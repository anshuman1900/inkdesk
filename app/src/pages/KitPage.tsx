import {
  CategoryChip,
  FavBar,
  Panel,
  RadialMenu,
  Slider,
  Swatches,
  Toggle,
  ToolButton,
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
            <RadialMenu />
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
