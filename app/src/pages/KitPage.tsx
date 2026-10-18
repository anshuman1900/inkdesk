import {
  CategoryChip,
  ColorChip,
  FavBar,
  Glyph,
  Panel,
  Slider,
  SubRow,
  SubTool,
  Swatches,
  Toggle,
  ToolButton,
  WidthPreview,
} from "../ui/kit";

export default function KitPage() {
  return (
    <div className="kit-page">
      <h1>UI kit — tokens v0.2</h1>
      <p className="kit-sub">
        Every component renders from <code>replica/design/tokens.json</code>. All
        pairs pass WCAG AA (contrast.py: 18/18).
      </p>

      <div className="kit-grid">
        <Panel title="Tool buttons (circular, category-tinted)">
          <div className="kit-row">
            <ToolButton glyph="pen" category="draw" label="Pen" active />
            <ToolButton glyph="pen2" category="draw" label="Pen 2" />
            <ToolButton glyph="highlighter" category="draw" label="Highlighter" />
            <ToolButton glyph="eraser" category="draw" label="Eraser" />
            <ToolButton glyph="textreview" category="draw" label="Text review" />
            <ToolButton glyph="insert" category="insert" label="Insert" />
            <ToolButton glyph="measure" category="measure" label="Measure" />
            <ToolButton glyph="select" category="select" label="Select" />
            <ToolButton glyph="pro" category="pro" label="Pro tools" />
          </div>
          <div className="kit-row">
            <ToolButton glyph="pen" category="draw" size="lg" label="Pen large" active />
            <ToolButton glyph="shapes" category="draw" size="lg" label="Shapes large" />
          </div>
        </Panel>

        <Panel title="Category chips (Choose-new-tool panel)">
          <div className="kit-row">
            <CategoryChip name="Draw" category="draw" active />
            <CategoryChip name="Insert" category="insert" />
            <CategoryChip name="Measure" category="measure" />
            <CategoryChip name="Select" category="select" />
            <CategoryChip name="Pro tools" category="pro" />
          </div>
        </Panel>

        <Panel title="Favorites bar (dockable — P10 wires behavior)">
          <FavBar />
        </Panel>

        <Panel title="Radial menu (static geometry — P9 wires behavior)">
          <div className="radial-stage">
            <div className="radial">
              {["pan", "select", "pen", "pen2", "highlighter", "eraser", "textreview", "more"].map((g, i) => {
                const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
                const r = 86;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                const cat = ["neutral", "select", "draw", "draw", "draw", "insert", "pro", "pro"][i];
                return (
                  <button key={g} className={`tool-btn tool-btn--${cat} radial__slot ${i === 2 ? "is-active" : ""}`}
                    style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}>
                    <Glyph name={g as never} size={22} />
                  </button>
                );
              })}
              <div className="radial__center" />
            </div>
          </div>
        </Panel>

        <Panel title="Tool properties">
          <Slider label="Width" value={6} min={1} max={40} />
          <Slider label="Opacity" value={80} min={5} max={100} />
          <div className="kit-row" style={{ marginTop: 12 }}>
            <Swatches selected={0} />
          </div>
          <div className="kit-col">
            <Toggle label="Pressure sensitivity" on />
            <Toggle label="Stylus draws, touch pans" on />
            <Toggle label="Use radial menu" />
          </div>
        </Panel>

        <Panel title="Expanded rows — Review (live-app match)">
          <SubRow>
            <SubTool glyph="text" label="Text" active />
            <SubTool glyph="callout" label="Callout" />
            <SubTool glyph="t_highlight" label="Text Highlight" />
            <SubTool glyph="t_underline" label="Underline" />
            <SubTool glyph="t_squiggle" label="Squiggle" />
            <SubTool glyph="t_strike" label="Strike-through" />
            <SubTool glyph="t_cleaner" label="Text Cleaner" />
            <SubTool glyph="t_redact" label="Redaction" />
          </SubRow>
        </Panel>

        <Panel title="Expanded rows — Shapes">
          <SubRow>
            <SubTool glyph="rectangle" label="Rectangle" active />
            <SubTool glyph="ellipse" label="Ellipse" />
            <SubTool glyph="line" label="Line" />
            <SubTool glyph="arrow" label="Arrow" />
            <SubTool glyph="polyline" label="Polyline" />
            <SubTool glyph="polygon" label="Polygon" />
            <SubTool glyph="cloud" label="Cloud" />
          </SubRow>
        </Panel>

        <Panel title="Expanded rows — Insert">
          <SubRow>
            <SubTool glyph="sticky" label="Note" active />
            <SubTool glyph="bookmark" label="Bookmark" />
            <SubTool glyph="camera" label="Image from Camera" />
            <SubTool glyph="image" label="Image from File" />
            <SubTool glyph="link" label="Hyperlink" />
            <SubTool glyph="speaker" label="Audio note" />
            <SubTool glyph="equation" label="Equation" />
            <SubTool glyph="snapshot" label="Snapshot" />
            <SubTool glyph="flourish" label="Signature" />
          </SubRow>
        </Panel>

        <Panel title="Expanded rows — Free-form properties">
          <SubRow>
            <button className="color-chip is-selected" style={{ background: "var(--cat-draw)" }} aria-label="ink color" />
            <SubTool glyph="highlighter" label="" />
            <SubTool glyph="clip" label="" />
            <SubTool glyph="scribble" label="" />
            <ColorChip color="#ff6b6b" />
            <ColorChip color="#4f8cff" />
            <ColorChip color="#1e1f24" />
            <WidthPreview width={1.4} label="" />
            <WidthPreview width={4.5} label="" />
            <button className="width-chip" style={{ background: "var(--cat-draw)" }}>
              2 ▾
            </button>
            <SubTool glyph="more" label="" />
          </SubRow>
        </Panel>

        <Panel title="States">
          <div className="kit-row">
            <ToolButton glyph="pan" category="neutral" label="Default" />
            <ToolButton glyph="pan" category="neutral" active label="Active" />
            <button className="btn">Default</button>
            <button className="btn btn--accent">Accent</button>
            <button className="btn btn--danger">Delete</button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
