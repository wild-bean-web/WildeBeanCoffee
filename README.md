# WildeCoffeeBean

## Digital menu (in-store TVs)

Full-screen menu pages for café displays—no USB sticks required. Update the SVGs in the repo, deploy, and refresh the browser on each TV.

| URL path | Source file |
|----------|-------------|
| `/digitalmenu/coffee` | `client/public/images/DigitalMenusSVG/Revised Coffee Menu.svg` |
| `/digitalmenu/smoothies` | `client/public/images/DigitalMenusSVG/Revised Smoothie Menu.svg` |

**Production examples**

- `https://wildbeancoffeeshop.com/digitalmenu/coffee`
- `https://wildbeancoffeeshop.com/digitalmenu/smoothies`

**Behavior**

- Site chrome (nav, footer, cookie banner) is hidden on these routes.
- The SVG scales with `object-fit: contain` on a black background so the full menu stays visible on different aspect ratios.
- Use the on-page **Fullscreen** control so the browser hides its own UI (tabs and the outer window are controlled by the OS/browser, not the website). For a dedicated display, consider launching the browser in **kiosk mode** (e.g. Chrome `--kiosk <url>`).

**Implementation**

- `client/src/app/digitalmenu/[menu]/page.js` — static routes `coffee` and `smoothies`
- `client/src/app/digitalmenu/[menu]/DigitalMenuClient.js` — viewport layout + fullscreen helper
- `client/src/components/AppChrome.js` — omits global chrome when the path starts with `/digitalmenu`

---

## Scripts

### Parse inventory xlsx to JSON

```bash
node scripts/parse-inventory-xlsx.js
```
