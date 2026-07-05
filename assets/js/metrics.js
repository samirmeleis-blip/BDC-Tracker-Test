/*
 * PANTOR INTELLIGENCE — ANALYTICS & PREDICTION ENGINE
 * ---------------------------------------------------
 * Everything in this module is COMPUTED. Three strictly separated grades:
 *
 *   FACT     — transcribed from filings (lives in data.js, passed through untouched)
 *   DERIVED  — deterministic arithmetic on facts (e.g. tendered × (1 − repurchase))
 *   ESTIMATE — model output about the future. Never presented without a
 *              "model estimate" label in the UI.
 *
 * The model is intentionally simple and fully disclosed (see methodology.html):
 * observable rebalancing-queue logic, not a black box.
 */

import { BDCS } from "./data.js";

export const GRADE = { FACT: "fact", DERIVED: "derived", ESTIMATE: "estimate" };

export const STATUS = {
  OVERSUBSCRIBED: { id: "oversubscribed", label: "Oversubscribed", color: "var(--status-critical)" },
  CAP_BREACH:     { id: "cap-breach", label: "Cap breach anomaly", color: "var(--status-serious)" },
  EXECUTED:       { id: "executed", label: "Fully executed", color: "var(--status-good)" },
  ZERO:           { id: "zero", label: "Zero tender", color: "var(--ink-muted)" },
  NO_FILING:      { id: "no-filing", label: "No completed cycle", color: "var(--ink-muted)" },
};

export const TIER = {
  PRIME:     { id: "prime", label: "Prime opportunity", rank: 0 },
  STRONG:    { id: "strong", label: "Strong opportunity", rank: 1 },
  MODERATE:  { id: "moderate", label: "Moderate opportunity", rank: 2 },
  WATCHLIST: { id: "watchlist", label: "Watchlist", rank: 3 },
  LOW:       { id: "low", label: "Low opportunity", rank: 4 },
  NO_DATA:   { id: "no-data", label: "Insufficient data", rank: 5 },
};

const QUARTER_DAYS = 91;            // assumed tender cadence (quarterly programs)
const WINDOW_SLACK_DAYS = 14;       // +/- band on the projected window
const CARRYOVER_RETENDER = 0.85;    // share of trapped demand assumed to re-tender
const ORGANIC_RECURRENCE = 0.60;    // share of executed demand assumed to recur
const BAND = 0.20;                  // +/- band on projected demand

export function analyze(raw) {
  const b = { ...raw };
  const hasCycle = raw.dateOfTender !== null;

  // ---------- DERIVED (deterministic arithmetic on filed facts) ----------
  if (hasCycle) {
    const rep = raw.repurchasePct / 100;
    const pct = raw.pctOutstanding / 100;
    b.oversubRatio = raw.floodgate > 0 ? raw.pctOutstanding / raw.floodgate : null; // demand ÷ cap
    b.unmetShares = raw.sharesTendered * (1 - rep);                                  // shares tendered but NOT repurchased
    b.trappedPctOfTendered = (1 - rep) * 100;
    b.impliedSharesOutstanding = pct > 0 ? raw.sharesTendered / pct : null;
    b.executedShares = raw.sharesTendered * rep;

    const over = raw.pctOutstanding > raw.floodgate;
    if (over && raw.repurchasePct < 100) b.status = STATUS.OVERSUBSCRIBED;
    else if (over && raw.repurchasePct >= 100) b.status = STATUS.CAP_BREACH; // demand exceeded cap yet 100% honored
    else if (raw.sharesTendered === 0) b.status = STATUS.ZERO;
    else b.status = STATUS.EXECUTED;

    b.anomaly = b.status === STATUS.CAP_BREACH
      ? "Demand exceeded the stated floodgate, yet 100% of tendered shares were repurchased. The fund likely raised or waived its cap for this cycle; treat the floodgate as soft."
      : null;
  } else {
    b.oversubRatio = null; b.unmetShares = null; b.trappedPctOfTendered = null;
    b.impliedSharesOutstanding = null; b.executedShares = null;
    b.status = STATUS.NO_FILING; b.anomaly = null;
  }

  // ---------- ESTIMATES (model output — always label as such) ----------
  b.prediction = hasCycle ? predict(raw, b) : {
    nextWindow: null, projectedDemandPct: null, projectedDemandLow: null, projectedDemandHigh: null,
    projectedRepurchasePct: null, oversubProbability: null, confidence: "none",
    basis: "No completed tender cycle on file. The model does not extrapolate from zero observations.",
  };

  b.score = opportunityScore(b);
  b.tier = tierFor(b);
  b.advice = adviceFor(b);
  return b;
}

