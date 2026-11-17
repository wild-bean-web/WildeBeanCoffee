"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { paymentsApi, productsApi, shippingApi } from "@/lib/api";
import { applyRetailBeanOverrides, RETAIL_YIRGACHEFFE } from "@/lib/retailBeans";
import {
  CONTIGUOUS_STATE_CODES,
  MAX_SHIP_BAGS,
  applyShipmentCoupon,
  formatUsd,
  quoteShipment,
  validateShipForm,
} from "@/lib/beanShipping";

const EMPTY = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  state: "MD",
  postalCode: "",
};

export default function GetItShippedPage() {
  const router = useRouter();
  const [offer, setOffer] = useState(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchNote, setSearchNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [config, products] = await Promise.all([
          shippingApi.getOffer(),
          productsApi.getAll(),
        ]);
        if (cancelled) return;
        setOffer(config);
        const beans = applyRetailBeanOverrides(products);
        const match = beans.find((product) =>
          (product.name || "").toLowerCase().includes("yirgacheffe"),
        );
        if (match?._id) setProductId(String(match._id));
      } catch {
        if (!cancelled) setOffer({ enabled: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = form.line1.trim();
    if (!offer?.enabled || !offer.placesConfigured || query.length < 3) {
      setSuggestions([]);
      return undefined;
    }
    const handle = setTimeout(async () => {
      try {
        const rows = await shippingApi.autocomplete(query);
        setSuggestions(rows);
        setSearchNote("");
      } catch (err) {
        setSuggestions([]);
        setSearchNote(err.message || "Address search is unavailable");
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [form.line1, offer]);

  const quote = useMemo(() => {
    const base = quoteShipment(quantity);
    return applyShipmentCoupon(base, appliedCoupon) || base;
  }, [quantity, appliedCoupon]);

  const applyCoupon = () => {
    const next = applyShipmentCoupon(quoteShipment(quantity), couponInput);
    if (!couponInput.trim()) {
      setAppliedCoupon("");
      setCouponError("");
      return;
    }
    if (!next) {
      setCouponError("That coupon code is not valid.");
      return;
    }
    setAppliedCoupon(next.couponCode);
    setCouponInput(next.couponCode);
    setCouponError("");
  };

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const chooseSuggestion = async (suggestion) => {
    setSuggestions([]);
    setField("line1", suggestion.mainText);
    try {
      const place = await shippingApi.place(suggestion.placeId);
      setForm((current) => ({
        ...current,
        line1: place.line1 || suggestion.mainText,
        line2: current.line2 || place.line2 || "",
        city: place.city || current.city,
        state: place.state || current.state,
        postalCode: place.postalCode || current.postalCode,
      }));
    } catch (err) {
      setSearchNote(err.message || "Enter the city, state, and ZIP yourself");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateShipForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !quote) return;
    if (!productId) {
      setFormError("This bag is not available to ship right now.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      const phoneDigits = form.phone.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
      const orderItems = [
        {
          itemType: "product",
          itemId: productId,
          name: RETAIL_YIRGACHEFFE.name,
          price: RETAIL_YIRGACHEFFE.price,
          quantity,
          modifiers: [],
          modifierTotal: 0,
        },
      ];
      const baseUrl = window.location.origin;
      const session = await paymentsApi.createCheckout({
        items: [
          {
            name: `${RETAIL_YIRGACHEFFE.name} 12 oz`,
            quantity,
            price: RETAIL_YIRGACHEFFE.price,
          },
          ...(quote.shipping > 0
            ? [{ name: "UPS Ground shipping", quantity: 1, price: quote.shipping }]
            : []),
        ],
        customer: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: phoneDigits,
        },
        amount: Math.round(quote.total * 100),
        tipAmountCents: 0,
        taxRate: 0,
        currency: "USD",
        successUrl: `${baseUrl}/order/success?checkoutId={CHECKOUT_SESSION_ID}`,
        failureUrl: `${baseUrl}/order/failure`,
        cancelUrl: `${baseUrl}/shop/ship?canceled=true`,
        orderDraft: {
          fulfillment: "ship",
          customer: {
            name: fullName,
            phone: phoneDigits,
            email: form.email.trim(),
          },
          items: orderItems,
          taxRate: 0,
          couponCode: quote.couponCode || "",
          shipping: {
            name: fullName,
            phone: phoneDigits,
            line1: form.line1.trim(),
            line2: form.line2.trim(),
            city: form.city.trim(),
            state: form.state,
            postalCode: form.postalCode.trim(),
            country: "US",
          },
        },
      });
      sessionStorage.setItem(
        "pendingOrder",
        JSON.stringify({
          fulfillment: "ship",
          checkoutId: session.checkoutId,
        }),
      );
      if (!session.checkoutUrl) throw new Error("Payment could not be started");
      window.location.href = session.checkoutUrl;
    } catch (err) {
      setFormError(err.message || "Payment could not be started");
      setSubmitting(false);
    }
  };

  if (offer && offer.enabled === false) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-bold text-[var(--coffee-brown)]">In store only</h1>
        <p className="mt-3 text-gray-600">
          Ethiopian Yirgacheffe bags are available at our Rockville cafe. Shipping is turned off.
        </p>
        <Link href="/shop" className="mt-6 font-semibold text-[var(--lime-green-dark)]">
          Back to coffee beans
        </Link>
      </div>
    );
  }

  const fieldClass = (key) =>
    `w-full rounded-lg border px-4 py-3 text-base focus:outline-none focus:ring-2 ${
      errors[key]
        ? "border-red-500 focus:ring-red-500"
        : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
    }`;

  return (
    <div className="min-h-screen bg-gray-50 pb-28 lg:pb-12">
      <div className="bg-[var(--coffee-brown-very-light)] py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => router.push("/shop")}
            className="mb-4 text-sm font-medium text-[var(--coffee-brown)]"
          >
            Back to coffee beans
          </button>
          <h1 className="text-4xl font-bold text-[var(--coffee-brown)]">Get it Shipped</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Ethiopian Yirgacheffe, 12 oz whole beans. UPS Ground to the 48 states and Washington, DC.
            No P.O. Boxes.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-5 lg:px-8">
        <div className="space-y-4 lg:col-span-3">
          {formError && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>
          )}
          <div className="rounded-xl bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--coffee-brown)]">Ship to</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--coffee-brown)]">
                First name
                <input className={`mt-1 ${fieldClass("firstName")}`} value={form.firstName} autoComplete="given-name" onChange={(e) => setField("firstName", e.target.value)} />
                {errors.firstName && <span className="mt-1 block text-red-600">{errors.firstName}</span>}
              </label>
              <label className="block text-sm font-medium text-[var(--coffee-brown)]">
                Last name
                <input className={`mt-1 ${fieldClass("lastName")}`} value={form.lastName} autoComplete="family-name" onChange={(e) => setField("lastName", e.target.value)} />
                {errors.lastName && <span className="mt-1 block text-red-600">{errors.lastName}</span>}
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--coffee-brown)]">
                Phone
                <input className={`mt-1 ${fieldClass("phone")}`} value={form.phone} autoComplete="tel" inputMode="tel" onChange={(e) => setField("phone", e.target.value)} />
                {errors.phone && <span className="mt-1 block text-red-600">{errors.phone}</span>}
              </label>
              <label className="block text-sm font-medium text-[var(--coffee-brown)]">
                Email
                <input className={`mt-1 ${fieldClass("email")}`} type="email" value={form.email} autoComplete="email" onChange={(e) => setField("email", e.target.value)} />
                {errors.email && <span className="mt-1 block text-red-600">{errors.email}</span>}
              </label>
            </div>
            <div className="relative mt-4">
              <label className="block text-sm font-medium text-[var(--coffee-brown)]">
                Street address
                <input
                  className={`mt-1 ${fieldClass("line1")}`}
                  value={form.line1}
                  autoComplete="off"
                  aria-autocomplete="list"
                  onChange={(e) => setField("line1", e.target.value)}
                />
              </label>
              {suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg" role="listbox">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.placeId}>
                      <button
                        type="button"
                        className="block w-full px-4 py-3 text-left hover:bg-[var(--coffee-brown-very-light)]"
                        onClick={() => chooseSuggestion(suggestion)}
                      >
                        <span className="font-medium text-[var(--coffee-brown)]">{suggestion.mainText}</span>
                        {suggestion.secondaryText && (
                          <span className="mt-0.5 block text-sm text-gray-500">{suggestion.secondaryText}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {errors.line1 && <p className="mt-1 text-sm text-red-600">{errors.line1}</p>}
              {searchNote && <p className="mt-1 text-sm text-gray-500">{searchNote}</p>}
            </div>
            <label className="mt-4 block text-sm font-medium text-[var(--coffee-brown)]">
              Apt, unit (optional)
              <input className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]" value={form.line2} autoComplete="address-line2" onChange={(e) => setField("line2", e.target.value)} />
            </label>
            <div className="mt-4 flex gap-3">
              <label className="min-w-0 flex-1 text-sm font-medium text-[var(--coffee-brown)]">
                City
                <input className={`mt-1 ${fieldClass("city")}`} value={form.city} autoComplete="address-level2" onChange={(e) => setField("city", e.target.value)} />
                {errors.city && <span className="mt-1 block text-red-600">{errors.city}</span>}
              </label>
              <label className="w-24 shrink-0 text-sm font-medium text-[var(--coffee-brown)]">
                State
                <select className={`mt-1 ${fieldClass("state")}`} value={form.state} autoComplete="address-level1" onChange={(e) => setField("state", e.target.value)}>
                  {CONTIGUOUS_STATE_CODES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                {errors.state && <span className="mt-1 block text-red-600">{errors.state}</span>}
              </label>
              <label className="w-28 shrink-0 text-sm font-medium text-[var(--coffee-brown)]">
                ZIP
                <input className={`mt-1 ${fieldClass("postalCode")}`} value={form.postalCode} autoComplete="postal-code" inputMode="numeric" onChange={(e) => setField("postalCode", e.target.value)} />
                {errors.postalCode && <span className="mt-1 block text-red-600">{errors.postalCode}</span>}
              </label>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div className="rounded-xl bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-[var(--coffee-brown)]">Order</h2>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--coffee-brown)]">{RETAIL_YIRGACHEFFE.name}</p>
                <p className="text-sm text-gray-500">12 oz whole bean</p>
                <div className="mt-3 inline-flex items-center rounded-full border border-gray-200">
                  <button type="button" className="px-3 py-2" aria-label="Fewer bags" onClick={() => setQuantity((qty) => Math.max(1, qty - 1))}>−</button>
                  <span className="min-w-8 text-center font-semibold">{quantity}</span>
                  <button type="button" className="px-3 py-2" aria-label="More bags" onClick={() => setQuantity((qty) => Math.min(MAX_SHIP_BAGS, qty + 1))}>+</button>
                </div>
              </div>
              <p className="font-semibold">{quote ? formatUsd(quote.subtotal) : ""}</p>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-[var(--coffee-brown)]" htmlFor="coupon-code">
                Coupon code
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="coupon-code"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 uppercase focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]"
                  value={couponInput}
                  autoCapitalize="characters"
                  onChange={(event) => {
                    setCouponInput(event.target.value.toUpperCase());
                    setCouponError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyCoupon();
                    }
                  }}
                />
                <button
                  type="button"
                  className="rounded-full border border-[var(--coffee-brown)] px-4 py-3 font-semibold text-[var(--coffee-brown)]"
                  onClick={applyCoupon}
                >
                  Apply
                </button>
              </div>
              {couponError && <p className="mt-1 text-sm text-red-600">{couponError}</p>}
              {quote?.couponCode && (
                <p className="mt-2 text-sm text-[var(--coffee-brown)]">
                  {quote.couponCode} applied · {quote.percentOff}% off coffee.{" "}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => {
                      setAppliedCoupon("");
                      setCouponInput("");
                      setCouponError("");
                    }}
                  >
                    Remove
                  </button>
                </p>
              )}
            </div>
            <div className="mt-4 rounded-lg border-2 border-[var(--lime-green)] p-3">
              <div className="flex justify-between font-semibold text-[var(--coffee-brown)]">
                <span>UPS Ground</span>
                <span>{quote?.shipping === 0 ? "Free" : quote ? formatUsd(quote.shipping) : ""}</span>
              </div>
              <p className="text-sm text-gray-500">
                3–5 business days
                {quote?.shipping === 0 ? "" : ". Free on 5 or more bags"}
              </p>
            </div>
            {quote?.discount > 0 && (
              <div className="mt-4 flex justify-between text-sm font-semibold text-[var(--coffee-brown)]">
                <span>Coupon {quote.couponCode}</span>
                <span>−{formatUsd(quote.discount)}</span>
              </div>
            )}
            <div className="mt-4 flex justify-between border-t border-gray-200 pt-4 text-lg font-bold text-[var(--coffee-brown)]">
              <span>Total</span>
              <span>{quote ? formatUsd(quote.total) : ""}</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">No sales tax on whole beans. You will pay on our secure Clover page.</p>
            <button
              type="submit"
              disabled={submitting || !offer?.enabled}
              className="mt-4 hidden w-full rounded-full bg-[var(--lime-green)] px-6 py-3 font-bold text-white hover:bg-[var(--lime-green-dark)] disabled:opacity-60 lg:block"
            >
              {submitting ? "Starting payment..." : "Continue to payment"}
            </button>
          </div>
        </aside>

        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 lg:hidden">
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-[var(--coffee-brown)]">{quote ? formatUsd(quote.total) : ""}</p>
          </div>
          <button
            type="submit"
            disabled={submitting || !offer?.enabled}
            className="rounded-full bg-[var(--lime-green)] px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Starting..." : "Continue to payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
