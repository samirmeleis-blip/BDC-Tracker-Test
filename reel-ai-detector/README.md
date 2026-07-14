# Reel AI Detector

A Chrome extension that overlays an **AI-likelihood badge** on Instagram Reels
(desktop, instagram.com). As you scroll, it samples 3 frames from the reel
that's playing, sends them to the Claude vision API, and shows a badge like
**"Likely AI · 82%"** on the video. Hover the badge for the signals behind the
score.

## What it can and can't do

This is a **confidence estimate, not a verdict**. There is no reliable way to
prove a compressed social video is or isn't AI-generated: provenance metadata
(C2PA) is stripped on upload, watermarks like SynthID aren't publicly
checkable, and Instagram's compression destroys many generation artifacts. The
extension looks for visual tells (lip-sync smearing, temporal shimmer,
malformed hands/text, impossible lighting) and reports a calibrated
probability. Treat mid-range scores as "unknown".

## Install

1. Open `chrome://extensions`, enable **Developer mode** (top right).
2. Click **Load unpacked** and select this `reel-ai-detector/` folder.
3. Click the extension's icon (or its **Options**) and paste your Anthropic
   API key from <https://platform.claude.com/>. Pick a model — Opus 4.8 is the
   default; Haiku 4.5 is much cheaper if you scroll a lot.
4. Browse reels at <https://www.instagram.com/reels/>. A badge appears on each
   playing reel within a few seconds.

## Cost

One API call per unique reel (3 downscaled JPEG frames + a short prompt).
Results are cached per video, so replays and back-scrolls don't re-bill.
Rough order of magnitude: a fraction of a cent per reel on Haiku, a few cents
on Opus.

## How it works

- `content.js` finds the largest playing `<video>`, draws frames to a canvas
  (max 512px wide, JPEG), and injects the badge. If Instagram serves a video
  in a way that taints the canvas, the badge reports "capture blocked" instead
  of failing silently.
- `background.js` calls `POST https://api.anthropic.com/v1/messages` with the
  frames as base64 image blocks and a JSON schema via structured outputs
  (`output_config.format`), so the verdict is always valid JSON:
  `{likelihood, verdict, signals, summary}`.
- Your API key lives in `chrome.storage.sync` and is only ever sent to
  `api.anthropic.com`.

## Limitations / ideas

- Desktop instagram.com only — mobile apps can't be overlaid by extensions.
- Frames only; no audio analysis (synthetic-voice detection would need a
  different pipeline).
- Detection is an arms race: the best avatar models (e.g. HeyGen Avatar 5)
  will fool frame-level analysis some of the time.
- Possible upgrades: a dedicated detection API (Hive, Reality Defender) as a
  second scorer, audio-track analysis, per-account signal history.
