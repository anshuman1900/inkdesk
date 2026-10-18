import Database from "@tauri-apps/plugin-sql";

export interface Favorite {
  id: string;
  tool: "pen" | "highlighter" | "eraser";
  color: string;
  width: number;
  opacity: number;
}

const KEY = "favorites";

export async function loadFavorites(): Promise<Favorite[]> {
  try {
    const db = await Database.load("sqlite:inkdesk.db");
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM app_settings WHERE key = $1",
      [KEY],
    );
    if (rows.length === 0) {
      // sensible starter set
      return [
        { id: "f1", tool: "pen", color: "#1e1f24", width: 2.2, opacity: 1 },
        { id: "f2", tool: "highlighter", color: "#f2b23e", width: 14, opacity: 0.45 },
        { id: "f3", tool: "pen", color: "#ff4d4d", width: 3, opacity: 1 },
      ];
    }
    return JSON.parse(rows[0].value) as Favorite[];
  } catch {
    return [];
  }
}

export async function saveFavorites(favs: Favorite[]): Promise<void> {
  const db = await Database.load("sqlite:inkdesk.db");
  await db.execute(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = $2`,
    [KEY, JSON.stringify(favs)],
  );
}
