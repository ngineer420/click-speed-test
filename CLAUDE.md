# cpsboost.com — working notes for Claude

Free click-speed test (clicks-per-second) built as a **retro arcade cabinet**.
Static, zero-dependency site: vanilla HTML/CSS/JS, no build step, deployed on
GitHub Pages (`CNAME` → cpsboost.com, Cloudflare DNS). Everything runs
client-side; nothing is uploaded.

## Files

- `index.html` — the whole game UI (one page). Below it: an About/FAQ section
  and a "Learn more" article list. Standalone articles live in `articles/`.
- `assets/js/app.js` — all logic (~940 lines, one IIFE): theme, gamification
  (XP/levels/ranks/achievements/streaks), WebAudio sound synth, the game state
  machine, and the arcade HUD layer.
- `assets/css/styles.css` — the entire design system in one file.
- `privacy.html` / `terms.html` — required for ad networks; keep them working.

Serve locally with any static server (`python3 -m http.server 8000`). **A
`?v=` cache-bust convention is now in use** (`styles.css?v=N` / `app.js?v=N`
on every page) — see the pixel-art overhaul section at the bottom. Bump it on
any coupled HTML+CSS/JS change. GitHub Pages serves `max-age=600`.

## Design language — the arcade cabinet

The look is a genuine **early-90s arcade cabinet**, specifically the
**Street Fighter II / CPS-2 fighting-game era** (Max is fond of it). The retro
feel comes entirely from CSS — **zero external fonts/assets** — via glow, chunky
notched panels, CRT scanlines, and motion. Palette is "Power Surge": a dark,
magenta-tinted background (never neutral gray), one dominant saturated accent
(hot pink `--accent`), one secondary (arcade gold `--accent-2`), and a third
(`--cyan`) reserved for HUD/celebration. Light theme exists and must keep working.

**This cabinet's genre flavour = FIGHTING GAME.** Sibling game sites share the
arcade *chrome* but each evokes a **different arcade genre** so they never feel
like style clones (reflexzap = quick-draw/lightning duel, wpmflex = rhythm
"type-rush", flicktrainer = light-gun shooter). Keep cpsboost's fighting-game
identity: combos, a SUPER charge meter, beveled announce slams (FIGHT! / TIME
UP!), and a post-match letter GRADE.

Shared arcade chrome (see `styles.css`): CRT scanline + vignette overlay
(`body::before`/`::after`), a `crt-power-on` boot flash, an illuminated
**marquee sign** (`.hero-sign`), **pixel-corners** notched panels, chunky
`box-shadow` "cabinet" buttons that depress on `:active`.

## CLICK FIGHTER — the full cabinet + CRT fighting-game overhaul

The page is NOT a webpage with a centered card; it is a rendered **arcade
cabinet** (`.cabinet`) — a real re-imagining, not a facelift. Structure (see the
"CLICK FIGHTER" block appended to `styles.css`):

- **`.marquee`** — backlit banner up top with the beveled "CLICK **FIGHTER**"
  logo (text-stroke + hard shadow) and a scanline sheen.
- **`.crt`** — a molded monitor bezel (gradient plastic, corner-screw pseudos)
  wrapping **`.crt-screen`** (id `game-panel`): the screen, with a curvature
  vignette (`::after`), inner glow, and a glass-glare overlay (`.crt-glare`).
  The screen plays the match.
- **`.fight-hud`** — a 3-column SFII HUD: **YOU** *Power* bar (left, cyan→gold,
  id `super-fill`, the old SUPER gauge) · a big **round timer** (center, id
  `stat-time`) · **RIVAL** *Health* bar (right, `#hp-rival`, a skewed
  parallelogram that drains as you click). Both `.hp` bars are `skewX(-16deg)`.
- **`.combo-meter`** (`#combo-num`) — a big beveled "N HITS" counter that pops
  on ≥2-combos. **`.fight-stage`** holds the glowing hit-orb (`#click-target`);
  each click throws a **`.hit-spark`** burst.
- **`.deck`** — an angled (`perspective`+`rotateX`) control panel below the CRT:
  the mode row as chunky beveled arcade buttons, a big illuminated round
  **START** button (`.start-btn`), a coin-door detail, and a `.player-card`
  (rank + XP bar, ids `xp-rank-label` / `xp-progress-label` / `xp-bar-fill`).
