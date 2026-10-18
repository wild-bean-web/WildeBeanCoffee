"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface Choice {
  id: string;
  label: string;
}

const emptyLine = { productId: "", quantity: "", uomId: "", wastePercent: "" };

export function RecipeDraftForm({
  products,
  units,
}: {
  products: Choice[];
  units: Choice[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState([emptyLine, emptyLine, emptyLine]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ingredients = lines
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        uomId: line.uomId,
        wasteFactor: Number(line.wastePercent || "0") / 100,
      }))
      .filter((line) => line.productId && line.uomId && line.quantity > 0);
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          outputProductId: String(form.get("outputProductId") ?? ""),
          yieldQuantity: Number(form.get("yieldQuantity")),
          yieldUomId: String(form.get("yieldUomId") ?? ""),
          ingredients,
        }),
      });
      const body = (await response.json()) as {
        data?: { message?: string };
        error?: { message?: string };
      };
      setFailed(!response.ok);
      setNotice(body.data?.message ?? body.error?.message ?? "The recipe could not be saved.");
      if (response.ok) {
        event.currentTarget.reset();
        setLines([emptyLine, emptyLine, emptyLine]);
        router.refresh();
      }
    } catch {
      setFailed(true);
      setNotice("The recipe could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="recipe-draft" onSubmit={onSubmit}>
      <label className="field">
        <span>Recipe name</span>
        <input className="input" name="name" required maxLength={160} placeholder="Oat milk latte" />
      </label>
      <div className="recipe-draft-grid">
        <label className="field">
          <span>Finished item</span>
          <select className="input" name="outputProductId" required defaultValue="">
            <option value="" disabled>
              Choose a product
            </option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Yield</span>
          <input className="input" name="yieldQuantity" type="number" min="0.001" step="0.001" required placeholder="1" />
        </label>
        <label className="field">
          <span>Yield unit</span>
          <select className="input" name="yieldUomId" required defaultValue="">
            <option value="" disabled>
              Unit
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="recipe-lines">
        <p className="brand-row-title">Ingredients in that yield</p>
        {lines.map((line, index) => (
          <div className="recipe-line" key={index}>
            <select
              className="input"
              aria-label={`Ingredient ${index + 1}`}
              value={line.productId}
              onChange={(event) => updateLine(index, { productId: event.target.value })}
            >
              <option value="">Ingredient</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              aria-label={`Quantity ${index + 1}`}
              inputMode="decimal"
              placeholder="Qty"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: event.target.value })}
            />
            <select
              className="input"
              aria-label={`Unit ${index + 1}`}
              value={line.uomId}
              onChange={(event) => updateLine(index, { uomId: event.target.value })}
            >
              <option value="">Unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
            <input
              className="input"
              aria-label={`Waste percent ${index + 1}`}
              inputMode="decimal"
              placeholder="Waste %"
              value={line.wastePercent}
              onChange={(event) => updateLine(index, { wastePercent: event.target.value })}
            />
          </div>
        ))}
        <button
          type="button"
          className="button"
          onClick={() => setLines((current) => [...current, emptyLine])}
        >
          Add ingredient
        </button>
      </div>
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save draft"}
      </button>
      {notice ? (
        <p className={failed ? "form-error" : "metric-note"} role="status">
          {notice}
        </p>
      ) : null}
    </form>
  );

  function updateLine(index: number, patch: Partial<typeof emptyLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }
}
