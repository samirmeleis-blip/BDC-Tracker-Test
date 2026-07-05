import { FUNDS, MARKET, TIER, fmtShares, fmtPct, fmtDateLong } from "./metrics.js";
import { scoreRing } from "./charts.js";
import { initReveal, statusChip, tierChip, animateCount } from "./ui.js";

/* ---------------- headline tiles ---------------- */
const kpis = document.getElementById("oppKpis");
function tile(label, value, foot, kind, animateTo, format) {
  const t = document.createElement("div"); t.className = "tile" + (kind ? ` tile-${kind}` : "");
  const acc = document.createElement("div"); acc.className = "t-accent"; t.appendChild(acc);
  const l = document.createElement("div"); l.className = "t-label"; l.textContent = label; t.appendChild(l);
  const v = document.createElement("div"); v.className = "t-value"; v.textContent = value; t.appendChild(v);
  const ft = document.createElement("div"); ft.className = "t-foot"; ft.textContent = foot; t.appendChild(ft);
  kpis.appendChild(t);
  if (animateTo !== undefined) animateCount(v, animateTo, { format });
}
const ranked = FUNDS.filter((f) => f.score !== null).sort((a, b) => b.score - a.score);
const prime = ranked.filter((f) => f.tier === TIER.PRIME);
const strong = ranked.filter((f) => f.tier === TIER.STRONG);
const watch = FUNDS.filter((f) => f.tier === TIER.WATCHLIST);

tile("Total addressable trapped demand", "0", "shares refused exit in the latest cycle — the bridge-lending book", "alert", MARKET.trappedShares, (v) => fmtShares(v));
tile("Prime targets", String(prime.length), prime.map((f) => shortName(f.name)).join(" · ") || "none this cycle");
tile("Strong targets", String(strong.length), strong.map((f) => shortName(f.name)).join(" · ") || "none this cycle");
tile("Watchlist", String(watch.length), "fully executed today, one cycle from locking up", "estimate");

/* ---------------- ranked cards ---------------- */
const list = document.getElementById("oppList");
const ordered = [...FUNDS].sort((a, b) => {
  if (a.tier.rank !== b.tier.rank) return a.tier.rank - b.tier.rank;
  return (b.score ?? -1) - (a.score ?? -1);
});

ordered.forEach((f, i) => {
  const card = document.createElement("div"); card.className = "card opp-card reveal";

  const rank = document.createElement("div"); rank.className = "opp-rank"; rank.textContent = String(i + 1).padStart(2, "0");
  card.appendChild(rank);

  const mid = document.createElement("div");
  const h = document.createElement("h3");
  const a = document.createElement("a"); a.href = `bdc/${f.slug}.html`; a.textContent = f.name;
  h.appendChild(a); mid.appendChild(h);

  const meta = document.createElement("div"); meta.className = "fund-meta"; meta.style.marginTop = "8px";
  meta.append(statusChip(f.status), tierChip(f.tier));
  mid.appendChild(meta);

  const facts = document.createElement("div"); facts.className = "opp-facts";
  const factPairs = f.dateOfTender === null
    ? [["Last tender", "never filed"]]
    : [
        ["Last tender", fmtDateLong(f.dateOfTender)],
        ["Demand", fmtPct(f.pctOutstanding) + " of outstanding"],
        ["Repurchase", fmtPct(f.repurchasePct)],
        ["Trapped", f.unmetShares > 0 ? fmtShares(f.unmetShares) + " shares" : "none"],
        ...(f.prediction.nextWindow ? [["Next window (est.)", fmtDateLong(f.prediction.nextWindow.low) + " – " + fmtDateLong(f.prediction.nextWindow.high)]] : []),
      ];
  for (const [k, v] of factPairs) {
    const s = document.createElement("span");
    s.appendChild(document.createTextNode(k + " "));
    const b = document.createElement("b"); b.textContent = v; s.appendChild(b);
    facts.appendChild(s);
  }
  mid.appendChild(facts);

  const advice = document.createElement("p"); advice.className = "opp-advice"; advice.textContent = f.advice;
  mid.appendChild(advice);
  card.appendChild(mid);

  const right = document.createElement("div"); right.className = "opp-right";
  scoreRing(right, f.score, f.tier.label, 84);
  const cap = document.createElement("div"); cap.className = "sd-num"; cap.textContent = "score";
  right.appendChild(cap);
  card.appendChild(right);

  list.appendChild(card);
});

function shortName(n) {
  return n.replace(/ (Fund|Corp\.?|Corporation|BDC Inc\.|LLC|Inc\.)$/g, "").split(" ").slice(0, 3).join(" ");
}

initReveal();