- **Announce slams** (`.announce`, beveled/skewed/outlined italic): "FIGHT!" on
  go, and on end **"K.O.!"** if you drained the rival's health, else "TIME UP!"
  (timed) / "FINISH!" (100-click). **Letter GRADE** (`.grade-stamp`, S–E from
  CPS) stamps the results.
- **FREE PLAY** credit indicator blinks while idle and hides once a run is
  running (`setCreditVisible`). Arcade "SCORE" = total clicks (not "1UP", which
  reads as lives); HI-SCORE (`#score-hi`) = most clicks in any run
  (`cbt-best-clicks`).

**The RIVAL fight is pure flavour** layered on the real test: `rivalHp` drains
by `rivalDamage` per click (`koTarget` scaled per mode so ~6 CPS K.O.s
regardless of duration). It never feeds the CPS math. Beveled announce/grade
text = `-webkit-text-stroke` + `paint-order: stroke fill` + hard `text-shadow` +
`skewX` (the SFII "announce" look). Every animation has a
`prefers-reduced-motion` fallback.

Note: the old `.game-panel` / `.hero` / `.score-strip` / pixel-corners styles
still exist in `styles.css` above the overhaul block but are largely superseded
— `.crt-screen` overrides the reused `#game-panel`. The **sibling game sites are
NOT yet reimagined to this depth** (they still have the lighter arcade-HUD
pass); bringing them up to a full genre-cabinet is the follow-up.

## Hard rules (don't regress)

- **The CPS math is sacred.** `computeCps` / `getRating` live between the
  `=== CPS-MATH-START/END ===` markers, are pure/DOM-free, and are the only
  source of the real score. The HUD, combos, heat, SUPER, grade, and announce
  are all **flavour** — none of them may feed back into the CPS calculation.
- **Clicks are counted on `pointerdown` only** (one listener covers mouse +
  touch; the `click` listener is a no-op guard). Don't add a second counter or
  you'll double-count.
- **Ads: AdSense Auto ads only.** One `<script>` in `<head>` (client
  `ca-pub-7560786263587509`). NEVER add `.ad-slot` divs or manual units.
- **Respect `prefers-reduced-motion`** — every animation added must have a
  reduce fallback (the file already gates the arcade ones).
- **Zero third-party requests.** No CDNs or beacons. The one webfont
  (`assets/fonts/pressstart2p.woff2`, the pixel font) is **self-hosted /
  same-origin**, so the privacy intent of the rule holds — no external font
  fetch. The rest of the arcade feel is CSS-only. Sound is synthesized live via
  WebAudio (`playTone` and friends) — no audio files — and is mute-toggleable +
  persisted (`cbt-sound-muted`).
- The `erabb.it` 🐇 mark is the portfolio signature — leave it last in `<body>`,
  flush to the corner, `cursor: default`.

## Friend challenge links (URL state)

A shared result is a **URL**, not a dead text blob. `#share-btn` copies
`https://cpsboost.com/?cps=<score>&mode=<mode>`; opening that link preselects
the friend's mode, shows `#challenge-banner` on the CRT with their score as the
number to beat, and renders `#challenge-verdict` (`.is-win` / `.is-loss`) on the
results panel once you finish.

- `cps` — float, must be finite and within `0 < cps <= 100`, else no challenge.
- `mode` — must be one of `CHALLENGE_MODES` (`5`/`10`/`30`/`60`/`100clicks`),
  else falls back to `10`.
- **Validate every param before use.** A hand-edited or hostile query string
  must only ever degrade to "no challenge" — it must never configure a broken
  run or render unescaped text (the banner is set via `textContent`).
- `applyChallenge()` runs **before** `resetToIdle(false)` at init, otherwise the
  round timer renders the previous mode's duration.
- `finalMode` snapshots the mode the finished run was played in, so the share
  link can't drift if the mode selector is touched afterwards.

## localStorage keys

`cbt-theme`, `cbt-sound-muted`, `cbt-profile` (XP/level/streak/achievements),
`cbt-best-cps` (personal best CPS), `cbt-best-clicks` (HI-SCORE, most clicks),
`cbt-history` (last 8 CPS results).

## Shipping

