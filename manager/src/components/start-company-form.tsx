"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function StartCompanyForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: form.get("companyName"),
          locationName: form.get("locationName"),
          ownerName: form.get("ownerName"),
          email,
          password,
          timezone: form.get("timezone"),
        }),
      });
      const result = (await response.json()) as { error?: { message: string } };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "The company was not created.");
      }
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("Sign-in is not configured.");
      const signedIn = await supabase.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw new Error("The company was created. Sign in with that email.");
      router.replace("/settings");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The company was not created.");
      setPending(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="field">
        <label htmlFor="companyName">Company</label>
        <input id="companyName" name="companyName" className="input" required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="locationName">First location</label>
        <input id="locationName" name="locationName" className="input" required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="ownerName">Your name</label>
        <input id="ownerName" name="ownerName" className="input" required minLength={2} />
      </div>
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" className="input" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" className="input" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div className="field">
        <label htmlFor="timezone">Timezone</label>
        <select id="timezone" name="timezone" className="input" defaultValue="America/New_York">
          <option value="America/New_York">Eastern</option>
          <option value="America/Chicago">Central</option>
          <option value="America/Denver">Mountain</option>
          <option value="America/Los_Angeles">Pacific</option>
        </select>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Creating company…" : "Create company"}
      </button>
    </form>
  );
}
