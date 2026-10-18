import { PDFDocument, rgb } from "pdf-lib";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { Annotation, ShapeGeometry, ReviewGeometry } from "./ink";
import { annStore, strokePath2D, drawShape, drawTextReview, uid } from "./ink";
import { putAnn, delAnn } from "./annDb";
import { drawObject, imageCache } from "./annRender";

export function editedPath(originalPath: string, suffix: string): string {
  const i = originalPath.toLowerCase().lastIndexOf(".pdf");
  const base = i >= 0 ? originalPath.slice(0, i) : originalPath;
  return `${base} (${suffix}).pdf`;
}

export async function fetchDocBytes(docId: string): Promise<Uint8Array> {
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  const url = convertFileSrc(docId, "inkdesk");
  const res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  await invoke("write_file", { path, bytes: Array.from(bytes) });
}

export interface PageOpResult {
  newPath: string;
  newId: string;
  pageMap: (number | null)[]; // old 0-based index -> new index (null = removed)
}

/** Apply page manipulations to a COPY of the document; returns the new file. */
export async function applyPageOps(
  docId: string,
  originalPath: string,
  ops: {
    order: number[]; // new sequence of old 0-based indices; -1 = insert blank here
    rotations: Record<number, number>; // old index -> extra 90s
  },
): Promise<PageOpResult> {
  const bytes = await fetchDocBytes(docId);
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const realIdx = ops.order.filter((i) => i >= 0);
  const copied = await out.copyPages(src, realIdx);
  let ci = 0;
  let lastW = 595, lastH = 842;
  for (const oldIdx of ops.order) {
    if (oldIdx === -1) {
      out.addPage([lastW, lastH]);
      continue;
    }
    const p = copied[ci++];
    const extra = (ops.rotations[oldIdx] ?? 0) * 90;
    if (extra) p.setRotation(((p.getRotation().angle + extra) % 360) as never);
    out.addPage(p);
    const sz = p.getSize();
    lastW = sz.width;
    lastH = sz.height;
  }

  const pageMap: (number | null)[] = new Array(src.getPageCount()).fill(null);
  ops.order.forEach((oldIdx, newIdx) => {
    pageMap[oldIdx] = newIdx;
  });

  const newPath = editedPath(originalPath, "edited");
  const outBytes = await out.save();
  await writeBytes(newPath, outBytes);

  // register the new file and get an id
  const res = await invoke<string>("doc_register", { path: newPath });
  const newId = res.split(":")[0];

  // remap annotations in store + DB
  for (const [, list] of Object.entries({})) void list; // noop guard
  const byId = new Map<string, Annotation>();
  for (const a of annStore.docAnns(docId)) byId.set(a.id, a);
  for (const [oldIdx, newIdx] of pageMap.entries()) {
    for (const a of byId.values()) {
      if (a.page !== oldIdx || newIdx === null) continue;
      if (newIdx !== a.page) {
        const moved = { ...a, page: newIdx };
        annStore.update(moved, false);
        await putAnn(moved).catch(() => {});
      }
    }
  }
  // drop annotations on removed pages
  for (const a of byId.values()) {
    if (pageMap[a.page] === null) {
      annStore.remove(a, false);
      await delAnn(a.id).catch(() => {});
    }
  }

  return { newPath, newId, pageMap };
}

/** Create a fresh blank/template document; returns the new file. */
export async function createBlankDoc(opts: {
  dir: string; // target folder
  pages: number;
  size: [number, number];
  color: { r: number; g: number; b: number };
  template: "blank" | "grid" | "lines" | "dots";
  title: string;
}): Promise<string> {
  const doc = await PDFDocument.create();
  const [w, h] = opts.size;
  const bg = rgb(opts.color.r, opts.color.g, opts.color.b);
  const lineC = rgb(0.72, 0.76, 0.82);
  for (let i = 0; i < opts.pages; i++) {
    const page = doc.addPage([w, h]);
    page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: bg });
    if (opts.template !== "blank") {
      const step = 24;
      if (opts.template === "lines" || opts.template === "grid") {
        for (let y = step; y < h; y += step) {
          page.drawLine({ start: { x: 0, y }, end: { x: w, y }, thickness: 0.4, color: lineC });
        }
      }
      if (opts.template === "grid" || opts.template === "dots") {
        for (let x = step; x < w; x += step) {
          if (opts.template === "grid") {
            page.drawLine({ start: { x, y: 0 }, end: { x, y: h }, thickness: 0.4, color: lineC });
          } else {
            for (let y = step; y < h; y += step) {
              page.drawCircle({ x, y, size: 0.7, color: lineC });
            }
          }
        }
      }
    }
  }
  const bytes = await doc.save();
  let path = `${opts.dir}\\${opts.title}.pdf`;
  let n = 1;
  // ensure unique
  const probe = async (p: string) => invoke<boolean>("file_exists", { path: p });
  while (await probe(path)) {
    path = `${opts.dir}\\${opts.title} (${n}).pdf`;
    n++;
  }
  await writeBytes(path, bytes);
  return path;
}

