/**
 * Google Places autocomplete, proxied so the API key stays on the server.
 * Suggestions are US addresses. The customer can still type an address if this is unset.
 */

const PLACES_AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete";

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || "";
}

export function placesConfigured() {
  return Boolean(apiKey());
}

export async function autocompleteAddress(input) {
  const text = String(input || "").trim().slice(0, 120);
  if (text.length < 3) return [];
  if (!apiKey()) {
    const err = new Error("Address search is not configured");
    err.status = 503;
    throw err;
  }

  const response = await fetch(PLACES_AUTOCOMPLETE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey(),
    },
    body: JSON.stringify({
      input: text,
      includedRegionCodes: ["us"],
      languageCode: "en",
    }),
  });

  if (!response.ok) {
    const err = new Error("Address search is unavailable");
    err.status = 502;
    throw err;
  }

  const body = await response.json();
  return (body.suggestions || [])
    .map((suggestion) => suggestion.placePrediction)
    .filter(Boolean)
    .slice(0, 5)
    .map((prediction) => ({
      placeId: prediction.placeId,
      mainText: prediction.structuredFormat?.mainText?.text || prediction.text?.text || "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text || "",
    }))
    .filter((row) => row.placeId && row.mainText);
}

function component(components, type, short = false) {
  const match = (components || []).find((part) => (part.types || []).includes(type));
  if (!match) return "";
  if (short) return match.shortText || match.short_name || match.longText || match.long_name || "";
  return match.longText || match.long_name || match.shortText || match.short_name || "";
}

export async function addressFromPlace(placeId) {
  const id = String(placeId || "").trim();
  if (!/^[A-Za-z0-9_-]{8,}$/.test(id)) {
    const err = new Error("Choose an address from the list");
    err.status = 400;
    throw err;
  }
  if (!apiKey()) {
    const err = new Error("Address search is not configured");
    err.status = 503;
    throw err;
  }

  const response = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "addressComponents,formattedAddress",
    },
  });
  if (!response.ok) {
    const err = new Error("That address could not be loaded");
    err.status = 502;
    throw err;
  }
  const body = await response.json();
  const parts = body.addressComponents || [];
  const streetNumber = component(parts, "street_number");
  const route = component(parts, "route");
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  const city =
    component(parts, "locality") ||
    component(parts, "postal_town") ||
    component(parts, "sublocality") ||
    component(parts, "administrative_area_level_2");
  return {
    line1,
    line2: component(parts, "subpremise"),
    city,
    state: component(parts, "administrative_area_level_1", true).slice(0, 2).toUpperCase(),
    postalCode: component(parts, "postal_code"),
  };
}
