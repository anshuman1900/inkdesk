import type { Annotation, ShapeGeometry, ReviewGeometry } from "./ink";

/** axis-aligned bbox of an annotation in page units */
export function bboxOf(a: Annotation): { x: number; y: number; w: number; h: number } {
  const g = a.geometry as Record<string, unknown>;
  const pts = g.points as number[][] | undefined;
  if (pts && Array.isArray(pts) && pts.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (a.type === "shape") {
    const s = g as unknown as ShapeGeometry;
    const xs = [s.x0, s.x1, ...(s.pts ?? []).map((p) => p[0])];
    const ys = [s.y0, s.y1, ...(s.pts ?? []).map((p) => p[1])];
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  if (a.type === "text_review") {
    const rects = (g as unknown as ReviewGeometry).rects;
    const x = Math.min(...rects.map((r) => r[0]));
    const y = Math.min(...rects.map((r) => r[1]));
    const mx = Math.max(...rects.map((r) => r[0] + r[2]));
    const my = Math.max(...rects.map((r) => r[1] + r[3]));
    return { x, y, w: mx - x, h: my - y };
  }
  // textbox/note/callout/image/audio
  const o = g as { x: number; y: number; w?: number; h?: number };
  return { x: o.x, y: o.y, w: o.w ?? 40, h: o.h ?? 24 };
}

/** translate an annotation's geometry by (dx, dy) page units */
export function translateAnn(a: Annotation, dx: number, dy: number): Annotation {
  const g = { ...(a.geometry as Record<string, unknown>) };
  const pts = g.points as number[][] | undefined;
  if (pts) g.points = pts.map(([x, y, p]) => [x + dx, y + dy, p]);
  if (a.type === "shape") {
    g.x0 = (g.x0 as number) + dx; g.y0 = (g.y0 as number) + dy;
    g.x1 = (g.x1 as number) + dx; g.y1 = (g.y1 as number) + dy;
    if (g.pts) g.pts = (g.pts as number[][]).map(([x, y]) => [x + dx, y + dy]);
  }
  if (a.type === "text_review") {
    g.rects = (g.rects as number[][]).map(([x, y, w, h]) => [x + dx, y + dy, w, h]);
  }
  if (typeof g.x === "number") { g.x = (g.x as number) + dx; g.y = (g.y as number) + dy; }
  return { ...a, geometry: g, updatedAt: Math.floor(Date.now() / 1000) };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** draw any non-ink annotation (ink handled by strokePath2D) */
export function drawObject(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  scale: number,
  imageCache: Map<string, HTMLImageElement>,
): void {
  const g = a.geometry as Record<string, number & string & number[][]>;
  ctx.save();
  if (a.type === "textbox" || a.type === "note" || a.type === "callout") {
    const fontSize = ((a.data?.fontSize as number) ?? 14) * scale;
    const boxW = ((a.data?.boxW as number) ?? (a.type === "note" ? 150 : 240)) * scale;
    ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    const lines = wrapText(ctx, String(a.data?.text ?? ""), boxW - 16 * scale);
    const lineH = fontSize * 1.35;
    const textH = lines.length * lineH + 14 * scale;
    if (a.type === "note") {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = (a.style.color as string) || "#fff3a0";
      roundRect(ctx, g.x * scale, g.y * scale, boxW, Math.max(textH, 34 * scale), 4 * scale);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#1e1f24";
    } else if (a.type === "callout") {
      ctx.strokeStyle = a.style.color;
      ctx.lineWidth = (a.style.width ?? 2) * scale;
      const tailX = (a.data?.tailX as number ?? g.x - 40) * scale;
      const tailY = (a.data?.tailY as number ?? g.y - 30) * scale;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(g.x * scale + boxW / 2, g.y * scale + Math.max(textH, 30 * scale));
      ctx.stroke();
      ctx.fillStyle = a.style.color;
      roundRect(ctx, g.x * scale, g.y * scale, boxW, Math.max(textH, 30 * scale), 6 * scale);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.fillStyle = a.style.color;
    }
    ctx.textBaseline = "top";
    lines.forEach((ln, i) => ctx.fillText(ln, g.x * scale + 8 * scale, g.y * scale + 7 * scale + i * lineH));
  } else if (a.type === "image" || a.type === "signature") {
    const src = a.data?.src as string;
    const img = src ? imageCache.get(src) : undefined;
    if (img && img.complete) {
      ctx.globalAlpha = a.style.opacity ?? 1;
      ctx.drawImage(img, g.x * scale, g.y * scale, g.w * scale, g.h * scale);
      ctx.globalAlpha = 1;
    }
  } else if (a.type === "audio") {
    const r = 11 * scale;
    ctx.fillStyle = "#58c770";
    ctx.beginPath();
    ctx.arc(g.x * scale, g.y * scale, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    const s = r / 11;
    ctx.beginPath();
    ctx.moveTo(g.x * scale - 4 * s, g.y * scale - 3 * s);
    ctx.lineTo(g.x * scale + 1 * s, g.y * scale - 3 * s);
    ctx.lineTo(g.x * scale + 4 * s, g.y * scale - 6 * s);
    ctx.lineTo(g.x * scale + 4 * s, g.y * scale + 6 * s);
    ctx.lineTo(g.x * scale + 1 * s, g.y * scale + 3 * s);
    ctx.lineTo(g.x * scale - 4 * s, g.y * scale + 3 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function pointInBBox(
  a: Annotation,
  x: number,
  y: number,
  pad = 6,
): boolean {
  const b = bboxOf(a);
  return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
}

export function segIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  // sample-based — good enough for lasso selection
  const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return true;
  }
  return false;
}
