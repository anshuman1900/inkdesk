import Database from "@tauri-apps/plugin-sql";

export interface UiSettings {
  touchDraw: boolean; // false = touch pans (palm rejection), true = touch draws
  layout: "continuous" | "single";
  radialOn: boolean; // honored in P9
}

export const DEFAULTS: UiSettings = {
  touchDraw: false,
  layout: "continuous",
  radialOn: false,
};

const KEY = "ui";

export async function loadSettings(): Promise<UiSettings> {
  try {
    const db = await Database.load("sqlite:inkdesk.db");
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM app_settings WHERE key = $1",
      [KEY],
    );
    if (rows.length === 0) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(rows[0].value) as Partial<UiSettings>) };
  } catch (e) {
    console.warn("settings load:", e);
    return { ...DEFAULTS };
  }
}

export async function saveSettings(s: UiSettings): Promise<void> {
  const db = await Database.load("sqlite:inkdesk.db");
  await db.execute(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $2`,
    [KEY, JSON.stringify(s)],
  );
}
