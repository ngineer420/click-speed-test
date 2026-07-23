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

  /* ============================= gamification ============================= */

  const PROFILE_KEY = "cbt-profile";
  const SOUND_KEY = "cbt-sound-muted";
  const COMBO_WINDOW_MS = 400;
  const HEAT_WINDOW_MS = 1000;
  const HEAT_TARGET_CPS = 12;

  const RANK_TITLES = [
    { level: 1, title: "Casual Clicker" },
    { level: 2, title: "Quick Fingers" },
    { level: 3, title: "Rapid Tapper" },
    { level: 4, title: "Click Machine" },
    { level: 5, title: "Turbo Clicker" },
    { level: 6, title: "Blur Fingers" },
    { level: 7, title: "Click Cyborg" },
    { level: 8, title: "Neural Overclock" },
    { level: 9, title: "Click Legend" },
    { level: 10, title: "Click God" },
  ];

  function xpForLevel(level) { return 50 * level * (level - 1); }
  function levelForXp(xp) {
    let level = 1;
    while (xp >= xpForLevel(level + 1)) level += 1;
    return Math.min(level, RANK_TITLES.length);
  }
  function titleForLevel(level) {
    const entry = RANK_TITLES[Math.min(level, RANK_TITLES.length) - 1];
    return entry ? entry.title : RANK_TITLES[RANK_TITLES.length - 1].title;
  }

  const ACHIEVEMENTS = [
    { id: "first_click", icon: "🎯", title: "First Click", desc: "Complete your first test.", check: (c) => c.totalSessions >= 1 },
    { id: "century", icon: "💯", title: "Century Club", desc: "Land 100+ clicks in one session.", check: (c) => c.clicks >= 100 },
    { id: "speed_demon", icon: "🚀", title: "Speed Demon", desc: "Hit 10+ CPS.", check: (c) => c.cps >= 10 },
    { id: "superhuman", icon: "👑", title: "Superhuman Clicks", desc: "Hit 13+ CPS.", check: (c) => c.cps >= 13 },
    { id: "marathon", icon: "⏱️", title: "Marathon Clicker", desc: "Complete the 60-second mode.", check: (c) => c.completedSixty },
    { id: "combo_20", icon: "⚡", title: "Combo x20", desc: "Reach a 20-click combo.", check: (c) => c.maxCombo >= 20 },
    { id: "pb_breaker", icon: "🏆", title: "Record Breaker", desc: "Beat your personal best 5 times.", check: (c) => c.pbBeatenCount >= 5 },
    { id: "streak_3", icon: "🔥", title: "3-Day Streak", desc: "Play 3 days in a row.", check: (c) => c.streak >= 3 },
    { id: "streak_7", icon: "🔥", title: "Week Warrior", desc: "Play 7 days in a row.", check: (c) => c.streak >= 7 },
    { id: "streak_30", icon: "🔥", title: "Monthly Grind", desc: "Play 30 days in a row.", check: (c) => c.streak >= 30 },
    { id: "sessions_10", icon: "🕹️", title: "Arcade Regular", desc: "Complete 10 test sessions.", check: (c) => c.totalSessions >= 10 },
    { id: "sessions_50", icon: "🕹️", title: "Arcade Veteran", desc: "Complete 50 test sessions.", check: (c) => c.totalSessions >= 50 },
    { id: "level_5", icon: "⭐", title: "Rising Star", desc: "Reach level 5.", check: (c) => c.level >= 5 },
    { id: "level_10", icon: "👑", title: "Click God", desc: "Reach the max level.", check: (c) => c.level >= 10 },
  ];

  function loadProfile() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROFILE_KEY));
      if (raw && typeof raw === "object") {
        return Object.assign(
          { totalXP: 0, totalSessions: 0, pbBeatenCount: 0, streak: 0, lastPlayedDate: null, achievements: [] },
          raw
        );
      }
    } catch (e) { /* ignore */ }
    return { totalXP: 0, totalSessions: 0, pbBeatenCount: 0, streak: 0, lastPlayedDate: null, achievements: [] };
  }

  function saveProfile(profile) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
  }

  function dateKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

  function updateStreak(profile, now) {
    const today = dateKey(now);
    if (profile.lastPlayedDate === today) return profile.streak;
    const yesterday = dateKey(new Date(now.getTime() - 86400000));
    profile.streak = profile.lastPlayedDate === yesterday ? profile.streak + 1 : 1;
    profile.lastPlayedDate = today;
    return profile.streak;
  }

  function xpForSessionCps(rating, isNewBest, isFirstBest, completedSixty, maxCombo) {
    let xp = 10;
    if (rating === "Superhuman") xp += 45;
    else if (rating === "Elite Clicker") xp += 32;
    else if (rating === "Pro Clicker") xp += 22;
    else if (rating === "Skilled Clicker") xp += 14;
    else if (rating === "Casual Clicker") xp += 8;
    else xp += 4;
    if (isNewBest && !isFirstBest) xp += 30;
    if (completedSixty) xp += 12;
    if (maxCombo >= 20) xp += 10;
    return xp;
  }

  function recordSession({ cps, clicks, isNewBest, isFirstBest, completedSixty, maxCombo, now }) {
    const profile = loadProfile();
    const prevLevel = levelForXp(profile.totalXP);

    profile.totalSessions += 1;
    if (isNewBest && !isFirstBest) profile.pbBeatenCount += 1;
    const streak = updateStreak(profile, now);
    const gained = xpForSessionCps(getRating(cps), isNewBest, isFirstBest, completedSixty, maxCombo);
    profile.totalXP += gained;
    const newLevel = levelForXp(profile.totalXP);

    const ctx = {
      cps,
      clicks,
      totalSessions: profile.totalSessions,
      pbBeatenCount: profile.pbBeatenCount,
      streak,
      completedSixty,
      maxCombo,
      level: newLevel,
    };
    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach((a) => {
      if (profile.achievements.indexOf(a.id) === -1 && a.check(ctx)) {
        profile.achievements.push(a.id);
        newlyUnlocked.push(a);
      }
    });

    saveProfile(profile);
    return { profile, xpGained: gained, leveledUp: newLevel > prevLevel, newLevel, newlyUnlocked };
  }

  /* ---------- gamification rendering ---------- */

  const chipLevel = document.getElementById("chip-level");
  const chipStreak = document.getElementById("chip-streak");
  const xpRankLabel = document.getElementById("xp-rank-label");
  const xpProgressLabel = document.getElementById("xp-progress-label");
  const xpBarFill = document.getElementById("xp-bar-fill");
  const achievementsGrid = document.getElementById("achievements-grid");
  const unlockStack = document.getElementById("unlock-stack");

  function renderStatusChips(profile) {
    const level = levelForXp(profile.totalXP);
    if (chipLevel) chipLevel.textContent = "LV " + level;
    if (chipStreak) {
      chipStreak.textContent = "🔥" + profile.streak;
      chipStreak.classList.toggle("is-zero", profile.streak === 0);
    }
    if (xpRankLabel) xpRankLabel.textContent = titleForLevel(level);
    if (xpProgressLabel && xpBarFill) {
      const base = xpForLevel(level);
      const next = xpForLevel(level + 1);
      const span = next - base || 1;
      const into = Math.max(0, profile.totalXP - base);
      const pct = level >= RANK_TITLES.length ? 100 : Math.min(100, (into / span) * 100);
      xpProgressLabel.textContent = level >= RANK_TITLES.length ? "MAX LEVEL" : into + " / " + span + " XP";
      xpBarFill.style.width = pct + "%";
    }
  }

  function renderAchievements(profile) {
    if (!achievementsGrid) return;
    achievementsGrid.innerHTML = ACHIEVEMENTS.map((a) => {
      const unlocked = profile.achievements.indexOf(a.id) !== -1;
      return (
        `<div class="badge${unlocked ? " unlocked" : ""}" title="${a.title}: ${a.desc}">` +
        `<span class="badge-icon" aria-hidden="true">${a.icon}</span>` +
        `<span class="badge-title">${a.title}</span>` +
        `</div>`
      );
    }).join("");
  }

  function queueUnlockToasts(items, kickerFor) {
    if (!unlockStack || !items.length) return;
    items.forEach((item, i) => {
      setTimeout(() => {
        const el = document.createElement("div");
        el.className = "unlock-toast";
        el.innerHTML =
          `<span class="unlock-icon" aria-hidden="true">${item.icon}</span>` +
          `<span class="unlock-text"><span class="unlock-kicker">${kickerFor(item)}</span>` +
          `<span class="unlock-title">${item.title}</span></span>`;
        unlockStack.appendChild(el);
        playAchievementChime();
        setTimeout(() => el.remove(), 3600);
      }, i * 550);
    });
  }

  /* ---------- arcade sound synth (WebAudio, no audio files) ---------- */

  let audioCtx = null;
  let soundMuted = false;
  try { soundMuted = localStorage.getItem(SOUND_KEY) === "1"; } catch (e) { /* ignore */ }

  function getAudioCtx() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function playTone(freq, startOffset, duration, type, peakGain) {
    if (soundMuted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peakGain || 0.07, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function playClickTick(pitchBoost) {
    playTone(720 + Math.min(pitchBoost || 0, 400), 0, 0.045, "square", 0.035);
  }
  function playMilestoneBoom() { playTone(160, 0, 0.2, "sawtooth", 0.06); }
  function playAchievementChime() {
    [660, 880, 1320].forEach((f, i) => playTone(f, i * 0.09, 0.16, "triangle", 0.07));
  }
  function playLevelUpFanfare() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => playTone(f, i * 0.08, 0.22, "square", 0.06));
  }
  function playNewBestSparkle() {
    [988, 1318, 1568, 2093].forEach((f, i) => playTone(f, i * 0.06, 0.14, "sine", 0.07));
  }

  const soundToggleBtn = document.getElementById("sound-toggle");
  function renderSoundToggle() {
    if (!soundToggleBtn) return;
    soundToggleBtn.textContent = soundMuted ? "🔇" : "🔊";
  }
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener("click", () => {
      soundMuted = !soundMuted;
      try { localStorage.setItem(SOUND_KEY, soundMuted ? "1" : "0"); } catch (e) { /* ignore */ }
      renderSoundToggle();
      if (!soundMuted) playClickTick(0);
    });
    renderSoundToggle();
  }

  const statusChipBtn = document.getElementById("status-chip");
  if (statusChipBtn) {
    statusChipBtn.addEventListener("click", () => {
      const panel = document.getElementById("achievements-panel");
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

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
  let comboCount = 0;
  let maxCombo = 0;
  let lastClickAt = 0;
  let recentClickTimes = [];

  /* ---------- arcade cabinet HUD (score strip, super gauge, announce, grade) ----------
     Pure presentation on top of the real game — none of this feeds the CPS
     calculation. The arcade "score" is total clicks (points); HI-SCORE is the
     most clicks landed in any run. SUPER mirrors the existing click "heat".  */
  const BEST_CLICKS_KEY = "cbt-best-clicks";
  const score1up = document.getElementById("score-1up");
  const scoreHi = document.getElementById("score-hi");
  const scoreCredit = document.getElementById("score-credit");
  const superFill = document.getElementById("super-fill");
  const superMeter = document.querySelector(".super-meter");
  const announceEl = document.getElementById("announce");
  const resultGrade = document.getElementById("result-grade");
  const hpRival = document.getElementById("hp-rival");
  const comboMeter = document.getElementById("combo-meter");
  const comboNum = document.getElementById("combo-num");

  // The RIVAL fighter's health drains as you land clicks — empty it before time
  // runs out for a K.O. Pure flavour on top of the real CPS test; koTarget is
  // scaled per mode so it takes ~6 CPS to K.O. regardless of duration.
  let rivalHp = 100;
  let rivalDamage = 2;
  function renderRival() { if (hpRival) hpRival.style.width = Math.max(0, rivalHp) + "%"; }
  function setCombo(n) {
    if (!comboMeter) return;
    if (n >= 2) {
      if (comboNum) comboNum.textContent = n;
      comboMeter.classList.add("show");
      comboMeter.classList.remove("pop");
      void comboMeter.offsetWidth;
      comboMeter.classList.add("pop");
    } else {
      comboMeter.classList.remove("show", "pop");
    }
  }
  function spawnHitSpark(e) {
    const rect = clickTarget.getBoundingClientRect();
    const hasCoords = typeof e.clientX === "number" && e.isPrimary !== false;
    const x = hasCoords ? e.clientX - rect.left : rect.width / 2;
    const y = hasCoords ? e.clientY - rect.top : rect.height / 2;
    const s = document.createElement("span");
    s.className = "hit-spark";
    s.style.left = x + "px";
    s.style.top = y + "px";
    clickTarget.appendChild(s);
    let removed = false;
    const rm = () => { if (removed) return; removed = true; s.remove(); };
    s.addEventListener("animationend", rm);
    setTimeout(rm, 400);
    const sparks = clickTarget.querySelectorAll(".hit-spark");
    if (sparks.length > 6) sparks[0].remove();
  }

  function getBestClicks() {
    const raw = parseInt(localStorage.getItem(BEST_CLICKS_KEY), 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }
  function setBestClicks(n) {
    try { localStorage.setItem(BEST_CLICKS_KEY, String(n)); } catch (e) { /* ignore */ }
  }
  let bestClicksCache = getBestClicks();

  function pad5(n) { return String(Math.max(0, n | 0)).padStart(5, "0"); }
  function updateScoreStrip() {
    if (score1up) score1up.textContent = pad5(clicks);
    if (scoreHi) scoreHi.textContent = pad5(Math.max(bestClicksCache, clicks));
  }
  function setSuper(heat) {
    if (superFill) superFill.style.width = Math.round(heat * 100) + "%";
    if (superMeter) superMeter.classList.toggle("is-max", heat >= 0.999);
  }
  // FREE PLAY is an attract-mode credit indicator — like a real cabinet it
  // shows while idle/attract and disappears once the round is actually running.
  function setCreditVisible(show) {
    if (scoreCredit) scoreCredit.style.visibility = show ? "" : "hidden";
  }

  let announceTimer = null;
  function showAnnounce(text) {
    if (!announceEl) return;
    announceEl.innerHTML = '<span class="announce-text"></span>';
    announceEl.firstChild.textContent = text;
    announceEl.classList.remove("show");
    void announceEl.offsetWidth; // restart the slam animation
    announceEl.classList.add("show");
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => announceEl.classList.remove("show"), 900);
  }

  function gradeForCps(cps) {
    if (cps >= 12) return "S";
    if (cps >= 10) return "A";
    if (cps >= 8) return "B";
    if (cps >= 6) return "C";
    if (cps >= 4) return "D";
    return "E";
  }
  function showGrade(cps) {
    if (!resultGrade) return;
    const g = gradeForCps(cps);
    resultGrade.textContent = g;
    resultGrade.setAttribute("data-grade", g);
    resultGrade.classList.remove("show");
    void resultGrade.offsetWidth;
    resultGrade.classList.add("show");
  }
  function playFightStinger() {
    playTone(330, 0, 0.12, "square", 0.06);
    playTone(494, 0.09, 0.18, "square", 0.06);
  }

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
    clickTarget.style.setProperty("--heat", "0");
    targetHint.textContent = "";
    startBtn.disabled = false;
    startBtn.textContent = "Start";
    statClicks.textContent = "0";
    statCps.textContent = "0.0";
    updateScoreStrip();
    setSuper(0);
    setCreditVisible(true);
    rivalHp = 100;
    renderRival();
    setCombo(0);
    if (superMeter) superMeter.classList.remove("is-max");
    if (resultGrade) resultGrade.classList.remove("show");
    if (announceEl) announceEl.classList.remove("show");
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
    setCreditVisible(false);
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
        clickTarget.textContent = "";
        targetHint.textContent = "";
        pulseTarget();
        showAnnounce("Fight!");
        playFightStinger();
        countdownRunTimer = setTimeout(startRun, 260);
      }
    }, 700);
  }

  function startRun() {
    state = "running";
    clicks = 0;
    startTime = performance.now();
    elapsedMs = 0;
    comboCount = 0;
    maxCombo = 0;
    lastClickAt = 0;
    recentClickTimes = [];
    clickTarget.style.setProperty("--heat", "0");
    clickTarget.className = "state-running";
    clickTarget.disabled = false;
    clickTarget.textContent = "CLICK!";
    statClicks.textContent = "0";
    statCps.textContent = "0.0";
    updateScoreStrip();
    setSuper(0);
    rivalHp = 100;
    // ~6 CPS should K.O. the rival regardless of mode length.
    var koTarget = isTimedMode() ? Math.max(10, 6 * (durationMs() / 1000)) : 60;
    rivalDamage = 100 / koTarget;
    renderRival();
    setCombo(0);
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

    // Combo: consecutive clicks within COMBO_WINDOW_MS of each other build a
    // streak; a bigger gap (hesitation) resets it. Purely a feel/reward layer,
    // never touches the real CPS calculation above.
    comboCount = now - lastClickAt <= COMBO_WINDOW_MS ? comboCount + 1 : 1;
    lastClickAt = now;
    maxCombo = Math.max(maxCombo, comboCount);
    if (comboCount > 0 && comboCount % 5 === 0) spawnComboFloat(e, comboCount);

    // Heat: rolling CPS over the trailing HEAT_WINDOW_MS drives a glow that
    // intensifies the faster the recent clicking has been.
    recentClickTimes.push(now);
    recentClickTimes = recentClickTimes.filter((t) => now - t <= HEAT_WINDOW_MS);
    const rollingCps = recentClickTimes.length / (HEAT_WINDOW_MS / 1000);
    const heat = Math.max(0, Math.min(1, rollingCps / HEAT_TARGET_CPS));
    clickTarget.style.setProperty("--heat", heat.toFixed(2));
    setSuper(heat);
    updateScoreStrip();
    rivalHp = Math.max(0, rivalHp - rivalDamage);
    renderRival();
    setCombo(comboCount);
    spawnHitSpark(e);

    playClickTick(comboCount * 8);

    if (clicks % 25 === 0) {
      clickTarget.classList.remove("milestone-shake");
      void clickTarget.offsetWidth;
      clickTarget.classList.add("milestone-shake");
      playMilestoneBoom();
    }

    if (!isTimedMode() && clicks >= 100) {
      finishRun();
    }
  });

  /* Floating "COMBO x N" text spawned at the click point — same throwaway-DOM-node
     pattern as spawnRipple, capped the same way so rapid clicking can't pile up nodes. */
  function spawnComboFloat(e, combo) {
    const rect = clickTarget.getBoundingClientRect();
    const hasCoords = typeof e.clientX === "number" && e.isPrimary !== false;
    const x = hasCoords ? e.clientX - rect.left : rect.width / 2;
    const y = hasCoords ? e.clientY - rect.top : rect.height / 2;

    const el = document.createElement("span");
    el.className = "combo-float";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.textContent = "COMBO x" + combo;
    clickTarget.appendChild(el);

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      el.remove();
    };
    el.addEventListener("animationend", remove);
    setTimeout(remove, 700);

    const floats = clickTarget.querySelectorAll(".combo-float");
    if (floats.length > 4) floats[0].remove();
  }

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
    clickTarget.style.setProperty("--heat", "0");
    setSuper(0);
    if (superMeter) superMeter.classList.remove("is-max");
    startBtn.disabled = false;
    startBtn.textContent = "Start";
    setCreditVisible(true);
    setCombo(0);
    showAnnounce(rivalHp <= 0 ? "K.O.!" : (isTimedMode() ? "Time Up!" : "Finish!"));

    const finalElapsedMs = isTimedMode() ? durationMs() : elapsedMs;
    finalCpsValue = computeCps(clicks, finalElapsedMs);
    setTimeout(function () { showGrade(finalCpsValue); }, 260);
    const rating = getRating(finalCpsValue);
    const meta = RATING_META[rating] || RATING_META["Getting Started"];

    const best = getBest();
    const isNewBest = finalCpsValue > best;
    const isFirstBest = best === 0;
    if (isNewBest) setBest(finalCpsValue);
    if (clicks > bestClicksCache) { setBestClicks(clicks); bestClicksCache = clicks; }
    updateScoreStrip();

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

    const gameResult = recordSession({
      cps: finalCpsValue,
      clicks,
      isNewBest,
      isFirstBest,
      completedSixty: mode === "60",
      maxCombo,
      now: new Date(),
    });
    renderStatusChips(gameResult.profile);
    renderAchievements(gameResult.profile);

    if (isNewBest && !isFirstBest) playNewBestSparkle();
    if (gameResult.leveledUp) {
      setTimeout(playLevelUpFanfare, gameResult.newlyUnlocked.length ? 700 : 0);
    }
    queueUnlockToasts(gameResult.newlyUnlocked, () =>
      gameResult.leveledUp ? "Achievement Unlocked · LV " + gameResult.newLevel : "Achievement Unlocked"
    );

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
    const profile = loadProfile();
    const rank = titleForLevel(levelForXp(profile.totalXP));
    const text =
      "I hit " + finalCpsValue.toFixed(1) + " CPS on Click Speed Test (" + rank + ", LV " +
      levelForXp(profile.totalXP) + ")! Try to beat me: https://cpsboost.com/";
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
  renderStatusChips(loadProfile());
  renderAchievements(loadProfile());
})();
