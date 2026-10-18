import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPdf, renderPage, type PDFHandle } from "../pdf/engine";
import type { DocMeta } from "../screens/Home";
import {
  Glyph,
  SubTool,
  ColorChip,
  WidthPreview,
  type GlyphName,
} from "../ui/kit";
import {
  annStore,
  uid,
  strokePath2D,
  DEFAULT_TOOL,
  type Annotation,
  type ToolState,
} from "../lib/ink";
import { loadAnns, putAnn, delAnn, syncOp } from "../lib/annDb";

type ToolId =
  | "pan" | "select" | "freeform" | "shapes" | "review"
  | "measure" | "insert" | "library";

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

const INK_COLORS = ["#ff4d4d", "#2f6bff", "#1e1f24", "#58c770", "#f2b23e", "#a06bff"];
const PAGE_GAP = 18;
const MAX_DPR = 1.5;

export default function Viewer({
  meta, tabs, night, layout, touchDraw,
  onSelectTab, onCloseTab, onAddTab, onToggleNight, onOpenSettings, onBack,
}: {
  meta: DocMeta;
  tabs: DocMeta[];
  night: boolean;
  layout: "continuous" | "single";
  touchDraw: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
  onToggleNight: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const dryRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const wetRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedRef = useRef<Set<number>>(new Set());
  const renderJobsRef = useRef<Map<number, Promise<void>>>(new Map());
  const pdfRef = useRef<PDFHandle | null>(null);
  const t0Ref = useRef<number>(performance.now());
  const fittedRef = useRef(false);
  const historyRef = useRef<{ stack: number[]; idx: number }>({ stack: [1], idx: 0 });

  // active drawing state
  const [toolState, setToolState] = useState<ToolState>({ ...DEFAULT_TOOL });
  const toolRef = useRef<ToolState>(toolState);
  toolRef.current = toolState;
  const strokeRef = useRef<{ pts: number[][]; dirty: boolean } | null>(null);
  const rafRef = useRef(0);

  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [tool, setTool] = useState<ToolId>("pan");
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [firstPaint, setFirstPaint] = useState<number | null>(null);
  const [err, setErr] = useState("");

  // ink store subscription (re-render on any annotation change)
  useSyncExternalStore(
    (cb) => annStore.subscribe(cb),
    () => annStore.version,
  );

  /* ---- load document + its annotations ---- */
  useEffect(() => {
    let cancelled = false;
    renderedRef.current.clear();
    renderJobsRef.current.clear();
    fittedRef.current = false;
    historyRef.current = { stack: [1], idx: 0 };
    (async () => {
      try {
        const handle = await openPdf(convertFileSrc(meta.id, "inkdesk"));
        if (cancelled) return;
        pdfRef.current = handle;
        setNumPages(handle.doc.numPages);
        const p1 = await handle.doc.getPage(1);
        const vp = p1.getViewport({ scale: 1 });
        setBase({ w: vp.width, h: vp.height });
        const anns = await loadAnns(meta.id).catch(() => []);
        if (!cancelled) annStore.loadDoc(meta.id, anns);
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

  /* ---- draw all committed annotations of one page onto its dry canvas ---- */
  const redrawDry = useCallback((n: number) => {
    const dry = dryRefs.current.get(n);
    if (!dry || !base) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = base.w * scale;
    const h = base.h * scale;
    if (dry.width !== Math.floor(w * dpr) || dry.height !== Math.floor(h * dpr)) {
      dry.width = Math.floor(w * dpr);
      dry.height = Math.floor(h * dpr);
    }
    dry.style.width = `${w}px`;
    dry.style.height = `${h}px`;
    const ctx = dry.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const ann of annStore.pageAnns(meta.id, n - 1)) {
      if (ann.type === "ink" || ann.type === "highlighter") {
        const pts = (ann.geometry as { points: number[][] }).points;
        if (!pts || pts.length === 0) continue;
        const path = strokePath2D(pts, ann.style, scale, ann.type === "highlighter");
        ctx.globalAlpha = ann.style.opacity;
        ctx.fillStyle = ann.style.color;
        ctx.fill(path);
        ctx.globalAlpha = 1;
      }
    }
  }, [base, scale, meta.id]);

  // redraw all visible dry overlays on store/scale change
  useEffect(() => {
    for (const n of [...renderedRef.current]) redrawDry(n);
  }, [annStore.version, scale, redrawDry]);

  /* ---- wet stroke painting (current stroke only, rAF-throttled) ---- */
  const paintWet = useCallback(() => {
    const cur = strokeRef.current;
    if (!cur) return;
    const n = page;
    const wet = wetRefs.current.get(n);
    if (!wet || !base) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = base.w * scale;
    const h = base.h * scale;
    if (wet.width !== Math.floor(w * dpr) || wet.height !== Math.floor(h * dpr)) {
      wet.width = Math.floor(w * dpr);
      wet.height = Math.floor(h * dpr);
    }
    wet.style.width = `${w}px`;
    wet.style.height = `${h}px`;
    const ctx = wet.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const st = toolRef.current;
    const path = strokePath2D(cur.pts, st, scale, st.tool === "highlighter");
    ctx.globalAlpha = st.tool === "highlighter" ? 0.45 : st.opacity;
    ctx.fillStyle = st.color;
    ctx.fill(path);
    ctx.globalAlpha = 1;
    cur.dirty = false;
  }, [base, scale, page]);

  const scheduleWet = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      paintWet();
    });
  }, [paintWet]);

  /* ---- pointer drawing on overlay ---- */
  const onOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>, n: number) => {
    const st = toolRef.current;
    const isPen = e.pointerType === "pen";
    const isMouse = e.pointerType === "mouse";
    const touchWantsDraw = e.pointerType === "touch" && touchDraw;
    const drawTool = toolRefDrawing();
    if (e.pointerType === "touch" && !touchWantsDraw) return; // let the browser pan/scroll
    if (!(isPen || isMouse || touchWantsDraw)) return;

    if (st.tool === "eraser") {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      const hit = annStore.eraseAt(meta.id, n - 1, x, y, Math.max(6, st.width * 2.2));
      if (hit) void delAnn(hit.id).catch(() => {});
      return;
    }
    if (!drawTool) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const pressure = isPen && e.pressure > 0 ? e.pressure : isMouse ? 0.5 : e.pressure || 0.5;
    strokeRef.current = {
      pts: [[(e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale, pressure * 2]],
      dirty: true,
    };
    scheduleWet();
  };

  const onOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cur = strokeRef.current;
    if (!cur) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const isPen = e.pointerType === "pen" && e.pressure > 0;
    const pressure = isPen ? e.pressure : e.pointerType === "mouse" ? 0.5 : 0.5;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function"
      ? e.nativeEvent.getCoalescedEvents()
      : [];
    if (events.length > 0) {
      for (const ce of events) {
        cur.pts.push([(ce.clientX - rect.left) / scale, (ce.clientY - rect.top) / scale, pressure * 2]);
      }
    } else {
      cur.pts.push([(e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale, pressure * 2]);
    }
    cur.dirty = true;
    scheduleWet();
  };

  const onOverlayPointerUp = (e: React.PointerEvent<HTMLDivElement>, n: number) => {
    const cur = strokeRef.current;
    if (!cur) return;
    e.preventDefault();
    strokeRef.current = null;
    const wet = wetRefs.current.get(n);
    const wctx = wet?.getContext("2d");
    if (wctx && wet) wctx.clearRect(0, 0, wet.width, wet.height);
    if (cur.pts.length < 2) return; // tap = ignore for now
    const st = toolRef.current;
    const ann: Annotation = {
      id: uid(),
      docId: meta.id,
      page: n - 1,
      type: st.tool === "highlighter" ? "highlighter" : "ink",
      geometry: { points: cur.pts },
      style: { color: st.color, width: st.width, opacity: st.tool === "highlighter" ? 0.45 : st.opacity },
      z: Date.now() % 1e9,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };
    annStore.add(ann);
    void putAnn(ann).catch((e2) => console.warn("ann put:", e2));
  };

  function toolRefDrawing(): boolean {
    // pen/highlighter draw via freeform; eraser handled separately
    const t = toolRef.current.tool;
    return t === "pen" || t === "highlighter";
  }

  /* ---- undo/redo (store + DB sync) ---- */
  const doUndo = useCallback(() => {
    const op = annStore.undo(meta.id);
    if (op) void syncOp(op, true).catch(() => {});
  }, [meta.id]);
  const doRedo = useCallback(() => {
    const op = annStore.redo(meta.id);
    if (op) void syncOp(op, true).catch(() => {});
  }, [meta.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo]);

  /* ---- render pdf pages (virtualized) ---- */
  const renderRange = useCallback(async () => {
    const handle = pdfRef.current;
    const scroll = scrollRef.current;
    if (!fittedRef.current || !handle || !base || !scroll) return;
    const doc = handle.doc;
    const pageH = base.h * scale;
    const pageW = base.w * scale;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    let lo: number;
    let hi: number;
    if (layout === "single") {
      lo = hi = page;
    } else {
      const firstVisible = Math.floor(scroll.scrollTop / (pageH + PAGE_GAP)) + 1;
      const visibleCount = Math.ceil(scroll.clientHeight / (pageH + PAGE_GAP)) + 1;
      lo = Math.max(1, firstVisible - 1);
      hi = Math.min(doc.numPages, firstVisible + visibleCount + 1);
    }

    for (let n = lo; n <= hi; n++) {
      if (renderedRef.current.has(n) || renderJobsRef.current.has(n)) continue;
      const canvas = canvasRefs.current.get(n);
      if (!canvas) continue;
      const job = renderPage(doc, n, canvas, pageW, pageH, dpr)
        .then(() => {
          renderedRef.current.add(n);
          renderJobsRef.current.delete(n);
          redrawDry(n);
          if (n === 1 && firstPaint === null) {
            setFirstPaint(performance.now() - t0Ref.current);
          }
        })
        .catch(() => {
          renderJobsRef.current.delete(n);
        });
      renderJobsRef.current.set(n, job);
    }
    for (const n of [...renderedRef.current]) {
      if (n < lo - 2 || n > hi + 2) renderedRef.current.delete(n);
    }
  }, [base, scale, firstPaint, layout, page, redrawDry]);

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
    if (!scroll || !base || layout === "single") return;
    const pageH = base.h * scale + PAGE_GAP;
    setPage(Math.min(numPages, Math.floor(scroll.scrollTop / pageH) + 1));
    renderRange();
  }, [base, scale, numPages, layout, renderRange]);

  /* dev: 'b' toggles free-form / pan */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "b" || e.key === "B") setTool((t) => (t === "freeform" ? "pan" : "freeform"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  /* ---- pan drag (hand tool) ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || tool !== "pan") return;
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    const down = (e: PointerEvent) => {
      dragging = true; sx = e.clientX; sy = e.clientY; ox = el.scrollLeft; oy = el.scrollTop;
      el.classList.add("is-grabbing");
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      el.scrollLeft = ox - (e.clientX - sx);
      el.scrollTop = oy - (e.clientY - sy);
    };
    const up = () => { dragging = false; el.classList.remove("is-grabbing"); };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [tool]);

  const goToPage = (n: number, pushHistory = true) => {
    const scroll = scrollRef.current;
    if (!scroll || !base) return;
    const clamped = Math.min(Math.max(1, n), numPages);
    if (layout === "single") setPage(clamped);
    else scroll.scrollTop = (clamped - 1) * (base.h * scale + PAGE_GAP);
    if (pushHistory) {
      const h = historyRef.current;
      h.stack = h.stack.slice(0, h.idx + 1);
      h.stack.push(clamped);
      h.idx = h.stack.length - 1;
    }
  };

  const historyJump = (dir: -1 | 1) => {
    const h = historyRef.current;
    const next = h.idx + dir;
    if (next < 0 || next >= h.stack.length) return;
    h.idx = next;
    goToPage(h.stack[next], false);
  };

  const pageW = base ? base.w * scale : 0;
  const pageH = base ? base.h * scale : 0;
  const shownPages = layout === "single" ? [page] : Array.from({ length: numPages }, (_, i) => i + 1);
  const canUndo = annStore.canUndo(meta.id);
  const canRedo = annStore.canRedo(meta.id);

  return (
    <div className="viewer">
      {/* tab bar */}
      <div className="tabbar">
        <button className="tabbar__home" onClick={onBack} title="Home">
          <Glyph name="insert" size={16} />
        </button>
        <div className="tabs">
          {tabs.map((t) => (
            <div key={t.id} className={`tab ${t.id === meta.id ? "is-active" : ""}`} onClick={() => onSelectTab(t.id)}>
              <span className="tab__dot" />
              <span className="tab__name">{t.title}</span>
              <button className="tab__close" onClick={(e) => { e.stopPropagation(); onCloseTab(t.id); }} aria-label="close tab">×</button>
            </div>
          ))}
          <button className="tabbar__plus" onClick={onAddTab} title="Open another document">+</button>
        </div>
        <div className="tabbar__spacer" />
        <button className={`tabbar__icon ${night ? "is-active" : ""}`} onClick={onToggleNight} title="Night mode (M)">
          {night ? "☀" : "☾"}
        </button>
        <button className="tabbar__icon" onClick={onOpenSettings} title="Settings">
          <Glyph name="measure" size={15} />
        </button>
        <span className="tabbar__meta">
          {numPages > 0 ? `${numPages} pages · ${(meta.sizeBytes / 1e6).toFixed(1)} MB` : "loading…"}
        </span>
      </div>

      <div className="viewer__body">
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
            <button key={r.label} className="rail__btn" title={r.label}
              onClick={r.label === "Settings" ? onOpenSettings : undefined}>
              <Glyph name={r.glyph} size={18} />
            </button>
          ))}
        </div>

        <div className="stage">
          <div className="toolbar">
            {TOOLBAR.map((t) => (
              <button key={t.id}
                className={`toolbar__pill ${tool === t.id ? "is-active" : ""}`}
                onClick={() => {
                  setTool(t.id);
                  if (t.id === "freeform" && toolState.tool === "eraser") setToolState({ ...toolState, tool: "pen" });
                }}
                title={t.id}>
                <Glyph name={t.glyph ?? "pen"} size={17} />
                {t.label && <span>{t.label}</span>}
                {t.id === "select" && <span className="toolbar__caret">▾</span>}
                {t.id === "library" && <span className="toolbar__caret">▾</span>}
              </button>
            ))}
          </div>

          {/* free-form expanded subrow (colors + widths + eraser) */}
          {tool === "freeform" && (
            <div className="subrow under-toolbar">
              <SubTool glyph="pen" label="" active={toolState.tool === "pen"} />
              <SubTool glyph="highlighter" label="" active={toolState.tool === "highlighter"} />
              <SubTool glyph="eraser" label="" active={toolState.tool === "eraser"} />
              {INK_COLORS.map((c) => (
                <ColorChip key={c} color={c} selected={toolState.color === c}
                  onClickOverride={() => setToolState({ ...toolState, color: c })} />
              ))}
              <WidthPreview width={1.4} label="" selected={toolState.width <= 3}
                onClickOverride={() => setToolState({ ...toolState, width: 2 })} />
              <WidthPreview width={4.5} label="" selected={toolState.width > 3}
                onClickOverride={() => setToolState({ ...toolState, width: 6 })} />
              <button className="width-chip" style={{ background: toolState.color }}>
                {toolState.width} ▾
              </button>
            </div>
          )}

          <div ref={scrollRef} className={`canvas-scroll ${tool === "pan" ? "is-pan" : ""}`} onScroll={onScroll}>
            <div className={`pages ${night ? "night" : ""}`} style={{ width: pageW || undefined }}>
              {shownPages.map((n) => (
                <div key={n} className="page-slot" style={{ height: pageH || 400, marginTop: n === 1 ? 24 : 0 }}>
                  <canvas ref={(c) => { if (c) canvasRefs.current.set(n, c); else canvasRefs.current.delete(n); }} />
                  <canvas className="dry-canvas" ref={(c) => { if (c) dryRefs.current.set(n, c); else dryRefs.current.delete(n); }} />
                  <canvas className="wet-canvas" ref={(c) => { if (c) wetRefs.current.set(n, c); else wetRefs.current.delete(n); }} />
                  <div
                    className="ink-overlay"
                    onPointerDown={(e) => onOverlayPointerDown(e, n)}
                    onPointerMove={onOverlayPointerMove}
                    onPointerUp={(e) => onOverlayPointerUp(e, n)}
                    onPointerCancel={(e) => onOverlayPointerUp(e, n)}
                  />
                  {!renderedRef.current.has(n) && <span className="page-slot__num">{n}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="corner corner--bl">
            <button className="round-btn" disabled={!canUndo} onClick={doUndo} title="Undo (Ctrl+Z)">
              <Glyph name="pen2" size={16} />
            </button>
            <button className={`round-btn ${canRedo ? "" : "round-btn--dim"}`} disabled={!canRedo} onClick={doRedo} title="Redo (Ctrl+Y)">
              <Glyph name="pen2" size={16} />
            </button>
          </div>

          <div className="corner corner--br">
            <div className="page-chip">
              <button onClick={() => historyJump(-1)} title="Back">↩</button>
              <button onClick={() => historyJump(1)} title="Forward">↪</button>
              <button onClick={() => goToPage(page - 1)} aria-label="previous page">‹</button>
              <b>{page}</b>
              <span>of {numPages || "…"}</span>
              <button onClick={() => goToPage(page + 1)} aria-label="next page">›</button>
              <span className="page-chip__divider" />
              <button title="Pages grid — P16"><Glyph name="shapes" size={15} /></button>
            </div>
            <div className="zoom-chip">
              <button onClick={() => setScale((s) => Math.max(0.25, s * 0.9))}>−</button>
              <b>{Math.round(scale * 100)}%</b>
              <button onClick={() => setScale((s) => Math.min(4, s * 1.1))}>+</button>
            </div>
          </div>

          <button className={`flyout-handle ${flyoutOpen ? "is-open" : ""}`} onClick={() => setFlyoutOpen((v) => !v)} aria-label="favorites flyout">
            <Glyph name="select" size={16} />
          </button>
          <div className={`flyout ${flyoutOpen ? "is-open" : ""}`}>
            <button className="flyout__star" title="Pin"><Glyph name="pro" size={16} /></button>
            {FLYOUT_CHIPS.map((c, i) => (
              <button key={i} className="flyout__chip" style={{ background: `var(--${c.cat})` }}>
                <Glyph name={c.glyph} size={18} />
                {c.count !== undefined && <span className="flyout__count">{c.count}</span>}
              </button>
            ))}
            <button className="flyout__add" title="Add tool — P10">+</button>
          </div>

          {err && <div className="viewer__error">{err}</div>}
          {firstPaint !== null && <div className="perf-chip">first page: {Math.round(firstPaint)} ms</div>}
        </div>
      </div>
    </div>
  );
}
