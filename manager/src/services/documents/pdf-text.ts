import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

function resolvePdfjsFiles(): { pdf: string; worker: string } {
  const pdfCandidates = [
    join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.mjs"),
    join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.mjs"),
  ];
  const workerCandidates = [
    join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
    join(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.mjs"),
  ];
  const pdf = pdfCandidates.find((candidate) => existsSync(candidate));
  const worker = workerCandidates.find((candidate) => existsSync(candidate));
  if (!pdf || !worker) {
    throw new Error("The PDF parser files were not found.");
  }
  return { pdf, worker };
}

async function loadPdfjs(): Promise<PdfJsModule> {
  const files = resolvePdfjsFiles();
  const importer = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<PdfJsModule>;
  const pdfjs = await importer(pathToFileURL(files.pdf).href);
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(files.worker).href;
  return pdfjs;
}

export async function extractPdfPageTexts(
  bytes: Uint8Array,
): Promise<string[]> {
  const pdfjs = await loadPdfjs();
  const data =
    bytes.byteLength === bytes.buffer.byteLength
      ? bytes
      : Uint8Array.from(bytes);
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
  });

  try {
    const documentProxy = await loadingTask.promise;
    const pages: string[] = [];
    const pageCount = Math.min(documentProxy.numPages, 40);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("\n");
      pages.push(text);
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