Work in a worktree under `.claude/worktrees/`, open a PR, merge when Max says
(he's been saying "merge as they land" for this batch). Never push straight to
`main`. Verify visually with a real headless-Chrome render of the idle screen,
and force the mid-fight + results/announce state via throwaway previews (strip
`app.js`, set inline widths on `#super-fill`/`#hp-rival`, add `.show`+content to
`.announce`/`.combo-meter`/`#result-grade`, un-hide `#results-panel`) since the
`--screenshot` flag can't drive the game. **Serve over HTTP** — the app uses
absolute `/assets/...` paths, so `file://` won't load the CSS/font.

## PIXEL-ART CLICK FIGHTER overhaul (supersedes the sections above)

cpsboost was rebuilt from the earlier "web-slick" CLICK FIGHTER pass (smooth
gradients, soft glows, a bold *sans* logo with `-webkit-text-stroke`/`skewX`
outlines) into a **genuine pixel-art cabinet** (bar: metekamil.com). The DOM
structure (`.cabinet` → `.marquee` → `.crt`/`.crt-screen` → `.deck`) and the
fighting-game mechanics are unchanged — this was a CSS conversion. Key shifts:

- **Self-hosted pixel font** `assets/fonts/pressstart2p.woff2` (Press Start 2P,
  OFL) via `@font-face "PixArc"`, applied to ALL arcade chrome (logo, HUD
  labels, timer, combo, announce, grade, buttons, player card, results). This is
  the one deliberate exception to "system-fonts only" — it is **same-origin**,
  so it still makes **no third-party request**. Body/FAQ prose stays a normal
  system font — the pixel font is arcade chrome only.
- **Pixel-art discipline**: FLAT colours, HARD pixel edges (layered `box-shadow`
  borders like `0 0 0 4px #000, 0 0 0 8px #ff2d6b`, `border-radius:0`),
  `image-rendering: pixelated`, hard offset `text-shadow` (e.g. `3px 3px 0
  #000`). NO smooth gradients on text/bars, NO `-webkit-text-stroke`/`skewX`, NO
  blurred glows, NO thin 1px borders. An animated diagonal-stripe backdrop
  (`stripe-scroll`) on `.crt-screen`; hard horizontal scanline `::after`.
- **Fixed-palette CRT**: the cabinet interior hardcodes bright pink `#ff2d6b` /
  gold `#ffd60a` / cyan `#00e0ff` (NOT the theme `var(--accent)` etc.) so the
  arcade screen stays vivid in BOTH light and dark page themes. The surrounding
  page chrome (header/footer/About) still respects the theme.
- **Fighting-game identity kept + made pixel** (distinct from reflexzap's
  best-of-5 duel *pips*): YOU **Power** bar (cyan flat) vs RIVAL **Health** bar
  (pink flat) — both now rectangular black-boxed flat fills, no skew/gradient;
  big **HITS** combo (`#combo-num`); pixel **hit-sparks** (a `clip-path` star,
  not a soft radial); pixel `FIGHT!`/`TIME UP!`/`K.O.!` **announce slams** (flat,
  hard offset shadow, `steps()` scale — no skew); a tilted pixel letter
  **GRADE** stamp. The hit target (`#click-target`) is a chunky flat pixel block
  with a hard 3D `box-shadow` "depth" — NOTE it is `disabled` while idle, so it
  carries `#click-target:disabled { opacity:1 !important }` to stop the base
  `button:disabled` opacity from letting the CRT stripes bleed through it.
- **Cache-bust adopted**: `styles.css?v=` / `app.js?v=` on **every** page
  (index, 404, privacy, terms, articles/*). **Bump the `?v=` on any coupled
  HTML+CSS/JS change** or cached visitors get new HTML with stale CSS and the
  page renders as raw unstyled text (this exact bug hit cpsboost before).
  Currently `?v=3`.
- All the ID contracts app.js relies on (`click-target`, `start-btn`,
  `mode-row`/`mode-btn`, `stat-*`, `score-*`, `super-fill`, `hp-rival`,
  `combo-num`, `announce`, `result-grade`, `result-*`, `xp-*`, `chip-*`) are
  preserved. The CPS math (`computeCps`/`getRating` between the CPS-MATH
  markers) and the `pointerdown`-only click counting are untouched — the whole
  HUD/health/combo/super/grade layer remains pure flavour.
