"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isKitchenAdminEmail } from "@/lib/kitchenAdmin";

export default function KitchenLayout({ children }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/auth");
      return;
    }

    if (!isKitchenAdminEmail(user.email)) {
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

  if (!isKitchenAdminEmail(user.email)) {
    return null;
  }

  return <>{children}</>;
}

