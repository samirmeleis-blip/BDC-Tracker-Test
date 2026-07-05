/*
 * Hand-rolled SVG chart layer.
 * Mark contract (see methodology): bars ≤ 24px with 4px rounded data-end and a
 * square baseline; 2px lines; solid hairline grid; selective direct labels;
 * every chart ships a hover layer AND a table-view twin; all dynamic text is
 * inserted with textContent (never innerHTML).
 */

const SVGNS = "http://www.w3.org/2000/svg";

export function svgEl(name, attrs = {}) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function div(cls) { const d = document.createElement("div"); if (cls) d.className = cls; return d; }

/* ---------------- tooltip singleton ---------------- */
let TIP = null;
function tip() {
  if (!TIP) { TIP = div("viz-tooltip"); document.body.appendChild(TIP); }
  return TIP;
}
export function showTip(evt, title, rows) {
  const t = tip();
  t.replaceChildren();
  const h = div("tt-title"); h.textContent = title; t.appendChild(h);
  for (const r of rows) {
    const row = div("tt-row");
    if (r.color) { const k = div("tt-key"); k.style.borderTopColor = r.color; if (r.dashed) k.style.borderTopStyle = "dashed"; row.appendChild(k); }
    const lbl = document.createElement("span"); lbl.textContent = r.label; row.appendChild(lbl);
    const val = document.createElement("b"); val.textContent = r.value; row.appendChild(val);
    t.appendChild(row);
  }
  t.style.display = "block";
  moveTip(evt);
}
export function moveTip(evt) {
  const t = tip();
  const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
  if (y + h > window.innerHeight - 8) y = evt.clientY - h - pad;
  t.style.left = x + "px"; t.style.top = y + "px";
}
export function hideTip() { if (TIP) TIP.style.display = "none"; }

/* ---------------- chart card scaffolding (chart ⇄ table toggle) ---------------- */
export function chartCard(host, { render, tableHead, tableRows }) {
  const bar = div(); bar.style.cssText = "display:flex;justify-content:flex-end;margin-bottom:8px;";
  const toggle = div("viz-toggle"); toggle.setAttribute("role", "group"); toggle.setAttribute("aria-label", "View as chart or table");
  const bChart = document.createElement("button"); bChart.textContent = "Chart"; bChart.setAttribute("aria-pressed", "true");
  const bTable = document.createElement("button"); bTable.textContent = "Table"; bTable.setAttribute("aria-pressed", "false");
  toggle.append(bChart, bTable); bar.appendChild(toggle);

  const vizWrap = div("viz");
  const tblWrap = div("viz-table"); tblWrap.hidden = true;
  const table = document.createElement("table");
  const thead = document.createElement("thead"); const trh = document.createElement("tr");
  for (const h of tableHead) { const th = document.createElement("th"); th.textContent = h; trh.appendChild(th); }
  thead.appendChild(trh);
  const tbody = document.createElement("tbody");
  for (const r of tableRows) {
    const tr = document.createElement("tr");
    for (const c of r) { const td = document.createElement("td"); td.textContent = c; tr.appendChild(td); }
    tbody.appendChild(tr);
  }
  table.append(thead, tbody); tblWrap.appendChild(table);

  bChart.onclick = () => { vizWrap.hidden = false; tblWrap.hidden = true; bChart.setAttribute("aria-pressed", "true"); bTable.setAttribute("aria-pressed", "false"); };
  bTable.onclick = () => { vizWrap.hidden = true; tblWrap.hidden = false; bChart.setAttribute("aria-pressed", "false"); bTable.setAttribute("aria-pressed", "true"); };

  host.append(bar, vizWrap, tblWrap);
  render(vizWrap);
  return vizWrap;
}

/* ---------------- ranked horizontal bars with a cap reference line ----------------
 * Magnitude vs a threshold: bars below the cap wear the primary series hue,
 * bars above it wear the critical status hue (state, not decoration). */
