(function () {
  "use strict";

  /* === CPS-MATH-START ===
     Pure, DOM-free helpers. Kept isolated between these markers so they can
     be extracted and unit-tested in Node without needing a browser/DOM. */

  function computeCps(clicks, elapsedMs) {
    if (!elapsedMs || elapsedMs <= 0) return 0;
    return clicks / (elapsedMs / 1000);
  }

  function getRating(cps) {
    if (cps < 2) return "Getting Started";
    if (cps < 4) return "Casual Clicker";
    if (cps < 6) return "Skilled Clicker";
    if (cps < 8) return "Pro Clicker";
    if (cps < 10) return "Elite Clicker";
    return "Superhuman";
  }

  /* === CPS-MATH-END === */

  // Exposed for potential reuse / testing; harmless no-op in the browser.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { computeCps: computeCps, getRating: getRating };
  }

  /* ============================= theme toggle ============================= */

  (function initTheme() {
    const stored = localStorage.getItem("cbt-theme");
    if (stored) document.documentElement.setAttribute("data-theme", stored);
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const current =
          document.documentElement.getAttribute("data-theme") ||
          (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("cbt-theme", next);
      });
    }
  })();

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ============================= game state ============================= */

  const PB_KEY = "cbt-best-cps";
  const HISTORY_KEY = "cbt-history";
  const HISTORY_MAX = 8;
  const AVERAGE_CPS = 6.5; // rough "average person" reference point, used for comparison framing
  const GAUGE_MAX = 12; // visual cap for the slow->superhuman gauge

  // Flavor layer only — keys must match the exact strings returned by
  // getRating() above. Thresholds/labels themselves are NOT duplicated here.
  const RATING_META = {
    "Getting Started": { emoji: "🐢", stars: 1, tagline: "Everyone starts somewhere — warm up those fingers." },
    "Casual Clicker": { emoji: "🙂", stars: 2, tagline: "Solid and steady. Push a bit harder next time." },
    "Skilled Clicker": { emoji: "⚡", stars: 3, tagline: "Right around the average clicker — nice control." },
    "Pro Clicker": { emoji: "🔥", stars: 4, tagline: "Faster than most people. Quick reflexes." },
    "Elite Clicker": { emoji: "🚀", stars: 5, tagline: "Elite territory — jitter/butterfly-click speed." },
    "Superhuman": { emoji: "👑", stars: 5, tagline: "Off the charts. Are you even human?" }
  };

  const modeRow = document.getElementById("mode-row");
  const modeIndicator = document.getElementById("mode-indicator");
  const playView = document.getElementById("play-view");
  const resultsPanel = document.getElementById("results-panel");
  const clickTarget = document.getElementById("click-target");
  const startBtn = document.getElementById("start-btn");
  const targetHint = document.getElementById("target-hint");

  const statClicks = document.getElementById("stat-clicks");
  const statTime = document.getElementById("stat-time");
  const statTimeLabel = document.getElementById("stat-time-label");
  const statCps = document.getElementById("stat-cps");

  const resultEmoji = document.getElementById("result-emoji");
  const resultRating = document.getElementById("result-rating");
  const resultStars = document.getElementById("result-stars");
  const resultCps = document.getElementById("result-cps");
  const resultTagline = document.getElementById("result-tagline");
  const bestLine = document.getElementById("best-line");
  const resultClicks = document.getElementById("result-clicks");
  const resultTime = document.getElementById("result-time");
  const gaugeMarker = document.getElementById("gauge-marker");
  const gaugeAvgMarker = document.getElementById("gauge-avg-marker");
  const comparisonText = document.getElementById("comparison-text");
  const historyBlock = document.getElementById("history-block");
  const historyBars = document.getElementById("history-bars");
  const historyTrend = document.getElementById("history-trend");

  const shareBtn = document.getElementById("share-btn");
  const retryBtn = document.getElementById("retry-btn");
  const toast = document.getElementById("toast");

  let mode = "10"; // "5" | "10" | "30" | "60" | "100clicks"
  let state = "idle"; // idle | countdown | running | finished
  let clicks = 0;
  let startTime = 0;
  let elapsedMs = 0;
  let rafId = null;
  let countdownTimer = null;
  let countdownRunTimer = null;
  let finalCpsValue = 0;

  function isTimedMode() {
    return mode !== "100clicks";
  }

  function durationMs() {
    return parseInt(mode, 10) * 1000;
  }

  /* ---------- view transitions (idle/play <-> results) ---------- */
  /* Swap two panels with a short fade/scale so the flow between states
     feels deliberate instead of an instant jump. */

  function switchView(hideEl, showEl) {
    hideEl.classList.add("view-fade-out");
    window.setTimeout(() => {
      hideEl.hidden = true;
      hideEl.classList.remove("view-fade-out");
      showEl.hidden = false;
      showEl.classList.add("view-fade-in");
      void showEl.offsetWidth; // force reflow so the transition below runs
      requestAnimationFrame(() => {
        showEl.classList.remove("view-fade-in");
      });
    }, 200);
  }

  /* ---------- mode selection (segmented pill control) ---------- */

  function updateModeIndicator() {
    if (!modeIndicator) return;
    const activeBtn = modeRow.querySelector('.mode-btn[aria-pressed="true"]');
    if (!activeBtn) return;
    const rowRect = modeRow.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    modeIndicator.style.width = btnRect.width + "px";
    modeIndicator.style.transform =
      "translateX(" + (btnRect.left - rowRect.left + modeRow.scrollLeft) + "px)";
  }

  modeRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".mode-btn");
    if (!btn || state === "countdown" || state === "running") return;
    mode = btn.dataset.mode;
    Array.from(modeRow.querySelectorAll(".mode-btn")).forEach((b) => {
      b.setAttribute("aria-pressed", String(b === btn));
    });
    updateModeIndicator();
    btn.scrollIntoView({ block: "nearest", inline: "nearest" });
    resetToIdle(state === "finished");
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateModeIndicator, 100);
  });

  /* ---------- reset / idle ---------- */

  function resetToIdle(animated) {
    state = "idle";
    clicks = 0;
    elapsedMs = 0;
    clickTarget.className = "state-idle";
    clickTarget.textContent = "Press Start";
    clickTarget.disabled = true;
    targetHint.textContent = "";
    startBtn.disabled = false;
    startBtn.textContent = "Start";
    statClicks.textContent = "0";
    statCps.textContent = "0.0";
    if (isTimedMode()) {
      statTimeLabel.textContent = "Time left";
      statTime.textContent = parseInt(mode, 10).toFixed(1);
    } else {
      statTimeLabel.textContent = "Elapsed";
      statTime.textContent = "0.0";
    }

    if (animated && !resultsPanel.hidden) {
      switchView(resultsPanel, playView);
    } else {
      resultsPanel.hidden = true;
      playView.hidden = false;
    }
  }

  /* ---------- start / countdown ---------- */

  startBtn.addEventListener("click", () => {
    if (state === "countdown" || state === "running") return;
    beginCountdown();
  });

  function pulseTarget() {
    clickTarget.classList.remove("tick-pulse");
    void clickTarget.offsetWidth; // restart the CSS animation
    clickTarget.classList.add("tick-pulse");
  }

  function beginCountdown() {
    state = "countdown";
    startBtn.disabled = true;
    clickTarget.disabled = true;
    clickTarget.className = "state-countdown";
    let n = 3;
    clickTarget.textContent = String(n);
    targetHint.textContent = "Get ready...";
    pulseTarget();
    countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        clickTarget.textContent = String(n);
        pulseTarget();
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        clickTarget.textContent = "GO!";
        targetHint.textContent = "";
        pulseTarget();
        countdownRunTimer = setTimeout(startRun, 220);
      }
    }, 700);
  }

  function startRun() {
    state = "running";
    clicks = 0;
    startTime = performance.now();
    elapsedMs = 0;
    clickTarget.className = "state-running";
    clickTarget.disabled = false;
    clickTarget.textContent = "CLICK!";
    statClicks.textContent = "0";
    statCps.textContent = "0.0";
    tick();
  }

  function tick() {
    if (state !== "running") return;
    const now = performance.now();
    elapsedMs = now - startTime;

    if (isTimedMode()) {
      const remainingMs = Math.max(0, durationMs() - elapsedMs);
      statTime.textContent = (remainingMs / 1000).toFixed(1);
      statCps.textContent = computeCps(clicks, elapsedMs).toFixed(1);
      if (remainingMs <= 0) {
        elapsedMs = durationMs();
        finishRun();
        return;
      }
    } else {
      statTime.textContent = (elapsedMs / 1000).toFixed(1);
      statCps.textContent = computeCps(clicks, elapsedMs).toFixed(1);
    }

    rafId = requestAnimationFrame(tick);
  }

  /* ---------- click handling ----------
     Only `pointerdown` increments the counter. Modern browsers (including
     iOS/Android) unify mouse + touch under the Pointer Events API, so a
     single listener handles both input types without double-counting. The
     `click` listener below is a no-op guard that just prevents any stray
     synthetic click (fired after pointerup) from doing anything. */

  clickTarget.addEventListener("pointerdown", (e) => {
    if (state !== "running") return;
    e.preventDefault();
    clicks += 1;
    statClicks.textContent = String(clicks);

    clickTarget.classList.add("pressed");
    setTimeout(() => clickTarget.classList.remove("pressed"), 80);
    spawnRipple(e);

    const now = performance.now();
    elapsedMs = now - startTime;
    statCps.textContent = computeCps(clicks, elapsedMs).toFixed(1);

    if (!isTimedMode() && clicks >= 100) {
      finishRun();
    }
  });

  /* Per-click visual feedback: a lightweight ripple burst from the exact
     click/tap point. Purely cosmetic — never touches the click counter
     above, so it can't affect scoring even if it lags on slow devices. */
  function spawnRipple(e) {
    const rect = clickTarget.getBoundingClientRect();
    const hasCoords = typeof e.clientX === "number" && e.isPrimary !== false;
    const x = hasCoords ? e.clientX - rect.left : rect.width / 2;
    const y = hasCoords ? e.clientY - rect.top : rect.height / 2;

    const ripple = document.createElement("span");
    ripple.className = "click-ripple";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    clickTarget.appendChild(ripple);

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      ripple.remove();
    };
    ripple.addEventListener("animationend", remove);
    setTimeout(remove, 500); // safety net if animationend doesn't fire

    // Cap concurrent ripples so very fast clicking (10+ CPS) can't pile up DOM nodes.
    const ripples = clickTarget.querySelectorAll(".click-ripple");
    if (ripples.length > 6) ripples[0].remove();
  }

  clickTarget.addEventListener("click", (e) => {
    if (state === "running" || state === "countdown") e.preventDefault();
  });

  /* ---------- finish / results ---------- */

  function finishRun() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    state = "finished";
    clickTarget.disabled = true;
    clickTarget.className = "state-finished";
    clickTarget.textContent = "Done!";
    startBtn.disabled = false;
    startBtn.textContent = "Start";

    const finalElapsedMs = isTimedMode() ? durationMs() : elapsedMs;
    finalCpsValue = computeCps(clicks, finalElapsedMs);
    const rating = getRating(finalCpsValue);
    const meta = RATING_META[rating] || RATING_META["Getting Started"];

    const best = getBest();
    const isNewBest = finalCpsValue > best;
    if (isNewBest) setBest(finalCpsValue);

    resultRating.textContent = rating;
    resultEmoji.textContent = meta.emoji;
    resultTagline.textContent = meta.tagline;
    renderStars(meta.stars);
    resultClicks.textContent = String(clicks);
    resultTime.textContent = (finalElapsedMs / 1000).toFixed(1) + "s";
    animateCountUp(resultCps, finalCpsValue);

    const displayBest = Math.max(best, finalCpsValue);
    bestLine.textContent = isNewBest
      ? "New personal best!"
      : "Your best: " + displayBest.toFixed(1) + " CPS";
    bestLine.classList.toggle("is-new-best", isNewBest);

    renderGauge(finalCpsValue);
    comparisonText.textContent = getComparisonText(finalCpsValue);

    const history = pushHistory(finalCpsValue);
    renderHistory(history);

    switchView(playView, resultsPanel);
  }

  retryBtn.addEventListener("click", () => resetToIdle(true));

  /* ---------- animated hero stat count-up ---------- */

  function animateCountUp(el, target) {
    const suffix = '<span class="unit"> CPS</span>';
    const duration = 700;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const value = target * eased;
      el.innerHTML = value.toFixed(1) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.innerHTML = target.toFixed(1) + suffix;
    }
    requestAnimationFrame(step);
  }

  /* ---------- star rating (reuses getRating() thresholds, adds flavor) ---------- */

  function renderStars(count) {
    const filled = "★".repeat(count);
    const empty = "☆".repeat(5 - count);
    resultStars.textContent = filled + empty;
  }

  /* ---------- comparison / gauge (context framing for the raw CPS number) ---------- */

  function getComparisonText(cps) {
    const diff = Math.abs(cps - AVERAGE_CPS).toFixed(1);
    if (cps >= AVERAGE_CPS + 0.05) {
      return "You clicked " + diff + " CPS faster than the average person (~" + AVERAGE_CPS.toFixed(1) + " CPS).";
    }
    if (cps <= AVERAGE_CPS - 0.05) {
      return "The average clicker hits ~" + AVERAGE_CPS.toFixed(1) + " CPS — you were " + diff + " CPS behind. Keep practicing!";
    }
    return "Right on the average clicker's pace (~" + AVERAGE_CPS.toFixed(1) + " CPS).";
  }

  function gaugePercent(cps) {
    return Math.max(0, Math.min(100, (cps / GAUGE_MAX) * 100));
  }

  function renderGauge(cps) {
    gaugeMarker.style.left = gaugePercent(cps) + "%";
    gaugeAvgMarker.style.left = gaugePercent(AVERAGE_CPS) + "%";
  }

  /* ---------- session history (localStorage, same pattern as personal best) ---------- */

  function getHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return Array.isArray(raw) ? raw.filter((n) => Number.isFinite(n)) : [];
    } catch (err) {
      return [];
    }
  }

  function pushHistory(cps) {
    const history = getHistory();
    history.push(Number(cps.toFixed(1)));
    while (history.length > HISTORY_MAX) history.shift();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return history;
  }

  function renderHistory(history) {
    if (!history.length) {
      historyBlock.hidden = true;
      return;
    }
    historyBlock.hidden = false;
    const max = Math.max.apply(null, history.concat([1]));
    historyBars.innerHTML = "";
    history.forEach((val, i) => {
      const bar = document.createElement("div");
      bar.className = "history-bar" + (i === history.length - 1 ? " is-latest" : "");
      bar.style.height = Math.max(8, (val / max) * 100) + "%";
      bar.title = val.toFixed(1) + " CPS";
      historyBars.appendChild(bar);
    });

    if (history.length >= 2) {
      const diff = history[history.length - 1] - history[history.length - 2];
      if (Math.abs(diff) < 0.05) {
        historyTrend.textContent = "Same as your last attempt";
      } else if (diff > 0) {
        historyTrend.textContent = "▲ " + diff.toFixed(1) + " CPS faster than your last attempt";
      } else {
        historyTrend.textContent = "▼ " + Math.abs(diff).toFixed(1) + " CPS slower than your last attempt";
      }
    } else {
      historyTrend.textContent = "";
    }
  }

  /* ---------- personal best (localStorage) ---------- */

  function getBest() {
    const raw = localStorage.getItem(PB_KEY);
    const val = raw ? parseFloat(raw) : 0;
    return Number.isFinite(val) ? val : 0;
  }

  function setBest(cps) {
    localStorage.setItem(PB_KEY, String(cps));
  }

  /* ---------- share / copy result ---------- */

  shareBtn.addEventListener("click", () => {
    const text =
      "I hit " + finalCpsValue.toFixed(1) + " CPS on Click Speed Test! Try to beat me: https://cpsboost.com/";
    copyText(text);
    showToast("Copied!");
  });

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      /* no-op: clipboard unsupported */
    }
    ta.remove();
  }

  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  /* ---------- init ---------- */

  resetToIdle(false);
  requestAnimationFrame(updateModeIndicator);
})();
