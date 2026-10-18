import { useEffect, useMemo, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import { open } from "@tauri-apps/plugin-dialog";
import { openFileByPath, type DocMeta } from "../lib/doc";

export type { DocMeta };

type Row = {
  id: string;
  path: string;
  title: string;
  size_bytes: number;
  last_opened_at: number;
};

export default function Home({ onOpen }: { onOpen: (m: DocMeta) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"all" | "device" | "deleted">("all");

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

  const fmtSize = (b: number) =>
    b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;

  return (
    <div className="home">
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
          <button className="btn-plus" title="New blank document — arrives in P17" disabled>
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
              <span className="home__dim">⋯</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
