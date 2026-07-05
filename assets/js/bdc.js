import { edgarUrl } from "./data.js";
import { FUNDS, STATUS, bySlug, sortedForTable, fmtShares, fmtSharesFull, fmtPct, fmtDate, fmtDateLong } from "./metrics.js";
import { capMeter, splitBar, cycleTimeline, scoreRing, chartCard } from "./charts.js";
import { initReveal, statusChip, tierChip } from "./ui.js";
import { gateScene } from "./three-scenes.js";

const slug = document.body.dataset.slug;
const f = bySlug(slug);
const $ = (id) => document.getElementById(id);
const hasCycle = f.dateOfTender !== null;

document.title = `${f.name} — Pantor Intelligence`;

/* ---------------- header ---------------- */
$("fundName").textContent = f.name;
$("crumbName").textContent = f.name;
$("fundMeta").append(statusChip(f.status), tierChip(f.tier));
const cikEl = document.createElement("a");
cikEl.className = "mono"; cikEl.href = edgarUrl(f.cik); cikEl.target = "_blank"; cikEl.rel = "noopener";
cikEl.textContent = `CIK ${f.cik} · EDGAR ↗`;
$("fundMeta").appendChild(cikEl);

scoreRing($("scoreDial"), f.score, f.tier.label);
$("scoreCaption").textContent = f.score === null ? "no score — no data" : `Pantor score · ${f.tier.label.toLowerCase()}`;

/* ---------------- filed facts tiles ---------------- */
const tiles = [
  { label: "Date of tender", value: hasCycle ? fmtDate(f.dateOfTender) : "N/A", foot: "final amendment signature date" },
  { label: "Shares tendered", value: f.sharesTendered === null ? "N/A" : fmtShares(f.sharesTendered), foot: f.sharesTendered === null ? "no completed cycle" : fmtSharesFull(f.sharesTendered) + " shares" },
  { label: "% of shares outstanding", value: f.pctOutstanding === null ? "N/A" : fmtPct(f.pctOutstanding), foot: "tendered ÷ total outstanding" },
  { label: "Floodgate", value: f.floodgate === null ? "N/A" : fmtPct(f.floodgate), foot: "cap on repurchase, % of outstanding" },
  { label: "Repurchase of tendered", value: f.repurchasePct === null ? "N/A" : fmtPct(f.repurchasePct), foot: f.repurchasePct === null ? "no completed cycle" : f.repurchasePct < 100 ? "investors were rationed" : "all tendering investors exited", kind: f.repurchasePct !== null && f.repurchasePct < 100 ? "alert" : undefined },
];
for (const t of tiles) {
  const el = document.createElement("div"); el.className = "tile" + (t.kind ? ` tile-${t.kind}` : "");
  const acc = document.createElement("div"); acc.className = "t-accent"; el.appendChild(acc);
  const l = document.createElement("div"); l.className = "t-label"; l.textContent = t.label; el.appendChild(l);
  const v = document.createElement("div"); v.className = "t-value"; v.textContent = t.value; el.appendChild(v);
  const ft = document.createElement("div"); ft.className = "t-foot"; ft.textContent = t.foot; el.appendChild(ft);
  $("factTiles").appendChild(el);
}

/* ---------------- anomaly banner ---------------- */
if (f.anomaly) {
  const wrap = document.createElement("div"); wrap.className = "anomaly reveal";
  const ic = document.createElement("span"); ic.className = "ic"; ic.textContent = "⚠";
  const p = document.createElement("p"); p.textContent = f.anomaly;
  wrap.append(ic, p);
  $("anomalySlot").appendChild(wrap);
}

/* ---------------- 3D gate ---------------- */
gateScene($("gate3d"), f);
$("gateCaption").textContent = hasCycle && f.sharesTendered > 0
  ? `Simulated: ${fmtPct(f.repurchasePct)} of tendered shares clear the gate (aqua); ${fmtPct(100 - f.repurchasePct)} are refused (red). Gate aperture ∝ repurchase rate.`
  : "No share flow to simulate — the gate stands idle.";

/* ---------------- demand vs cap ---------------- */
if (hasCycle) {
  capMeter($("capMeterHost"), f.pctOutstanding, f.floodgate, { title: f.name });
  $("capNote").textContent = f.oversubRatio > 1
    ? `Demand ran ${f.oversubRatio.toFixed(2)}× the floodgate. ${f.status === STATUS.CAP_BREACH ? "The fund honored it anyway — see anomaly note above." : "The gate held; excess demand was refused."}`
    : `Demand stayed at ${(f.oversubRatio * 100).toFixed(0)}% of the cap — every tendered share cleared.`;
} else {
  $("capNote").textContent = "No completed tender cycle on file — nothing to measure yet.";
}

