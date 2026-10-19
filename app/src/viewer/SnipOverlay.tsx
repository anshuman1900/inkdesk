import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Snipping tool: hides the app, captures every screen via PowerShell,
 * then lets the user drag a region. Returns a cropped PNG data URL.
 */
export function captureScreenToTemp(): Promise<string> {
  return invoke<string>("snip_capture");
}

export default function SnipOverlay({
  imagePath,
  onDone,
}: {
  imagePath: string;
  onDone: (result: { dataUrl: string } | null) => void;
}) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragRef = useRef<{ x0: number; y0: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const crop = (): string | null => {
    const img = imgRef.current;
    const d = drag;
    if (!img || !d) return null;
    const rx = Math.min(d.x0, d.x1);
    const ry = Math.min(d.y0, d.y1);
    const rw = Math.abs(d.x1 - d.x0);
    const rh = Math.abs(d.y1 - d.y0);
    if (rw < 8 || rh < 8) return null;
    // drag coords are CSS px over the fitted image → map to native pixels
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const c = document.createElement("canvas");
    c.width = Math.floor(rw * scaleX);
    c.height = Math.floor(rh * scaleY);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(
      img,
      rx * scaleX, ry * scaleY, rw * scaleX, rh * scaleY,
      0, 0, c.width, c.height,
    );
    return c.toDataURL("image/png");
  };

  return (
    <div className="snip-backdrop">
      <img
        ref={imgRef}
        className="snip-img"
        src={imagePath.startsWith("http") ? imagePath : `data:image/png;base64,${imagePath}`}
        onLoad={(e) => setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        draggable={false}
      />
      <div
        className="snip-canvas"
        onPointerDown={(e) => {
          if (drag) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          dragRef.current = { x0: e.clientX, y0: e.clientY };
          setDrag({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
        }}
        onPointerMove={(e) => {
          setHover({ x: e.clientX, y: e.clientY });
          if (!dragRef.current) return;
          setDrag((d) => (d ? { ...d, x1: e.clientX, y1: e.clientY } : d));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
      >
        {drag && (
          <div
            className="snip-rect"
            style={{
              left: Math.min(drag.x0, drag.x1),
              top: Math.min(drag.y0, drag.y1),
              width: Math.abs(drag.x1 - drag.x0),
              height: Math.abs(drag.y1 - drag.y0),
            }}
          />
        )}
        {hover && !drag && (
          <div className="snip-cross" style={{ left: hover.x, top: hover.y }} />
        )}
      </div>
      {drag && Math.abs(drag.x1 - drag.x0) > 8 && (
        <div
          className="snip-actions"
          style={{
            left: Math.min(drag.x0, drag.x1) + Math.abs(drag.x1 - drag.x0) / 2 - 90,
            top: Math.max(drag.y0, drag.y1) + 14,
          }}
        >
          <button
            className="btn btn--accent"
            onClick={() => {
              const d = crop();
              onDone(d ? { dataUrl: d } : null);
            }}
          >
            Copy
          </button>
          <button className="btn" onClick={() => onDone(null)}>
            Cancel
          </button>
        </div>
      )}
      {!drag && (
        <div className="snip-hint">Drag to select a region · Esc to cancel</div>
      )}
      {imgSize === null && <div className="snip-hint">loading capture…</div>}
    </div>
  );
}
