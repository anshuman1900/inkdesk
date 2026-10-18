import { getStroke } from "perfect-freehand";

/* ---------- annotation model ---------- */

export type AnnType =
  | "ink"
  | "highlighter"
  | "text_review"
  | "shape"
  | "note"
  | "textbox"
  | "callout"
  | "signature"
  | "image"
  | "audio"
  | "measurement"
  | "stamp"
  | "hyperlink"
  | "redaction";

export interface Annotation {
  id: string;
  docId: string;
  page: number; // 0-based
  type: AnnType;
  geometry: unknown; // per-type
  style: InkStyle & Record<string, unknown>;
  data?: Record<string, unknown>; // text, src, audio, fontSize...
  z: number;
  createdAt: number;
  updatedAt: number;
}

export interface InkStyle {
  color: string;
  width: number; // stroke width in page units at scale 1
  opacity: number; // 0..1
  dash?: boolean;
}

export type ShapeKind =
  | "rectangle" | "ellipse" | "line" | "arrow"
  | "polyline" | "polygon" | "cloud";

export interface ShapeGeometry {
  kind: ShapeKind;
  x0: number; y0: number; x1: number; y1: number;
  pts?: number[][]; // polyline/polygon vertices
}

export type ReviewStyle = "highlight" | "underline" | "squiggle" | "strike";

