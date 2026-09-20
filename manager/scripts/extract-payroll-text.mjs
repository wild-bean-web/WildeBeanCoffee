import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const worker = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href;

const bytes = new Uint8Array(
  readFileSync("src/domain/payroll/fixtures/payroll-preview.pdf"),
);
const loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
const documentProxy = await loadingTask.promise;
const pages = [];
for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
  const page = await documentProxy.getPage(pageNumber);
  const content = await page.getTextContent();
  pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join("\n"));
}
await loadingTask.destroy();
writeFileSync(
  "src/domain/payroll/fixtures/payroll-preview.pages.json",
  JSON.stringify(pages, null, 2),
);
for (const [index, page] of pages.entries()) {
  console.log(`\n===== PAGE ${index + 1} =====\n${page}`);
}