export function rankedBars(host, items, opts) {
  const { valueOf, labelOf, capValue, fmt, onClick, tipRows } = opts;
  const rowH = 30, barH = 18, padL = 236, padR = 86, padT = 26, padB = 30;
  const W = 860, H = padT + items.length * rowH + padB;
  const maxV = Math.max(capValue * 1.15, ...items.map(valueOf)) * 1.04;
  const x = (v) => padL + (v / maxV) * (W - padL - padR);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.ariaLabel || "Ranked bar chart" });

  // hairline grid at clean ticks
  const step = niceStep(maxV);
  for (let v = 0; v <= maxV; v += step) {
    svg.appendChild(svgEl("line", { x1: x(v), x2: x(v), y1: padT - 8, y2: H - padB, class: "gline" }));
    const t = svgEl("text", { x: x(v), y: H - padB + 16, "text-anchor": "middle", class: "tick" });
    t.textContent = fmt(v); svg.appendChild(t);
  }
  // cap reference line
  svg.appendChild(svgEl("line", { x1: x(capValue), x2: x(capValue), y1: padT - 12, y2: H - padB, stroke: "var(--ink-primary)", "stroke-width": 1.5 }));
  const capT = svgEl("text", { x: x(capValue), y: padT - 16, "text-anchor": "middle", class: "tick", fill: "var(--ink-secondary)" });
  capT.textContent = opts.capLabel; svg.appendChild(capT);

  items.forEach((it, i) => {
    const v = valueOf(it);
    const y = padT + i * rowH + (rowH - barH) / 2;
    const over = v > capValue;
    const color = it.zero ? "var(--de-emphasis)" : over ? "var(--status-critical)" : "var(--series-1)";
    const w = Math.max(x(v) - padL, v > 0 ? 3 : 0);

    const g = svgEl("g", { tabindex: "0", role: "listitem", style: "cursor:pointer;outline:none;" });
    // square baseline, 4px rounded data-end: rect + squaring patch at the left
    if (w > 0) {
      const bar = svgEl("rect", { x: padL, y, width: w, height: barH, rx: 4, fill: color });
      g.appendChild(bar);
      if (w > 6) g.appendChild(svgEl("rect", { x: padL, y, width: 4, height: barH, fill: color }));
    }
    // fund label (text token, never series color)
    const lbl = svgEl("text", { x: padL - 10, y: y + barH / 2 + 4, "text-anchor": "end", class: i < 3 ? "dlabel-strong" : "dlabel" });
    lbl.textContent = truncate(labelOf(it), 29); g.appendChild(lbl);
    // value at the bar tip
    const val = svgEl("text", { x: x(v) + 8, y: y + barH / 2 + 4, class: over ? "dlabel-strong" : "dlabel" });
    val.textContent = fmt(v); g.appendChild(val);
    // oversized hit target
    const hit = svgEl("rect", { x: 0, y: padT + i * rowH, width: W, height: rowH, fill: "transparent" });
    g.appendChild(hit);

    const onOver = (e) => showTip(e, labelOf(it), tipRows(it));
    g.addEventListener("pointermove", (e) => { onOver(e); });
    g.addEventListener("pointerleave", hideTip);
    g.addEventListener("focus", (e) => { const r = g.getBoundingClientRect(); showTip({ clientX: r.left + 240, clientY: r.top + 10 }, labelOf(it), tipRows(it)); });
    g.addEventListener("blur", hideTip);
    if (onClick) g.addEventListener("click", () => onClick(it));
    if (onClick) g.addEventListener("keydown", (e) => { if (e.key === "Enter") onClick(it); });
    svg.appendChild(g);
  });

  host.appendChild(svg);
}

