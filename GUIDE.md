# Website playbook

How the SILQ site is built, written so you can reuse it for the next one.
Every pattern here exists in working code in this repo — the file is named
next to each section, so you can open it and copy.

Use it three ways:

- **Starting point** — copy this repo, swap the content, keep the machinery.
- **Checklist** — go through [New site, step by step](#new-site-step-by-step)
  so nothing important is forgotten (legal pages, social previews, mobile).
- **Inspiration** — the 3D sections show what a small team can build
  without a 3D artist or a framework.

---

## 1. The stack: plain files, no build step

| Choice | Why |
|---|---|
| HTML + CSS + vanilla JavaScript | Anyone can open a file and change it. Nothing to install, nothing breaks when a package updates. |
| GitHub Pages | Free hosting, deploys when you push to `main`. |
| three.js from a CDN, loaded on demand | 3D without a build tool, and pages that don't use it pay nothing. |
| `config.js` for everything business-critical | Prices and payment details change; HTML shouldn't have to. |

**When to pick something else:** if the site needs user accounts, a real
database, stock that updates itself, or more than ~20 products, use a shop
platform (Shopify) or a framework with a backend. This stack is for a small
brand with a handful of products — which is most UF companies.

## 2. File structure

```
index.html            start page (hero, why, trend, product teaser)
produkten.html        product page: gallery, 3D, buy block, material, FAQ
om.html, teamet.html  about + team
kontakt.html
kassa.html            checkout
kopvillkor.html, angerratt.html, integritetspolicy.html   legally required
404.html
config.js             products, shipping, payment, contact — edit here
styles.css            the whole design system in one file
js/
  nav.js              mobile menu
  cart.js             cart in localStorage
  checkout.js         order form + Swish QR
  lightbox.js         zoomable fullscreen images
  media.js            product gallery
  cap3d.js            3D model + product viewer engine
  visare.js           fullscreen 3D viewer UI
  hero3d.js           scroll-driven 3D on the start page
  qrcode.js           vendored QR library
assets/produkt/       product photos (white-background versions)
verktyg/              tools used while building — not part of the site
```

**Rule:** one file per job. When something breaks you know where to look.

## 3. Design system — `styles.css`

All colours, fonts and sizes are tokens at the top:

```css
:root {
  --ink: #0A0A0A;  --paper: #FAF8F5;  --paper-warm: #F1EDE6;
  --line: #DFD8CD; --accent: #B99A6B; --accent-dk: #8C7148;
  --font-display: 'Archivo', …;  --font-body: 'Inter', …;
}
```

For a new brand, change these ~10 lines first — most of the site follows.

What made SILQ look premium, and carries over to any brand:

- **Two fonts, not more.** One heavy display font for headings, one quiet
  body font. Load only the weights you use.
- **One accent colour**, used sparingly (kickers, active menu item, focus
  rings). Check contrast: the light accent failed on white, so light
  sections use the darker `--accent-dk`.
- **Rhythm of sections**: light → warm → dark → light. Alternating
  backgrounds replace dividers and make the page easy to scan.
- **Product on white.** Photos are cut out onto `#fff` and shown on white
  surfaces (`.produktbild`, `.media__scen`). The product becomes the only
  thing with contrast.
- **Generous spacing** with `clamp()` so it scales from phone to desktop
  without breakpoints: `padding: clamp(56px, 9vw, 112px) 0`.
- **Few components, reused**: `.btn`, `.btn--ghost`, `.btn--light`, `.card`,
  `.field`, `.grid--2/3`. Don't invent a new button per page.

## 4. `config.js` — single source of truth

```js
window.SILQ = {
  produkter: [
    { id: 'skullcap-svart', namn: 'Satinfodrad skullcap', variant: 'Svart',
      pris: 199, maxAntal: 10, status: 'i-lager',   // 'slut' | 'kommer'
      bilder: [{ src: 'assets/produkt/hero-vit.jpg', alt: '…' }, …] }
  ],
  frakt: { avgift: 49, beskrivning: 'PostNord, 2–5 arbetsdagar', friFran: null },
  swish: { … }, kontakt: { … }, form: { … }
};
```

- New product = new object in the list. It appears in the cart and checkout.
- **Never change an `id`** after something has been sold — saved carts use it.
- Keep the price only here. The HTML says "199 kr" in copy, but the cart and
  checkout always read `config.js`.

## 5. Cart — `js/cart.js`

- Stored in `localStorage` as `[{ id, antal }]` — **never prices or names**.
  Prices are looked up in `config.js` every time, so a price change applies
  immediately and a customer can't edit their own price.
- Unknown ids (removed products) are dropped silently.
- Any button with `data-lagg-i-korg="<id>"` adds to the cart; optional
  `data-antal-falt="<select id>"` reads quantity. No page-specific JS needed.
- The "Köp" nav link with `data-korg-lank` gets a live item-count badge.
- Syncs across tabs via the `storage` event.

## 6. Checkout and payment — `kassa.html`, `js/checkout.js`

- Order form → sent to email via Web3Forms (no server needed).
- Customer then pays with **Swish via a QR code** generated in the browser.
  The payload `C{number};{amount};{message};0` locks recipient, amount and
  message so the customer can't change them.
- If no Swish number is set, checkout runs "dark": orders are received and
  the customer is told payment info will be emailed.
- Payments are matched manually (order number in the Swish message).

**Legal minimum for selling to consumers in Sweden** — every shop needs:
purchase terms (`kopvillkor.html`), 14-day right of withdrawal
(`angerratt.html`), privacy policy (`integritetspolicy.html`), company name
and contact details in the footer, and prices stating whether VAT applies.
Copy these pages and change the company details — don't skip them.

## 7. Product photos on white — `verktyg/frilagg.js`

A white background is what makes a product look like a real shop listing.
Two ways to get there:

1. **Shoot it right** (best): white paper or a light tent, soft daylight
   from a window, phone on a stack of books, no flash.
2. **Cut it out** afterwards with the tool:

```
cd verktyg && npm install
node frilagg.js ../assets/produkt/foto.jpg ../assets/produkt/foto-vit.jpg 145
```

How it works: everything darker than the threshold is "product"; the largest
dark region is kept; everything reachable from the image edge without
crossing the product becomes white; the edge is softened by 1–2 px. White
logos inside the product survive because the edge-fill can't reach them.

- **Threshold:** start at 145. Parts of the product disappear → raise it.
  The background gets eaten in → lower it.
- **Light parts of a dark product** (SILQ's silver satin) look like
  background. Draw a rough polygon around them in `POLY`; inside it, only
  warm-toned light pixels (the table) are removed:
  ```
  POLY='[[[214,398],[236,372],…]]' EJ_BOTTEN=1 node frilagg.js in.jpg ut.jpg 120 "185,0,1060,720"
  ```
- **Light products** (white sneakers) invert the problem — this tool is
  built for dark products; use remove.bg or shoot on a dark/coloured backdrop.
- Keep the originals. Name cut-outs `*-vit.jpg`.
- Pad to a consistent ratio (4:3 here) so the gallery doesn't jump.
- **Never use AI-generated product images as if they were the real
  product.** (One reference image had an "AI生成" watermark — it was left out.)

## 8. Product gallery + lightbox — `js/media.js`, `js/lightbox.js`

- Main image + thumbnails. Thumbnails carry `data-galleri-bild` and
  `data-galleri-alt`; no JS changes to add an image.
- Images use `object-fit: contain` on a white stage, so any aspect ratio fits
  without cropping the product.
- Swipe left/right on mobile switches image.
- Magnifier button → `lightbox.js`: fullscreen, scroll/pinch/double-click
  zoom, drag when zoomed, arrows between images, Esc closes, focus is
  trapped and returned.
- Any `<img data-lightbox>` anywhere on the site becomes zoomable.

**Gotcha:** an `<img height="1080">` attribute overrides CSS
`aspect-ratio`. Add `height: auto` in the CSS when you want the ratio to win.

## 9. 3D product viewer — `js/cap3d.js`, `js/visare.js`

Click the product photo → fullscreen 3D on white. Drag to rotate (with
inertia), pinch/scroll to zoom, buttons for front / side / back / inside.

### Building the model in code

No 3D artist or modelling software: the skullcap is a **profile rotated
around an axis** (`THREE.LatheGeometry`) — the same way a potter's wheel
works. Anything round fits this approach:

| Product | Profile |
|---|---|
| Cap, beanie, bucket hat | dome + cuff (as in `cap3d.js`) |
| Mug, cup, bottle, candle, jar | straight/curved wall + base |
| Bowl, plate, vase | curve from base to rim |
| Lip balm, perfume, can | cylinder + cap |

For boxy products (boxes, phone cases, books) combine `BoxGeometry` pieces.
For complex shapes (shoes, clothing on a body) buy or scan a `.glb` model
and load it with `GLTFLoader` — the viewer code (`montera`) works the same.

How `cap3d.js` gets from a shape to something that looks real:

1. **Two surfaces**: outside and inside, a fabric thickness apart
   (`GODS`). Outside renders `FrontSide`, lining renders `BackSide`.
2. **Soft folds**: vertices are pushed in and out by a sum of sine waves
   (`veck`). Use whole-number frequencies around the circle so the waves
   meet without a seam. The lining gets extra inward-only creases so it can
   never poke through the fabric.
3. **Textures drawn on a `<canvas>`**: colour, seams, rib knit, logo. No
   image files to load.
4. **Materials** (`MeshPhysicalMaterial`) — starting values that worked:

   | Look | Settings |
   |---|---|
   | Matte fabric / knit | `roughness 0.86, metalness 0, sheen 0.6` + fine normal map |
   | Satin / silk | `metalness 0.5, roughness 0.42, sheen 0.5, clearcoat 0.25` |
   | Plastic | `roughness 0.4, metalness 0, clearcoat 0.3` |
   | Brushed metal | `metalness 1, roughness 0.35` |
   | Glass | `transmission 1, roughness 0.05, thickness 0.5` |

5. **Lighting**: `RoomEnvironment` (blurred, sigma 0.18) for reflections +
   key light, fill light, rim light from behind, a weak light from below.
   Without the environment, black products turn into flat silhouettes.
6. **Contact shadow**: a plane with a radial-gradient texture under the
   product. Cheaper and calmer than real shadows.

### Lessons learned (each one cost time)

- **`LatheGeometry` puts texture u = 0.5 at −z**, facing away from the
  camera. Rotate the model half a turn so the front faces the viewer.
- **Logo stretched?** A texture wrapped around the whole circumference is
  much wider per pixel than it is tall. Scale the text horizontally by
  `(canvas.width / 2πR) / (canvas.height / heightOfBand)`.
- **Star/pinwheel at the top of the dome** = a normal map or anisotropy
  squeezing together at the pole. Put the detail in the geometry instead.
- **Normals seam line**: after `computeVertexNormals()` on a lathe, average
  the first and last column (`lagaSkarv`).
- **Wait for the web font** (`document.fonts.load(...)`) before drawing a
  logo on canvas, or it's drawn in the fallback font.
- **Fit the camera to the screen** on both axes — a fixed distance that
  looks fine on a laptop overflows a portrait phone:
  `dist = max(h / tan(fov/2), w / (tan(fov/2) * aspect))`.
- **Only render when something moves.** The loop stops when the model is
  still; the GPU rests. Essential on phones.
- **Dispose everything on close** — geometries, materials, textures,
  environment, renderer — and remove the canvas.
- **Load three.js on intent**: start downloading when the pointer enters the
  product image, so it's ready by the click. Nobody else downloads it.
- The import map (`"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/…"`)
  must be in `<head>` of every page that uses 3D.

## 10. Scroll-driven 3D hero — `js/hero3d.js`

A separate system from the viewer: own renderer, own scene, own state. Only
the model code is shared.

The pattern:

1. **Keep the photo in the layout** (`.hero__fig`) as the slot. The 3D model
   is placed exactly where the slot is, so the layout is identical with and
   without 3D — and the photo is the fallback.
2. **Canvas behind content**: absolutely positioned, `z-index: 0`,
   `pointer-events: none`, extends 40vh below the hero. The next section has
   `position: relative; z-index: 1` and a background, so the model slides
   *behind* it.
3. **Scroll progress** `p = 0 → 1` from the top of the page until the slot
   has left the screen. Rotation, tilt, roll, sink and scale are each a
   different curve of `p`, so it never looks like a simple spin.
4. **Smoothing**: the model eases toward the scroll target
   (`nu += (mal - nu) * 0.085`) — smooth even with a jumpy mouse wheel.
5. **Parallax**: it sinks at ~50 % of scroll speed on desktop, less on
   mobile.
6. **Mobile**: text sits right below the model, so it fades out before
   overlapping the heading.
7. **Never blocks the page**: starts after `load` in `requestIdleCallback`;
   skipped for `prefers-reduced-motion`, Save-Data and no WebGL; renders only
   while visible (IntersectionObserver) and only while moving.

Reuse for any product: change `stall(p)` to choreograph a different reveal
(e.g. a bottle tilting to show its label, a box opening).

## 11. Performance checklist

- [ ] Images: JPG, ~80–110 kB, sized to their display (1440 px wide max),
      `width`/`height` attributes set, `loading="lazy"` below the fold,
      `fetchpriority="high"` on the hero image.
- [ ] Heavy libraries load on intent or after `load`, never in `<head>`.
- [ ] Only the font weights actually used.
- [ ] WebGL: pixel ratio capped (1.5 on weak devices, 2 elsewhere), render
      on demand, dispose on close.
- [ ] Weak-device detection: `hardwareConcurrency <= 4`, `deviceMemory <= 4`,
      Save-Data, narrow screen → lower quality.

## 12. Accessibility checklist

- [ ] Every image has meaningful `alt`; decorative canvases `aria-hidden`.
- [ ] Everything clickable is a `<button>` or `<a>`; custom clickables get
      `role="button"`, `tabindex="0"` and Enter/Space handling.
- [ ] Dialogs: `role="dialog"`, `aria-modal`, focus trapped, Esc closes,
      focus returns to the opener.
- [ ] Visible focus ring (`:focus-visible` with the accent colour).
- [ ] `prefers-reduced-motion` respected (no auto-rotation, no scroll
      animation).
- [ ] Text contrast ≥ 4.5:1 — check accent colours on light backgrounds.
- [ ] 3D is never the only way to see the product — photos always exist.

## 13. SEO and sharing checklist

Every page `<head>` has: `<title>`, `meta description`, `canonical`,
favicon + `apple-touch-icon`, `theme-color`, Open Graph (`og:title`,
`og:description`, `og:image` with width/height/alt, `og:url`, `og:locale`),
`twitter:card`. Plus `robots.txt`, `sitemap.xml` and a `404.html`.

Use the white-background product photo as `og:image` — it's what people see
when the link is shared in a chat.

## 14. Testing — `verktyg/`

```
cd verktyg && npm install     # once
node server.js ..             # terminal 1: http://localhost:8765/
node test.js                  # terminal 2: screenshots + console errors
```

`test.js` opens the site in headless Chrome (the one already installed) at
desktop (1440×900) and phone (390×844) size, scrolls the hero, opens the 3D
viewer from every angle, drags it, opens the lightbox, adds to cart, loads
every page, and reports console errors and horizontal scrolling. Look at the
screenshots in `verktyg/shots/` — a passing test doesn't mean it looks right.

**Gotcha:** a browser tab that is minimised or in the background pauses
`requestAnimationFrame` and CSS transitions. If 3D looks frozen or
half-faded while testing, the tab isn't visible — use the headless test.

## 15. Publishing

1. Push to `main`.
2. Once per repo: Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
3. Keep the `.nojekyll` file.
4. Custom domain: add a `CNAME` file with the domain, then replace the
   github.io address in canonical/og/sitemap (see README).

---

## New site, step by step

1. **Copy the repo.** Delete `assets/produkt/*`, keep everything else.
2. **Brand**: change the tokens in `styles.css` (colours, fonts) and the
   Google Fonts link in each page.
3. **Products**: fill `produkter` in `config.js`. Shipping, Swish,
   contact email, Web3Forms key.
4. **Photos**: shoot on white, or cut out with `frilagg.js`. Main photo
   4:3, plus a detail shot and one showing the feature that sells it.
5. **Copy**: start page (hero promise, three reasons, social proof/trend,
   product teaser, about), product page (price, shipping, what it is,
   material, fit, care, FAQ), about, team, contact.
6. **Legal pages**: company name, org. number (if any), address/email,
   return address, VAT status.
7. **3D (optional)**: if the product is round, adapt the profile in
   `cap3d.js` (`kupolProfil`, `muddProfil`) and the materials; update the
   `VYER` presets. Otherwise remove `cap3d.js`, `visare.js`, `hero3d.js`,
   the import maps and the `data-oppna-3d` button — everything else works
   without them.
8. **Meta**: titles, descriptions, `og:image`, canonical URLs, sitemap.
9. **Test**: `node test.js`, look at every screenshot, fix, repeat.
10. **Publish**: push, enable Pages, place a test order end-to-end
    (form email arrives, Swish QR shows the right amount).

## What to copy as-is vs. adapt

| Copy unchanged | Adapt per brand | Rewrite per product |
|---|---|---|
| `nav.js`, `cart.js`, `lightbox.js`, `media.js`, `visare.js`, `qrcode.js`, `verktyg/*` | `styles.css` tokens, `config.js`, `checkout.js` texts, legal pages | `cap3d.js` model (profile, textures, logo), `hero3d.js` choreography, all copy and photos |
