import { useEffect, useMemo, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import { open } from "@tauri-apps/plugin-dialog";
import { openFileByPath, type DocMeta } from "../lib/doc";
import { createBlankDoc } from "../lib/pdfOps";
import { Glyph } from "../ui/kit";

export type { DocMeta };

type Row = {
  id: string;
  path: string;
  title: string;
  size_bytes: number;
  last_opened_at: number;
};

const TILE_HUES = [212, 262, 160, 24, 330, 190];

function fmtSize(b: number) {
  return b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
}
function fmtWhen(ts: number) {
  const d = new Date(ts * 1000);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same
    ? `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export default function Home({
  onOpen,
  darkHome = false,
}: {
  onOpen: (m: DocMeta) => void;
  darkHome?: boolean;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [newDoc, setNewDoc] = useState<null | { pages: number; template: "blank" | "grid" | "lines" | "dots"; title: string }>(null);

  const refresh = () => {
    Database.load("sqlite:inkdesk.db")
      .then((db) =>
        db.select<Row[]>(
          "SELECT id, path, title, size_bytes, last_opened_at FROM documents ORDER BY last_opened_at DESC",
        ),
      )
      .then(setRows)
      .catch((e) => setError(String(e)));
  };

  useEffect(refresh, []);

  const openDialog = async () => {
    const path = await open({ filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return;
    const r = await openFileByPath(path);
    if ("meta" in r) onOpen(r.meta);
    else setError(r.error);
  };

  const openRow = async (row: Row) => {
    const r = await openFileByPath(row.path);
    if ("meta" in r) onOpen(r.meta);
    else setError(r.error);
  };

  const forget = async (row: Row) => {
    try {
      const db = await Database.load("sqlite:inkdesk.db");
      await db.execute("DELETE FROM documents WHERE id = $1", [row.id]);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
    } catch (e) {
      setError(String(e));
    }
  };

  const visible = useMemo(() => {
    const list = rows ?? [];
    const f = filter.trim().toLowerCase();
    return f ? list.filter((r) => r.title.toLowerCase().includes(f)) : list;
  }, [rows, filter]);

  const hue = (i: number) => TILE_HUES[i % TILE_HUES.length];

  return (
    <div className={`home premium ${darkHome ? "home--dark" : ""}`}>
      <aside className="hside">
        <div className="hbrand">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 20l1.2-4.2L17.6 5.4a1.9 1.9 0 012.7 0l.3.3a1.9 1.9 0 010 2.7L10.2 18.8 6 20z" />
            <path d="M9 20c2-1 4-1 6 0" />
          </svg>
          <div>
            <b>Inkdesk</b>
            <span className="hbrand__sub">markup & notes</span>
          </div>
        </div>

        <div className="hsection">Library</div>
        <nav className="hnav">
          <button className="hnav__item is-active">
            <Glyph name="insert" size={15} />
            All files
            <span className="hpill">{rows?.length ?? 0}</span>
          </button>
          <button className="hnav__item">
            <Glyph name="shapes" size={15} />
            Recent
            <span className="hpill">{rows?.length ?? 0}</span>
          </button>
        </nav>

        <div className="hsection">Create</div>
        <button className="hcreate" onClick={() => setNewDoc({ pages: 10, template: "lines", title: "Notes " + new Date().toLocaleDateString() })}>
          <Glyph name="pen" size={16} />
          New note document
          <span className="hcreate__arrow">→</span>
        </button>

        <div className="hfoot">
          <span className="hfoot__badge">100% free</span>
          <span>no accounts · offline</span>
        </div>
      </aside>

      <main className="hmain">
        <header className="hhero">
          <div>
            <h1>Your library</h1>
            <p>{rows?.length ?? 0} document{(rows?.length ?? 0) === 1 ? "" : "s"} · everything unlocked, forever</p>
          </div>
          <div className="hhero__actions">
            <button className="hbtn hbtn--ghost" onClick={openDialog}>
              <Glyph name="insert" size={15} /> Open
            </button>
            <button className="hbtn hbtn--primary" onClick={() => setNewDoc({ pages: 10, template: "lines", title: "Notes " + new Date().toLocaleDateString() })}>
              <Glyph name="pen" size={15} /> New note
            </button>
          </div>
        </header>

        <div className="htools">
          <div className="hsearch-wrap">
            <span className="hsearch-icon"><Glyph name="textreview" size={14} /></span>
            <input
              className="hsearch"
              placeholder="Search your files"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="hviews">
            <button className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")} title="Grid">▦</button>
            <button className={view === "list" ? "is-active" : ""} onClick={() => setView("list")} title="List">☰</button>
          </div>
        </div>

        {error && <div className="herror">{error}</div>}

        {visible.length === 0 ? (
          <div className="hempty">
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <path d="M6 20l1.2-4.2L17.6 5.4a1.9 1.9 0 012.7 0l.3.3a1.9 1.9 0 010 2.7L10.2 18.8 6 20z" />
            </svg>
            <h3>{rows === null ? "Loading…" : "Nothing here yet"}</h3>
            <p>Open a PDF to start marking it up — your original file is never touched.</p>
            <button className="hbtn hbtn--primary" onClick={openDialog}>Open a PDF</button>
          </div>
        ) : view === "grid" ? (
          <div className="hgrid">
            {visible.map((r, i) => (
              <button key={r.id} className="hcard" onClick={() => openRow(r)}>
                <span className="hcard__tile" style={{ background: `linear-gradient(135deg, hsl(${hue(i)} 70% 46%), hsl(${hue(i) + 40} 65% 34%))` }}>
                  <Glyph name="insert" size={26} />
                  <span className="hcard__ext">PDF</span>
                </span>
                <span className="hcard__name">{r.title}</span>
                <span className="hcard__meta">{fmtWhen(r.last_opened_at)} · {fmtSize(r.size_bytes)}</span>
                <span
                  className="hcard__more"
                  role="button"
                  aria-label="remove from list"
                  onClick={(e) => { e.stopPropagation(); void forget(r); }}
                >
                  ⋯
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="htable">
            {visible.map((r, i) => (
              <button key={r.id} className="hrow" onClick={() => openRow(r)}>
                <span className="hrow__tile" style={{ background: `linear-gradient(135deg, hsl(${hue(i)} 70% 46%), hsl(${hue(i) + 40} 65% 34%))` }}>
                  <Glyph name="insert" size={13} />
                </span>
                <span className="hrow__name">{r.title}</span>
                <span className="hrow__meta">{fmtWhen(r.last_opened_at)}</span>
                <span className="hrow__meta">{fmtSize(r.size_bytes)}</span>
                <span
                  className="hcard__more"
                  role="button"
                  aria-label="remove from list"
                  onClick={(e) => { e.stopPropagation(); void forget(r); }}
                >
                  ⋯
                </span>
              </button>
            ))}
          </div>
        )}

        {newDoc && (
          <div className="modal-backdrop" onClick={() => setNewDoc(null)}>
            <div className="modal modal--light" onClick={(e) => e.stopPropagation()}>
              <div className="modal__head">
                <h2 style={{ fontSize: 16, color: "#1b2530" }}>New note document</h2>
                <button className="modal__close" onClick={() => setNewDoc(null)}>×</button>
              </div>
              <label className="newdoc-row">
                <span>Title</span>
                <input className="home__search" value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} />
              </label>
              <label className="newdoc-row">
                <span>Pages</span>
                <input
                  type="number" min={1} max={300} className="home__search" style={{ maxWidth: 110 }}
                  value={newDoc.pages}
                  onChange={(e) => setNewDoc({ ...newDoc, pages: Math.max(1, Math.min(300, Number(e.target.value) || 1)) })}
                />
              </label>
              <div className="newdoc-row">
                <span>Template</span>
                <div className="seg seg--light">
                  {(["blank", "lines", "grid", "dots"] as const).map((t) => (
                    <button key={t} className={newDoc.template === t ? "is-active" : ""} onClick={() => setNewDoc({ ...newDoc, template: t })}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal__foot">
                <span style={{ fontSize: 11, color: "#64748b" }}>Saves to your Documents folder</span>
                <button
                  className="hbtn hbtn--primary"
                  onClick={async () => {
                    try {
                      const path = await createBlankDoc({
                        dir: "C:\\Users\\Administrator\\Documents",
                        pages: newDoc.pages,
                        size: [595, 842],
                        color: { r: 1, g: 1, b: 1 },
                        template: newDoc.template,
                        title: newDoc.title,
                      });
                      setNewDoc(null);
                      const r = await openFileByPath(path);
                      if ("meta" in r) onOpen(r.meta);
                    } catch (e2) {
                      setError(String(e2));
                    }
                  }}
                >
                  Create & open
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="hpagefoot">Inkdesk v0.1.0 · 100% free forever · works offline</footer>
      </main>
    </div>
  );
}
