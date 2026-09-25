"use client";

import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function BrandSettingsForm({
  primaryColor,
  accentColor,
  hasLogo,
}: {
  primaryColor: string;
  accentColor: string;
  hasLogo: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [primary, setPrimary] = useState(primaryColor);
  const [accent, setAccent] = useState(accentColor);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/brand", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const body = (await response.json()) as {
        data?: { message?: string };
        error?: { message?: string };
      };
      setFailed(!response.ok);
      setNotice(body.data?.message ?? body.error?.message ?? "The brand could not be saved.");
      if (response.ok) router.refresh();
    } catch {
      setFailed(true);
      setNotice("The brand could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="brand-form" onSubmit={onSubmit}>
      <div className="brand-row">
        <div>
          <p className="brand-row-title">Sidebar and button color</p>
          <p className="field-help">Menu, headings, and primary buttons at every location.</p>
        </div>
        <label className="color-control">
          <input
            name="primaryColor"
            type="color"
            value={primary}
            onChange={(event) => setPrimary(event.target.value)}
            required
            aria-label="Sidebar and button color"
          />
          <span>{primary.toUpperCase()}</span>
        </label>
      </div>
      <div className="brand-row">
        <div>
          <p className="brand-row-title">Highlight color</p>
          <p className="field-help">Selected filters, charts, and positive totals.</p>
        </div>
        <label className="color-control">
          <input
            name="accentColor"
            type="color"
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
            required
            aria-label="Highlight color"
          />
          <span>{accent.toUpperCase()}</span>
        </label>
      </div>
      <label className="logo-upload">
        <span className="logo-upload-preview" aria-hidden="true">
          {logoPreview || hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview ?? "/api/brand/logo"} alt="" />
          ) : (
            <ImagePlus size={22} />
          )}
        </span>
        <span className="logo-upload-copy">
          <span className="brand-row-title">Upload logo</span>
          <span className="field-help">
            {logoName ??
              (hasLogo
                ? "A logo is already in use. Click to replace it for every location."
                : "Click to choose a PNG, JPEG, or WebP. Every location uses this logo.")}
          </span>
        </span>
        <span className="button">Choose image</span>
        <input
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setLogoName(file?.name ?? null);
            setLogoPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </label>
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save brand"}
      </button>
      {notice ? (
        <p className={failed ? "form-error" : "metric-note"} role="status">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
