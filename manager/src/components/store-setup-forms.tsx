"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LocationSetupSnapshot } from "@/services/locations/setup-types";

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

const TOKEN_ON_FILE = "••••••••••••••••";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "The store setup could not be saved.");
  }
}

function FormStatus({
  error,
  updated,
}: {
  error: string | null;
  updated: boolean;
}) {
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (updated) return <p className="field-help">Updated for this store.</p>;
  return null;
}

function identityDraft(setup: LocationSetupSnapshot) {
  const identity = setup.identity;
  return {
    name: identity?.name ?? "",
    timezone: identity?.timezone ?? "America/New_York",
    line1: identity?.address.line1 ?? "",
    city: identity?.address.city ?? "",
    region: identity?.address.region ?? "",
    postalCode: identity?.address.postalCode ?? "",
    phone: identity?.address.phone ?? "",
  };
}

function cloverDraft(setup: LocationSetupSnapshot) {
  return {
    merchantId: setup.clover.merchantId,
    apiToken: setup.clover.tokenConfigured ? TOKEN_ON_FILE : "",
  };
}

function mailboxDraft(setup: LocationSetupSnapshot) {
  return {
    invoiceEmail: setup.mailbox.invoiceEmail,
    mailboxHash: setup.mailbox.mailboxHash,
  };
}

export function LocationIdentityForm({
  setup,
}: {
  setup: LocationSetupSnapshot;
}) {
  const router = useRouter();
  const identity = setup.identity;
  const saved = identityDraft(setup);
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setDraft(JSON.parse(savedKey) as typeof saved);
    setError(null);
  }, [savedKey]);

  if (!identity) return null;
  if (!setup.canManage) {
    return (
      <dl className="form-grid form-grid-two">
        <div className="field">
          <dt className="field-label">Store name</dt>
          <dd>{identity.name}</dd>
        </div>
        <div className="field">
          <dt className="field-label">Timezone</dt>
          <dd>{identity.timezone}</dd>
        </div>
      </dl>
    );
  }

  const timezoneOptions = timezones.includes(draft.timezone)
    ? timezones
    : [draft.timezone, ...timezones];
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!dirty) return;
        setError(null);
        setUpdated(false);
        setPending(true);
        try {
          await postJson("/api/locations/setup/identity", draft);
          setUpdated(true);
          router.refresh();
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The store identity could not be updated.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="form-grid form-grid-two">
        <label className="field">
          <span className="field-label">Store name</span>
          <input
            className="input"
            name="name"
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Business timezone</span>
          <select
            className="select"
            name="timezone"
            value={draft.timezone}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                timezone: event.target.value,
              }))
            }
          >
            {timezoneOptions.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Street</span>
          <input
            className="input"
            name="line1"
            value={draft.line1}
            onChange={(event) =>
              setDraft((current) => ({ ...current, line1: event.target.value }))
            }
            placeholder="1532 Rockville Pike"
          />
        </label>
        <label className="field">
          <span className="field-label">City</span>
          <input
            className="input"
            name="city"
            value={draft.city}
            onChange={(event) =>
              setDraft((current) => ({ ...current, city: event.target.value }))
            }
            placeholder="Rockville"
          />
        </label>
        <label className="field">
          <span className="field-label">State</span>
          <input
            className="input"
            name="region"
            value={draft.region}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                region: event.target.value,
              }))
            }
            placeholder="MD"
          />
        </label>
        <label className="field">
          <span className="field-label">ZIP</span>
          <input
            className="input"
            name="postalCode"
            value={draft.postalCode}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                postalCode: event.target.value,
              }))
            }
            placeholder="20852"
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Phone</span>
        <input
          className="input"
          name="phone"
          value={draft.phone}
          onChange={(event) =>
            setDraft((current) => ({ ...current, phone: event.target.value }))
          }
          placeholder="+1 227-280-7062"
        />
      </label>
      <FormStatus error={error} updated={updated && !dirty} />
      <button
        className="button button-accent"
        type="submit"
        disabled={!dirty || pending}
      >
        {pending ? "Updating…" : "Update store identity"}
      </button>
    </form>
  );
}