/* ---------------- split bar ---------------- */
if (hasCycle && f.sharesTendered > 0) {
  chartCard($("splitHost"), {
    render: (host) => splitBar(host, f.repurchasePct, {
      title: f.name,
      execShares: fmtShares(f.executedShares) + " shares repurchased",
      trappedShares: f.unmetShares > 0 ? fmtShares(f.unmetShares) + " shares trapped" : "",
    }),
    tableHead: ["Outcome", "Share of tendered", "Shares"],
    tableRows: [
      ["Repurchased (exited)", fmtPct(f.repurchasePct), fmtSharesFull(f.executedShares)],
      ["Trapped (refused exit)", fmtPct(100 - f.repurchasePct), fmtSharesFull(f.unmetShares)],
    ],
  });
} else {
  const p = document.createElement("p"); p.className = "card-sub";
  p.textContent = hasCycle ? "Zero shares were tendered — no split to show." : "No completed cycle on file.";
  $("splitHost").appendChild(p);
}

/* ---------------- prediction card ---------------- */
const pr = f.prediction;
if (pr.nextWindow) {
  cycleTimeline($("timelineHost"), { lastDate: new Date(f.dateOfTender + "T00:00:00"), window: pr.nextWindow, fmtDate });
  const items = [
    { label: "Projected next tender window", value: `${fmtDateLong(pr.nextWindow.low)} – ${fmtDateLong(pr.nextWindow.high)}`, note: "midpoint " + fmtDateLong(pr.nextWindow.mid) },
    { label: "Projected demand next cycle", value: `${fmtPct(pr.projectedDemandLow, 1)} – ${fmtPct(pr.projectedDemandHigh, 1)}`, note: "central estimate " + fmtPct(pr.projectedDemandPct, 1) + " of outstanding" },
    { label: "Projected repurchase rate", value: fmtPct(pr.projectedRepurchasePct, 1), note: "if the floodgate stays at " + fmtPct(f.floodgate, 1) },
    { label: "Oversubscription probability", value: pr.oversubProbability + "%", note: "chance next cycle refuses investors" },
    { label: "Model confidence", value: pr.confidence, note: "single-cycle observation base" },
  ];
  for (const it of items) {
    const el = document.createElement("div"); el.className = "pred-item";
    const l = document.createElement("div"); l.className = "p-label"; l.textContent = it.label;
    const v = document.createElement("div"); v.className = "p-value"; v.textContent = it.value;
    const n = document.createElement("div"); n.className = "p-note"; n.textContent = it.note;
    el.append(l, v, n); $("predGrid").appendChild(el);
  }
} else {
  const el = document.createElement("p"); el.className = "card-sub"; el.textContent = pr.basis;
  $("predGrid").appendChild(el);
}
$("predBasis").textContent = pr.nextWindow ? "Model basis: " + pr.basis : "";

/* ---------------- advice ---------------- */
$("adviceText").textContent = f.advice;

/* ---------------- full record ---------------- */
const record = [
  ["Fund name", f.name, "fact"],
  ["CIK", f.cik, "fact"],
  ["Date of tender (final amendment)", hasCycle ? fmtDate(f.dateOfTender) : "N/A", "fact"],
  ["Shares tendered", f.sharesTendered === null ? "N/A" : fmtSharesFull(f.sharesTendered), "fact"],
  ["% of shares outstanding", f.pctOutstanding === null ? "N/A" : fmtPct(f.pctOutstanding), "fact"],
  ["Floodgate", f.floodgate === null ? "N/A" : fmtPct(f.floodgate), "fact"],
  ["Repurchase of tendered shares", f.repurchasePct === null ? "N/A" : fmtPct(f.repurchasePct), "fact"],
  ["Demand ÷ floodgate", f.oversubRatio === null ? "N/A" : f.oversubRatio.toFixed(2) + "×", "derived"],
  ["Shares repurchased", f.executedShares === null ? "N/A" : fmtSharesFull(f.executedShares), "derived"],
  ["Shares trapped (refused exit)", f.unmetShares === null ? "N/A" : fmtSharesFull(f.unmetShares), "derived"],
  ["Implied shares outstanding", f.impliedSharesOutstanding === null ? "N/A" : fmtSharesFull(f.impliedSharesOutstanding), "derived"],
  ["Pantor opportunity score", f.score === null ? "N/A" : `${f.score} / 100 · ${f.tier.label}`, "estimate"],
];
for (const [k, v, grade] of record) {
  const li = document.createElement("li");
  const kEl = document.createElement("span"); kEl.className = "fl-k"; kEl.textContent = k;
  const right = document.createElement("span"); right.className = "fl-v";
  right.textContent = v + "  ";
  const b = document.createElement("span");
  b.className = "badge badge-" + grade;
  b.textContent = grade === "fact" ? "fact" : grade === "derived" ? "derived" : "estimate";
  right.appendChild(b);
  li.append(kEl, right);
  $("factsList").appendChild(li);
}

/* ---------------- prev / next pager ---------------- */
const order = sortedForTable();
const idx = order.findIndex((x) => x.slug === slug);
const prev = order[idx - 1], next = order[idx + 1];
if (prev) {
  const a = document.createElement("a"); a.href = `${prev.slug}.html`;
  const s = document.createElement("span"); s.textContent = "← Previous fund";
  a.append(s, document.createTextNode(prev.name)); $("pager").appendChild(a);
}
if (next) {
  const a = document.createElement("a"); a.href = `${next.slug}.html`; a.className = "next";
  const s = document.createElement("span"); s.textContent = "Next fund →";
  a.append(s, document.createTextNode(next.name)); $("pager").appendChild(a);
}

initReveal();
