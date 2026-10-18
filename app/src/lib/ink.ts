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
  z: number;
  createdAt: number;
  updatedAt: number;
}

export interface InkStyle {
  color: string;
  width: number; // stroke width in page units at scale 1
  opacity: number; // 0..1
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

type Op =
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

  /** hit-test ink strokes: delete the topmost stroke within r of page-space point */
  eraseAt(docId: string, page: number, x: number, y: number, r: number): Annotation | null {
    const list = this.pageAnns(docId, page).filter(
      (a) => a.type === "ink" || a.type === "highlighter",
    );
    for (let i = list.length - 1; i >= 0; i--) {
      const ann = list[i];
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
  }

  private applyInverse(op: Op) {
    if (op.kind === "add") this.remove(op.ann, false);
    else if (op.kind === "del") this.add(op.ann, false);
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
): Path2D {
  const outline = getStroke(points, {
    size: style.width * scale,
    thinning: isHighlighter ? 0 : 0.62,
    smoothing: 0.62,
    streamline: 0.42,
    easing: (t) => t,
    simulatePressure: true,
    last: true,
  });
  const path = new Path2D();
  if (outline.length < 2) {
    const [x, y] = points[0] ?? [0, 0];
    path.arc(x * scale, y * scale, Math.max(0.6, (style.width * scale) / 2), 0, Math.PI * 2);
    return path;
  }
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[i + 1] ?? outline[i];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}
