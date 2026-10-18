import { useEffect, useMemo, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import { open } from "@tauri-apps/plugin-dialog";
import { openFileByPath, type DocMeta } from "../lib/doc";
import { createBlankDoc } from "../lib/pdfOps";

export type { DocMeta };

type Row = {
  id: string;
  path: string;
  title: string;
  size_bytes: number;
  last_opened_at: number;
};

export default function Home({ onOpen, darkHome = false }: { onOpen: (m: DocMeta) => void; darkHome?: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"all" | "device" | "deleted">("all");
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
    const path = await open({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!path) return;
    const r = await openFileByPath(path);
    if ("meta" in r) {
      // upsert into documents (recents)
      try {
        const db = await Database.load("sqlite:inkdesk.db");
        await db.execute(
          `INSERT INTO documents (id, path, title, size_bytes, last_opened_at)
           VALUES ($1, $2, $3, $4, strftime('%s','now'))
           ON CONFLICT(path) DO UPDATE SET last_opened_at = strftime('%s','now')`,
          [r.meta.id, r.meta.path, r.meta.title, r.meta.sizeBytes],
        );
      } catch (e) {
        setError("recents: " + String(e));
      }
      onOpen(r.meta);
    } else {
      setError(r.error);
    }
  };

  const openRow = async (row: Row) => {
    const r = await openFileByPath(row.path);
    if ("meta" in r) {
      try {
        const db = await Database.load("sqlite:inkdesk.db");
        await db.execute(
          "UPDATE documents SET last_opened_at = strftime('%s','now') WHERE id = $1",
          [row.id],
        );
      } catch {
        /* best-effort */
      }
      onOpen(r.meta);
    } else setError(r.error);
  };

  const visible = useMemo(() => {
    const list = rows ?? [];
    const f = filter.trim().toLowerCase();
    const byTab =
      tab === "all" ? list : tab === "device" ? list : []; // deleted: P-later
    return f ? byTab.filter((r) => r.title.toLowerCase().includes(f)) : byTab;
  }, [rows, filter, tab]);

  const forget = async (row: Row) => {
    try {
      const db = await Database.load("sqlite:inkdesk.db");
      await db.execute("DELETE FROM documents WHERE id = $1", [row.id]);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
    } catch (e) {
      setError(String(e));
    }
  };

  const fmtSize = (b: number) =>
    b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;

  return (
    <div className={`home ${darkHome ? "home--dark" : ""}`}>
      <aside className="home__side">
        <div className="home__brand">
          <span className="logo-dot" />
          Inkdesk
        </div>
        <nav className="home__nav">
          <button className={`home__navitem ${tab === "all" ? "is-active" : ""}`} onClick={() => setTab("all")}>
            All Files <span className="count">{rows?.length ?? 0}</span>
          </button>
          <button className={`home__navitem ${tab === "device" ? "is-active" : ""}`} onClick={() => setTab("device")}>
            Device <span className="count">{rows?.length ?? 0}</span>
          </button>
          <button className={`home__navitem ${tab === "deleted" ? "is-active" : ""}`} onClick={() => setTab("deleted")}>
            Recently Deleted <span className="count">0</span>
          </button>
        </nav>
        <div className="home__sidefoot">100% free · no accounts · offline</div>
      </aside>

      <main className="home__main">
        <div className="home__bar">
          <input
            className="home__search"
            placeholder="Search your files or tags"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="btn btn--accent" onClick={openDialog}>
            Open
          </button>
          <button className="btn-plus" title="New blank document" onClick={() => setNewDoc({ pages: 10, template: "lines", title: "Notes " + new Date().toLocaleDateString() })}>
            +
          </button>
        </div>

        {error && <div className="home__error">{error}</div>}

        <div className="home__table">
          <div className="home__thead">
            <span>Document Name</span>
            <span>Last opened</span>
            <span>Size</span>
            <span />
          </div>
          {visible.length === 0 && (
            <div className="home__empty">
              {rows === null ? "Loading…" : "No PDFs yet — click Open"}
            </div>
          )}
          {visible.map((r) => (
            <button key={r.id} className="home__row" onClick={() => openRow(r)}>
              <span className="home__docname">{r.title}</span>
              <span className="home__dim">
                {new Date(r.last_opened_at * 1000).toLocaleString()}
              </span>
              <span className="home__dim">{fmtSize(r.size_bytes)}</span>
              <button
                className="home__more"
                title="Remove from list"
                onClick={(e) => {
                  e.stopPropagation();
                  void forget(r);
                }}
              >
                ⋯
              </button>
            </button>
          ))}
        </div>
      {newDoc && (
        <div className="modal-backdrop" onClick={() => setNewDoc(null)}>
          <div className="modal modal--light" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h2 style={{ fontSize: 16, color: "#1b2530" }}>New note document</h2>
              <button className="modal__close" onClick={() => setNewDoc(null)}>×</button>
            </div>
            <label className="newdoc-row">
              <span>Title</span>
              <input
                className="home__search"
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              />
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
                className="btn btn--accent"
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
      </main>
    </div>
  );
}
