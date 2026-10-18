import * as pdfjs from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy };

export interface PDFHandle {
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
}

export async function openPdf(url: string): Promise<PDFHandle> {
  const task = pdfjs.getDocument({ url });
  const doc = await task.promise;
  return {
    doc,
    destroy: () => task.destroy().then(() => undefined),
  };
}

export interface PageSize {
  width: number;
  height: number;
}

export async function getPageSize(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<PageSize> {
  const page = await doc.getPage(pageNumber);
  const vp = page.getViewport({ scale: 1 });
  return { width: vp.width, height: vp.height };
}

/** Render one page onto a canvas at cssScale * devicePixelRatio. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): Promise<void> {
  const page = await doc.getPage(pageNumber);
  const scale = (cssWidth / page.getViewport({ scale: 1 }).width) * 1;
  const viewport = page.getViewport({ scale: scale * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
}

/** Render the invisible selectable text layer into a container. */
export async function renderTextLayer(
  page: PDFPageProxy,
  container: HTMLDivElement,
  cssWidth: number,
): Promise<void> {
  const baseVp = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: cssWidth / baseVp.width });
  container.replaceChildren();
  container.style.setProperty("--scale-factor", String(viewport.scale));
  const tl = new TextLayer({
    textContentSource: page.streamTextContent({ includeMarkedContent: false }),
    container,
    viewport,
  });
  await tl.render();
}
