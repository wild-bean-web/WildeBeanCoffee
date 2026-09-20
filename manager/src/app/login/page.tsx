"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand-mark";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Manager authentication has not been configured.");
      setSubmitting(false);
      return;
    }

    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError("The email or password was not accepted.");
      setSubmitting(false);
      return;
    }

    router.replace("/overview");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="Wild Bean Manager">
        <div className="auth-brand-content">
          <BrandMark large />
          <h1>Know what came in, what went out, and why.</h1>
          <p>
            One private workspace for store purchases, receiving, inventory,
            daily sales, COGS, and a close you can trace back to its source.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="brand-lockup">
            <BrandMark />
            <div>
              <p className="brand-name">Wild Bean Coffee</p>
              <p className="brand-subtitle">Private manager workspace</p>
            </div>
          </div>

          <h2>Sign in</h2>
          <p>
            Accounts are invitation-only. Financial and inventory permissions
            are assigned separately for each staff member.
          </p>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="button button-primary"
              disabled={submitting || !supabaseConfigured}
            >
              <LockKeyhole size={17} />
              {submitting ? "Signing in…" : "Continue securely"}
            </button>
          </form>

          {!supabaseConfigured ? (
            <div className="setup-notice">
              Authentication is intentionally locked until the dedicated
              manager Supabase environment variables are configured. Local
              previews may use <code>MANAGER_DEMO_MODE=true</code>.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
