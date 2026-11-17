# Yirgacheffe shipping checkout

## Goal

Sell the 12 oz Ethiopian Yirgacheffe bag by mail from the Shop Coffee Beans screen. Cafe drinks stay pickup-only. Payment stays on Clover Hosted Checkout.

## Entry and switch

- The only storefront entry is **Get it Shipped** on the Yirgacheffe card on `/shop`.
- That opens `/shop/ship`. The drink cart never receives this bag.
- `BEAN_SHIPPING_ENABLED=false` or `0` turns the feature off. Any other value, including unset, leaves it on.
- When it is off, the button is hidden, `/shop/ship` explains that bags are in store only, and the server refuses a shipping checkout.
- The Apple Pay customer fix stays on when shipping is off.

## Price

- Bag: $17.53. Quantity 1 to 6.
- Shipping is UPS Ground for the whole order: $6.95 for 1 bag, $7.95 for 2–3, $9.95 for 4, and free at 5 or 6 bags. Copy says 3–5 business days.
- Tax: $0. Whole beans for home brewing are not taxed like cafe drinks.
- One bag total: $24.48. Five bags total $87.65.
- No tip and no Bean Stamps on a shipped order.

## Address

- Fields: name, phone, email, street, optional apartment or unit, then city, state, and ZIP on one line with space between them.
- Street search uses Google Places for US addresses through the server. The API key stays on the server (`GOOGLE_PLACES_API_KEY`).
- Choosing a suggestion fills street, city, state, and ZIP. Each field stays editable. Apartment stays separate.
- If the key is missing, the customer can still type the address. The server still checks it.
- Ship to the 48 contiguous states and Washington, DC. Reject Alaska, Hawaii, territories, and P.O. Boxes.
- Phone on the shipment screen and on drink checkout is sent to Clover as 10 digits. Last name is required and is never replaced with `.`.

## Layout

- Phones: one column, total and **Continue to payment** pinned at the bottom.
- Wider screens: the form on the left and a summary on the right. City, state, and ZIP stay on one line. Buttons and fields are large enough to tap and to use with a mouse.

## After payment

- The address is stored on the hosted-checkout draft before the redirect to Clover.
- The existing payment webhook, success page, and recovery job create the order.
- `fulfillment` is `ship`. The address and the UPS Ground amount for that bag count are stored on the order. There is no pickup time.
- The kitchen dashboard has an **Orders** tab and a **Shipments** tab. Shipping cards are only on Shipments, with the full address and **Mark shipped**.
- The receipt printer prints a SHIP TO slip.
- Email `info@wildbeancoffeeshop.com` (override with `SHIPMENT_ORDER_EMAIL`) when the paid order is created. A failed email does not remove the kitchen order.
- The customer success page says the bag will ship, not that it is ready for pickup.
- Stock is checked when checkout starts. It is not reserved during the Clover page. A paid order is still created if stock changes while the customer is paying.
