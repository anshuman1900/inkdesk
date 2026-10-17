import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import KitPage from "./pages/KitPage";

type TableRow = { name: string };

function Home() {
  const [tables, setTables] = useState<string[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    Database.load("sqlite:inkdesk.db")
      .then((db) =>
        db.select<TableRow[]>(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        ),
      )
      .then((rows) => {
        if (!cancelled) setTables(rows.map((r) => r.name));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const coreTables = (tables ?? []).filter((t) => !t.startsWith("_"));

  return (
    <main className="content">
      <h1>Inkdesk</h1>
      <p className="tagline">
        Free, local-first PDF markup + notes. Every feature unlocked.
      </p>
      <section className="card">
        <h2>P1 exit checks</h2>
        <ul>
          <li>
            Window opens (Tauri 2 + WebView2): <b className="ok">pass</b>
          </li>
          <li>
            SQLite schema:{" "}
            {error ? (
              <b className="bad">error — {error}</b>
            ) : tables === null ? (
              <b>loading…</b>
            ) : coreTables.length === 8 ? (
              <b className="ok">pass — 8 tables</b>
            ) : (
              <b className="bad">{coreTables.length} tables (expected 8)</b>
            )}
          </li>
        </ul>
        {tables !== null && <pre className="tables">{coreTables.join("\n")}</pre>}
      </section>
    </main>
  );
}

export default function App() {
  const [showKit, setShowKit] = useState(
    () => window.location.hash === "#kit",
  );

  useEffect(() => {
    const onHash = () => setShowKit(window.location.hash === "#kit");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" || e.key === "K") setShowKit((v) => !v);
      if (e.key === "Escape") setShowKit(false);
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="shell">
      <header className="titlebar">
        <span className="logo-dot" />
        <span className="title">Inkdesk</span>
        <span className="version">
          v0.1.0 · {showKit ? "P2 UI kit" : "P1 scaffold"} · press K to toggle kit
        </span>
      </header>
      {showKit ? <KitPage /> : <Home />}
    </div>
  );
}
