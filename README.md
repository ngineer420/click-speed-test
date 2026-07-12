# cpsboost.com

A free, ad-supported click speed test that measures clicks per second (CPS).

- **Modes**: 5s, 10s, 30s, and 60s timed tests, plus a "100 clicks" race-to-finish mode.
- **Live stats**: click counter and live CPS readout update as you click.
- **3-2-1 countdown** before each run starts.
- **Results screen**: total clicks, elapsed time, final CPS, and a fun skill rating (Getting Started → Superhuman).
- **Personal best** CPS is saved in `localStorage` and shown alongside each new result.
- **Copy result**: one-click clipboard copy of a shareable score summary, with a "Copied!" toast.
- Works on desktop (mouse) and mobile (touch) via the Pointer Events API — clicks are counted once per press, with no double-counting between input types.

Everything runs client-side — no backend, no build step, no uploads. Deployed as static files on GitHub Pages.

## Local development

No build tooling required. Serve the folder with any static file server, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Structure

```
index.html              Main app (game UI + FAQ content)
privacy.html             Privacy policy (required for ad networks)
terms.html                Terms of use
404.html                   Not-found page
assets/favicon.svg      Original SVG favicon
assets/css/styles.css   Design system
assets/js/app.js         All app logic (game state machine, CPS math, localStorage, clipboard)
robots.txt                Search engine crawl rules
sitemap.xml               Sitemap for search engines
CNAME                      GitHub Pages custom domain (cpsboost.com)
```

## Enabling ads (Google AdSense)

1. The site is live at https://cpsboost.com/.
2. Apply at https://adsense.google.com with the live URL. Approval requires a working privacy policy (already included) and some real content/traffic — it isn't instant.
3. Once approved, uncomment the AdSense `<script>` tag in `index.html`'s `<head>` and replace `ca-pub-XXXXXXXXXXXXXXXX` with your publisher ID. Auto ads then places ad units automatically — no manual placement needed.

## Custom domain (cpsboost.com)

`cpsboost.com` is purchased and live via Cloudflare DNS, pointed at GitHub Pages using the `CNAME` file in this repo:

- Apex domain (`cpsboost.com`): four `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- `www` subdomain (optional): `CNAME` record to `<username>.github.io`.

Pages is enabled in the repo's Settings → Pages with `cpsboost.com` as the custom domain, with HTTPS enforced.

## CPS calculation

`CPS = total clicks ÷ elapsed seconds`. In timed modes the elapsed time is the fixed duration selected; in 100-click mode it's the exact time between the first click and the 100th click. Rating thresholds (approximate, since average human CPS is roughly 4–7):

| CPS       | Rating           |
|-----------|------------------|
| < 2       | Getting Started  |
| 2 – 4     | Casual Clicker   |
| 4 – 6     | Skilled Clicker  |
| 6 – 8     | Pro Clicker      |
| 8 – 10    | Elite Clicker    |
| 10+       | Superhuman       |
