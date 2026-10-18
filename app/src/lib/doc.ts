import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

export interface DocMeta {
  id: string;
  path: string;
  title: string;
  sizeBytes: number;
}

export const FIXTURE_PATH = "E:\\drawboard-clone\\test-fixtures\\big120.pdf";

export async function openFileByPath(
  path: string,
): Promise<{ meta: DocMeta } | { error: string }> {
  try {
    const res = await invoke<string>("doc_register", { path });
    const [id, sizeStr] = res.split(":");
    const title = path.replace(/\\/g, "/").split("/").pop() ?? path;
    const meta: DocMeta = { id, path, title, sizeBytes: Number(sizeStr) || 0 };
    // recents must never block opening a document
    await upsertRecents(meta).catch((e) => console.warn("recents:", e));
    return { meta };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function upsertRecents(meta: DocMeta): Promise<void> {
  const db = await Database.load("sqlite:inkdesk.db");
  await db.execute(
    `INSERT INTO documents (id, path, title, size_bytes, last_opened_at)
     VALUES ($1, $2, $3, $4, strftime('%s','now'))
     ON CONFLICT(path) DO UPDATE SET last_opened_at = strftime('%s','now')`,
    [meta.id, meta.path, meta.title, meta.sizeBytes],
  );
}
