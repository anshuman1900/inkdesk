import { useEffect, useState } from "react";
import * as pdfjs from "pdfjs-dist";

const TIPS = [
  "Did you know you can drag and drop pages to reorder them in the Pages menu?",
  "Everything in Inkdesk is free — no subscriptions, ever.",
  "Your original PDF is never modified until you choose to flatten or save as new.",
  "Press K anywhere to preview the UI kit.",
  "Stylus draws, touch pans — palm rejection is on by default.",
];

// minimal valid single-page PDF used to warm the pdf.js worker + wasm during splash
const TINY_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f 
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`;

export default function Splash({ onDone }: { onDone: () => void }) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    // prewarm: compile the worker + wasm now so the first real open is fast
    const bytes = new TextEncoder().encode(TINY_PDF);
    const task = pdfjs.getDocument({ data: bytes });
    task.promise
      .then(() => task.destroy().catch(() => {}))
      .catch(() => {});
    const t = setTimeout(onDone, 1400);
    return () => {
      clearTimeout(t);
      task.destroy().catch(() => {});
    };
  }, [onDone]);

  return (
    <main className="splash" onClick={onDone}>
      <svg
        className="splash__mark"
        width="72"
        height="72"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 20l1.2-4.2L17.6 5.4a1.9 1.9 0 012.7 0l.3.3a1.9 1.9 0 010 2.7L10.2 18.8 6 20z" />
        <path d="M9 20c2-1 4-1 6 0" />
      </svg>
      <div className="splash__tip-label">TIP</div>
      <div className="splash__tip">{tip}</div>
    </main>
  );
}
