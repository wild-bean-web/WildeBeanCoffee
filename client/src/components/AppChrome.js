"use client";

import { usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CookieNotice from "@/components/CookieNotice";

/**
 * Hides site chrome on /digitalmenu/* so TV displays are edge-to-edge in the viewport.
 */
export default function AppChrome({ children }) {
  const pathname = usePathname();
  const isDigitalMenu = pathname?.startsWith("/digitalmenu");

  if (isDigitalMenu) {
    return (
      <div className="fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-black">
        {children}
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      <Footer />
      <CookieNotice />
    </>
  );
}
