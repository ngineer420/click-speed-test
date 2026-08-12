// Pure-helper tests for app.js. Run with: node assets/js/app.test.js
// No framework/deps — uses Node's built-in test runner + assert. app.js exports
// its pure half and then returns before touching `document`, so requiring it
// here loads the maths without a browser.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeCps,
  getRating,
  clickIntervals,
  perSecondCounts,
  stabilityScore,
  peakWindowCps,
  alternationScore,
  burstClusters,
  intervalHistogram,
  countBelow,
  analyzeRun,
  resolveVariant,
  resolveDuration,
  VARIANTS,
} = require("./app.js");

/* Build a click run at a steady rate: `cps` clicks a second for `seconds`. */
function steady(cps, seconds, startMs = 0) {
  const gap = 1000 / cps;
  const out = [];
  for (let i = 0; i < cps * seconds; i += 1) out.push(startMs + i * gap);
  return out;
}

/* ---------- the existing CPS maths, unchanged ---------- */

test("computeCps divides clicks by elapsed seconds and guards zero time", () => {
  assert.equal(computeCps(60, 10000), 6);
  assert.equal(computeCps(0, 10000), 0);
  assert.equal(computeCps(50, 0), 0, "a zero-length run must not divide by zero");
  assert.equal(computeCps(50, -1), 0);
});

test("getRating boundaries land on the lower band", () => {
  assert.equal(getRating(1.99), "Getting Started");
  assert.equal(getRating(2), "Casual Clicker");
  assert.equal(getRating(5.9), "Skilled Clicker");
  assert.equal(getRating(6), "Pro Clicker");
  assert.equal(getRating(10), "Superhuman");
});

/* ---------- intervals ---------- */

test("clickIntervals returns the gaps, one fewer than the clicks", () => {
  assert.deepEqual(clickIntervals([0, 100, 250, 300]), [100, 150, 50]);
  assert.deepEqual(clickIntervals([500]), [], "a single click has no gap");
  assert.deepEqual(clickIntervals([]), []);
});

test("countBelow counts only strictly-shorter gaps", () => {
  assert.equal(countBelow([10, 79, 80, 81, 400], 80), 2);
  assert.equal(countBelow([], 80), 0);
});

/* ---------- per-second bucketing ---------- */

test("perSecondCounts buckets by whole second and drops the partial tail", () => {
  // 2 clicks in second 0, 3 in second 1, and one stray at 2.5s that falls in
  // the partial third second, which is discarded rather than counted as a slow one.
  const times = [0, 500, 1000, 1200, 1900, 2500];
  assert.deepEqual(perSecondCounts(times, 2000), [2, 3]);
  assert.deepEqual(perSecondCounts(times, 2999), [2, 3]);
  assert.deepEqual(perSecondCounts(times, 3000), [2, 3, 1]);
});

test("perSecondCounts returns nothing for a sub-second run", () => {
  assert.deepEqual(perSecondCounts([0, 100], 900), []);
});

/* ---------- stability (the jitter readout) ---------- */

test("stabilityScore is 100 for a perfectly even run", () => {
  assert.equal(stabilityScore([8, 8, 8, 8]), 100);
});

test("stabilityScore drops as the run gets spiky", () => {
  const even = stabilityScore([10, 10, 10, 10]);
  const wobbly = stabilityScore([10, 8, 12, 10]);
  const spiky = stabilityScore([20, 2, 18, 1]);
  assert.equal(even, 100);
  assert.ok(wobbly < even && wobbly > spiky, `expected ${spiky} < ${wobbly} < ${even}`);
  assert.ok(spiky >= 0, "the score is clamped at zero, never negative");
});

test("stabilityScore refuses to guess from too little data", () => {
  assert.equal(stabilityScore([]), null);
  assert.equal(stabilityScore([7]), null, "one second is not a trend");
  assert.equal(stabilityScore([0, 0]), 0, "a run with no clicks is not 100% stable");
});

/* ---------- peak window ---------- */

test("peakWindowCps finds the best sliding second, not the best fixed one", () => {
  // Nothing special in second 0 or 1 alone, but the 500-1500ms window holds 10.
  const times = [];
  for (let i = 0; i < 10; i += 1) times.push(600 + i * 80); // 600..1320
  assert.equal(peakWindowCps(times, 1000), 10);
});

test("peakWindowCps handles the empty and single-click cases", () => {
  assert.equal(peakWindowCps([], 1000), 0);
  assert.equal(peakWindowCps([0], 1000), 1);
});

test("peakWindowCps on a steady run matches the steady rate", () => {
  assert.equal(peakWindowCps(steady(8, 5), 1000), 8, "exact 125ms gaps");
  assert.equal(peakWindowCps(steady(6, 10), 1000), 6, "166.66ms gaps must not fencepost to 7");
});

/* ---------- alternation (the butterfly readout) ---------- */

test("alternationScore reads a two-finger long/short ripple as alternating", () => {
  // Finger A lands 60ms after B, B lands 100ms after A — the signature.
  const times = [0];
  for (let i = 0; i < 20; i += 1) {
    times.push(times[times.length - 1] + (i % 2 === 0 ? 60 : 100));
  }
  assert.ok(alternationScore(clickIntervals(times)) >= 90);
});