/** sample points along a shape's stroke for eraser hit-testing (page units) */
export function shapeStrokePoints(g: ShapeGeometry): number[][] {
  const out: number[][] = [];
  const push = (x: number, y: number) => out.push([x, y]);
  const seg = (x1: number, y1: number, x2: number, y2: number) => {
    const steps = Math.max(3, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6));
    for (let i = 0; i <= steps; i++) push(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
  };
  const x0 = Math.min(g.x0, g.x1), x1 = Math.max(g.x0, g.x1);
  const y0 = Math.min(g.y0, g.y1), y1 = Math.max(g.y0, g.y1);
  switch (g.kind) {
    case "rectangle":
      seg(x0, y0, x1, y0); seg(x1, y0, x1, y1); seg(x1, y1, x0, y1); seg(x0, y1, x0, y0);
      break;
    case "ellipse": {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
      for (let i = 0; i < 48; i++) {
        const t = (i / 48) * Math.PI * 2;
        push(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
      }
      break;
    }
    case "line":
    case "arrow":
      seg(g.x0, g.y0, g.x1, g.y1);
      break;
    case "polyline":
    case "polygon": {
      const pts = g.pts ?? [];
      for (let i = 1; i < pts.length; i++) seg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      if (g.kind === "polygon" && pts.length > 2) seg(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
      break;
    }
    case "cloud":
      seg(x0, y0, x1, y0); seg(x1, y0, x1, y1); seg(x1, y1, x0, y1); seg(x0, y1, x0, y0);
      break;
  }
  return out;
}

export interface ReviewGeometry {
  rects: number[][]; // [x, y, w, h] in page units
  style: ReviewStyle;
  text?: string;
}

/* ---------- tool state ---------- */

export type DrawTool = "pen" | "highlighter" | "eraser";

export interface ToolState {
  tool: DrawTool;
  color: string;
  width: number;
  opacity: number;
}

export const DEFAULT_TOOL: ToolState = {
  tool: "pen",
  color: "#1e1f24",
  width: 2.2,
  opacity: 1,
};

/* ---------- in-memory store + undo/redo (per doc) ---------- */

export type Op =
  | { kind: "add"; ann: Annotation }
  | { kind: "del"; ann: Annotation }
  | { kind: "upd"; before: Annotation; after: Annotation };

type Listener = () => void;

class AnnStore {
  private byDoc = new Map<string, Map<number, Annotation[]>>();
  private undoStacks = new Map<string, Op[]>();
  private redoStacks = new Map<string, Op[]>();
  private listeners = new Set<Listener>();
  /** bumped on every mutation so React can re-render */
  version = 0;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  pageAnns(docId: string, page: number): Annotation[] {
    return this.byDoc.get(docId)?.get(page) ?? [];
  }

  docAnns(docId: string): Annotation[] {
    const m = this.byDoc.get(docId);
    if (!m) return [];
    return [...m.values()].flat();
  }

  loadDoc(docId: string, anns: Annotation[]) {
    const m = new Map<number, Annotation[]>();
    for (const a of anns) {
      const list = m.get(a.page) ?? [];
      list.push(a);
      m.set(a.page, list);
    }
    for (const list of m.values()) list.sort((x, y) => x.z - y.z);
    this.byDoc.set(docId, m);
    this.emit();
  }

  add(ann: Annotation, record = true) {
    const m = this.byDoc.get(ann.docId) ?? new Map<number, Annotation[]>();
    this.byDoc.set(ann.docId, m);
    const list = m.get(ann.page) ?? [];
    list.push(ann);
    list.sort((x, y) => x.z - y.z);
    m.set(ann.page, list);
    if (record) {
      this.pushUndo(ann.docId, { kind: "add", ann });
      this.redoStacks.delete(ann.docId);
    }
    this.emit();
  }

  update(after: Annotation, record = true) {
    const m = this.byDoc.get(after.docId);
    const list = m?.get(after.page);
    if (!list) return;
    const idx = list.findIndex((a) => a.id === after.id);
    if (idx < 0) return;
    const before = { ...list[idx], geometry: JSON.parse(JSON.stringify(list[idx].geometry)) };
    list[idx] = after;
    list.sort((x, y) => x.z - y.z);
    if (record) {
      this.pushUndo(after.docId, { kind: "upd", before, after });
      this.redoStacks.delete(after.docId);
    }
    this.emit();
  }

  getAnn(docId: string, id: string): Annotation | null {
    const m = this.byDoc.get(docId);
    if (!m) return null;
    for (const list of m.values()) {
      const a = list.find((x) => x.id === id);
      if (a) return a;
    }
    return null;
  }

  remove(ann: Annotation, record = true) {
    const m = this.byDoc.get(ann.docId);
    const list = m?.get(ann.page);
    if (!list) return;
    const idx = list.findIndex((a) => a.id === ann.id);
    if (idx >= 0) list.splice(idx, 1);
    if (record) {
      this.pushUndo(ann.docId, { kind: "del", ann });
      this.redoStacks.delete(ann.docId);
    }
    this.emit();
  }

  /** hit-test ink strokes AND shapes: delete the topmost within r of page-space point */
  eraseAt(docId: string, page: number, x: number, y: number, r: number): Annotation | null {
    const list = this.pageAnns(docId, page).filter(
      (a) => a.type === "ink" || a.type === "highlighter" || a.type === "shape",
    );
    for (let i = list.length - 1; i >= 0; i--) {
      const ann = list[i];
      if (ann.type === "shape") {
        const pts = shapeStrokePoints(ann.geometry as ShapeGeometry);
        for (const [px, py] of pts) {
          const dx = px - x;
          const dy = py - y;
          if (dx * dx + dy * dy < r * r) {
            this.remove(ann);
            return ann;
          }
        }
        continue;
      }
      const pts = (ann.geometry as { points: number[][] }).points;
      for (const [px, py] of pts) {
        const dx = px - x;
        const dy = py - y;
        if (dx * dx + dy * dy < r * r) {
          this.remove(ann);
          return ann;
        }
      }
    }
    return null;
  }

  private pushUndo(docId: string, op: Op) {
    const stack = this.undoStacks.get(docId) ?? [];
    stack.push(op);
    if (stack.length > 100) stack.shift();
    this.undoStacks.set(docId, stack);
  }

  canUndo(docId: string) {
    return (this.undoStacks.get(docId)?.length ?? 0) > 0;
  }

  canRedo(docId: string) {
    return (this.redoStacks.get(docId)?.length ?? 0) > 0;
  }

  undo(docId: string): Op | null {
    const stack = this.undoStacks.get(docId);
    if (!stack || stack.length === 0) return null;
    const op = stack.pop()!;
    const redo = this.redoStacks.get(docId) ?? [];
    redo.push(op);
    this.redoStacks.set(docId, redo);
    this.applyInverse(op);
    return op;
  }

  redo(docId: string): Op | null {
    const redo = this.redoStacks.get(docId);
    if (!redo || redo.length === 0) return null;
    const op = redo.pop()!;
    const stack = this.undoStacks.get(docId) ?? [];
    stack.push(op);
    this.undoStacks.set(docId, stack);
    this.apply(op);
    return op;
  }

  private apply(op: Op) {
    if (op.kind === "add") this.add(op.ann, false);
    else if (op.kind === "del") this.remove(op.ann, false);
    else if (op.kind === "upd") this.update(op.after, false);
  }

  private applyInverse(op: Op) {
    if (op.kind === "add") this.remove(op.ann, false);
    else if (op.kind === "del") this.add(op.ann, false);
    else if (op.kind === "upd") this.update(op.before, false);
  }
}

export const annStore = new AnnStore();

/* ---------- geometry helpers ---------- */

export function uid(): string {
  const h = crypto.getRandomValues(new Uint8Array(8));
  return (
    "a" + [...h].map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

/** perfect-freehand outline -> Path2D (page-space * scale) */
export function strokePath2D(
  points: number[][],
  style: InkStyle,
  scale: number,
  isHighlighter: boolean,
  simulatePressure = true,
): Path2D {
  const outline = getStroke(points, {
    size: style.width,   // page units — coords get scaled after, keeping true width
    thinning: isHighlighter ? 0 : 0.55,
    smoothing: 0.6,
    streamline: 0.34,   // responsive for fast pen writing
    easing: (t) => t,
    simulatePressure,
    last: true,
  });
  const path = new Path2D();
  if (outline.length < 2) {
    const [x, y] = points[0] ?? [0, 0];
    path.arc(x * scale, y * scale, Math.max(0.6, (style.width * scale) / 2), 0, Math.PI * 2);
    return path;
  }
  // outline is in page units — scale to CSS px so ink lands exactly under the cursor
  path.moveTo(outline[0][0] * scale, outline[0][1] * scale);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[i + 1] ?? outline[i];
    path.quadraticCurveTo(
      x0 * scale, y0 * scale,
      ((x0 + x1) / 2) * scale, ((y0 + y1) / 2) * scale,
    );
  }
  path.closePath();
  return path;
}


/* ---------- shape drawing ---------- */

export function drawShape(
  ctx: CanvasRenderingContext2D,
  g: ShapeGeometry,
  style: InkStyle,
  scale: number,
): void {
  const x0 = Math.min(g.x0, g.x1) * scale;
  const y0 = Math.min(g.y0, g.y1) * scale;
  const x1 = Math.max(g.x0, g.x1) * scale;
  const y1 = Math.max(g.y0, g.y1) * scale;
  ctx.save();
  ctx.globalAlpha = style.opacity;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(style.dash ? [style.width * scale * 3, style.width * scale * 2.4] : []);

  const bumpCloud = () => {
    const r = Math.max(7 * scale, (x1 - x0) / 14);
    const edges: [number, number, number, number][] = [
      [x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0],
    ];
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (const [ax, ay, bx, by] of edges) {
      const len = Math.hypot(bx - ax, by - ay);
      const bumps = Math.max(2, Math.round(len / (r * 1.6)));
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const dir = edges.indexOf([ax, ay, bx, by] as never) === 3 ? -1 : 1;
      for (let i = 1; i <= bumps; i++) {
        const t0 = (i - 0.5) / bumps;
        const t1 = i / bumps;
        const mx = ax + (bx - ax) * t0 + nx * r * 0.62 * dir;
        const my = ay + (by - ay) * t0 + ny * r * 0.62 * dir;
        ctx.quadraticCurveTo(mx, my, ax + (bx - ax) * t1, ay + (by - ay) * t1);
      }
    }
    ctx.closePath();
    ctx.stroke();
  };

  switch (g.kind) {
    case "rectangle":
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      break;
    case "ellipse": {
      ctx.beginPath();
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "line":
      ctx.beginPath();
      ctx.moveTo(g.x0 * scale, g.y0 * scale);
      ctx.lineTo(g.x1 * scale, g.y1 * scale);
      ctx.stroke();
      break;
    case "arrow": {
      const ax = g.x0 * scale;
      const ay = g.y0 * scale;
      const bx = g.x1 * scale;
      const by = g.y1 * scale;
      const ang = Math.atan2(by - ay, bx - ax);
      const head = Math.max(9 * scale, style.width * scale * 4);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - head * Math.cos(ang - 0.44), by - head * Math.sin(ang - 0.44));
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - head * Math.cos(ang + 0.44), by - head * Math.sin(ang + 0.44));
      ctx.stroke();
      break;
    }
    case "polyline":
    case "polygon": {
      const pts = g.pts ?? [];
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * scale, pts[0][1] * scale);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * scale, pts[i][1] * scale);
      if (g.kind === "polygon") ctx.closePath();
      ctx.stroke();
      break;
    }
    case "cloud":
      bumpCloud();
      break;
  }
  ctx.restore();
}

