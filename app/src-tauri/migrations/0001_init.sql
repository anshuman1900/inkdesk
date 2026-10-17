-- Inkdesk schema (SQLite) — from replica/recon.md inferred data model
-- Single local user; all times stored as unixepoch UTC integers.


CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,                -- uuid
  path            TEXT NOT NULL UNIQUE,            -- absolute path, case-normalized
  title           TEXT NOT NULL,
  page_count      INTEGER NOT NULL DEFAULT 0,
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  last_page       INTEGER NOT NULL DEFAULT 1,
  zoom_state      TEXT,                            -- json {mode: fit-width|fit-page|percent, value}
  night_mode      INTEGER NOT NULL DEFAULT 0,      -- boolean
  layout_mode     TEXT NOT NULL DEFAULT 'continuous'
                  CHECK (layout_mode IN ('continuous','single')),
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  last_opened_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_documents_recent ON documents (last_opened_at DESC);

CREATE TABLE IF NOT EXISTS annotations (
  id            TEXT PRIMARY KEY,                  -- uuid
  document_id   TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_index    INTEGER NOT NULL,                  -- 0-based
  type          TEXT NOT NULL CHECK (type IN (
                  'ink','highlighter','text_review','shape','note','textbox',
                  'callout','signature','image','audio','measurement','stamp',
                  'hyperlink','redaction')),
  geometry      TEXT NOT NULL,                     -- json: points[] | rect | polyline
  style         TEXT NOT NULL,                     -- json {color,opacity,strokeWidth,dash,fontSize,fontFamily}
  text          TEXT,                              -- note/textbox/callout/text_review quote
  data          TEXT,                              -- json: image_ref, audio_ref, measurement {kind,units,scale}, hyperlink target
  z_order       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_annotations_doc_page ON annotations (document_id, page_index, z_order);
CREATE INDEX IF NOT EXISTS idx_annotations_type     ON annotations (type);

CREATE TABLE IF NOT EXISTS tool_presets (
  id          TEXT PRIMARY KEY,
  tool_type   TEXT NOT NULL CHECK (tool_type IN (
                'pan','select_rect','select_text','select_lasso','laser','pen','pen2',
                'highlighter','eraser','text_review','shape','note','textbox','callout',
                'signature','image','audio','measure_length','measure_polylength',
                'measure_rect_area','measure_poly_area','protractor','stamp','redaction')),
  name        TEXT,
  style       TEXT NOT NULL,                       -- json defaults for this preset
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_presets_tool ON tool_presets (tool_type);

CREATE TABLE IF NOT EXISTS toolbars (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  position    TEXT NOT NULL DEFAULT 'left'
              CHECK (position IN ('left','right','top','bottom','floating')),
  is_active   INTEGER NOT NULL DEFAULT 0,          -- boolean
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS toolbar_items (
  id          TEXT PRIMARY KEY,
  toolbar_id  TEXT NOT NULL REFERENCES toolbars(id) ON DELETE CASCADE,
  preset_id   TEXT NOT NULL REFERENCES tool_presets(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL,
  UNIQUE (toolbar_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_toolbar_items ON toolbar_items (toolbar_id, sort_order);

CREATE TABLE IF NOT EXISTS signatures (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  strokes     TEXT,                                -- json vector ink
  png_path    TEXT,                                -- or rendered raster path
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_index  INTEGER NOT NULL,
  label       TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (document_id, page_index)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_doc ON bookmarks (document_id, page_index);

CREATE TABLE IF NOT EXISTS app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL                              -- json blob
);
