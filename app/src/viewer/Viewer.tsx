import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPdf, renderPage, type PDFHandle } from "../pdf/engine";
import type { DocMeta } from "../screens/Home";
import { Glyph, type GlyphName } from "../ui/kit";

type ToolId =
  | "pan"
  | "select"
  | "freeform"
  | "shapes"
  | "review"
  | "measure"
  | "insert"
  | "library";

const TOOLBAR: { id: ToolId; label: string; glyph?: GlyphName }[] = [
  { id: "pan", label: "", glyph: "pan" },
  { id: "select", label: "", glyph: "select" },
  { id: "freeform", label: "Free-form", glyph: "pen" },
  { id: "shapes", label: "Shapes", glyph: "shapes" },
  { id: "review", label: "Review", glyph: "textreview" },
  { id: "measure", label: "Measure", glyph: "measure" },
  { id: "insert", label: "Insert", glyph: "insert" },
  { id: "library", label: "", glyph: "pro" },
];

const RAIL_TOP: { glyph: GlyphName; label: string; badge?: string }[] = [
  { glyph: "pen", label: "Favorites", badge: "12" },
  { glyph: "insert", label: "Documents" },
  { glyph: "more", label: "More" },
];

const RAIL_MID: { glyph: GlyphName; label: string }[] = [
  { glyph: "shapes", label: "Pages" },
  { glyph: "select", label: "Outline" },
];

const RAIL_BOTTOM: { glyph: GlyphName; label: string }[] = [
  { glyph: "insert", label: "Notes" },
  { glyph: "pro", label: "Shortcuts" },
  { glyph: "measure", label: "Settings" },
];

const FLYOUT_CHIPS: { glyph: GlyphName; cat: string; count?: number }[] = [
  { glyph: "pen", cat: "cat-select", count: 12 },
  { glyph: "highlighter", cat: "cat-draw", count: 20 },
  { glyph: "eraser", cat: "cat-insert", count: 10 },
  { glyph: "shapes", cat: "cat-select", count: 12 },
  { glyph: "textreview", cat: "cat-pro" },
  { glyph: "pen2", cat: "cat-select" },
  { glyph: "insert", cat: "cat-measure" },
];

const PAGE_GAP = 18;
const MAX_DPR = 1.5;

