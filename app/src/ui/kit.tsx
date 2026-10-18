import type { CSSProperties, ReactNode } from "react";

/* ---------- inline glyphs (original, simple geometric set) ---------- */

export type GlyphName =
  | "pan" | "select" | "pen" | "pen2" | "highlighter" | "eraser" | "textreview"
  | "shapes" | "insert" | "measure" | "pro" | "more"
  | "text" | "callout" | "t_highlight" | "t_underline" | "t_squiggle"
  | "t_strike" | "t_cleaner" | "t_redact"
  | "rectangle" | "ellipse" | "line" | "arrow" | "polyline" | "polygon" | "cloud"
  | "sticky" | "bookmark" | "camera" | "image" | "link" | "speaker"
  | "equation" | "snapshot" | "flourish" | "pie" | "clip" | "scribble";

const PATHS: Record<GlyphName, ReactNode> = {
  pan: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
    </>
  ),
  select: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M12 14v3c0 2-1.5 3.5-3.5 3.5" />
    </>
  ),
  pen: (
    <>
      <path d="M5 19l1-3.5L15.5 6a1.8 1.8 0 012.5 0l.5.5a1.8 1.8 0 010 2.5L9 18.5 5 19z" />
      <path d="M14 7.5l3 3" />
    </>
  ),
  pen2: (
    <>
      <path d="M8 19l-1-3.5L14.5 6a1.8 1.8 0 012.5 0l.5.5a1.8 1.8 0 010 2.5L11 18.5 8 19z" />
      <path d="M13 7.5l3 3" />
    </>
  ),
  highlighter: (
    <>
      <path d="M9 12l6.5-6.5a1.6 1.6 0 012.3 0l.7.7a1.6 1.6 0 010 2.3L12 15H9v-3z" />
      <path d="M4 20h16" />
    </>
  ),
  eraser: (
    <>
      <path d="M8 16l7.5-7.5a1.6 1.6 0 012.3 0l1.7 1.7a1.6 1.6 0 010 2.3L14 18H9l-1-2z" />
      <path d="M4 20h16" />
    </>
  ),
  textreview: (
    <>
      <path d="M6 6h12M12 6v9" />
      <path d="M5 19q1.75-2.2 3.5 0t3.5 0 3.5 0 3.5 0" />
    </>
  ),
  shapes: (
    <>
      <rect x="4" y="4" width="7.5" height="7.5" rx="1" />
      <circle cx="15.5" cy="15.5" r="4.5" />
    </>
  ),
  insert: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  measure: (
    <>
      <rect x="3" y="9" width="18" height="6" rx="1" />
      <path d="M7 9v3M11 9v2M15 9v3M19 9v2" />
    </>
  ),
  pro: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </>
  ),
  text: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M8 8h8M12 8v9" />
    </>
  ),
  callout: <path d="M4.5 5h15a1 1 0 011 1v9a1 1 0 01-1 1h-8l-4.5 4v-4h-2.5a1 1 0 01-1-1V6a1 1 0 011-1z" />,
  t_highlight: (
    <>
      <path d="M6 6h12M12 6v9" />
      <path d="M6 19.5h12" strokeWidth="3.2" />
    </>
  ),
  t_underline: (
    <>
      <path d="M6 6h12M12 6v10" />
      <path d="M8 19.5h8" />
    </>
  ),
  t_squiggle: (
    <>
      <path d="M6 6h12M12 6v10" />
      <path d="M6 19.5q1.5-2 3 0t3 0 3 0 3 0" />
    </>
  ),
  t_strike: (
    <>
      <path d="M6 6h12M12 6v10" />
      <path d="M7 12.5h10" />
    </>
  ),
  t_cleaner: (
    <>
      <path d="M5 5h12M11 5v9" />
      <path d="M15.5 14.5l5 5M20.5 14.5l-5 5" />
    </>
  ),
  t_redact: (
    <>
      <path d="M6 4h12M12 4v5" />
      <rect x="6" y="11" width="12" height="7" fill="currentColor" stroke="none" rx="0.5" />
    </>
  ),
  rectangle: <rect x="4" y="5.5" width="16" height="13" rx="1.2" />,
  ellipse: <circle cx="12" cy="12" r="7.5" />,
  line: <path d="M4.5 19L19.5 5" />,
  arrow: (
    <>
      <path d="M4.5 19L19.5 5" />
      <path d="M12.5 5h7v7" />
    </>
  ),
  polyline: <path d="M3.5 17l5.5-6.5 4 3.5 7.5-9" />,
  polygon: <path d="M12 3.5l7 4v9l-7 4-7-4v-9z" />,
  cloud: <path d="M7 17a4 4 0 01-.4-7.98A5.5 5.5 0 0117.3 8.7 3.8 3.8 0 0116.8 17H7z" />,
  sticky: (
    <>
      <path d="M5 4.5h14v10.5l-4.5 4.5H5z" />
      <path d="M14.5 19.5V15H19" />
    </>
  ),
  bookmark: <path d="M7 4h10v16l-5-4-5 4z" />,
  camera: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <circle cx="12" cy="13" r="3.4" />
      <path d="M8.5 7l1.4-2.3h4.2L15.5 7" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.4" />
      <path d="M6 17.5l4.5-4.5 3 3 4.5-4.5" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5l5-5" />
      <path d="M8.5 11.5L6 14a3.2 3.2 0 004.5 4.5l2.5-2.5" />
      <path d="M15.5 12.5L18 10a3.2 3.2 0 00-4.5-4.5L11 8" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 10v4h3l5 4V6l-5 4z" />
      <path d="M15.5 9.5a3.6 3.6 0 010 5" />
    </>
  ),
  equation: (
    <>
      <path d="M5 7.5h14" />
      <path d="M9 7.5V18M15.5 7.5c0 4-1.5 8.5-4 10.5" />
    </>
  ),
  snapshot: (
    <>
      <path d="M7 3v14h14" />
      <path d="M3 7h14v14" />
    </>
  ),
  flourish: <path d="M4 17c2-6.5 4.2-6.5 5.2-2s3.2 4 5.3-1 3.5-4.5 6.5-2.5" />,
  pie: (
    <>
      <path d="M12 12V4a8 8 0 018 8z" />
      <path d="M12 12h8" />
    </>
  ),
  clip: <path d="M8.5 12l6-6a3 3 0 014.2 4.2l-8 8a4.6 4.6 0 01-6.5-6.5l7-7" />,
  scribble: (
    <>
      <circle cx="12" cy="9.5" r="5" />
      <path d="M9 13.5c-2.2 2.8-1.4 5.8 1.6 6.8" />
    </>
  ),
};;

