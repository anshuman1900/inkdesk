# Drawboard UI reference notes — from Anshu's live app screenshots (Oct 18)

Source: replica/screens/anshu-run/ (local only, never committed). Drawboard PDF v3.x "new UI".

## Loading screen (loading-screen-tip.png)
- Full dark navy bg (~#1a222e), no chrome except Windows titlebar
- Centered thin-outline logo mark (abstract pen nib), small muted "TIP #7", then a tip sentence in larger white text ("Did you know you can drag and drop pages to reorder them in the Pages menu?")
- Clone: dark splash + original thin-line mark + rotating local tips, ~1.2s, skippable on click

## Home (home-light-file-table.png) — LIGHT theme
- Top strip: dark navy (~#151d28): speaker icon, sync icon w/ green badge; right: black "Basic | Upgrade" pill, window controls
- Left sidebar (white, ~250px): "Drawboard PDF" heading; nav: All Files (bold, active, count chip), Device, Cloud, Shared by me, Shared with me, Recently Deleted — each with count; collapsible "Integrations" (Google Drive / OneDrive / SharePoint / Dropbox w/ counts) and "Tags"
- Main: search field "Search your files or tags", blue "Open" button, blue circular "+"
- File table: checkbox | refresh | "Document Name ⇅" | "Last opened by me ▾" | "Author ⇅" | "Last opened ⇅" | Share | view-density icon. Row: colored thumbnail chip, name bold, "Opened just now" muted, share icon, ⋮ menu
- Right rail: marketing cards + dark "Explore Pro" — **clone drops all of this (no promos/upsells)**
- Clone sidebar (local-only app): All Files, Device, Recently Deleted, Tags (P24); no cloud/integrations rows (R6)

## Document view (doc-view-full-toolbar-rail.png) — DARK chrome
- Chrome navy ~#131b26, canvas gutter darker ~#0d131c, page white centered with shadow
- Tab bar row: tab = cloud-doc icon + name + green dot + x; "+" new tab; right: blue "Upload / Share" pill, black "Basic | Upgrade" pill, window controls
- Centered toolbar row (icon + label pills, rounded, dark): Pan/hand (active = boxed lighter), Select cursor + ▾, Free-form (pen squiggle), Shapes (square+circle), Aa Review, Measure (ruler; hovered state gets filled pill bg), + Insert (circled plus), layers/stickies icon + ▾
- Left vertical rail (~48px, dark): pen icon w/ badge "12" (favorites count), doc icon, "…", divider, pages icon, another doc icon; lower group: nib/ink, graduation-cap-like, gear (settings) at bottom
- Right edge: collapsed flyout handle; expanded (right-favorites-flyout-expanded.png): star on top, vertical colored tool chips (blue pen, yellow highlighter w/ "20", white eraser w/ "10", blue shapes w/ "12", purple T (text), blue pen, note bubble), "+" add, collapse chevron — chips carry usage counts (recent-use ranking)
- Bottom-left: two circular undo/redo buttons (redo disabled = dimmer)
- Bottom-right: "< [1] of 12 >" page chip + grid/thumbnails button; below: "− 52% +" zoom row + expand icon
- Clone notes: no Upload/Share/Upgrade pills (R1/R6) — replace right side with search + doc actions (save/flatten/print per S11)

## Tool colors observed (flyout chips)
blue pen, yellow highlighter, white eraser, blue shapes, purple text "T", note bubble — maps to our category accents (draw/amber, insert/green, measure/teal, select/blue, pro/purple)

## Implications for the clone
1. Default UI = toolbar + left rail + right favorites flyout; radial menu stays as a settings toggle (P9, like the original's View & Layout toggle)
2. Home is light; viewer chrome is dark — tokens need BOTH themes
3. Usage-count badges on favorites (rank by recent use) — schema: tool_presets.last_used_at