/* ---------- P20: flatten annotated copy ---------- */

export async function flattenDoc(
  docId: string,
  originalPath: string,
  anns: Annotation[],
  opts: { dpi: number; onlyPages?: number[]; suffix: string },
): Promise<{ path: string; bytes: number }> {
  const bytes = await fetchDocBytes(docId);
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  const { openPdf } = await import("../pdf/engine");
  const srcForRender = await openPdf(convertFileSrc(docId, "inkdesk"));

  const pageCount = src.getPageCount();
  const pages = opts.onlyPages ?? Array.from({ length: pageCount }, (_, i) => i);
  const dpr = opts.dpi / 72;

  for (const oldIdx of pages) {
    const [page] = await out.copyPages(src, [oldIdx]);
    out.addPage(page);
    const pageAnns = anns.filter((a) => a.page === oldIdx);
    if (pageAnns.length === 0) continue;

    const pdfPage = await srcForRender.doc.getPage(oldIdx + 1);
    const baseVp = pdfPage.getViewport({ scale: 1 });
    const cw = Math.floor(baseVp.width * dpr);
    const ch = Math.floor(baseVp.height * dpr);
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    for (const a of pageAnns) {
      const st = a.style;
      if (a.type === "ink" || a.type === "highlighter" || a.type === "signature") {
        const pts = (a.geometry as { points: number[][] }).points;
        if (!pts) continue;
        const path = strokePath2D(pts, st, 1, a.type === "highlighter", false);
        ctx.globalAlpha = st.opacity;
        ctx.fillStyle = st.color;
        ctx.fill(path);
        ctx.globalAlpha = 1;
      } else if (a.type === "shape") {
        drawShape(ctx, a.geometry as ShapeGeometry, st, 1);
      } else if (a.type === "text_review") {
        drawTextReview(ctx, a.geometry as ReviewGeometry, st, 1);
      } else {
        drawObject(ctx, a, 1, imageCache);
      }
    }
    const png = await c.toDataURL("image/png");
    const embedded = await out.embedPng(png);
    page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }

  srcForRender.destroy().catch(() => {});
  const outBytes = await out.save();
  const path = editedPath(originalPath, opts.suffix);
  await writeBytes(path, outBytes);
  return { path, bytes: outBytes.length };
}

/** export text-review annotations as txt or csv */
export function textReviewExport(anns: Annotation[]): { txt: string; csv: string } {
  const rows = anns
    .filter((a) => a.type === "text_review")
    .map((a) => {
      const g = a.geometry as ReviewGeometry;
      return { page: a.page + 1, style: g.style, text: String(a.data?.text ?? g.text ?? "") };
    });
  const txt = rows.map((r) => `[p.${r.page}] (${r.style}) ${r.text}`).join("\n");
  const esc = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  const csv = "page,style,quote\n" + rows.map((r) => `${r.page},${r.style},${esc(r.text)}`).join("\n");
  return { txt, csv };
}

export function origDir(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i >= 0 ? path.slice(0, i) : ".";
}

/* ---------- P22: document builder (merge) ---------- */
export async function mergeDocs(
  sources: { docId: string; path: string }[],
  outDir: string,
): Promise<string> {
  const out = await PDFDocument.create();
  for (const src of sources) {
    const bytes = await fetchDocBytes(src.docId);
    const doc = await PDFDocument.load(bytes);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const bytes = await out.save();
  const path = `${outDir}\\merged ${Date.now() % 100000}.pdf`;
  await writeBytes(path, bytes);
  return path;
}

/** migrate annotations of a merged source doc into the merged doc with page offset */
export async function migrateAnns(
  sourceDocId: string,
  newDocId: string,
  pageOffset: number,
): Promise<void> {
  const { loadAnns } = await import("./annDb");
  const anns = await loadAnns(sourceDocId);
  for (const a of anns) {
    const copy: Annotation = {
      ...a,
      id: uid(),
      docId: newDocId,
      page: a.page + pageOffset,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };
    annStore.add(copy, false);
    await putAnn(copy).catch(() => {});
  }
}