/* ---------- text review drawing ---------- */

export function drawTextReview(
  ctx: CanvasRenderingContext2D,
  g: ReviewGeometry,
  style: InkStyle,
  scale: number,
): void {
  ctx.save();
  ctx.globalAlpha = g.style === "highlight" ? 0.38 : style.opacity;
  for (const [rx, ry, rw, rh] of g.rects) {
    const x = rx * scale;
    const y = ry * scale;
    const w = rw * scale;
    const h = rh * scale;
    if (g.style === "highlight") {
      ctx.fillStyle = style.color;
      ctx.fillRect(x, y, w, h);
    } else if (g.style === "underline") {
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width * scale;
      ctx.beginPath();
      ctx.moveTo(x, y + h - style.width * scale);
      ctx.lineTo(x + w, y + h - style.width * scale);
      ctx.stroke();
    } else if (g.style === "strike") {
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width * scale;
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
      ctx.stroke();
    } else {
      // squiggle
      ctx.strokeStyle = style.color;
      ctx.lineWidth = style.width * scale * 0.8;
      ctx.beginPath();
      const yy = y + h - style.width * scale;
      const amp = style.width * scale * 1.6;
      ctx.moveTo(x, yy);
      const seg = Math.max(4, w / 10);
      for (let px = x; px < x + w; px += seg) {
        ctx.quadraticCurveTo(px + seg / 2, yy + amp, Math.min(px + seg, x + w), yy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
