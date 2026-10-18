import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPdf, renderPage, renderTextLayer, type PDFHandle } from "../pdf/engine";
import type { DocMeta } from "../screens/Home";
import {
  Glyph,
  SubTool,
  ColorChip,
  WidthPreview,
  RadialMenu,
  type GlyphName,
} from "../ui/kit";
import { loadFavorites, saveFavorites, type Favorite } from "../lib/favorites";
import {
  annStore,
  uid,
  strokePath2D,
  drawShape,
  drawTextReview,
  DEFAULT_TOOL,
  type Annotation,
  type ToolState,
  type ShapeKind,
  type ShapeGeometry,
  type ReviewStyle,
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

const RAIL_TOP: { glyph: GlyphName; label: string }[] = [
  { glyph: "pen", label: "Favorites" },
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

const INK_COLORS = ["#ff4d4d", "#2f6bff", "#1e1f24", "#58c770", "#f2b23e", "#a06bff"];
const PAGE_GAP = 18;
const MAX_DPR = 1.5;

export default function Viewer({
  meta, tabs, night, layout, touchDraw, radialOn,
  onSelectTab, onCloseTab, onAddTab, onToggleNight, onOpenSettings, onBack,
}: {
  meta: DocMeta;
  tabs: DocMeta[];
  night: boolean;
  layout: "continuous" | "single";
  touchDraw: boolean;
  radialOn: boolean;
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
  const textRefs = useRef<Map<number, HTMLDivElement>>(new Map());
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
  const strokeRef = useRef<{ pts: number[][]; dirty: boolean; isPen: boolean; lastDrawn: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const erasingRef = useRef(false);
  const rafRef = useRef(0);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [shapeDash, setShapeDash] = useState(false);
  const shapeRef = useRef<{ x0: number; y0: number; x1: number; y1: number; pts: number[][] } | null>(null);
  const [reviewStyle, setReviewStyle] = useState<ReviewStyle>("highlight");

  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [tool, setTool] = useState<ToolId>("pan");
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [firstPaint, setFirstPaint] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [radialPos, setRadialPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void loadFavorites().then(setFavs);
  }, []);

  const addFavorite = () => {
    const st = toolRef.current;
    if (st.tool === "eraser") return;
    const fav: Favorite = {
      id: uid(),
      tool: st.tool,
      color: st.color,
      width: st.width,
      opacity: st.opacity,
    };
    const next = [...favs, fav].slice(-12);
    setFavs(next);
    void saveFavorites(next).catch(() => {});
  };

  const removeFavorite = (id: string) => {
    const next = favs.filter((f) => f.id !== id);
    setFavs(next);
    void saveFavorites(next).catch(() => {});
  };

  const applyFavorite = (f: Favorite) => {
    setTool("freeform");
    setToolState({ tool: f.tool, color: f.color, width: f.width, opacity: f.opacity });
  };

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
      } else if (ann.type === "shape") {
        drawShape(ctx, ann.geometry as ShapeGeometry, ann.style, scale);
      } else if (ann.type === "text_review") {
        drawTextReview(ctx, ann.geometry as import("../lib/ink").ReviewGeometry, ann.style, scale);
      }
    }
  }, [base, scale, meta.id]);

  // redraw all visible dry overlays on store/scale change
  useEffect(() => {
    for (const n of [...renderedRef.current]) redrawDry(n);
  }, [annStore.version, scale, redrawDry]);

  /* ---- wet stroke painting: INCREMENTAL (only new segments per frame) ---- */
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
    const st = toolRef.current;
    if (shapeRef.current) {
      // shapes: rebuild preview (cheap, few points)
      ctx.clearRect(0, 0, w, h);
      const g: ShapeGeometry = {
        kind: shapeKind,
        x0: shapeRef.current.x0, y0: shapeRef.current.y0,
        x1: shapeRef.current.x1, y1: shapeRef.current.y1,
        pts: shapeRef.current.pts,
      };
      drawShape(ctx, g, { color: st.color, width: st.width, opacity: st.opacity, dash: shapeDash }, scale);
    } else {
      // full wet preview: clear + tapered outline of the current stroke
      ctx.clearRect(0, 0, w, h);
      const path = strokePath2D(cur.pts, st, scale, st.tool === "highlighter", !cur.isPen);
      ctx.globalAlpha = st.tool === "highlighter" ? 0.45 : st.opacity;
      ctx.fillStyle = st.color;
      ctx.fill(path);
      ctx.globalAlpha = 1;
    }
    cur.dirty = false;
  }, [base, scale, page]);

  const scheduleWet = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      paintWet();
    });
  }, [paintWet]);

  const shapeActive = () => tool === "shapes";

  /* pen pressure clamped into a visible band — some tablets/drivers report 0 */
  const penPressure = (raw: number): number => {
    if (!raw || raw < 0.04) return 0.5;      // dead reporting -> constant width
    return Math.max(0.35, Math.min(1, raw)); // visible modulation
  };

  /* ---- text review: capture text-layer selection on mouseup ---- */
  useEffect(() => {
    if (tool !== "review") return;
    const onUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString();
      if (!text.trim()) return;
      // rects are viewport-relative; convert to first page-slot-local, then page units
      const range = sel.getRangeAt(0);
      const rects = [...range.getClientRects()];
      if (rects.length === 0) return;
      // find the page slot containing the first rect
      const slot = rects[0].top >= 0 ? (rects[0].top as number) : 0;
      void slot;
      let overlay: HTMLElement | null = null;
      for (const el of document.querySelectorAll(".ink-overlay")) {
        const r = el.getBoundingClientRect();
        if (rects[0].left >= r.left - 2 && rects[0].right <= r.right + 2 && rects[0].top >= r.top - 2 && rects[0].bottom <= r.bottom + 200) {
          overlay = el as HTMLElement;
          break;
        }
      }
      if (!overlay) return;
      const pageSlot = overlay.parentElement as HTMLElement;
      const slotRect = pageSlot.getBoundingClientRect();
      // page index from slot position among slots
      const slots = [...document.querySelectorAll(".page-slot")];
      const pageIndex = slots.indexOf(pageSlot);
      if (pageIndex < 0) return;
      const pageRects = rects
        .filter((r) => {
          const rr = r;
          return rr.width > 1 && rr.height > 1;
        })
        .map((r) => [
          (r.left - slotRect.left) / scale,
          (r.top - slotRect.top) / scale,
          r.width / scale,
          r.height / scale,
        ]);
      if (pageRects.length === 0) return;
      const st = toolRef.current;
      const ann: Annotation = {
        id: uid(),
        docId: meta.id,
        page: pageIndex,
        type: "text_review",
        geometry: { rects: pageRects, style: reviewStyle, text },
        style: {
          color: reviewStyle === "highlight" ? "#f2e94e" : st.color,
          width: reviewStyle === "underline" ? 1.6 : reviewStyle === "squiggle" ? 1.4 : 1.8,
          opacity: 1,
        },
        z: Date.now() % 1e9,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };
      annStore.add(ann);
      void putAnn(ann).catch(() => {});
      sel.removeAllRanges();
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [tool, reviewStyle, scale, meta.id]);

  /* ---- pointer drawing on overlay ---- */
  const onOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>, n: number) => {
    const st = toolRef.current;
    const isPen = e.pointerType === "pen";
    const isMouse = e.pointerType === "mouse";
    const touchWantsDraw = e.pointerType === "touch" && touchDraw;
    const drawTool = toolRefDrawing();
    if (e.pointerType === "touch" && !touchWantsDraw) return; // let the browser pan/scroll
    if (!(isPen || isMouse || touchWantsDraw)) return;

    // pen barrel button = eraser; drawing/erasing only when the Free-form pill is active
    const barrelErase = isPen && (e.buttons & 32) !== 0;
    if ((tool === "freeform" && st.tool === "eraser") || (tool === "freeform" && barrelErase)) {
      e.preventDefault();
      erasingRef.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const radius = Math.max(8, st.width * 2.5);
      const eraseAt = (cx: number, cy: number) => {
        const x = (cx - rect.left) / scale;
        const y = (cy - rect.top) / scale;
        const hit = annStore.eraseAt(meta.id, n - 1, x, y, radius);
        if (hit) void delAnn(hit.id).catch(() => {});
      };
      eraseAt(e.clientX, e.clientY);
      const move = (ev: PointerEvent) => eraseAt(ev.clientX, ev.clientY);
      const up = () => {
        erasingRef.current = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      return;
    }
    if (!drawTool || tool !== "freeform") {
      // pan: any pointer pans when the pan tool is active, or touch when touch-pan mode
      if (tool === "pan" || (e.pointerType === "touch" && !touchDraw)) {
        e.preventDefault();
        const scroll = scrollRef.current;
        if (scroll) {
          panRef.current = { x: e.clientX, y: e.clientY, sl: scroll.scrollLeft, st: scroll.scrollTop };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
      }
      return;
    }

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;

    if (shapeActive()) {
      shapeRef.current = { x0: px, y0: py, x1: px, y1: py, pts: [[px, py]] };
      scheduleWet();
      return;
    }

    // pen pressure clamped into a visible band — some tablets/drivers report 0
    const pressure = isPen ? penPressure(e.pressure) : 0.5;
    strokeRef.current = {
      pts: [[px, py, pressure]],
      dirty: true,
      isPen,
      lastDrawn: 0,
    };
    scheduleWet();
  };

  const onOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const cur = strokeRef.current;
    const shp = shapeRef.current;
    if (!cur && !shp) return;
    e.preventDefault();
    if (shp) {
      const rect = e.currentTarget.getBoundingClientRect();
      shp.x1 = (e.clientX - rect.left) / scale;
      shp.y1 = (e.clientY - rect.top) / scale;
      shp.pts.push([shp.x1, shp.y1]);
      scheduleWet();
      return;
    }
    if (!cur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const events = typeof e.nativeEvent.getCoalescedEvents === "function"
      ? e.nativeEvent.getCoalescedEvents()
      : [];
    if (events.length > 0) {
      for (const ce of events) {
        cur.pts.push([(ce.clientX - rect.left) / scale, (ce.clientY - rect.top) / scale, penPressure(ce.pressure)]);
      }
    } else {
      cur.pts.push([(e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale, penPressure(e.pressure)]);
    }
    cur.dirty = true;
    scheduleWet();
  };

  const onOverlayPointerUp = (e: React.PointerEvent<HTMLDivElement>, n: number) => {
    erasingRef.current = false;
    if (e.pointerType === "touch" && panRef.current) {
      panRef.current = null;
      return;
    }
    const shp = shapeRef.current;
    if (shp) {
      e.preventDefault();
      shapeRef.current = null;
      const wet = wetRefs.current.get(n);
      const wctx = wet?.getContext("2d");
      if (wctx && wet) wctx.clearRect(0, 0, wet.width, wet.height);
      const st = toolRef.current;
      const ann: Annotation = {
        id: uid(),
        docId: meta.id,
        page: n - 1,
        type: "shape",
        geometry: {
          kind: shapeKind,
          x0: shp.x0, y0: shp.y0, x1: shp.x1, y1: shp.y1,
          pts: shapeKind === "polyline" || shapeKind === "polygon" ? shp.pts : undefined,
        },
        style: { color: st.color, width: st.width, opacity: st.opacity, dash: shapeDash },
        z: Date.now() % 1e9,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      };
      annStore.add(ann);
      void putAnn(ann).catch(() => {});
      return;
    }
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
        .then(async () => {
          renderedRef.current.add(n);
          renderJobsRef.current.delete(n);
          redrawDry(n);
          if (n === 1 && firstPaint === null) {
            setFirstPaint(performance.now() - t0Ref.current);
          }
          const tlDiv = textRefs.current.get(n);
          if (tlDiv) {
            const pg = await doc.getPage(n);
            await renderTextLayer(pg, tlDiv, pageW).catch(() => {});
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

  /* dev: 'r' opens radial at viewport center */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") setRadialPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      if (e.key === "Escape") setRadialPos(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            <button key={r.label} className="rail__btn" title={r.label}
              onClick={r.label === "Favorites" ? () => setFlyoutOpen((v) => !v) : undefined}>
              <Glyph name={r.glyph} size={18} />
              {r.label === "Favorites" && favs.length > 0 && (
                <span className="rail__badge">{favs.length}</span>
              )}
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

        <div
          className="stage"
          onContextMenu={(e) => {
            if (!radialOn) return;
            e.preventDefault();
            setRadialPos({ x: e.clientX, y: e.clientY });
          }}
        >
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

          {/* Review expanded subrow */}
          {tool === "review" && (
            <div className="subrow under-toolbar">
              <SubTool glyph="text" label="Text" />
              <SubTool glyph="callout" label="Callout" />
              <SubTool glyph="t_highlight" label="Highlight" active={reviewStyle === "highlight"} onClickOverride={() => setReviewStyle("highlight")} />
              <SubTool glyph="t_underline" label="Underline" active={reviewStyle === "underline"} onClickOverride={() => setReviewStyle("underline")} />
              <SubTool glyph="t_squiggle" label="Squiggle" active={reviewStyle === "squiggle"} onClickOverride={() => setReviewStyle("squiggle")} />
              <SubTool glyph="t_strike" label="Strike" active={reviewStyle === "strike"} onClickOverride={() => setReviewStyle("strike")} />
              <SubTool glyph="t_cleaner" label="Cleaner" title="click text-review marks to remove" />
            </div>
          )}

          {/* Shapes expanded subrow */}
          {tool === "shapes" && (
            <div className="subrow under-toolbar">
              {([
                ["rectangle", "Rectangle"], ["ellipse", "Ellipse"], ["line", "Line"],
                ["arrow", "Arrow"], ["polyline", "Polyline"], ["polygon", "Polygon"], ["cloud", "Cloud"],
              ] as [ShapeKind, string][]).map(([kind, label]) => (
                <SubTool key={kind}
                  glyph={kind as never}
                  label={label}
                  active={shapeKind === kind}
                  onClickOverride={() => setShapeKind(kind)}
                />
              ))}
              <SubTool glyph="line" label={shapeDash ? "Dashed" : "Solid"} active={shapeDash}
                onClickOverride={() => setShapeDash((d) => !d)} />
            </div>
          )}

          {/* free-form expanded subrow (colors + widths + eraser) */}
          {tool === "freeform" && (
            <div className="subrow under-toolbar">
              <SubTool glyph="pen" label="" active={toolState.tool === "pen"}
                onClickOverride={() => setToolState({ ...toolState, tool: "pen" })} />
              <SubTool glyph="highlighter" label="" active={toolState.tool === "highlighter"}
                onClickOverride={() => setToolState({ ...toolState, tool: "highlighter" })} />
              <SubTool glyph="eraser" label="" active={toolState.tool === "eraser"}
                onClickOverride={() => setToolState({ ...toolState, tool: "eraser" })} />
              {INK_COLORS.map((c) => (
                <ColorChip key={c} color={c} selected={toolState.color === c}
                  onClickOverride={() => setToolState({ ...toolState, color: c })} />
              ))}
              <span className="color-chip color-chip--custom" title="Custom color" style={{ background: toolState.color }}>
                <input
                  type="color"
                  value={toolState.color}
                  onChange={(e) => setToolState({ ...toolState, color: e.target.value })}
                />
              </span>
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
                  <div className="textlayer" ref={(d) => { if (d) textRefs.current.set(n, d); else textRefs.current.delete(n); }} />
                  <div
                    className={`ink-overlay ${tool === "review" ? "is-transparent" : ""}`}
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
            <button className="flyout__star" title="Pin the current tool below">
              <Glyph name="pro" size={16} />
            </button>
            {favs.map((f) => (
              <button
                key={f.id}
                className="flyout__chip"
                style={{ background: f.color, color: "#0d131c" }}
                onClick={() => applyFavorite(f)}
                title={`${f.tool} ${f.color} w${f.width}`}
              >
                <Glyph name={f.tool === "highlighter" ? "highlighter" : f.tool === "eraser" ? "eraser" : "pen"} size={18} />
                <span
                  className="chip-x"
                  onClick={(e) => { e.stopPropagation(); removeFavorite(f.id); }}
                  role="button"
                  aria-label="remove favorite"
                >
                  ×
                </span>
              </button>
            ))}
            <button className="flyout__add" title="Pin current tool" onClick={addFavorite}>+</button>
          </div>

          {radialPos && (
            <div style={{ position: "fixed", left: radialPos.x, top: radialPos.y, zIndex: 251 }}>
              <RadialMenu
                onClose={() => setRadialPos(null)}
                slots={[
                  { glyph: "pan", label: "Pan", cat: "neutral", active: tool === "pan", onClick: () => setTool("pan") },
                  { glyph: "select", label: "Select", cat: "select", active: tool === "select", onClick: () => setTool("select") },
                  { glyph: "pen", label: "Pen", cat: "draw", active: tool === "freeform" && toolState.tool === "pen", onClick: () => { setTool("freeform"); setToolState({ ...toolState, tool: "pen" }); } },
                  { glyph: "pen2", label: "Pen (blue)", cat: "draw", onClick: () => { setTool("freeform"); setToolState({ tool: "pen", color: "#2f6bff", width: 2.4, opacity: 1 }); } },
                  { glyph: "highlighter", label: "Highlighter", cat: "draw", active: tool === "freeform" && toolState.tool === "highlighter", onClick: () => { setTool("freeform"); setToolState({ ...toolState, tool: "highlighter" }); } },
                  { glyph: "eraser", label: "Eraser", cat: "insert", active: tool === "freeform" && toolState.tool === "eraser", onClick: () => { setTool("freeform"); setToolState({ ...toolState, tool: "eraser" }); } },
                  { glyph: "textreview", label: "Review", cat: "pro", active: tool === "review", onClick: () => setTool("review") },
                  { glyph: "more", label: "Insert", cat: "pro", active: tool === "insert", onClick: () => setTool("insert") },
                ]}
              />
            </div>
          )}

          {err && <div className="viewer__error">{err}</div>}
          {firstPaint !== null && <div className="perf-chip">first page: {Math.round(firstPaint)} ms</div>}
        </div>
      </div>
    </div>
  );
}