export function Glyph({ name, size = 20 }: { name: GlyphName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

/* ---------- components ---------- */

export function ToolButton({
  glyph,
  category,
  size = "md",
  active = false,
  label,
}: {
  glyph: GlyphName;
  category: "draw" | "insert" | "measure" | "select" | "pro" | "neutral";
  size?: "md" | "lg";
  active?: boolean;
  label: string;
}) {
  return (
    <button
      className={`tool-btn tool-btn--${category} ${active ? "is-active" : ""} tool-btn--${size}`}
      title={label}
      aria-label={label}
    >
      <Glyph name={glyph} size={size === "lg" ? 24 : 20} />
    </button>
  );
}

export function CategoryChip({
  name,
  category,
  active = false,
}: {
  name: string;
  category: string;
  active?: boolean;
}) {
  return (
    <button className={`chip ${active ? "is-active" : ""}`} data-category={category}>
      <span className={`chip-dot chip-dot--${category}`} />
      {name}
    </button>
  );
}

export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="kit-panel">
      {title && <div className="kit-panel__title">{title}</div>}
      {children}
    </div>
  );
}

export function Slider({
  label,
  value,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="slider">
      <span className="slider__label">
        {label} <b>{value}</b>
      </span>
      <input type="range" min={min} max={max} defaultValue={value} />
    </label>
  );
}

const SWATCHES = [
  "#f2b23e", "#ff6b6b", "#58c770", "#3fc1c9", "#4f8cff",
  "#a06bff", "#f0f0f4", "#1e1f24",
];