/* ---------------- scatter: demand vs repurchase, bubble = trapped scale ---------------- */
export function scatter(host, items, opts) {
  const { xOf, yOf, rOf, labelOf, onClick, tipRows } = opts;
  const W = 860, H = 480, padL = 64, padR = 30, padT = 44, padB = 52;
  const maxX = Math.max(...items.map(xOf)) * 1.1;
  const x = (v) => padL + (v / maxX) * (W - padL - padR);
  const y = (v) => padT + (1 - v / 100) * (H - padT - padB);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.ariaLabel || "Scatter chart" });

  for (let v = 0; v <= 100; v += 25) {
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: "gline" }));
    const t = svgEl("text", { x: padL - 10, y: y(v) + 4, "text-anchor": "end", class: "tick" });
    t.textContent = v + "%"; svg.appendChild(t);
  }
  const xstep = niceStep(maxX);
  for (let v = 0; v <= maxX; v += xstep) {
    const t = svgEl("text", { x: x(v), y: H - padB + 20, "text-anchor": "middle", class: "tick" });
    t.textContent = v.toFixed(0) + "%"; svg.appendChild(t);
  }
  svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: H - padB, y2: H - padB, class: "axisline" }));
  // cap line on x (floodgate 5%)
  if (opts.capX) {
    svg.appendChild(svgEl("line", { x1: x(opts.capX), x2: x(opts.capX), y1: padT, y2: H - padB, stroke: "var(--ink-primary)", "stroke-width": 1.5, opacity: 0.8 }));
    const ct = svgEl("text", { x: x(opts.capX) + 6, y: H - padB - 12, class: "tick", fill: "var(--ink-secondary)" });
    ct.textContent = opts.capLabel; svg.appendChild(ct);
  }
  // axis titles
  const xt = svgEl("text", { x: (padL + W - padR) / 2, y: H - 8, "text-anchor": "middle", class: "tick" });
  xt.textContent = opts.xTitle; svg.appendChild(xt);
  const yt = svgEl("text", { x: 14, y: padT - 10, class: "tick" });
  yt.textContent = opts.yTitle; svg.appendChild(yt);

  const pts = [];
  for (const it of items) {
    const cx = x(xOf(it)), cy = y(yOf(it));
    const r = Math.max(5, rOf(it));
    const over = xOf(it) > (opts.capX ?? Infinity);
    const color = it.zero ? "var(--de-emphasis)" : over ? "var(--status-critical)" : "var(--series-1)";
    // 2px surface ring keeps overlapping dots legible
    const dot = svgEl("circle", { cx, cy, r, fill: color, "fill-opacity": 0.85, stroke: "var(--surface-1)", "stroke-width": 2 });
    svg.appendChild(dot);
    pts.push({ it, cx, cy, dot });
  }
  // selective direct labels: extremes only
  const flagged = [...items].sort((a, b) => xOf(b) - xOf(a)).slice(0, opts.labelTop ?? 3);
  for (const it of flagged) {
    const cx = x(xOf(it)), overflowRight = cx > padL + (W - padL - padR) * 0.68;
    const t = svgEl("text", {
      x: overflowRight ? cx - rOf(it) - 6 : cx + rOf(it) + 6,
      y: y(yOf(it)) + 4,
      "text-anchor": overflowRight ? "end" : "start",
      class: "dlabel-strong",
    });
    t.textContent = truncate(labelOf(it), 26); svg.appendChild(t);
  }

  // nearest-point hover layer (never pinpoint hunting)
  const overlay = svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
  let active = null;
  overlay.addEventListener("pointermove", (e) => {
    const box = svg.getBoundingClientRect();
    const mx = ((e.clientX - box.left) / box.width) * W;
    const my = ((e.clientY - box.top) / box.height) * H;
    let best = null, bd = Infinity;
    for (const p of pts) { const d = (p.cx - mx) ** 2 + (p.cy - my) ** 2; if (d < bd) { bd = d; best = p; } }
    if (best && bd < 120 ** 2) {
      if (active && active !== best) active.dot.setAttribute("fill-opacity", 0.85);
      active = best; best.dot.setAttribute("fill-opacity", 1);
      showTip(e, labelOf(best.it), tipRows(best.it));
      overlay.style.cursor = onClick ? "pointer" : "default";
    } else { if (active) active.dot.setAttribute("fill-opacity", 0.85); active = null; hideTip(); overlay.style.cursor = "default"; }
  });
  overlay.addEventListener("pointerleave", () => { if (active) active.dot.setAttribute("fill-opacity", 0.85); active = null; hideTip(); });
  if (onClick) overlay.addEventListener("click", () => { if (active) onClick(active.it); });
  svg.appendChild(overlay);

  host.appendChild(svg);
}