test("alternationScore reads one flat finger as not alternating", () => {
  const flat = clickIntervals(steady(8, 5));
  assert.ok(
    alternationScore(flat) === null || alternationScore(flat) < 65,
    "an evenly-spaced run must not be reported as butterfly clicking"
  );
});

test("alternationScore refuses to guess from a handful of clicks", () => {
  assert.equal(alternationScore([]), null);
  assert.equal(alternationScore([100, 60, 100]), null, "three gaps is not a rhythm");
});

/* ---------- burst clusters (the drag readout) ---------- */

test("burstClusters counts separated explosions, not every click", () => {
  // Two 20-click bursts at ~50 CPS, a second apart.
  const times = [];
  for (let i = 0; i < 20; i += 1) times.push(i * 20);
  for (let i = 0; i < 20; i += 1) times.push(1500 + i * 20);
  assert.equal(burstClusters(times, 15, 1000), 2);
});

test("burstClusters ignores ordinary clicking", () => {
  assert.equal(burstClusters(steady(8, 10), 15, 1000), 0);
  assert.equal(burstClusters([], 15, 1000), 0);
});

test("burstClusters does not split one continuous burst into many", () => {
  const times = [];
  for (let i = 0; i < 60; i += 1) times.push(i * 20); // 50 CPS for 1.2s
  assert.equal(burstClusters(times, 15, 1000), 1);
});

/* ---------- histogram (the double-click readout) ---------- */

test("intervalHistogram bins gaps and clamps the overflow into the last bucket", () => {
  const bins = intervalHistogram([10, 50, 90, 100000], 40, 4);
  assert.deepEqual(bins, [1, 1, 1, 1]);
  assert.equal(bins.length, 4);
});

test("intervalHistogram of an empty run is all zeroes, not an empty array", () => {
  assert.deepEqual(intervalHistogram([], 40, 3), [0, 0, 0]);
});

/* ---------- the aggregator every page shares ---------- */

test("analyzeRun reports every metric from one timestamp array", () => {
  const a = analyzeRun(steady(6, 10), 10000);
  assert.equal(a.clicks, 60);
  assert.equal(a.cps, 6);
  assert.equal(a.peakCps, 6);
  assert.equal(a.stability, 100);
  assert.equal(a.bursts, 0);
  assert.equal(a.fastDoubles, 0);
  assert.equal(Math.round(a.medianGap), 167);
  assert.equal(Math.round(a.fastestGap), 167);
  assert.equal(a.histogram.length, 12);
});

test("analyzeRun flags sub-80ms doubles as a hardware symptom", () => {
  // A deliberate click every 400ms, each one shadowed by a 12ms bounce.
  const times = [];
  for (let i = 0; i < 10; i += 1) {
    times.push(i * 400);
    times.push(i * 400 + 12);
  }
  const a = analyzeRun(times, 4000);
  assert.equal(a.fastDoubles, 10);
  assert.equal(a.fastestGap, 12);
  assert.ok(a.histogram[0] >= 10, "the bounces pile into the first bucket");
});

test("analyzeRun survives a run with no clicks at all", () => {
  const a = analyzeRun([], 10000);
  assert.equal(a.clicks, 0);
  assert.equal(a.cps, 0);
  assert.equal(a.peakCps, 0);
  assert.equal(a.medianGap, null);
  assert.equal(a.fastestGap, null);
  assert.equal(a.alternation, null);
  assert.equal(a.bursts, 0);
});

/* ---------- the variant table ---------- */

test("resolveVariant falls back to the standard test for anything unknown", () => {
  assert.equal(resolveVariant("jitter"), VARIANTS.jitter);
  assert.equal(resolveVariant("nonsense"), VARIANTS.standard);
  assert.equal(resolveVariant(""), VARIANTS.standard);
  assert.equal(resolveVariant(null), VARIANTS.standard);
  assert.equal(
    resolveVariant("constructor"),
    VARIANTS.standard,
    "prototype keys must not resolve to a variant"
  );
});

test("resolveDuration only accepts a duration the engine can run", () => {
  assert.equal(resolveDuration("30", VARIANTS.standard), "30");
  assert.equal(resolveDuration("1", VARIANTS.standard), "1");
  assert.equal(resolveDuration("100clicks", VARIANTS.standard), "100clicks");
  assert.equal(resolveDuration("7", VARIANTS.standard), "10", "an unknown duration falls back");
  assert.equal(resolveDuration(null, VARIANTS.jitter), "10");
  assert.equal(resolveDuration("999999", VARIANTS.kohi), "10");
});

test("every variant's default duration is one of its own buttons", () => {
  Object.keys(VARIANTS).forEach((name) => {
    const v = VARIANTS[name];
    assert.ok(
      v.durations.indexOf(v.defaultDuration) !== -1,
      `${name} defaults to ${v.defaultDuration}, which is not in its duration list`
    );
    assert.ok(
      ["left", "right", "space"].indexOf(v.input) !== -1,
      `${name} declares an input surface the engine does not implement`
    );
  });
});

test("only the standard test uses the unsuffixed storage keys", () => {
  const suffixes = Object.keys(VARIANTS).map((k) => VARIANTS[k].storageSuffix);
  assert.equal(suffixes.filter((s) => s === "").length, 1);
  assert.equal(new Set(suffixes).size, suffixes.length, "two variants share a storage namespace");
});
