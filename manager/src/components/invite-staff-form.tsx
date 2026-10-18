"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InviteStaffForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/staff/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: formData.get("displayName"),
          email: formData.get("email"),
          role: formData.get("role"),
        }),
      });
      const result = (await response.json()) as {
        data?: { message: string };
        error?: { message: string };
      };
      if (!response.ok) throw new Error(result.error?.message ?? "The invite was not sent.");
      setMessage(result.data?.message ?? "Invite sent.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invite was not sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="payroll-calendar-form" action={submit}>
      <label className="field">
        <span className="field-label">Name</span>
        <input className="input" name="displayName" required minLength={2} />
      </label>
      <label className="field">
        <span className="field-label">Work email</span>
        <input className="input" name="email" type="email" required />
      </label>
      <label className="field">
        <span className="field-label">Role</span>
        <select className="input" name="role" defaultValue="manager">
          <option value="manager">Manager</option>
          <option value="purchaser">Purchaser</option>
          <option value="inventory_counter">Inventory counter</option>
          <option value="accountant">Accountant</option>
        </select>
      </label>
      <button className="button button-accent" type="submit" disabled={pending}>
        {pending ? "Sending" : "Send invite"}
      </button>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