/* ---------------- single 100% bar: executed vs trapped ---------------- */
export function splitBar(host, executedPct, opts = {}) {
  const W = 860, H = 96, padL = 10, padR = 10, barH = 22, y0 = 34;
  const usable = W - padL - padR;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Share of tendered shares repurchased vs trapped" });
  const wExec = usable * (executedPct / 100);
  const gap = executedPct > 0 && executedPct < 100 ? 2 : 0; // 2px surface gap between segments

  if (executedPct > 0) svg.appendChild(svgEl("rect", { x: padL, y: y0, width: Math.max(3, wExec - gap / 2), height: barH, rx: 4, fill: "var(--series-2)" }));
  if (executedPct < 100) svg.appendChild(svgEl("rect", { x: padL + wExec + gap / 2, y: y0, width: Math.max(3, usable - wExec - gap / 2), height: barH, rx: 4, fill: "var(--status-critical)" }));

  const l1 = svgEl("text", { x: padL, y: y0 - 12, class: "dlabel-strong" });
  l1.textContent = `Repurchased ${executedPct.toFixed(2)}%`; svg.appendChild(l1);
  if (executedPct < 100) {
    const l2 = svgEl("text", { x: W - padR, y: y0 - 12, "text-anchor": "end", class: "dlabel-strong" });
    l2.textContent = `Trapped ${(100 - executedPct).toFixed(2)}%`; svg.appendChild(l2);
  }
  if (opts.execShares !== undefined) {
    const f1 = svgEl("text", { x: padL, y: y0 + barH + 20, class: "tick" });
    f1.textContent = opts.execShares; svg.appendChild(f1);
    const f2 = svgEl("text", { x: W - padR, y: y0 + barH + 20, "text-anchor": "end", class: "tick" });
    f2.textContent = opts.trappedShares; svg.appendChild(f2);
  }
  const hit = svgEl("rect", { x: 0, y: y0 - 6, width: W, height: barH + 12, fill: "transparent" });
  hit.addEventListener("pointermove", (e) => showTip(e, opts.title || "Tendered shares", [
    { label: "Repurchased", value: executedPct.toFixed(2) + "%", color: "var(--series-2)" },
    { label: "Trapped (refused exit)", value: (100 - executedPct).toFixed(2) + "%", color: "var(--status-critical)" },
  ]));
  hit.addEventListener("pointerleave", hideTip);
  svg.appendChild(hit);
  host.appendChild(svg);
}

/* ---------------- cycle timeline: filed dot + projected window ---------------- */
export function cycleTimeline(host, { lastDate, window: win, fmtDate }) {
  const W = 860, H = 130, padL = 20, padR = 20, yMid = 62;
  const t0 = lastDate.getTime();
  const t1 = win.high.getTime() + 12 * 864e5;
  const start = t0 - 18 * 864e5;
  const x = (t) => padL + ((t - start) / (t1 - start)) * (W - padL - padR);

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Last tender date and projected next window" });
  svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: yMid, y2: yMid, class: "axisline" }));

  // month ticks
  const mt = new Date(lastDate); mt.setDate(1);
  for (let i = 0; i < 8; i++) {
    const tx = x(mt.getTime());
    if (tx > padL && tx < W - padR) {
      svg.appendChild(svgEl("line", { x1: tx, x2: tx, y1: yMid - 5, y2: yMid + 5, class: "gline" }));
      const t = svgEl("text", { x: tx, y: yMid + 24, "text-anchor": "middle", class: "tick" });
      t.textContent = mt.toLocaleDateString("en-US", { month: "short" }); svg.appendChild(t);
    }
    mt.setMonth(mt.getMonth() + 1);
  }

  // projected window band — dashed violet = model estimate
  const bx1 = x(win.low.getTime()), bx2 = x(win.high.getTime());
  const band = svgEl("rect", { x: bx1, y: yMid - 22, width: bx2 - bx1, height: 44, rx: 6, fill: "var(--estimate)", "fill-opacity": 0.12, stroke: "var(--estimate)", "stroke-dasharray": "5 4", "stroke-width": 1.5 });
  svg.appendChild(band);
  const bmid = svgEl("circle", { cx: x(win.mid.getTime()), cy: yMid, r: 6, fill: "var(--estimate)", stroke: "var(--surface-1)", "stroke-width": 2 });
  svg.appendChild(bmid);
  const bl = svgEl("text", { x: (bx1 + bx2) / 2, y: yMid - 32, "text-anchor": "middle", class: "dlabel", fill: "#beb6f5" });
  bl.textContent = `Projected window · ${fmtDate(win.low)} – ${fmtDate(win.high)}`; svg.appendChild(bl);

  // filed tender — solid blue = fact
  svg.appendChild(svgEl("circle", { cx: x(t0), cy: yMid, r: 7, fill: "var(--fact)", stroke: "var(--surface-1)", "stroke-width": 2 }));
  const fl = svgEl("text", { x: x(t0), y: yMid + 44, "text-anchor": "middle", class: "dlabel-strong" });
  fl.textContent = `Filed ${fmtDate(lastDate)}`; svg.appendChild(fl);

  // hover
  const hit = svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
  hit.addEventListener("pointermove", (e) => showTip(e, "Tender cycle", [
    { label: "Last final amendment (fact)", value: fmtDate(lastDate), color: "var(--fact)" },
    { label: "Projected next window (estimate)", value: `${fmtDate(win.low)} – ${fmtDate(win.high)}`, color: "var(--estimate)", dashed: true },
  ]));
  hit.addEventListener("pointerleave", hideTip);
  svg.appendChild(hit);
  host.appendChild(svg);
}