export default function Viewer({
  meta,
  onBack,
}: {
  meta: DocMeta;
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedRef = useRef<Set<number>>(new Set());
  const renderJobsRef = useRef<Map<number, Promise<void>>>(new Map());
  const pdfRef = useRef<PDFHandle | null>(null);
  const t0Ref = useRef<number>(performance.now());
  const fittedRef = useRef(false);

  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [tool, setTool] = useState<ToolId>("pan");
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [firstPaint, setFirstPaint] = useState<number | null>(null);
  const [err, setErr] = useState("");

  /* ---- load document ---- */
  useEffect(() => {
    let cancelled = false;
    renderedRef.current.clear();
    renderJobsRef.current.clear();
    (async () => {
      try {
        const handle = await openPdf(convertFileSrc(meta.id, "inkdesk"));
        if (cancelled) return;
        pdfRef.current = handle;
        setNumPages(handle.doc.numPages);
        const p1 = await handle.doc.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setBase({ w: vp.width, h: vp.height });
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
      pdfRef.current?.destroy().catch(() => {});
      pdfRef.current = null;
    };
  }, [meta.id]);

  /* ---- fit width on first layout ---- */
  useEffect(() => {
    if (!base || !scrollRef.current) return;
    const w = scrollRef.current.clientWidth - 56;
    setScale(w / base.w);
    fittedRef.current = true;
  }, [base]);

  /* ---- virtualized rendering ---- */
  const renderRange = useCallback(async () => {
    const handle = pdfRef.current;
    const scroll = scrollRef.current;
    if (!fittedRef.current || !handle || !base || !scroll) return;
    const doc = handle.doc;
    const pageH = base.h * scale;
    const pageW = base.w * scale;
    const firstVisible = Math.floor(scroll.scrollTop / (pageH + PAGE_GAP)) + 1;
    const visibleCount = Math.ceil(scroll.clientHeight / (pageH + PAGE_GAP)) + 1;
    const lo = Math.max(1, firstVisible - 1);
    const hi = Math.min(doc.numPages, firstVisible + visibleCount + 1);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    for (let n = lo; n <= hi; n++) {
      if (renderedRef.current.has(n) || renderJobsRef.current.has(n)) continue;
      const canvas = canvasRefs.current.get(n);
      if (!canvas) continue;
      const job = renderPage(doc, n, canvas, pageW, pageH, dpr)
        .then(() => {
          renderedRef.current.add(n);
          renderJobsRef.current.delete(n);
          if (n === 1 && firstPaint === null) {
            setFirstPaint(performance.now() - t0Ref.current);
          }
        })
        .catch(() => {
          renderJobsRef.current.delete(n);
        });
      renderJobsRef.current.set(n, job);
    }
    // drop pages outside the window (keep the two canvases, they get reused)
    for (const n of [...renderedRef.current]) {
      if (n < lo - 2 || n > hi + 2) renderedRef.current.delete(n);
    }
  }, [base, scale, firstPaint]);

  useEffect(() => {
    renderedRef.current.clear();
    for (const c of canvasRefs.current.values()) {
      const ctx = c.getContext("2d");
      ctx?.clearRect(0, 0, c.width, c.height);
    }
    renderRange();
  }, [scale, numPages, renderRange]);

  const onScroll = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll || !base) return;
    const pageH = base.h * scale + PAGE_GAP;
    setPage(Math.min(numPages, Math.floor(scroll.scrollTop / pageH) + 1));
    renderRange();
  }, [base, scale, numPages, renderRange]);

  /* ---- zoom via ctrl+wheel ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setScale((s) => Math.min(4, Math.max(0.25, s * (e.deltaY < 0 ? 1.1 : 0.9))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ---- pan drag ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || tool !== "pan") return;
    let dragging = false;
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      ox = el.scrollLeft;
      oy = el.scrollTop;
      el.classList.add("is-grabbing");
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      el.scrollLeft = ox - (e.clientX - sx);
      el.scrollTop = oy - (e.clientY - sy);
    };
    const up = () => {
      dragging = false;
      el.classList.remove("is-grabbing");
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [tool]);

  const goToPage = (n: number) => {
    const scroll = scrollRef.current;
    if (!scroll || !base) return;
    const clamped = Math.min(Math.max(1, n), numPages);
    scroll.scrollTop = (clamped - 1) * (base.h * scale + PAGE_GAP);
  };

  const pageW = base ? base.w * scale : 0;
  const pageH = base ? base.h * scale : 0;

  return (
    <div className="viewer">
      {/* tab bar */}
      <div className="tabbar">
        <button className="tabbar__home" onClick={onBack} title="Home">
          <Glyph name="insert" size={16} />
        </button>
        <div className="tab">
          <span className="tab__dot" />
          <span className="tab__name">{meta.title}</span>
          <button className="tab__close" onClick={onBack} aria-label="close tab">
            ×
          </button>
        </div>
        <button className="tabbar__plus" title="New tab — P5">
          +
        </button>
        <div className="tabbar__spacer" />
        <span className="tabbar__meta">
          {numPages > 0 ? `${numPages} pages · ${(meta.sizeBytes / 1e6).toFixed(1)} MB` : "loading…"}
        </span>
      </div>

      <div className="viewer__body">
        {/* left vertical rail */}
        <div className="rail">
          {RAIL_TOP.map((r) => (
            <button key={r.label} className="rail__btn" title={r.label}>
              <Glyph name={r.glyph} size={18} />
              {r.badge && <span className="rail__badge">{r.badge}</span>}
            </button>
          ))}
          <div className="rail__divider" />
          {RAIL_MID.map((r) => (
            <button key={r.label} className="rail__btn" title={r.label}>
              <Glyph name={r.glyph} size={18} />
            </button>
          ))}
          <div className="rail__spacer" />
          {RAIL_BOTTOM.map((r) => (
            <button key={r.label} className="rail__btn" title={r.label}>
              <Glyph name={r.glyph} size={18} />
            </button>
          ))}
        </div>

        {/* stage */}
        <div className="stage">
          {/* centered toolbar */}
          <div className="toolbar">
            {TOOLBAR.map((t) => (
              <button
                key={t.id}
                className={`toolbar__pill ${tool === t.id ? "is-active" : ""}`}
                onClick={() => setTool(t.id)}
                title={t.id}
              >
                <Glyph name={t.glyph ?? "pen"} size={17} />
                {t.label && <span>{t.label}</span>}
                {t.id === "select" && <span className="toolbar__caret">▾</span>}
                {t.id === "library" && <span className="toolbar__caret">▾</span>}
              </button>
            ))}
          </div>

          {/* canvas */}
          <div
            ref={scrollRef}
            className={`canvas-scroll ${tool === "pan" ? "is-pan" : ""}`}
            onScroll={onScroll}
          >
            <div className="pages" style={{ width: pageW || undefined }}>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <div
                  key={n}
                  className="page-slot"
                  style={{ height: pageH || 400, marginTop: n === 1 ? 24 : 0 }}
                >
                  <canvas
                    ref={(c) => {
                      if (c) canvasRefs.current.set(n, c);
                      else canvasRefs.current.delete(n);
                    }}
                  />
                  {!renderedRef.current.has(n) && (
                    <span className="page-slot__num">{n}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* bottom-left: undo / redo */}
          <div className="corner corner--bl">
            <button className="round-btn" disabled title="Undo — P8">
              <Glyph name="pen2" size={16} />
            </button>
            <button className="round-btn round-btn--dim" disabled title="Redo — P8">
              <Glyph name="pen2" size={16} />
            </button>
          </div>

          {/* bottom-right: page nav + zoom */}
          <div className="corner corner--br">
            <div className="page-chip">
              <button onClick={() => goToPage(page - 1)} aria-label="previous page">
                ‹
              </button>
              <b>{page}</b>
              <span>of {numPages || "…"}</span>
              <button onClick={() => goToPage(page + 1)} aria-label="next page">
                ›
              </button>
              <span className="page-chip__divider" />
              <button title="Pages grid — P16">
                <Glyph name="shapes" size={15} />
              </button>
            </div>
            <div className="zoom-chip">
              <button onClick={() => setScale((s) => Math.max(0.25, s * 0.9))}>−</button>
              <b>{Math.round(scale * 100)}%</b>
              <button onClick={() => setScale((s) => Math.min(4, s * 1.1))}>+</button>
            </div>
          </div>

          {/* right favorites flyout */}
          <button
            className={`flyout-handle ${flyoutOpen ? "is-open" : ""}`}
            onClick={() => setFlyoutOpen((v) => !v)}
            aria-label="favorites flyout"
          >
            <Glyph name="select" size={16} />
          </button>
          <div className={`flyout ${flyoutOpen ? "is-open" : ""}`}>
            <button className="flyout__star" title="Pin">
              <Glyph name="pro" size={16} />
            </button>
            {FLYOUT_CHIPS.map((c, i) => (
              <button key={i} className="flyout__chip" style={{ background: `var(--${c.cat})` }}>
                <Glyph name={c.glyph} size={18} />
                {c.count !== undefined && <span className="flyout__count">{c.count}</span>}
              </button>
            ))}
            <button className="flyout__add" title="Add tool — P10">
              +
            </button>
          </div>

          {err && <div className="viewer__error">{err}</div>}
          {firstPaint !== null && (
            <div className="perf-chip">first page: {Math.round(firstPaint)} ms</div>
          )}
        </div>
      </div>
    </div>
  );
}
