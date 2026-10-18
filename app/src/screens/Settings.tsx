import { useEffect, useState } from "react";
import { DEFAULTS, saveSettings, type UiSettings } from "../lib/settings";

export default function SettingsModal({
  settings,
  onChange,
  onClose,
}: {
  settings: UiSettings;
  onChange: (s: UiSettings) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<UiSettings>(settings);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const update = (patch: Partial<UiSettings>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
    void saveSettings(next).catch(() => {});
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>Settings</h2>
          <button className="modal__close" onClick={onClose} aria-label="close">
            ×
          </button>
        </div>

        <section className="modal__section">
          <h3>View & layout</h3>
          <label className="toggle">
            <span>Night mode (per document, moon in tab bar)</span>
          </label>
          <div className="modal__row">
            <span>Page layout</span>
            <div className="seg">
              <button
                className={local.layout === "continuous" ? "is-active" : ""}
                onClick={() => update({ layout: "continuous" })}
              >
                Continuous
              </button>
              <button
                className={local.layout === "single" ? "is-active" : ""}
                onClick={() => update({ layout: "single" })}
              >
                Single page
              </button>
            </div>
          </div>
        </section>

        <section className="modal__section">
          <h3>Appearance</h3>
          <label className="toggle">
            <span>Dark home screen</span>
            <span
              className={`toggle__track ${local.darkHome ? "is-on" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                update({ darkHome: !local.darkHome });
              }}
            >
              <span className="toggle__thumb" />
            </span>
          </label>
        </section>

        <section className="modal__section">
          <h3>Input</h3>
          <label className="toggle">
            <span>Touch draws (off = touch pans, pen always draws)</span>
            <span
              className={`toggle__track ${local.touchDraw ? "is-on" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                update({ touchDraw: !local.touchDraw });
              }}
            >
              <span className="toggle__thumb" />
            </span>
          </label>
        </section>

        <section className="modal__section">
          <h3>Tools</h3>
          <label className="toggle">
            <span>Use radial menu (right-click on the page)</span>
            <span
              className={`toggle__track ${local.radialOn ? "is-on" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                update({ radialOn: !local.radialOn });
              }}
            >
              <span className="toggle__thumb" />
            </span>
          </label>
        </section>

        <section className="modal__section">
          <h3>About</h3>
          <p className="modal__muted">
            Inkdesk v0.1.0 · P6 · 100% free, no accounts, offline. Every feature
            unlocked — now and forever.
          </p>
        </section>

        <div className="modal__foot">
          <span className="modal__muted">Defaults: {DEFAULTS.layout} layout</span>
          <button className="btn btn--accent" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