export function LocationCloverForm({
  setup,
}: {
  setup: LocationSetupSnapshot;
}) {
  const router = useRouter();
  const saved = cloverDraft(setup);
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [pending, setPending] = useState(false);
  const [revealToken, setRevealToken] = useState(false);

  useEffect(() => {
    setDraft(JSON.parse(savedKey) as typeof saved);
    setError(null);
    setRevealToken(false);
  }, [savedKey]);

  if (!setup.location) return null;
  if (!setup.canManage) {
    return (
      <p className="field-help">
        {setup.clover.configured
          ? `Clover merchant ${setup.clover.merchantId} is connected for this store.`
          : "Clover is not connected for this store."}
      </p>
    );
  }

  const tokenOnFile = setup.clover.tokenConfigured;
  const tokenHint = tokenOnFile
    ? setup.clover.tokenSource === "stored" && setup.clover.tokenLast4
      ? `Token on file ending ${setup.clover.tokenLast4}. Type a new token to replace it.`
      : "A token is on file. Type a new token to replace it."
    : "Paste the read-only API token for this store’s Clover merchant.";
  const dirty =
    draft.merchantId.trim() !== saved.merchantId.trim() ||
    (draft.apiToken !== TOKEN_ON_FILE &&
      draft.apiToken.trim() !== (tokenOnFile ? "" : saved.apiToken));
  const replacementToken =
    draft.apiToken !== TOKEN_ON_FILE ? draft.apiToken.trim() : "";

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!dirty) return;
        setError(null);
        setUpdated(false);
        setPending(true);
        try {
          await postJson("/api/locations/setup/clover", {
            merchantId: draft.merchantId,
            apiToken: replacementToken,
          });
          setDraft({
            merchantId: draft.merchantId.trim(),
            apiToken:
              replacementToken || tokenOnFile ? TOKEN_ON_FILE : "",
          });
          setRevealToken(false);
          setUpdated(true);
          router.refresh();
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Clover could not be updated for this store.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        <span className="field-label">Clover merchant ID</span>
        <input
          className="input"
          name="merchantId"
          value={draft.merchantId}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              merchantId: event.target.value,
            }))
          }
          placeholder="Merchant ID for this store"
          required
        />
      </label>
      <label className="field">
        <span className="field-label">Clover API token</span>
        <div className="secret-input-wrap">
          <input
            className="input"
            name="apiToken"
            type={revealToken ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={draft.apiToken}
            placeholder={
              tokenOnFile ? "Type a new token to replace it" : "Paste API token"
            }
            onFocus={() => {
              if (draft.apiToken === TOKEN_ON_FILE) {
                setDraft((current) => ({ ...current, apiToken: "" }));
              }
            }}
            onBlur={() => {
              if (!draft.apiToken.trim() && tokenOnFile) {
                setDraft((current) => ({
                  ...current,
                  apiToken: TOKEN_ON_FILE,
                }));
                setRevealToken(false);
              }
            }}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                apiToken: event.target.value,
              }))
            }
          />
          <button
            type="button"
            className="icon-button"
            aria-label={revealToken ? "Hide API token" : "Show API token"}
            onClick={() => setRevealToken((current) => !current)}
          >
            {revealToken ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="field-help">
          {tokenHint} The token needs Orders, Payments, and Employees (read).
          Employees is the time clock. Clover does not send wage rates or
          payroll taxes.
        </p>
      </label>
      <FormStatus error={error} updated={updated && !dirty} />
      <button
        className="button button-accent"
        type="submit"
        disabled={!dirty || pending}
      >
        {pending ? "Updating…" : "Update Clover"}
      </button>
    </form>
  );
}

export function LocationMailboxForm({
  setup,
}: {
  setup: LocationSetupSnapshot;
}) {
  const router = useRouter();
  const saved = mailboxDraft(setup);
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setDraft(JSON.parse(savedKey) as typeof saved);
    setError(null);
  }, [savedKey]);

  if (!setup.location) return null;
  if (!setup.canManage) {
    return (
      <p className="field-help">
        {setup.mailbox.configured
          ? setup.mailbox.invoiceEmail || setup.mailbox.mailboxHash
          : "No invoice mailbox is connected for this store."}
      </p>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!dirty) return;
        setError(null);
        setUpdated(false);
        setPending(true);
        try {
          await postJson("/api/locations/setup/mailbox", draft);
          setUpdated(true);
          router.refresh();
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The invoice mailbox could not be updated.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        <span className="field-label">Invoice email for this store</span>
        <input
          className="input"
          name="invoiceEmail"
          type="email"
          value={draft.invoiceEmail}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              invoiceEmail: event.target.value,
            }))
          }
          placeholder="invoices+rockville@wildbeancoffeeshop.com"
        />
      </label>
      <label className="field">
        <span className="field-label">Postmark mailbox hash</span>
        <input
          className="input"
          name="mailboxHash"
          value={draft.mailboxHash}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              mailboxHash: event.target.value,
            }))
          }
          placeholder="The +hash on this store’s inbound address"
        />
        <p className="field-help">
          Brand Postmark credentials stay in the environment. This address is
          how invoices land on this store’s books.
        </p>
      </label>
      <FormStatus error={error} updated={updated && !dirty} />
      <button
        className="button button-accent"
        type="submit"
        disabled={!dirty || pending}
      >
        {pending ? "Updating…" : "Update mailbox"}
      </button>
    </form>
  );
}
