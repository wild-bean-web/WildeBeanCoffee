"use client";

import { useEffect, useRef, useState } from "react";

export function DocumentOriginalPreview({
  src,
  title,
  mimeType,
  focusPage,
  highlightPages = [],
}: {
  src: string;
  title: string;
  mimeType: string;
  focusPage?: number;
  highlightPages?: number[];
}) {
  if (mimeType.startsWith("image/")) {
    return (
      <img className="document-preview-image" alt={title} src={src} />
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <PdfPagePreview
        src={src}
        title={title}
        focusPage={focusPage}
        highlightPages={highlightPages}
      />
    );
  }

  return (
    <p className="text-sm text-muted">
      This file type is stored, but it cannot be previewed here. Open it in a
      new tab.
    </p>
  );
}

function PdfPagePreview({
  src,
  title,
  focusPage,
  highlightPages,
}: {
  src: string;
  title: string;
  focusPage?: number;
  highlightPages: number[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading original file…");
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState(0);
  const highlightKey = highlightPages.join(",");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const root: HTMLDivElement = host;

    let cancelled = false;
    let destroyDocument: (() => Promise<void>) | undefined;

    async function renderPages() {
      try {
        const response = await fetch(src, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error("The original file could not be loaded.");
        }

        const data = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingTask = pdfjs.getDocument({
          data,
        });
        const documentProxy = await loadingTask.promise;
        destroyDocument = () => loadingTask.destroy();
        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        root.replaceChildren();
        const pageCount = Math.min(documentProxy.numPages, 40);
        const width = root.clientWidth || 800;

        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          const page = await documentProxy.getPage(pageNumber);
          const unscaled = page.getViewport({ scale: 1 });
          const outputScale = window.devicePixelRatio || 1;
          const scale = width / unscaled.width;
          const viewport = page.getViewport({ scale: scale * outputScale });
          const wrap = document.createElement("figure");
          wrap.className = "document-preview-page-wrap";
          wrap.dataset.page = String(pageNumber);
          wrap.id = `pdf-page-${pageNumber}`;
          const caption = document.createElement("figcaption");
          caption.className = "document-preview-page-label";
          caption.textContent = `Page ${pageNumber}`;
          const canvas = document.createElement("canvas");
          canvas.className = "document-preview-page";
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.setAttribute(
            "aria-label",
            `${title}, page ${pageNumber} of ${documentProxy.numPages}`,
          );
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("The original file could not be drawn.");
          }
          await page.render({
            canvas,
            canvasContext: context,
            viewport,
          }).promise;
          if (cancelled) {
            await loadingTask.destroy();
            return;
          }
          wrap.append(caption, canvas);
          root.appendChild(wrap);
        }

        setRenderedPages(pageCount);
        setStatus(
          documentProxy.numPages > pageCount
            ? `Showing the first ${pageCount} pages. Open the file in a new tab to see the rest.`
            : "",
        );
      } catch (caught) {
        console.error("Original PDF preview failed", caught);
        if (!cancelled) {
          setError(
            "The original file could not be shown here. Use Open in a new tab.",
          );
          setStatus("");
        }
      }
    }

    void renderPages();

    return () => {
      cancelled = true;
      root.replaceChildren();
      void destroyDocument?.();
    };
  }, [src, title]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    for (const wrap of host.querySelectorAll<HTMLElement>(".document-preview-page-wrap")) {
      const pageNumber = Number(wrap.dataset.page);
      wrap.classList.toggle(
        "is-active",
        highlightPages.includes(pageNumber),
      );
    }
    if (!focusPage) return;
    host.querySelector(`#pdf-page-${focusPage}`)?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [focusPage, highlightKey, highlightPages, renderedPages]);

  if (error) {
    return <p className="text-sm text-muted">{error}</p>;
  }

  return (
    <div className="document-preview-pages">
      {status ? <p className="text-sm text-muted">{status}</p> : null}
      <div ref={hostRef} />
    </div>
  );
}
