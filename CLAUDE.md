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

Serve locally with any static server (`python3 -m http.server 8000`). No
`?v=` cache-bust convention here (unlike some sibling sites) — GitHub Pages
serves `max-age=600`, so a redeploy is visible within ~10 min.

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

## Arcade HUD (the "ARCADE CABINET HUD" block in styles.css / helpers in app.js)

Added on top of the real game — **presentation only, never touches scoring**:

- **`SCORE / FREE PLAY / HI-SCORE` score strip** at the top of the game panel.
  The arcade "score" is **total clicks** (points), zero-padded to 5 digits;
  `HI-SCORE` is the **most clicks landed in any run** (`cbt-best-clicks`), NOT
  the best CPS. SCORE counts up live during a run. (Label is "SCORE", not "1UP"
  — "1UP" reads as an extra-life indicator, which doesn't fit a click count.)
  **FREE PLAY** is a real attract-mode credit indicator: it blinks while idle
  and **disappears once a run is actually running** (`setCreditVisible`), like a
  cabinet set to free play.
- **`▸ SELECT MODE`** menu caption over the mode pills (the mode row is the
  game's menu).
- **CRT bezel** on `.game-panel`: dark border + inset shadow + `::after`
  vignette. ⚠️ `.game-panel` has a pixel-corners `clip-path`, which **clips any
  OUTER `box-shadow`** — build depth from `border` + `inset` shadow + the
  vignette pseudo, never an outer glow ring.
- **SUPER meter** (`.super-meter`): a fighting-game charge gauge bound to the
  existing click "heat" (rolling CPS / `HEAT_TARGET_CPS`). Fills as you click
  fast; `.is-max` at full.
- **Announce slam** (`.announce`): a beveled, skewed, outlined italic word that
  slams in — "FIGHT!" when the countdown ends (replaces the old "GO!"),
  "TIME UP!" (timed modes) / "FINISH!" (100-click) on end. Auto-hides after
  ~0.9s (so it doesn't cover the CPS result).
- **Letter GRADE stamp** (`.grade-stamp`): S/A/B/C/D/E from final CPS, stamped
  on the results panel (shown ~260ms after finish so it animates on reveal).
- Beveled announce/grade text = `-webkit-text-stroke` + `paint-order: stroke
  fill` + hard offset `text-shadow` + `skewX`. That's the SFII "announce" look.

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
- **Zero external requests.** No webfonts, CDNs, or beacons. The arcade feel is
  CSS-only. Sound is synthesized live via WebAudio (`playTone` and friends) —
  no audio files — and is mute-toggleable + persisted (`cbt-sound-muted`).
- The `erabb.it` 🐇 mark is the portfolio signature — leave it last in `<body>`,
  flush to the corner, `cursor: default`.

## localStorage keys

`cbt-theme`, `cbt-sound-muted`, `cbt-profile` (XP/level/streak/achievements),
`cbt-best-cps` (personal best CPS), `cbt-best-clicks` (HI-SCORE, most clicks),
`cbt-history` (last 8 CPS results).

## Shipping

Work in a worktree under `.claude/worktrees/`, open a PR, merge when Max says
(he's been saying "merge as they land" for this batch). Never push straight to
`main`. Verify visually with a real headless-Chrome render of the idle screen,
and force the results/announce state via a throwaway preview (strip `app.js`,
un-hide `#results-panel`, add `.show` to `.announce`/`.grade-stamp`) since the
`--screenshot` flag can't drive the game.
