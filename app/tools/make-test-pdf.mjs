// Generates test fixtures: big120.pdf (perf gate) — run: node make-test-pdf.mjs
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "test-fixtures");
mkdirSync(dir, { recursive: true });

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

for (let i = 1; i <= 120; i++) {
  const page = doc.addPage([595, 842]); // A4
  page.drawRectangle({ x: 0, y: 762, width: 595, height: 80, color: rgb(0.12, 0.16, 0.35) });
  page.drawText(`Inkdesk test fixture — page ${i} of 120`, {
    x: 48, y: 800, size: 18, font: bold, color: rgb(1, 1, 1),
  });
  for (let l = 0; l < 24; l++) {
    page.drawText(
      `Line ${l + 1}: lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod (${i})`,
      { x: 48, y: 720 - l * 26, size: 11, font, color: rgb(0.15, 0.18, 0.22) },
    );
  }
}

writeFileSync(join(dir, "big120.pdf"), await doc.save());
console.log("wrote big120.pdf (120 pages)");
