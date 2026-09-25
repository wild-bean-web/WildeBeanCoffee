"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, setPending] = useState(false);
  const here = `${pathname}?${search.toString()}`;

  useEffect(() => {
    setPending(false);
  }, [here]);

  useEffect(() => {
    function startsHere(url: URL): boolean {
      return `${url.pathname}?${url.searchParams.toString()}` === `${window.location.pathname}?${window.location.search.replace(/^\?/, "")}`;
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || startsHere(url)) return;
      setPending(true);
    }

    function onSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.method.toLowerCase() !== "get") return;
      setPending(true);
    }

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(false), 12000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  if (!pending) return null;

  return (
    <div className="nav-pending" role="status" aria-live="polite">
      <div className="nav-pending-bar" />
      <p>Loading</p>
    </div>
  );
}
