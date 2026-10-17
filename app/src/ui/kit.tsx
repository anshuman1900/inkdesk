import type { CSSProperties, ReactNode } from "react";

/* ---------- inline glyphs (original, simple geometric set) ---------- */

export type GlyphName =
  | "pan"
  | "select"
  | "pen"
  | "pen2"
  | "highlighter"
  | "eraser"
  | "textreview"
  | "shapes"
  | "insert"
  | "measure"
  | "pro"
  | "more";

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
};

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

/* Radial menu — static geometry mock (interactions land in P9) */
const RADIAL_SLOTS: { glyph: GlyphName; category: "draw" | "insert" | "measure" | "select" | "pro" | "neutral"; label: string }[] = [
  { glyph: "pan", category: "neutral", label: "Pan" },
  { glyph: "select", category: "select", label: "Select" },
  { glyph: "pen", category: "draw", label: "Pen" },
  { glyph: "pen2", category: "draw", label: "Pen 2" },
  { glyph: "highlighter", category: "draw", label: "Highlighter" },
  { glyph: "eraser", category: "draw", label: "Eraser" },
  { glyph: "textreview", category: "draw", label: "Text review" },
  { glyph: "more", category: "pro", label: "More" },
];

export function RadialMenu() {
  return (
    <div className="radial">
      {RADIAL_SLOTS.map((slot, i) => {
        const angle = (i / RADIAL_SLOTS.length) * 2 * Math.PI - Math.PI / 2;
        const r = 86;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        return (
          <button
            key={slot.label}
            className={`tool-btn tool-btn--${slot.category} radial__slot`}
            style={
              {
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              } as CSSProperties
            }
            title={slot.label}
            aria-label={slot.label}
          >
            <Glyph name={slot.glyph} size={22} />
          </button>
        );
      })}
      <div className="radial__center" />
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
