/* percentile.js — a cited, population-model percentile engine.
   DOM-free and dependency-free. Loaded before app.js as a plain <script>;
   also require()-able from Node for unit tests.

   Ported from reaction-time-test/assets/js/percentile.js (reflexzap). The
   engine is byte-for-byte the same. Only the SOURCES and the models below the
   "SITE-SPECIFIC POPULATION MODEL" heading belong to this site.

   ─────────────────────────────────────────────────────────────────────────
   WHAT THIS IS, AND WHAT IT IS NOT
   ─────────────────────────────────────────────────────────────────────────
   The percentiles this file produces come from a MODEL fitted to figures
   published by one large public click-test dataset — cited in the SOURCES
   block below. No peer-reviewed distribution of browser click speed exists.
   The closest laboratory analogue, the clinical finger-tapping test, uses a
   mechanical tapper over 10 seconds and a small clinical sample, so it does
   not feed this model.

   They are NOT this site's own visitor data. This site has no backend and
   stores nothing off your device; it cannot and does not aggregate results.
   Any copy rendered from this module must name that origin — the model's
   `populationPhrase` carries the wording — and must never imply "other
   visitors here". A test greps every shipped page for the phrasings that
   would break that. If a number cannot be traced to a source below, it does
   not belong here.
*/

(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PercentileEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ===================== generic math ===================== */

  /* Abramowitz & Stegun 7.1.26 rational approximation of the error function
     (|error| < 1.5e-7). Monotone across the range we evaluate it over, which
     is what keeps percentileForScore monotone — see test/percentile.test.js. */
  function erf(x) {
    var sign = x < 0 ? -1 : 1;
    var ax = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * ax);
    var y =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
        0.254829592) *
        t *
        Math.exp(-ax * ax);
    return sign * y;
  }

  function normalCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }

  /* Inverse standard normal CDF — Acklam's rational approximation
     (|error| < 1.15e-9). Used to turn a percentile back into a score. */
  function normalQuantile(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    var a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
    var b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
    var c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
             -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
    var d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
             3.754408661907416e0];
    var pLow = 0.02425, pHigh = 1 - pLow, q, r;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > pHigh) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /* A lognormal is the standard shape for reaction-time-like data: bounded
     below by zero, right-skewed, long slow tail. Optional `shift` moves the
     floor; mu/sigma describe log(score - shift).

     The model is pinned to TWO published numbers and has no free parameters.
     Anchor it on whichever central figure the source actually reports:

       median given (preferred — robust to a junk tail):
         M       = median - shift
         u       = exp(sigma^2), solved from  SD^2 = M^2 * u * (u - 1)
                   ->  u = (1 + sqrt(1 + 4*(SD/M)^2)) / 2
         mu      = ln(M)

       mean given:
         m       = mean - shift
         sigma^2 = ln(1 + SD^2 / m^2)
         mu      = ln(m) - sigma^2 / 2                                      */
  function lognormalParams(model) {
    var shift = model.shift || 0;
    var sd = model.sd;
    if (model.median != null) {
      var M = model.median - shift;
      var k = (sd / M) * (sd / M);
      var u = (1 + Math.sqrt(1 + 4 * k)) / 2;
      return { mu: Math.log(M), sigma: Math.sqrt(Math.log(u)), shift: shift };
    }
    var m = model.mean - shift;
    var sigmaSq = Math.log(1 + (sd * sd) / (m * m));
    return { mu: Math.log(m) - sigmaSq / 2, sigma: Math.sqrt(sigmaSq), shift: shift };
  }

  function paramsFor(model) {
    if (!model._params) model._params = lognormalParams(model);
    return model._params;
  }

  /* ===================== generic engine ===================== */

  /* Share (0..1) of the modelled population scoring at or below `score`. */
  function shareAtOrBelow(model, score) {
    var p = paramsFor(model);
    var x = score - p.shift;
    if (!(x > 0)) return 0;
    return normalCdf((Math.log(x) - p.mu) / p.sigma);
  }

  /* Raw score at a given share (0..1) of the population. */
  function scoreAtShare(model, share) {
    var p = paramsFor(model);
    if (share <= 0) return p.shift;
    if (share >= 1) return Infinity;
    return p.shift + Math.exp(p.mu + p.sigma * normalQuantile(share));
  }

  /* Probability density at `score` (unnormalised units are fine — only ever
     used to give the drawn curve its shape). */
  function density(model, score) {
    var p = paramsFor(model);
    var x = score - p.shift;
    if (!(x > 0)) return 0;
    var z = (Math.log(x) - p.mu) / p.sigma;
    return Math.exp(-0.5 * z * z) / (x * p.sigma * Math.sqrt(2 * Math.PI));
  }

  function modeOf(model) {
    var p = paramsFor(model);
    return p.shift + Math.exp(p.mu - p.sigma * p.sigma);
  }

  /* THE headline function: what percentage of the modelled population does
     this score beat? Always finite and within 0-100. Monotone — a better
     score can never come back with a lower percentile. */
  function percentileForScore(score, model) {
    if (!model || !Number.isFinite(score)) return NaN;
    var below = shareAtOrBelow(model, score);
    var beaten = model.lowerIsBetter ? 1 - below : below;
    return Math.min(100, Math.max(0, beaten * 100));
  }

  /* Inverse: the score sitting at "beats P% of the population". */
  function scoreForPercentile(percentile, model) {
    if (!model || !Number.isFinite(percentile)) return NaN;
    var beaten = Math.min(100, Math.max(0, percentile)) / 100;
    return scoreAtShare(model, model.lowerIsBetter ? 1 - beaten : beaten);
  }

  /* Display form. Clamped to 1-99: the tails of a smooth model fitted to
     published summary statistics do not support "beats 100% of people". */
  function formatPercentile(percentile) {
    if (!Number.isFinite(percentile)) return "";
    return String(Math.min(99, Math.max(1, Math.round(percentile))));
  }

  /* Comparison copy. The population wording is owned by the model so it can
     never drift into implying we aggregate visitor results. */
  function comparisonText(score, model) {
    if (!model || !Number.isFinite(score)) return "";
    var pct = formatPercentile(percentileForScore(score, model));
    return model.betterWord + " than " + pct + "% of " + model.populationPhrase + ".";
  }

  /* A quantile table: [{ percentile, score }, ...] for the reference page and
     for the results-screen ladder. `percentile` is again "beats this many".
     Scores are rounded to model.precision decimals — whole milliseconds here,
     but a clicks-per-second model would want 2. */
  function quantileTable(model, percentiles) {
    var factor = Math.pow(10, model.precision || 0);
    return (percentiles || DEFAULT_PERCENTILES).map(function (p) {
      return { percentile: p, score: Math.round(scoreForPercentile(p, model) * factor) / factor };
    });
  }

  var DEFAULT_PERCENTILES = [99, 95, 90, 75, 50, 25, 10, 5];

  /* ===================== generic curve geometry ===================== */

  function resolveGeom(model, geom) {
    var g = geom || {};
    var domain = model.domain || [model.mean - 3 * model.sd, model.mean + 4 * model.sd];
    return {
      width: g.width || 320,
      height: g.height || 130,
      padTop: g.padTop == null ? 12 : g.padTop,
      padBottom: g.padBottom == null ? 26 : g.padBottom,
      padLeft: g.padLeft == null ? 10 : g.padLeft,
      padRight: g.padRight == null ? 10 : g.padRight,
      min: g.min == null ? domain[0] : g.min,
      max: g.max == null ? domain[1] : g.max,
      samples: g.samples || 96,
    };
  }

  function scalesFor(model, geom) {
    var g = resolveGeom(model, geom);
    var plotW = g.width - g.padLeft - g.padRight;
    var plotH = g.height - g.padTop - g.padBottom;
    var span = g.max - g.min || 1;
    var peak = density(model, modeOf(model)) || 1;
    return {
      g: g,
      baseline: g.padTop + plotH,
      xFor: function (score) {
        var t = (score - g.min) / span;
        return g.padLeft + Math.min(1, Math.max(0, t)) * plotW;
      },
      yFor: function (score) {
        var d = density(model, score) / peak;
        return g.padTop + (1 - Math.min(1, Math.max(0, d))) * plotH;
      },
    };
  }

  /* SVG path `d` for the distribution curve.
     opts.close — close the path down to the baseline (a fillable area)
     opts.step  — draw a staircase instead of a smooth polyline
     opts.from / opts.to — draw only that score slice (used to shade the part
     of the population the visitor beat). */
  function distributionPath(model, geom) {
    if (!model) return "";
    var s = scalesFor(model, geom);
    var g = s.g;
    var from = geom && geom.from != null ? Math.max(g.min, geom.from) : g.min;
    var to = geom && geom.to != null ? Math.min(g.max, geom.to) : g.max;
    if (!(to > from)) return "";
    var stepped = !!(geom && geom.step);
    var step = (to - from) / g.samples;
    var parts = [];
    for (var i = 0; i <= g.samples; i++) {
      var score = from + i * step;
      var x = s.xFor(score).toFixed(2);
      var y = s.yFor(score).toFixed(2);
      // A staircase repeats each sample's height across its own bin width, so
      // the curve reads as hard-edged pixel steps rather than a smooth spline.
      if (stepped && i > 0) parts.push("L" + x + " " + parts[parts.length - 1].split(" ")[1]);
      parts.push((i === 0 ? "M" : "L") + x + " " + y);
    }
    var d = parts.join(" ");
    if (geom && geom.close) {
      d += " L" + s.xFor(to).toFixed(2) + " " + s.baseline.toFixed(2);
      d += " L" + s.xFor(from).toFixed(2) + " " + s.baseline.toFixed(2) + " Z";
    }
    return d;
  }

  /* Where the visitor's marker sits on that same curve. */
  function projectScore(model, score, geom) {
    var s = scalesFor(model, geom);
    var clamped = Math.min(s.g.max, Math.max(s.g.min, score));
    return {
      score: clamped,
      x: s.xFor(clamped),
      y: s.yFor(clamped),
      baseline: s.baseline,
      top: s.g.padTop,
      clamped: clamped !== score,
    };
  }

  /* The slice of the drawn domain this score beats — the part of the curve
     worth shading. Which side that is depends only on model.lowerIsBetter,
     so callers stay unit-agnostic. */
  function beatenRange(model, score, geom) {
    var s = scalesFor(model, geom);
    var at = Math.min(s.g.max, Math.max(s.g.min, score));
    return model.lowerIsBetter ? { from: at, to: s.g.max } : { from: s.g.min, to: at };
  }

  /* Evenly spaced axis ticks across the drawn domain. */
  function axisTicks(model, geom, count) {
    var s = scalesFor(model, geom);
    var n = count || 4;
    var out = [];
    for (var i = 0; i <= n; i++) {
      var score = s.g.min + ((s.g.max - s.g.min) * i) / n;
      out.push({ score: Math.round(score), x: s.xFor(score) });
    }
    return out;
  }

  /* ===================== SOURCES ===================== */
  /* Every figure in the models below traces to one of these. Nothing in this
     file comes from visitors to this site. */

  var SOURCES = [
    {
      id: "arealme",
      name: "A Real Me",
      citation: "A Real Me — Click Speed Test, statistics panel and FAQ (accessed 2026-08-26).",
      url: "https://www.arealme.com/click-speed-test/en/",
      kind: "web dataset",
      used:
        "Browser click-test aggregate the site describes as anonymous Google Analytics data " +
        "from 37.1 million testers, refreshed every two weeks, auto-clicker sessions excluded. " +
        "Average CPS by test length: 1 s 6.81, 3 s 6.80, 5 s 6.77, 10 s 6.66, 15 s 6.45, " +
        "30 s 6.23, 60 s 6.12, 100 s 6.07. Its scoring table puts the top 0.94% at 12.6 CPS " +
        "and above on tests of 10 s or longer. Aggregated by that site, not by this one.",
    },
  ];

  /* ===================== SITE-SPECIFIC POPULATION MODEL ===================== */

  /* HOW THESE MODELS WERE BUILT — the whole derivation, so every number is
     checkable.

     What we are modelling: one person's clicks per second over one timed run
     in a browser, on whatever mouse or trackpad they own. [arealme] measures
     the same statistic in the same medium at the same set of test lengths,
     so it supplies both the location and the spread. Every model is a
     lognormal pinned to TWO published numbers and has no free parameters.

     LOCATION — the site's stated average CPS for the matching test length.
     The site reports a mean, not a median, so each model is mean-anchored.

     SPREAD — one shape parameter shared by every length, solved from the
     10 s model so that its top 0.94% sits at 12.6 CPS, the site's own
     top-tier threshold for tests of 10 s or longer:

       exp(mu + 2.35 * sigma) = 12.6,  mu = ln(6.66) - sigma^2 / 2
       ->  sigma = 0.289,  SD = 6.66 * sqrt(exp(sigma^2) - 1) = 1.97

     The other lengths keep sigma = 0.289 and take their SD from their own
     mean, which keeps the shape identical and only moves the curve:

       1 s   mean 6.81  SD 2.01
       5 s   mean 6.77  SD 2.00
       10 s  mean 6.66  SD 1.97
       30 s  mean 6.23  SD 1.84
       60 s  mean 6.12  SD 1.81
       100 clicks: no published figure. A 100-click run at the average pace
       lasts about 15 s, so it uses the 15 s mean, 6.45, SD 1.90.

     LIMITATIONS, stated rather than hidden:

     - The source is a website's own aggregate, not a peer-reviewed study. It
       publishes no standard deviation, and its scoring-table percentages are
       not tied to a test length. Between the top tier and the mean the table
       runs about 0.5 to 0.9 CPS below this curve, so read a percentile here
       as accurate to several points, not exactly.
     - The source's stated 10 s mean appears twice on its page, as 6.66 in the
       FAQ and 6.95 in a summary panel. This model uses the FAQ figure, which
       is the one given per test length.
     - The source pools every clicking technique. A jitter or butterfly score
       here is compared against that same pooled population, which is the
       only one published.
     - The spacebar and right-click tests get no model. The source measures
       left clicks, and no published distribution exists for either input. */

  var CPS_SIGMA = 0.289;

  function cpsModel(id, seconds, mean, sd) {
    return {
      id: id,
      label: "Clicks per second, " + seconds + " second browser test",
      unit: "CPS",
      precision: 2,
      lowerIsBetter: false,
      betterWord: "Faster",
      populationPhrase: "clickers in published click-test data (A Real Me, 37 million testers)",
      source: "arealme",

      mean: mean,
      sd: sd, // mean * sqrt(exp(CPS_SIGMA^2) - 1), rounded to 0.01
      shift: 0,
      domain: [0, 16],
      seconds: seconds,
      quantiles: [],
    };
  }

  var CPS_1S = cpsModel("cps-1s", 1, 6.81, 2.01);
  var CPS_5S = cpsModel("cps-5s", 5, 6.77, 2.0);
  var CPS_10S = cpsModel("cps-10s", 10, 6.66, 1.97);
  var CPS_30S = cpsModel("cps-30s", 30, 6.23, 1.84);
  var CPS_60S = cpsModel("cps-60s", 60, 6.12, 1.81);
  var CPS_100_CLICKS = cpsModel("cps-100-clicks", 15, 6.45, 1.9);
  CPS_100_CLICKS.label = "Clicks per second, 100-click browser test";

  /* Which model a duration key in app.js maps to. */
  var MODEL_BY_DURATION = {
    "1": CPS_1S,
    "5": CPS_5S,
    "10": CPS_10S,
    "30": CPS_30S,
    "60": CPS_60S,
    "100clicks": CPS_100_CLICKS,
  };

  function modelForDuration(key) {
    return Object.prototype.hasOwnProperty.call(MODEL_BY_DURATION, key) ? MODEL_BY_DURATION[key] : null;
  }

  var MODELS = [CPS_1S, CPS_5S, CPS_10S, CPS_30S, CPS_60S, CPS_100_CLICKS];

  MODELS.forEach(function (model) {
    model.quantiles = [99, 95, 90, 75, 50, 25, 10, 5, 1].map(function (p) {
      return { percentile: p, score: Math.round(scoreForPercentile(p, model) * 100) / 100 };
    });
  });

  return {
    // engine
    percentileForScore: percentileForScore,
    scoreForPercentile: scoreForPercentile,
    formatPercentile: formatPercentile,
    comparisonText: comparisonText,
    quantileTable: quantileTable,
    shareAtOrBelow: shareAtOrBelow,
    density: density,
    distributionPath: distributionPath,
    projectScore: projectScore,
    beatenRange: beatenRange,
    axisTicks: axisTicks,
    DEFAULT_PERCENTILES: DEFAULT_PERCENTILES,
    // math (exported for tests)
    erf: erf,
    normalCdf: normalCdf,
    normalQuantile: normalQuantile,
    lognormalParams: lognormalParams,
    // site data
    SOURCES: SOURCES,
    MODELS: MODELS,
    CPS_SIGMA: CPS_SIGMA,
    MODEL_BY_DURATION: MODEL_BY_DURATION,
    modelForDuration: modelForDuration,
    CPS_1S: CPS_1S,
    CPS_5S: CPS_5S,
    CPS_10S: CPS_10S,
    CPS_30S: CPS_30S,
    CPS_60S: CPS_60S,
    CPS_100_CLICKS: CPS_100_CLICKS,
  };
});