function predict(raw, d) {
  const last = new Date(raw.dateOfTender + "T00:00:00");
  const mid = new Date(last); mid.setDate(mid.getDate() + QUARTER_DAYS);
  const lo = new Date(mid); lo.setDate(lo.getDate() - WINDOW_SLACK_DAYS);
  const hi = new Date(mid); hi.setDate(hi.getDate() + WINDOW_SLACK_DAYS);

  // Queue model: trapped demand re-tenders, executed (organic) demand partially recurs.
  const rep = raw.repurchasePct / 100;
  const carryover = raw.pctOutstanding * (1 - rep);            // % of outstanding still stuck in the queue
  const organic = Math.min(raw.pctOutstanding * rep, raw.floodgate); // demand that cleared last cycle
  const proj = CARRYOVER_RETENDER * carryover + ORGANIC_RECURRENCE * organic;
  const projLow = proj * (1 - BAND), projHigh = proj * (1 + BAND);
  const projRep = proj > 0 ? Math.min(100, (raw.floodgate / proj) * 100) : 100;

  // Probability next cycle is oversubscribed: logistic on projected demand vs cap.
  const x = raw.floodgate > 0 ? proj / raw.floodgate : 0;
  const pOver = proj === 0 ? 0.02 : 1 / (1 + Math.exp(-5 * (x - 1)));

  const confidence = d.status.id === "cap-breach" ? "low"
    : raw.sharesTendered === 0 ? "low" : "moderate";

  return {
    nextWindow: { low: lo, mid, high: hi },
    projectedDemandPct: round2(proj),
    projectedDemandLow: round2(projLow),
    projectedDemandHigh: round2(projHigh),
    projectedRepurchasePct: round2(projRep),
    oversubProbability: Math.round(pOver * 100),
    confidence,
    basis: `Assumes a ~${QUARTER_DAYS}-day tender cadence; ${Math.round(CARRYOVER_RETENDER * 100)}% of trapped demand re-tenders and ${Math.round(ORGANIC_RECURRENCE * 100)}% of executed demand recurs. Single-cycle observation — treat as directional, not precise.`,
  };
}

/*
 * Opportunity score (0–100) — how much revenue potential a fund offers Pantor.
 * 55 pts: trapped-demand intensity (share of tendered shares that could NOT exit)
 * 25 pts: cap pressure (demand ÷ floodgate above 1.0, saturating at 7×)
 * 20 pts: market scale (log10 of trapped shares, saturating near 400M)
 */
function opportunityScore(b) {
  if (b.status === STATUS.NO_FILING || b.sharesTendered === null) return null;
  if (b.sharesTendered === 0) return 0;
  const trapped = 1 - b.repurchasePct / 100;
  const pressure = Math.max(0, (b.oversubRatio ?? 0) - 1);
  const scale = b.unmetShares > 0 ? Math.log10(b.unmetShares) : 0;
  const s = 55 * Math.min(1, trapped / 0.85)
          + 25 * Math.min(1, pressure / 6)
          + 20 * Math.min(1, scale / 8.6);
  return Math.round(s * 10) / 10;
}

function tierFor(b) {
  if (b.score === null) return TIER.NO_DATA;
  if (b.score >= 70) return TIER.PRIME;
  if (b.score >= 45) return TIER.STRONG;
  if (b.score >= 22) return TIER.MODERATE;
  // Fully-executed funds close to (or breaching) the cap are one cycle from locking up.
  if (b.repurchasePct === 100 && b.oversubRatio !== null && b.oversubRatio >= 0.85) return TIER.WATCHLIST;
  return TIER.LOW;
}

