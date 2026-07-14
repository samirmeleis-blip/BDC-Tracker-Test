// Service worker: receives sampled frames from the content script, scores them
// with the Claude API, and returns a structured verdict.

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-opus-4-8";

// One verdict per video key per service-worker lifetime, so scrolling back to a
// reel doesn't re-bill. (The content script also caches per-page.)
const verdictCache = new Map();

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    likelihood: {
      type: "integer",
      description:
        "Estimated probability, 0-100, that this video is AI-generated or AI-manipulated (avatar/lip-sync, diffusion video, face swap, fully synthetic scene). 0 = certainly real footage, 100 = certainly synthetic."
    },
    verdict: {
      type: "string",
      enum: ["likely_ai", "possibly_ai", "likely_real", "uncertain"]
    },
    signals: {
      type: "array",
      items: { type: "string" },
      description: "Short, concrete observations that drove the score, most important first."
    },
    summary: {
      type: "string",
      description: "One sentence a layperson can read."
    }
  },
  required: ["likelihood", "verdict", "signals", "summary"],
  additionalProperties: false
};

const SYSTEM_PROMPT = `You are a synthetic-media analyst. You are shown a few frames sampled from a single short-form social video (an Instagram reel). Estimate the likelihood that the video is AI-generated or AI-manipulated.

Look for: avatar/lip-sync artifacts (teeth blur, mouth-interior smearing, jaw seams), diffusion-video tells (temporal shimmer, melting fine detail, malformed hands/text/logos, physically inconsistent lighting or reflections), face-swap boundaries, uncanny skin texture, and impossible scene content. Also weigh signals of real capture: sensor noise, motion blur consistent with handheld capture, natural imperfections, legible incidental text.

Be calibrated, not decisive. Heavy platform compression destroys many artifacts, and a few frames cannot prove authenticity — when evidence is thin, say "uncertain" with a mid-range likelihood rather than guessing confidently. Never claim certainty in either direction.`;

async function analyzeFrames(frames, meta) {
  const { apiKey, model } = await chrome.storage.sync.get({
    apiKey: "",
    model: DEFAULT_MODEL
  });
  if (!apiKey) return { error: "no_key" };

  const content = frames.map((dataUrl) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: dataUrl.replace(/^data:image\/jpeg;base64,/, "")
    }
  }));
  content.push({
    type: "text",
    text: `These ${frames.length} frames were sampled a few seconds apart from one Instagram reel${
      meta?.caption ? ` (caption excerpt: ${JSON.stringify(meta.caption.slice(0, 300))})` : ""
    }. Assess AI-generation likelihood.`
  });

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
      messages: [{ role: "user", content }]
    })
  });

  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const err = await resp.json();
      detail = err?.error?.message || detail;
    } catch (_) {}
    return { error: "api_error", detail };
  }

  const data = await resp.json();
  if (data.stop_reason === "refusal") {
    return { error: "api_error", detail: "Request was declined by the model." };
  }
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) return { error: "api_error", detail: "Empty response." };
  try {
    return { result: JSON.parse(textBlock.text) };
  } catch (_) {
    return { error: "api_error", detail: "Unparseable response." };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "analyze") return;
  const key = msg.videoKey;
  if (key && verdictCache.has(key)) {
    sendResponse(verdictCache.get(key));
    return;
  }
  analyzeFrames(msg.frames, msg.meta)
    .then((out) => {
      if (key && out.result) verdictCache.set(key, out);
      sendResponse(out);
    })
    .catch((e) => sendResponse({ error: "api_error", detail: String(e) }));
  return true; // async response
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
