# Nanophonics

The nanophonics.com one-pager. Static site: **no build step, no dependencies,
no third-party requests.** Open `index.html` and it works.

```
index.html                 the whole page
CNAME                      custom domain for GitHub Pages
assets/css/style.css       design tokens + all styling
assets/js/main.js          canvas visuals, reveals, nav, accordion, form
assets/fonts/*.woff2       self-hosted variable fonts
assets/img/team/           team portraits (4:5)
assets/img/favicon.svg     logo mark
```

Around 1.5 MB total, of which 768 KB is fonts.

---

## Run it locally

```bash
python -m http.server 8000     # then open http://localhost:8000
```

A server is only needed because the fonts load with CORS; opening the file
directly still renders, just with fallback fonts.

## Deploy

Published with GitHub Pages from the `main` branch, root folder. The `CNAME`
file pins the custom domain, so leave it in place. Pushing to `main` is the
deploy.

---

## Design

**Near-black canvas, one saturated accent, grotesk + mono type pairing, and
real signal visualisations instead of stock imagery.**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#08090b` | page |
| `--panel` | `#0e1116` | instrument frames |
| `--acc` | `#d4ff3f` | the single accent |
| `--cyan` | `#3fe8ff` | data-viz only, never UI |
| `--f-dsp` | Space Grotesk | headlines |
| `--f-txt` | Inter | body |
| `--f-mon` | JetBrains Mono | labels, numbers, metadata |

Everything lives in the `:root` block at the top of `style.css`. Change the
accent there and the whole site follows.

Fonts are self-hosted rather than loaded from Google Fonts: no third-party
request, no GDPR exposure, and the `latin-ext` subset is included so Croatian
diacritics render correctly.

### The visuals are generated at runtime

Five `<canvas>` animations, all drawn in `main.js`. No images, no GIFs.

- **Hero scope** — a harmonic stack buried in band-limited value noise, with a
  processing edge sweeping left to right. Behind the edge the noise is gone and
  the trace glows; ahead of it, raw input. The readouts track the sweep.
- **Machine Learning** — an embedding space, points orbiting into three clusters
  with a moving decision boundary.
- **Signal Processing** — one signal decomposed into four components.
- **Audio Development** — spectrum analyser with a smoothed response curve.
- **AI Agents** — a hub dispatching calls to tools and sub-agents of three
  different kinds, several in flight at once, each returning with a result.

Each canvas animates only while it is on screen (`IntersectionObserver`) and
pauses when the tab is hidden, so idle CPU stays at zero.

---

## Still open

### A form endpoint

The contact form has an empty `action`, so submitting opens the visitor's mail
client pre-filled to `info@nanophonics.com`. It never dead-ends, but nothing
lands in an inbox on its own. GitHub Pages has no server side, so this needs a
third-party endpoint:

```html
<form class="form" id="contactForm" ... action="https://formspree.io/f/XXXXXXX">
```

`main.js` detects the endpoint and switches to `fetch`, with success and error
states already wired. Formspree, Basin and similar all work. A honeypot field
(`_gotcha`) is in place.

### An OG share image

`assets/img/og.png`, 1200×630. Referenced in the `<head>`; until it exists, link
previews show text only.

---

## Team photos

Portraits live in `assets/img/team/` at 4:5, 800px wide, shown in full colour.
Supply them already colour-corrected; the only treatment applied is a gentle
zoom on hover. If a file is missing, the card falls back to the person's
initials and a "photo pending" marker rather than breaking.

Uncropped originals are kept outside the repository.

---

## Accessibility & behaviour

- Skip link, visible focus rings, semantic landmarks, `aria-expanded` on every
  toggle, live region on the form status.
- `prefers-reduced-motion` is honoured: reveals resolve instantly, canvases draw
  one static frame, the grain layer is removed.
- Work entries ship expanded in the markup and collapse only once JavaScript
  runs, so the copy stays readable without it.
- Keyboard: everything reachable, Escape closes the mobile menu.
- Verified at 390 px, 900 px and 1440 px.

## Browser support

Modern evergreen browsers. Uses `IntersectionObserver`, custom properties,
`backdrop-filter` and `canvas.roundRect`. No polyfills.
