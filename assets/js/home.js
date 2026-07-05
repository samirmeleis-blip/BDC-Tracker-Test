import { DATASET_META } from "./data.js";
import { FUNDS, MARKET, STATUS, sortedForTable, fmtShares, fmtSharesFull, fmtPct, fmtDate } from "./metrics.js";
import { rankedBars, scatter, chartCard } from "./charts.js";
import { initReveal, animateCount } from "./ui.js";
import { marketHero } from "./three-scenes.js";

document.getElementById("asof").textContent = `data as of ${DATASET_META.asOf}`;

/* ---------------- 3D hero ---------------- */
marketHero(document.getElementById("hero3d"), FUNDS, {
  tipEl: document.getElementById("hero3dTip"),
  onSelect: (f) => { window.location.href = `bdc/${f.slug}.html`; },
});

/* ---------------- KPI row ---------------- */
const kpis = document.getElementById("kpis");
function tile({ label, value, foot, kind, animateTo, format }) {
  const t = document.createElement("div");
  t.className = "tile" + (kind ? ` tile-${kind}` : "");
  const acc = document.createElement("div"); acc.className = "t-accent"; t.appendChild(acc);
  const l = document.createElement("div"); l.className = "t-label"; l.textContent = label; t.appendChild(l);
  const v = document.createElement("div"); v.className = "t-value"; v.textContent = value; t.appendChild(v);
  if (foot) { const f = document.createElement("div"); f.className = "t-foot"; f.textContent = foot; t.appendChild(f); }
  kpis.appendChild(t);
  if (animateTo !== undefined) animateCount(v, animateTo, { format });
  return t;
}
tile({
  label: "Shares trapped last cycle", value: "0", kind: "alert",
  animateTo: MARKET.trappedShares, format: (v) => fmtShares(v),
  foot: `tendered but refused exit, across ${MARKET.oversubscribedCount} oversubscribed funds`,
});
tile({
  label: "Oversubscribed funds", value: "0",
  animateTo: MARKET.oversubscribedCount, format: (v) => `${Math.round(v)} of ${MARKET.cycledCount}`,
  foot: "demand exceeded the floodgate and repurchase was cut",
});
tile({
  label: "Deepest repurchase cut", value: "0",
  animateTo: MARKET.worstRepurchase, format: (v) => v.toFixed(2) + "%",
  foot: "Owl Rock Technology Income — 85.6% of tendered shares refused",
});
tile({
  label: "Heaviest demand vs cap", value: "0",
  animateTo: MARKET.maxOversub, format: (v) => v.toFixed(2) + "×",
  foot: "Owl Rock Technology Income — 40.40% tendered against a 5% gate",
});

/* ---------------- ranked oversubscription bars ---------------- */
const cycled = FUNDS.filter((f) => f.dateOfTender !== null)
  .map((f) => ({ ...f, zero: f.sharesTendered === 0 }))
  .sort((a, b) => (b.oversubRatio ?? 0) - (a.oversubRatio ?? 0));

chartCard(document.getElementById("oversubChart"), {
  render: (host) => rankedBars(host, cycled, {
    ariaLabel: "Demand as a multiple of the floodgate cap, per fund",
    valueOf: (f) => f.oversubRatio ?? 0,
    labelOf: (f) => f.name,
    capValue: 1.0,
    capLabel: "cap 1.0×",
    fmt: (v) => v.toFixed(1) + "×",
    onClick: (f) => { window.location.href = `bdc/${f.slug}.html`; },
    tipRows: (f) => [
      { label: "Demand ÷ floodgate", value: (f.oversubRatio ?? 0).toFixed(2) + "×", color: f.oversubRatio > 1 ? "var(--status-critical)" : "var(--series-1)" },
      { label: "% of outstanding tendered", value: fmtPct(f.pctOutstanding) },
      { label: "Repurchase of tendered", value: fmtPct(f.repurchasePct) },
      { label: "Status", value: f.status.label },
    ],
  }),
  tableHead: ["Fund", "Demand ÷ cap", "% tendered", "Floodgate", "Repurchase"],
  tableRows: cycled.map((f) => [f.name, (f.oversubRatio ?? 0).toFixed(2) + "×", fmtPct(f.pctOutstanding), fmtPct(f.floodgate), fmtPct(f.repurchasePct)]),
});

/* ---------------- opportunity scatter ---------------- */
const withDemand = cycled.filter((f) => f.sharesTendered > 0);
const maxUnmet = Math.max(...withDemand.map((f) => f.unmetShares));
chartCard(document.getElementById("scatterChart"), {
  render: (host) => scatter(host, withDemand, {
    ariaLabel: "Repurchase rate versus tendered demand; bubble area is trapped shares",
    xOf: (f) => f.pctOutstanding,
    yOf: (f) => f.repurchasePct,
    rOf: (f) => 5 + Math.sqrt(f.unmetShares / maxUnmet) * 26,
    labelOf: (f) => f.name,
    capX: 5.0, capLabel: "5% floodgate",
    xTitle: "Shares tendered, % of outstanding →",
    yTitle: "↑ Repurchase of tendered shares",
    labelTop: 3,
    onClick: (f) => { window.location.href = `bdc/${f.slug}.html`; },
    tipRows: (f) => [
      { label: "% of outstanding tendered", value: fmtPct(f.pctOutstanding), color: f.pctOutstanding > 5 ? "var(--status-critical)" : "var(--series-1)" },
      { label: "Repurchase of tendered", value: fmtPct(f.repurchasePct) },
      { label: "Shares refused exit", value: fmtShares(f.unmetShares) },
      { label: "Pantor score", value: f.score === null ? "N/A" : String(f.score) },
    ],
  }),
  tableHead: ["Fund", "% tendered", "Repurchase", "Trapped shares", "Score"],
  tableRows: withDemand.map((f) => [f.name, fmtPct(f.pctOutstanding), fmtPct(f.repurchasePct), fmtSharesFull(f.unmetShares), String(f.score ?? "N/A")]),
});

