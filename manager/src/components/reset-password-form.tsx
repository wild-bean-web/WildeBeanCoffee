"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/brand-mark";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!tokenHash) {
      setError("Open the latest reset email and use the link in that message.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Those passwords do not match.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Manager authentication has not been configured.");
      return;
    }

    setSubmitting(true);
    const verified = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (verified.error) {
      setError("This reset link is no longer valid. Send a new recovery email.");
      setSubmitting(false);
      return;
    }

    const updated = await supabase.auth.updateUser({ password });
    if (updated.error) {
      setError("The password was not saved. Choose a different one and try again.");
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
          <h1>Choose the password for your manager login.</h1>
          <p>
            This password is only for the Wild Bean Manager. It is separate
            from GitHub and from the Supabase dashboard.
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

          <h2>Set a new password</h2>
          <p>
            This sets the password for the email that received the reset
            message. Choose it, then the workspace opens.
          </p>

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="confirmation">Confirm password</label>
              <input
                id="confirmation"
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
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
              disabled={submitting || !tokenHash}
            >
              <LockKeyhole size={17} />
              {submitting ? "Saving…" : "Save password and continue"}
            </button>
          </form>

          {!tokenHash ? (
            <div className="setup-notice">
              This page opens from the reset email. The link that went to
              localhost is already used up, so send a new recovery email after
              the template points here.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