/* ---------------- demand vs cap meter ---------------- */
export function capMeter(host, pct, floodgate, opts = {}) {
  const maxScale = Math.max(pct, floodgate) * 1.25 || 10;
  const wrap = div("meter" + (pct > floodgate ? " m-hot" : ""));
  const track = div("m-track");
  const fill = div("m-fill");
  fill.style.width = Math.min(100, (pct / maxScale) * 100) + "%";
  const cap = div("m-cap");
  cap.style.left = Math.min(100, (floodgate / maxScale) * 100) + "%";
  cap.dataset.label = `floodgate ${floodgate.toFixed(2)}%`;
  track.append(fill, cap);
  const scale = div("m-scale");
  const s0 = document.createElement("span"); s0.textContent = "0%";
  const s1 = document.createElement("span"); s1.textContent = `demand ${pct.toFixed(2)}% of shares outstanding`;
  const s2 = document.createElement("span"); s2.textContent = maxScale.toFixed(1) + "%";
  scale.append(s0, s1, s2);
  wrap.append(track, scale);
  track.addEventListener("pointermove", (e) => showTip(e, opts.title || "Demand vs floodgate", [
    { label: "Shares tendered (% outstanding)", value: pct.toFixed(2) + "%", color: pct > floodgate ? "var(--status-critical)" : "var(--series-1)" },
    { label: "Floodgate cap", value: floodgate.toFixed(2) + "%" },
    { label: "Demand ÷ cap", value: (pct / floodgate).toFixed(2) + "×" },
  ]));
  track.addEventListener("pointerleave", hideTip);
  host.appendChild(wrap);
}

/* ---------------- score ring (SVG dial) ---------------- */
export function scoreRing(host, score, tierLabel, size = 92) {
  const r = 38, c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, (score ?? 0) / 100));
  const hue = score === null ? "var(--de-emphasis)" : score >= 70 ? "var(--status-critical)" : score >= 45 ? "var(--status-serious)" : score >= 22 ? "var(--status-warning)" : "var(--de-emphasis)";
  const svg = svgEl("svg", { viewBox: "0 0 100 100", width: size, height: size, role: "img", "aria-label": `Opportunity score ${score ?? "not available"} — ${tierLabel}` });
  svg.appendChild(svgEl("circle", { cx: 50, cy: 50, r, fill: "none", stroke: "var(--surface-3)", "stroke-width": 8 }));
  svg.appendChild(svgEl("circle", {
    cx: 50, cy: 50, r, fill: "none", stroke: hue, "stroke-width": 8, "stroke-linecap": "round",
    "stroke-dasharray": `${c * frac} ${c}`, transform: "rotate(-90 50 50)",
  }));
  const t = svgEl("text", { x: 50, y: 56, "text-anchor": "middle", fill: "var(--ink-primary)", "font-size": "24", "font-weight": "700" });
  t.textContent = score === null ? "—" : String(Math.round(score));
  svg.appendChild(t);
  host.appendChild(svg);
}

/* ---------------- helpers ---------------- */
function niceStep(max) {
  const raw = max / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * mag) return m * mag;
  return 10 * mag;
}
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
