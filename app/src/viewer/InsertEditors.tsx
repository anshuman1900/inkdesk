import { useEffect, useRef, useState } from "react";

/** Draw-a-signature modal → returns a transparent PNG data URL */
export function SignaturePad({
  onSave,
  onClose,
}: {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const pos = (e: React.PointerEvent): [number, number] => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * c.width,
      ((e.clientY - rect.top) / rect.height) * c.height,
    ];
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>Draw your signature</h2>
          <button className="modal__close" onClick={onClose} aria-label="close">×</button>
        </div>
        <canvas
          ref={canvasRef}
          width={480}
          height={200}
          className="sigpad"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const ctx = canvasRef.current!.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvasRef.current!.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.strokeStyle = "#0d131c";
            ctx.lineWidth = 2.6;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineTo(x, y);
            ctx.stroke();
            setEmpty(false);
          }}
          onPointerUp={() => { drawing.current = false; }}
        />
        <div className="modal__foot">
          <button
            className="btn"
            onClick={() => {
              const c = canvasRef.current!;
              const ctx = c.getContext("2d")!;
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, c.width, c.height);
              setEmpty(true);
            }}
          >
            Clear
          </button>
          <button
            className="btn btn--accent"
            disabled={empty}
            onClick={() => {
              // trim white background → transparent PNG
              const c = canvasRef.current!;
              const ctx = c.getContext("2d")!;
              const img = ctx.getImageData(0, 0, c.width, c.height);
              for (let i = 0; i < img.data.length; i += 4) {
                if (img.data[i] > 245 && img.data[i + 1] > 245 && img.data[i + 2] > 245) {
                  img.data[i + 3] = 0;
                }
              }
              ctx.putImageData(img, 0, 0);
              onSave(c.toDataURL("image/png"));
            }}
          >
            Save signature
          </button>
        </div>
      </div>
    </div>
  );
}

/** Inline text editor for textbox / note / callout placement */
export function TextEditor({
  x, y, width, value, isNote, onChange, onDone, onCancel,
}: {
  x: number;
  y: number;
  width: number;
  value: string;
  isNote: boolean;
  onChange: (v: string) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <textarea
      ref={ref}
      className={`ink-texteditor ${isNote ? "is-note" : ""}`}
      style={{ left: x, top: y, width }}
      value={value}
      placeholder="Type…"
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter" && !e.shiftKey && !isNote) {
          e.preventDefault();
          onDone();
        }
      }}
    />
  );
}