/* ---------------- league table ---------------- */
const tbody = document.querySelector("#leagueTable tbody");
let rows = sortedForTable();
let activeFilter = "all", query = "";
let sortKey = null, sortDir = -1;

function passes(f) {
  if (activeFilter === "oversubscribed" && f.status !== STATUS.OVERSUBSCRIBED) return false;
  if (activeFilter === "executed" && f.status !== STATUS.EXECUTED) return false;
  if (activeFilter === "cap-breach" && f.status !== STATUS.CAP_BREACH) return false;
  if (activeFilter === "quiet" && !(f.status === STATUS.ZERO || f.status === STATUS.NO_FILING)) return false;
  if (query) {
    const q = query.toLowerCase();
    if (!f.name.toLowerCase().includes(q) && !f.cik.includes(q)) return false;
  }
  return true;
}

function td(text, cls) { const d = document.createElement("td"); if (cls) d.className = cls; d.textContent = text; return d; }

function renderTable() {
  let data = rows.filter(passes);
  if (sortKey) {
    data = [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "string") return sortDir * av.localeCompare(bv);
      return sortDir * (av - bv);
    });
  }
  tbody.replaceChildren();
  for (const f of data) {
    const tr = document.createElement("tr");
    tr.appendChild(td(f.dateOfTender ? fmtDate(f.dateOfTender) : "N/A", f.dateOfTender ? "num-dim" : "na"));

    const fund = document.createElement("td"); fund.className = "fund-cell";
    const a = document.createElement("a"); a.href = `bdc/${f.slug}.html`; a.textContent = f.name;
    const cik = document.createElement("span"); cik.className = "cik"; cik.textContent = "CIK " + f.cik;
    fund.append(a, cik); tr.appendChild(fund);

    tr.appendChild(td(f.sharesTendered === null ? "N/A" : fmtSharesFull(f.sharesTendered), f.sharesTendered === null ? "na" : ""));

    const pctCell = document.createElement("td");
    if (f.pctOutstanding === null) { pctCell.className = "na"; pctCell.textContent = "N/A"; }
    else {
      const wrap = document.createElement("span"); wrap.className = "tbar";
      const label = document.createElement("span"); label.textContent = fmtPct(f.pctOutstanding);
      const track = document.createElement("span"); track.className = "tb-track";
      const fill = document.createElement("span"); fill.className = "tb-fill";
      fill.style.width = Math.min(100, (f.pctOutstanding / 12) * 100) + "%";
      fill.style.background = f.pctOutstanding > f.floodgate ? "var(--status-critical)" : "var(--series-1)";
      track.appendChild(fill); wrap.append(label, track); pctCell.appendChild(wrap);
    }
    tr.appendChild(pctCell);

    tr.appendChild(td(f.floodgate === null ? "N/A" : fmtPct(f.floodgate), f.floodgate === null ? "na" : "num-dim"));
    tr.appendChild(td(f.repurchasePct === null ? "N/A" : fmtPct(f.repurchasePct), f.repurchasePct === null ? "na" : f.repurchasePct < 100 ? "" : "num-dim"));
    tr.appendChild(td(f.unmetShares === null ? "N/A" : f.unmetShares === 0 ? "0" : fmtShares(f.unmetShares), f.unmetShares ? "" : "na"));

    const sc = document.createElement("td");
    const tierEl = document.createElement("span"); tierEl.className = `tier tier-${f.tier.id}`;
    tierEl.textContent = f.score === null ? "—" : String(f.score);
    tierEl.title = f.tier.label;
    sc.appendChild(tierEl); tr.appendChild(sc);

    tr.addEventListener("click", (e) => { if (e.target.tagName !== "A") window.location.href = `bdc/${f.slug}.html`; });
    tbody.appendChild(tr);
  }
}
renderTable();

document.querySelectorAll("#leagueTable thead th").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.key;
    if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = key === "name" ? 1 : -1; }
    document.querySelectorAll("#leagueTable thead th").forEach((x) => x.removeAttribute("aria-sort"));
    th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
    renderTable();
  });
});

document.querySelectorAll("#filters .fbtn").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#filters .fbtn").forEach((x) => x.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", "true");
    activeFilter = b.dataset.filter;
    renderTable();
  });
});
document.getElementById("fundSearch").addEventListener("input", (e) => { query = e.target.value.trim(); renderTable(); });

initReveal();