export function Swatches({ selected = 0 }: { selected?: number }) {
  return (
    <div className="swatches">
      {SWATCHES.map((c, i) => (
        <button
          key={c}
          className={`swatch ${i === selected ? "is-selected" : ""}`}
          style={{ background: c } as CSSProperties}
          aria-label={`color ${c}`}
        />
      ))}
      <button className="swatch swatch--custom" aria-label="custom color">
        <Glyph name="pro" size={14} />
      </button>
    </div>
  );
}

export function Toggle({
  label,
  on = false,
}: {
  label: string;
  on?: boolean;
}) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <span className={`toggle__track ${on ? "is-on" : ""}`}>
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}

/* Radial menu — interactive (P9): slots activate tools */
export interface RadialSlot {
  glyph: GlyphName;
  label: string;
  cat: string;
  onClick: () => void;
  active?: boolean;
}

export function RadialMenu({
  slots,
  onClose,
}: {
  slots: RadialSlot[];
  onClose: () => void;
}) {
  return (
    <div className="radial-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        className="radial radial--live"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {slots.map((slot, i) => {
          const angle = (i / slots.length) * 2 * Math.PI - Math.PI / 2;
          const r = 86;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          return (
            <button
              key={slot.label}
              className={`tool-btn tool-btn--${slot.cat} radial__slot ${slot.active ? "is-active" : ""}`}
              style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` } as CSSProperties}
              title={slot.label}
              aria-label={slot.label}
              onClick={() => { slot.onClick(); onClose(); }}
            >
              <Glyph name={slot.glyph} size={22} />
            </button>
          );
        })}
        <div className="radial__center" />
      </div>
    </div>
  );
}

export function FavBar() {
  return (
    <div className="favbar">
      <div className="favbar__handle" aria-hidden>
        <Glyph name="more" size={14} />
      </div>
      <ToolButton glyph="pen" category="draw" label="Pen" active />
      <ToolButton glyph="highlighter" category="draw" label="Highlighter" />
      <ToolButton glyph="eraser" category="draw" label="Eraser" />
      <ToolButton glyph="textreview" category="draw" label="Text review" />
      <ToolButton glyph="shapes" category="draw" label="Shapes" />
      <ToolButton glyph="insert" category="insert" label="Insert" />
      <button className="favbar__add" aria-label="add tool">
        +
      </button>
    </div>
  );
}

/* ---------- two-tier toolbar subrows (from live-app closeups) ---------- */

export function SubRow({ children }: { children: ReactNode }) {
  return (
    <div className="subrow">
      <div className="subrow__items">{children}</div>
      <button className="subrow__close" aria-label="close row">
        ×
      </button>
    </div>
  );
}

export function SubTool({
  glyph,
  label,
  active = false,
  onClickOverride,
  title,
}: {
  glyph: GlyphName;
  label: string;
  active?: boolean;
  onClickOverride?: () => void;
  title?: string;
}) {
  return (
    <button className={`subtool ${active ? "is-active" : ""}`} onClick={onClickOverride} title={title}>
      <Glyph name={glyph} size={17} />
      <span>{label}</span>
    </button>
  );
}

export function ColorChip({
  color,
  selected = false,
  onClickOverride,
}: {
  color: string;
  selected?: boolean;
  onClickOverride?: () => void;
}) {
  return (
    <button
      className={`color-chip ${selected ? "is-selected" : ""}`}
      style={{ background: color } as CSSProperties}
      aria-label={`color ${color}`}
      onClick={onClickOverride}
    />
  );
}

export function WidthPreview({
  width,
  label,
  selected = false,
  onClickOverride,
}: {
  width: number;
  label: string;
  selected?: boolean;
  onClickOverride?: () => void;
}) {
  return (
    <button className={`width-preview ${selected ? "is-selected" : ""}`} onClick={onClickOverride}>
      <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden>
        <path
          d="M1 6q3-5 6.5 0t6.5 0 6.5 0 4.5 0"
          fill="none"
          stroke="currentColor"
          strokeWidth={width}
          strokeLinecap="round"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}
