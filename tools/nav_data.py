"""cpsboost.com navigation data — the single source of truth for the toolbar.

This is the ONLY file that differs between sites. `sync_nav.py` is generic and
copies verbatim. Nothing here is computed at runtime by the browser: sync_nav
renders it into the static HTML of every page.

Tier rule (portfolio spec, ngineer420.github.io#13): a page is tier 1 only if it
answers a *different question*. The same tool with a parameter baked in is
tier 2 — it never appears in the rail or the sheet body. It gets one hub link at
the bottom of the sheet plus real <a href> sibling chips inside the tool's own
control panel, where it is a parameter and not a peer.

Here that line falls exactly where the engine already draws it: a *technique*
earns a row in the VARIANTS table in app.js because it changes what is being
measured and how, while the six duration pages are all `standard` with a
different clock. So the seven techniques plus the standard test are tier 1, and
the six durations are tier 2 — which is also what removes the site's one real
nav fault, the six duration chips appearing twice on the same screen (once in
the old tab bar, once in the deck's mode row).
"""

# Noun used in the menu trigger: "All 8 tests".
NOUN = "tests"

# Tier-1 tests, in rail order (rail is capped at 8 — this site has exactly 8).
#   label -> rail chip text, <= 18 chars
#   long  -> anchor text in the sheet and in any footer/in-body list
#   group -> sheet grouping key, only used once a site passes 8 destinations
TOOLS = [
    {"href": "/",                    "label": "Standard",     "long": "Standard Click Test",  "group": "core",      "tier": 1},
    {"href": "/jitter-click-test",   "label": "Jitter",       "long": "Jitter Click Test",    "group": "technique", "tier": 1},
    {"href": "/butterfly-click-test", "label": "Butterfly",   "long": "Butterfly Click Test", "group": "technique", "tier": 1},
    {"href": "/drag-click-test",     "label": "Drag",         "long": "Drag Click Test",      "group": "technique", "tier": 1},
    {"href": "/kohi-click-test",     "label": "Kohi",         "long": "Kohi Click Test",      "group": "technique", "tier": 1},
    {"href": "/spacebar-counter",    "label": "Spacebar",     "long": "Spacebar Counter",     "group": "technique", "tier": 1},
    {"href": "/right-click-test",    "label": "Right click",  "long": "Right Click Test",     "group": "technique", "tier": 1},
    {"href": "/double-click-test",   "label": "Double click", "long": "Double Click Test",    "group": "technique", "tier": 1},
]

# Sheet groups, in order. Unused at <= 8 destinations (the sheet renders flat,
# because group headings are noise at that size) — kept so the arrangement is
# already decided the day this site gains a ninth test. The DURATION label the
# old tab bar carried lives on the deck chips now, where the durations are.
GROUPS = [
    ("core",      "Click speed test"),
    ("technique", "Technique"),
]

# One hub link at the bottom of the sheet per tier-2 family.
HUBS = [("/", "All 6 test durations")]

# Tier-2: the duration landing pages. One engine with a different clock, so
# they live in the cabinet's own mode row as sibling chips and are deliberately
# absent from the rail and the sheet body. They are only rendered on the pages
# that run the `standard` mode — a technique page's durations have no URL of
# their own and stay plain buttons.
#   bytes -> the app.js mode token this chip selects (rendered as data-target)
VARIANTS = {
    "parent": "/",  # the tier-1 test these are a parameter of
    "label": "Duration",
    "aria": "Test duration",
    "items": [
        {"href": "/1-second-click-test",   "label": "1s",   "bytes": "1"},
        {"href": "/5-second-click-test",   "label": "5s",   "bytes": "5"},
        {"href": "/10-second-click-test",  "label": "10s",  "bytes": "10"},
        {"href": "/30-second-click-test",  "label": "30s",  "bytes": "30"},
        {"href": "/60-second-click-test",  "label": "60s",  "bytes": "60"},
        {"href": "/100-click-test",        "label": "100",  "bytes": "100clicks"},
    ],
}

# Long anchor text for a footer crawl list, if the site has one. cpsboost
# deliberately does not: the rail is always visible and carries every tier-1
# destination, the deck chips carry every tier-2 one, and the in-body "Every
# click test on cpsboost" grid on each tool page is already the long-anchor
# crawl surface. A footer duplicate would add boilerplate without adding reach.
FOOTER = []

# One-time --migrate: what the legacy markup looked like and where the marker
# pairs go. Per-site, because the legacy markup is per-site. Ops run in order.
MIGRATE = [
    # The old two-row tab bar: byte-identical in 32 files, which is what made
    # every nav change a 32-file edit and what this script exists to end.
    {"op": "strip", "pattern": r'\n<nav class="test-nav".*?\n</nav>'},
    # The toolbar is a direct child of <body>, immediately after </header>.
    {"op": "insert_after", "region": "nav", "pattern": r"</header>", "indent": ""},
    # The duration chips replace the deck's JS-only mode buttons — but only on
    # the pages that run `standard`, which are the only ones whose durations
    # have URLs. `data-mode="1"` is present in exactly those seven files (a
    # technique page's shortest offered run is 5s), so it is the discriminator.
    # The deck is always visible: unlike photoshrink's workspace there is no
    # load-gated `hidden` ancestor here, so the links are never display:none.
    {"op": "replace", "region": "sizechips", "indent": " " * 8,
     "pattern": r'[ \t]*<span class="deck-label">Select Mode</span>\s*'
                r'<div class="mode-row"[^>]*>.*?data-mode="1".*?</div>'},
]
