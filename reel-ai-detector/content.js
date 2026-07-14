// Content script: watches for the reel currently playing on instagram.com,
// samples frames from it, asks the background worker for a verdict, and
// overlays a badge on the video.

(() => {
  const FRAME_COUNT = 3;
  const FRAME_INTERVAL_MS = 1200;
  const MAX_FRAME_WIDTH = 512;
  const POLL_MS = 1500;

  // videoKey -> "pending" | verdict object; keys survive DOM churn since
  // Instagram recycles <video> elements as you scroll.
  const analyzed = new Map();
  const badges = new WeakMap(); // video -> badge element

  function videoKey(video) {
    return video.currentSrc || video.src || null;
  }

  function activeVideo() {
    let best = null;
    let bestArea = 0;
    for (const v of document.querySelectorAll("video")) {
      if (v.paused || v.readyState < 2) continue;
      const r = v.getBoundingClientRect();
      const visW = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
      const visH = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (visW <= 0 || visH <= 0) continue;
      const area = visW * visH;
      if (area > bestArea) {
        bestArea = area;
        best = v;
      }
    }
    return best;
  }

  function ensureBadge(video) {
    let badge = badges.get(video);
    if (badge && badge.isConnected) return badge;
    badge = document.createElement("div");
    badge.className = "raid-badge raid-pending";
    badge.textContent = "AI? analyzing…";
    const host = video.parentElement || video;
    if (getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }
    host.appendChild(badge);
    badges.set(video, badge);
    return badge;
  }

  function renderVerdict(badge, out) {
    badge.classList.remove("raid-pending", "raid-error", "raid-low", "raid-mid", "raid-high");
    if (out.error) {
      badge.classList.add("raid-error");
      badge.textContent =
        out.error === "no_key" ? "AI? set API key" :
        out.error === "capture_blocked" ? "AI? capture blocked" :
        "AI? error";
      badge.title = out.detail || (out.error === "no_key"
        ? "Open the extension options and paste your Anthropic API key."
        : "");
      return;
    }
    const r = out.result;
    const cls = r.likelihood >= 65 ? "raid-high" : r.likelihood >= 35 ? "raid-mid" : "raid-low";
    badge.classList.add(cls);
    const label =
      r.verdict === "likely_ai" ? "Likely AI" :
      r.verdict === "possibly_ai" ? "Possibly AI" :
      r.verdict === "likely_real" ? "Likely real" : "Uncertain";
    badge.textContent = `${label} · ${r.likelihood}%`;
    badge.title = `${r.summary}\n\nSignals:\n• ${(r.signals || []).join("\n• ")}\n\nEstimate only — not proof.`;
  }

  function captureFrame(video) {
    const scale = Math.min(1, MAX_FRAME_WIDTH / (video.videoWidth || MAX_FRAME_WIDTH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8); // throws SecurityError if tainted
  }

  function nearbyCaption(video) {
    // Best-effort: grab visible text near the reel for context. Optional signal.
    const container = video.closest("article, section, div[role='presentation']");
    const text = container ? container.innerText || "" : "";
    return text.trim().slice(0, 300) || null;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function analyze(video) {
    const key = videoKey(video);
    if (!key || analyzed.has(key)) {
      const cached = analyzed.get(key);
      if (cached && cached !== "pending") renderVerdict(ensureBadge(video), cached);
      return;
    }
    analyzed.set(key, "pending");
    const badge = ensureBadge(video);

    const frames = [];
    try {
      for (let i = 0; i < FRAME_COUNT; i++) {
        if (!video.isConnected) break;
        frames.push(captureFrame(video));
        if (i < FRAME_COUNT - 1) await sleep(FRAME_INTERVAL_MS);
      }
    } catch (_) {
      const out = { error: "capture_blocked", detail: "The browser blocked reading pixels from this video (cross-origin canvas taint)." };
      analyzed.set(key, out);
      renderVerdict(badge, out);
      return;
    }
    if (!frames.length) {
      analyzed.delete(key);
      return;
    }

    let out;
    try {
      out = await chrome.runtime.sendMessage({
        type: "analyze",
        videoKey: key,
        frames,
        meta: { caption: nearbyCaption(video) }
      });
    } catch (e) {
      out = { error: "api_error", detail: String(e) };
    }
    if (!out) out = { error: "api_error", detail: "No response from background worker." };
    analyzed.set(key, out);
    renderVerdict(badge, out);
  }

  setInterval(() => {
    const video = activeVideo();
    if (video) analyze(video);
  }, POLL_MS);
})();
