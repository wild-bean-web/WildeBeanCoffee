"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="icon-button"
      aria-label="Log out"
      disabled={pending}
      onClick={() => void signOut()}
    >
      <LogOut size={18} aria-hidden="true" />
    </button>
  );
}
