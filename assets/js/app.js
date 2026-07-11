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

  const modeRow = document.getElementById("mode-row");
  const playView = document.getElementById("play-view");
  const resultsPanel = document.getElementById("results-panel");
  const clickTarget = document.getElementById("click-target");
  const startBtn = document.getElementById("start-btn");
  const targetHint = document.getElementById("target-hint");

  const statClicks = document.getElementById("stat-clicks");
  const statTime = document.getElementById("stat-time");
  const statTimeLabel = document.getElementById("stat-time-label");
  const statCps = document.getElementById("stat-cps");

  const resultRating = document.getElementById("result-rating");
  const resultCps = document.getElementById("result-cps");
  const bestLine = document.getElementById("best-line");
  const resultClicks = document.getElementById("result-clicks");
  const resultTime = document.getElementById("result-time");

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

  /* ---------- mode selection ---------- */

  modeRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".mode-btn");
    if (!btn || state === "countdown" || state === "running") return;
    mode = btn.dataset.mode;
    Array.from(modeRow.querySelectorAll(".mode-btn")).forEach((b) => {
      b.setAttribute("aria-pressed", String(b === btn));
    });
    resetToIdle();
  });

  /* ---------- reset / idle ---------- */

  function resetToIdle() {
    state = "idle";
    clicks = 0;
    elapsedMs = 0;
    clickTarget.className = "state-idle";
    clickTarget.textContent = "Press Start";
    clickTarget.disabled = true;
    targetHint.textContent = "";
    startBtn.disabled = false;
    startBtn.textContent = "Start";
    resultsPanel.hidden = true;
    playView.hidden = false;
    statClicks.textContent = "0";
    statCps.textContent = "0.0";
    if (isTimedMode()) {
      statTimeLabel.textContent = "Time left";
      statTime.textContent = parseInt(mode, 10).toFixed(1);
    } else {
      statTimeLabel.textContent = "Elapsed";
      statTime.textContent = "0.0";
    }
  }

  /* ---------- start / countdown ---------- */

  startBtn.addEventListener("click", () => {
    if (state === "countdown" || state === "running") return;
    beginCountdown();
  });

  function beginCountdown() {
    state = "countdown";
    startBtn.disabled = true;
    clickTarget.disabled = true;
    clickTarget.className = "state-countdown";
    let n = 3;
    clickTarget.textContent = String(n);
    targetHint.textContent = "Get ready...";
    countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        clickTarget.textContent = String(n);
      } else {
        clearInterval(countdownTimer);
        countdownTimer = null;
        clickTarget.textContent = "GO!";
        targetHint.textContent = "";
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

    const now = performance.now();
    elapsedMs = now - startTime;
    statCps.textContent = computeCps(clicks, elapsedMs).toFixed(1);

    if (!isTimedMode() && clicks >= 100) {
      finishRun();
    }
  });

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

    const best = getBest();
    const isNewBest = finalCpsValue > best;
    if (isNewBest) setBest(finalCpsValue);

    resultRating.textContent = rating;
    resultCps.innerHTML = finalCpsValue.toFixed(1) + '<span class="unit"> CPS</span>';
    resultClicks.textContent = String(clicks);
    resultTime.textContent = (finalElapsedMs / 1000).toFixed(1) + "s";

    const displayBest = Math.max(best, finalCpsValue);
    bestLine.textContent = isNewBest
      ? "New personal best!"
      : "Your best: " + displayBest.toFixed(1) + " CPS";
    bestLine.classList.toggle("is-new-best", isNewBest);

    playView.hidden = true;
    resultsPanel.hidden = false;
  }

  retryBtn.addEventListener("click", resetToIdle);

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
      "I hit " + finalCpsValue.toFixed(1) + " CPS on Click Speed Test! Try to beat me: https://cpsblast.com/";
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

  resetToIdle();
})();
