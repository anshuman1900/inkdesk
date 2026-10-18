import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "../pdf/engine";

/* ---------- shared right slide-in ---------- */
export function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="sidepanel">
      <div className="sidepanel__head">
        <b>{title}</b>
        <button className="modal__close" onClick={onClose} aria-label="close">×</button>
      </div>
      <div className="sidepanel__body">{children}</div>
    </div>
  );
}

/* ---------- P16: pages panel ---------- */
export function PagesPanel({
  doc,
  onClose,
  onApply,
}: {
  doc: PDFDocumentProxy;
  onClose: () => void;
  onApply: (order: number[], rotations: Record<number, number>) => void;
}) {
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [order, setOrder] = useState<number[]>(() =>
    Array.from({ length: doc.numPages }, (_, i) => i),
  );
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const dragIdx = useRef<number | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    (async () => {
      for (const oldIdx of order) {
        if (cancelled.current || thumbs[oldIdx]) continue;
        try {
          const page = await doc.getPage(oldIdx + 1);
          const vp = page.getViewport({ scale: 0.22 });
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.floor(vp.width));
          c.height = Math.max(1, Math.floor(vp.height));
          await page.render({
            canvas: c,
            canvasContext: c.getContext("2d")!,
            viewport: vp,
          }).promise;
          if (cancelled.current) return;
          setThumbs((prev) => ({ ...prev, [oldIdx]: c.toDataURL("image/jpeg", 0.6) }));
        } catch {
          /* skip */
        }
      }
    })();
    return () => {
      cancelled.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const move = (idx: number, dir: -1 | 1) => {
    setOrder((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  return (
    <SidePanel title={`Pages (${order.length})`} onClose={onClose}>
      <div className="pages-grid">
        {order.map((oldIdx, i) => (
          <div
            key={`${oldIdx}-${i}`}
            className={`pages-thumb ${removed.has(oldIdx) ? "is-removed" : ""}`}
            draggable
            onDragStart={() => (dragIdx.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const from = dragIdx.current;
              if (from === null || from === i) return;
              setOrder((prev) => {
                const next = [...prev];
                const [m] = next.splice(from, 1);
                next.splice(i, 0, m);
                return next;
              });
              dragIdx.current = null;
            }}
          >
            {thumbs[oldIdx] ? (
              <img src={thumbs[oldIdx]} alt={`page ${oldIdx + 1}`} />
            ) : (
              <span className="pages-thumb__ph">{oldIdx + 1}</span>
            )}
            <div className="pages-thumb__ops">
              <button title="Move earlier" onClick={() => move(i, -1)}>‹</button>
              <button title="Move later" onClick={() => move(i, 1)}>›</button>
              <button
                title="Rotate 90°"
                onClick={() =>
                  setRotations((r) => ({ ...r, [oldIdx]: ((r[oldIdx] ?? 0) + 1) % 4 }))
                }
              >
                ⟳{(rotations[oldIdx] ?? 0) * 90 || ""}
              </button>
              <button title="Delete page" onClick={() => setRemoved((r) => new Set(r).add(oldIdx))}>✕</button>
            </div>
            {(rotations[oldIdx] ?? 0) > 0 && (
              <span className="pages-thumb__rot">{rotations[oldIdx] * 90}°</span>
            )}
          </div>
        ))}
      </div>
      <div className="pages-panel__foot">
        <button
          className="btn"
          onClick={() => setOrder((prev) => [...prev, -1])}
          title="Insert a blank page at the end"
        >
          + Blank page
        </button>
        <button
          className="btn btn--accent"
          onClick={() => {
            const finalOrder = order.filter((i) => !removed.has(i) || i === -1);
            onApply(finalOrder, rotations);
          }}
        >
          Apply (saves as new copy)
        </button>
      </div>
      <p className="sidepanel__note">
        Drag thumbnails to reorder. Original file is never modified — changes save
        to a new copy.
      </p>
    </SidePanel>
  );
}

/* ---------- P18: bookmarks ---------- */
export interface Bookmark {
  id: string;
  page_index: number;
  label: string | null;
}

export function BookmarksPanel({
  bookmarks,
  onGo,
  onAdd,
  onRemove,
  onClose,
}: {
  bookmarks: Bookmark[];
  onGo: (page: number) => void;
  onAdd: (page: number) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <SidePanel title="Bookmarks" onClose={onClose}>
      <button className="btn btn--accent bookmark-add" onClick={() => onAdd(-1)}>
        + Bookmark this page
      </button>
      {bookmarks.length === 0 && <p className="sidepanel__note">No bookmarks yet.</p>}
      {bookmarks
        .slice()
        .sort((a, b) => a.page_index - b.page_index)
        .map((b) => (
          <div key={b.id} className="bookmark-row">
            <button className="bookmark-row__go" onClick={() => onGo(b.page_index + 1)}>
              Page {b.page_index + 1}
            </button>
            <button className="tab__close" onClick={() => onRemove(b.id)} aria-label="remove">×</button>
          </div>
        ))}
    </SidePanel>
  );
}

/* ---------- P18: search ---------- */
export interface SearchHit {
  page: number;
  snippet: string;
}

export function SearchPanel({
  hits,
  total,
  onGo,
  onClose,
}: {
  hits: SearchHit[];
  total: number;
  onGo: (page: number) => void;
  onClose: () => void;
}) {
  return (
    <SidePanel title={`Search (${hits.length} hits)`} onClose={onClose}>
      {hits.length === 0 && <p className="sidepanel__note">No matches.</p>}
      {hits.map((h, i) => (
        <button key={i} className="search-hit" onClick={() => onGo(h.page + 1)}>
          <b>p.{h.page + 1}</b> …{h.snippet}…
        </button>
      ))}
      <p className="sidepanel__note">Searched {total} pages with a text layer.</p>
    </SidePanel>
  );
}

/* ---------- P19: markup history ---------- */
export function HistoryPanel({
  entries,
  onJump,
  onDelete,
  onClose,
}: {
  entries: { id: string; type: string; page: number; at: number }[];
  onJump: (page: number) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <SidePanel title={`Markup history (${entries.length})`} onClose={onClose}>
      {entries.length === 0 && <p className="sidepanel__note">No markups yet.</p>}
      {entries.map((e) => (
        <div key={e.id} className="history-row">
          <button className="history-row__go" onClick={() => onJump(e.page + 1)}>
            <b>{e.type}</b> · p.{e.page + 1} · {new Date(e.at * 1000).toLocaleTimeString()}
          </button>
          <button className="tab__close" onClick={() => onDelete(e.id)} aria-label="delete">×</button>
        </div>
      ))}
    </SidePanel>
  );
}
