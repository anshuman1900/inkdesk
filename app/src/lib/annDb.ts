import Database from "@tauri-apps/plugin-sql";
import type { Annotation } from "./ink";

interface Row {
  id: string;
  page_index: number;
  type: string;
  geometry: string;
  style: string;
  data: string | null;
  z_order: number;
  created_at: number;
  updated_at: number;
}

function toAnn(docId: string, r: Row): Annotation {
  return {
    id: r.id,
    docId,
    page: r.page_index,
    type: r.type as Annotation["type"],
    geometry: JSON.parse(r.geometry),
    style: JSON.parse(r.style),
    data: r.data ? JSON.parse(r.data) : undefined,
    z: r.z_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function loadAnns(docId: string): Promise<Annotation[]> {
  const db = await Database.load("sqlite:inkdesk.db");
  const rows = await db.select<Row[]>(
    "SELECT id, page_index, type, geometry, style, data, z_order, created_at, updated_at FROM annotations WHERE document_id = $1 ORDER BY page_index, z_order",
    [docId],
  );
  return rows.map((r) => toAnn(docId, r));
}

export async function putAnn(a: Annotation): Promise<void> {
  const db = await Database.load("sqlite:inkdesk.db");
  await db.execute(
    `INSERT INTO annotations (id, document_id, page_index, type, geometry, style, data, z_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT(id) DO UPDATE SET
       geometry = $5, style = $6, data = $7, z_order = $8, updated_at = $10`,
    [
      a.id,
      a.docId,
      a.page,
      a.type,
      JSON.stringify(a.geometry),
      JSON.stringify(a.style),
      a.data ? JSON.stringify(a.data) : null,
      a.z,
      a.createdAt,
      a.updatedAt,
    ],
  );
}

export async function delAnn(id: string): Promise<void> {
  const db = await Database.load("sqlite:inkdesk.db");
  await db.execute("DELETE FROM annotations WHERE id = $1", [id]);
}

/** apply an undo/redo op to the DB (inverse already applied in the store) */
export async function syncOp(
  op:
    | { kind: "add"; ann: Annotation }
    | { kind: "del"; ann: Annotation }
    | { kind: "upd"; before: Annotation; after: Annotation },
  inverse: boolean,
): Promise<void> {
  if (op.kind === "add") {
    if (inverse) await delAnn(op.ann.id);
    else await putAnn(op.ann);
  } else if (op.kind === "del") {
    if (inverse) await putAnn(op.ann);
    else await delAnn(op.ann.id);
  } else if (op.kind === "upd") {
    await putAnn(inverse ? op.before : op.after);
  }
}
