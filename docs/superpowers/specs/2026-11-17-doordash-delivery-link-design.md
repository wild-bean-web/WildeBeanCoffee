# DoorDash delivery link

## Goal

Offer delivery by sending the customer to the existing DoorDash store. Drinks on this website stay pickup-only. The button is a link. It does not create an order, charge a card, or talk to a DoorDash API.

## Button

- Label: **DoorDash Delivery**.
- It sits directly under **Order Online** in the site navigation, in the phone menu and on a wide screen.
- On a wide screen the two buttons stack in that nav slot, Order Online on top. The rest of the nav stays in one row. That wide-screen bar grows enough that both buttons are fully visible. The phone bar stays its current height, and DoorDash Delivery appears inside the opened menu.
- On the checkout page the pickup button still reads **Checkout**. DoorDash Delivery keeps its own label and stays underneath.
- The footer, home page, menu, and shop page stay as they are.

## Link

- Address: `https://www.doordash.com/store/41513961?utm_source=mx_share`
- One constant supplies that address to both the wide-screen nav and the phone menu.
- The control is a normal link and opens in the same window. A phone can then open the DoorDash app when it is installed. When the app is absent, the DoorDash website opens.
- An external-link icon sits at the end of the label: a small box with an arrow pointing up and out. The icon is decorative. The link name stays "DoorDash Delivery".
- The icon means the customer is leaving this website. It does not open a new browser tab.

## Appearance

- Order Online stays the filled green pill.
- DoorDash Delivery is an outline pill in the same coffee brown as Sign In.

## What stays the same

- The drink cart, pickup checkout, and kitchen dashboard are unchanged.
- DoorDash orders keep arriving through DoorDash.
- There is no feature flag and no new environment variable.

## Test

- The nav test checks that DoorDash Delivery points at the store address above, in the wide-screen nav and in the opened phone menu, and that the link opens in the same window.
