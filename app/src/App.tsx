import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import Splash from "./screens/Splash";
import Home, { type DocMeta } from "./screens/Home";
import Viewer from "./viewer/Viewer";
import KitPage from "./pages/KitPage";
import SettingsModal from "./screens/Settings";
import { openFileByPath, FIXTURE_PATH } from "./lib/doc";
import { loadSettings, type UiSettings } from "./lib/settings";

type Phase = "splash" | "home" | "viewer";

export default function App() {
  const [phase, setPhase] = useState<Phase>("splash");
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [night, setNight] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<UiSettings>({
    touchDraw: false,
    layout: "continuous",
    radialOn: false,
    darkHome: false,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showKit, setShowKit] = useState(
    () => window.location.hash === "#kit",
  );

  useEffect(() => {
    Database.load("sqlite:inkdesk.db").catch(() => {});
    void loadSettings().then(setSettings);
  }, []);

  const openDoc = (m: DocMeta) => {
    setDocs((prev) => (prev.some((d) => d.id === m.id) ? prev : [...prev, m]));
    setActiveId(m.id);
    setPhase("viewer");
  };

  const closeTab = (id: string) => {
    const idx = docs.findIndex((d) => d.id === id);
    const next = docs.filter((d) => d.id !== id);
    setDocs(next);
    if (id === activeId) {
      const neighbour = next[Math.min(idx, next.length - 1)];
      if (neighbour) {
        setActiveId(neighbour.id);
      } else {
        setActiveId(null);
        setPhase("home");
      }
    }
  };

  const toggleNight = () => {
    if (!activeId) return;
    setNight((prev) => {
      const next = { ...prev, [activeId]: !prev[activeId] };
      const db = Database.load("sqlite:inkdesk.db").then((db) =>
        db.execute("UPDATE documents SET night_mode = $1 WHERE id = $2", [
          next[activeId] ? 1 : 0,
          activeId,
        ]),
      );
      void db.catch(() => {});
      return next;
    });
  };

  const toggleLayout = () => {
    const next = settings.layout === "continuous" ? "single" : "continuous";
    setSettings({ ...settings, layout: next });
    void import("./lib/settings").then((m) => m.saveSettings({ ...settings, layout: next }).catch(() => {}));
  };

  useEffect(() => {
    const onHash = () => setShowKit(window.location.hash === "#kit");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" || e.key === "K") setShowKit((v) => !v);
      if (e.key === "F8") {
        void openFileByPath(FIXTURE_PATH).then((r) => {
          if ("meta" in r) openDoc(r.meta);
        });
      }
      if (e.key === "F9") {
        // dev: open the most recent other document from recents (second tab)
        void (async () => {
          try {
            const db = await Database.load("sqlite:inkdesk.db");
            const rows = await db.select<{ path: string }[]>(
              "SELECT path FROM documents WHERE path != $1 ORDER BY last_opened_at DESC LIMIT 1",
              [docs.find((d) => d.id === activeId)?.path ?? ""],
            );
            if (rows.length > 0) {
              const r = await openFileByPath(rows[0].path);
              if ("meta" in r) openDoc(r.meta);
            }
          } catch {
            /* dev-only */
          }
        })();
      }
      if (e.key === "m" || e.key === "M") toggleNight();
      if (e.key === "l" || e.key === "L") toggleLayout();
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, activeId, settings]);

  if (showKit) {
    return (
      <div className="shell">
        <header className="titlebar">
          <span className="logo-dot" />
          <span className="title">Inkdesk</span>
          <span className="version">P2 UI kit · press K to exit</span>
        </header>
        <KitPage />
      </div>
    );
  }

  const activeDoc = docs.find((d) => d.id === activeId) ?? null;

  return (
    <div className="shell shell--app">
      {phase === "splash" && <Splash onDone={() => setPhase("home")} />}
      {phase === "home" && (
        <Home onOpen={openDoc} />
      )}
      {phase === "viewer" && activeDoc && (
        <Viewer
          key={activeDoc.id}
          meta={activeDoc}
          tabs={docs}
          night={!!night[activeDoc.id]}
          layout={settings.layout}
          touchDraw={settings.touchDraw}
          radialOn={settings.radialOn}
          onSelectTab={(id) => setActiveId(id)}
          onCloseTab={closeTab}
          onAddTab={() => setPhase("home")}
          onToggleNight={toggleNight}
          onOpenSettings={() => setShowSettings(true)}
          onBack={() => {
            setActiveId(null);
            setPhase("home");
          }}
          onReplaceTab={(oldId, m) => {
            setDocs((prev) => prev.map((d) => (d.id === oldId ? m : d)));
            setActiveId(m.id);
          }}
        />
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onChange={(s) => setSettings(s)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
