"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_EMAILS = ["danielwoldehana@yahoo.com", "wildbeancoffeellc@gmail.com"];

export default function KitchenLayout({ children }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/auth");
      return;
    }

    const isAdmin = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
    if (!isAdmin) {
      router.replace("/");
      return;
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--coffee-brown-very-light)]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--coffee-brown-light)] border-t-[var(--lime-green)]" />
          <p className="mt-4 text-[var(--coffee-brown)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}

