import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import Splash from "./screens/Splash";
import Home, { type DocMeta } from "./screens/Home";
import Viewer from "./viewer/Viewer";
import KitPage from "./pages/KitPage";
import { openFileByPath, FIXTURE_PATH } from "./lib/doc";

type Phase = "splash" | "home" | "viewer";

export default function App() {
  const [phase, setPhase] = useState<Phase>("splash");
  const [doc, setDoc] = useState<DocMeta | null>(null);
  const [showKit, setShowKit] = useState(
    () => window.location.hash === "#kit",
  );

  useEffect(() => {
    // warm the DB while the splash shows
    Database.load("sqlite:inkdesk.db").catch(() => {});
  }, []);

  useEffect(() => {
    const onHash = () => setShowKit(window.location.hash === "#kit");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" || e.key === "K") setShowKit((v) => !v);
      if (e.key === "F8") {
        // dev shortcut: open the 120-page perf fixture (removed at release gate)
        void openFileByPath(FIXTURE_PATH).then((r) => {
          if ("meta" in r) {
            setDoc(r.meta);
            setPhase("viewer");
          }
        });
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

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

  return (
    <div className="shell shell--app">
      {phase === "splash" && <Splash onDone={() => setPhase("home")} />}
      {phase === "home" && (
        <Home
          onOpen={(m) => {
            setDoc(m);
            setPhase("viewer");
          }}
        />
      )}
      {phase === "viewer" && doc && (
        <Viewer
          meta={doc}
          onBack={() => {
            setDoc(null);
            setPhase("home");
          }}
        />
      )}
    </div>
  );
}