function adviceFor(b) {
  const n = b.name;
  switch (b.tier) {
    case TIER.PRIME:
      return `${n} is the strongest kind of Pantor client: ${fmtPct(b.trappedPctOfTendered)} of tendered shares were refused exit last cycle (${fmtShares(b.unmetShares)} shares trapped). Both revenue lines apply — bridge loans to trapped holders at scale, and a capacity deal with the fund itself, which is under visible redemption pressure. Price aggressively; the queue is deep enough to absorb it.`;
    case TIER.STRONG:
      return `${n} refused ${fmtPct(b.trappedPctOfTendered)} of tendered shares (${fmtShares(b.unmetShares)} shares). A solid bridge-lending book with real volume; the fund may also entertain a capacity arrangement to relieve queue pressure before it compounds.`;
    case TIER.MODERATE:
      return `${n} shows oversubscription, but the trapped pool is comparatively small. Serve inbound borrowers opportunistically; a dedicated origination push is hard to justify at this scale.`;
    case TIER.WATCHLIST:
      return b.status === STATUS.CAP_BREACH
        ? `${n} let demand above its stated cap exit in full — no trapped borrowers today. But demand at ${fmtPct(b.pctOutstanding)} against a ${fmtPct(b.floodgate)} floodgate means the cap generosity may not repeat. Position relationships now, before the first refused cycle.`
        : `${n} executed 100%, but demand reached ${fmtPct(b.pctOutstanding)} against a ${fmtPct(b.floodgate)} cap — nearly full. One uptick in redemptions makes this an oversubscribed fund. Build presence ahead of that.`;
    case TIER.LOW:
      return b.sharesTendered === 0
        ? `${n} had zero tendered shares last cycle — no exit demand, no borrowers, no revenue case today. Monitor only.`
        : `${n} cleared all tendered shares with room under the cap. No trapped demand to lend against; low priority until subscription pressure appears.`;
    default:
      return `${n} has never completed a tender cycle on file. No basis for action until a final amendment (SC TO-I/A) is filed.`;
  }
}

// ---------- formatting helpers (shared by all pages) ----------
export function fmtShares(v) {
  if (v === null || v === undefined) return "N/A";
  if (v === 0) return "0";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(Math.round(v));
}
export function fmtSharesFull(v) {
  if (v === null || v === undefined) return "N/A";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
export function fmtPct(v, dp = 2) {
  if (v === null || v === undefined) return "N/A";
  return v.toFixed(dp) + "%";
}
export function fmtDate(d) {
  if (!d) return "N/A";
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${dt.getFullYear()}`;
}
export function fmtDateLong(d) {
  if (!d) return "N/A";
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function round2(v) { return Math.round(v * 100) / 100; }

// ---------- the analyzed universe ----------
export const FUNDS = BDCS.map(analyze);

export const MARKET = (() => {
  const cycled = FUNDS.filter((f) => f.dateOfTender !== null);
  const over = cycled.filter((f) => f.status === STATUS.OVERSUBSCRIBED);
  const trapped = over.reduce((s, f) => s + f.unmetShares, 0);
  const tendered = cycled.reduce((s, f) => s + (f.sharesTendered || 0), 0);
  const anomalies = cycled.filter((f) => f.status === STATUS.CAP_BREACH);
  return {
    cycledCount: cycled.length,
    oversubscribedCount: over.length,
    trappedShares: trapped,
    tenderedShares: tendered,
    anomalyCount: anomalies.length,
    zeroCount: cycled.filter((f) => f.sharesTendered === 0).length,
    neverFiledCount: FUNDS.length - cycled.length,
    worstRepurchase: Math.min(...cycled.filter((f) => f.sharesTendered > 0).map((f) => f.repurchasePct)),
    maxOversub: Math.max(...cycled.map((f) => f.oversubRatio ?? 0)),
  };
})();

export function bySlug(slug) { return FUNDS.find((f) => f.slug === slug); }

export function sortedForTable(funds = FUNDS) {
  return [...funds].sort((a, b) => {
    if (a.dateOfTender === null && b.dateOfTender === null) return a.name.localeCompare(b.name);
    if (a.dateOfTender === null) return 1;
    if (b.dateOfTender === null) return -1;
    if (a.dateOfTender !== b.dateOfTender) return b.dateOfTender.localeCompare(a.dateOfTender);
    return a.name.localeCompare(b.name);
  });
}
