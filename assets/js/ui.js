/* Shared UI behaviors: scroll reveal, animated counters, badge/chip builders. */

export function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }, { threshold: 0.08 });
  els.forEach((e) => io.observe(e));
}

export function animateCount(el, target, { duration = 1100, format = (v) => Math.round(v).toLocaleString("en-US") } = {}) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = format(target); return; }
  const t0 = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function frame(now) {
    const p = Math.min(1, (now - t0) / duration);
    el.textContent = format(target * ease(p));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function badge(grade) {
  const map = {
    fact: ["badge badge-fact", "Filed fact"],
    derived: ["badge badge-derived", "Derived from filings"],
    estimate: ["badge badge-estimate", "Model estimate"],
  };
  const [cls, label] = map[grade];
  const s = document.createElement("span"); s.className = cls;
  const d = document.createElement("i"); d.className = "dot"; s.appendChild(d);
  s.appendChild(document.createTextNode(label));
  return s;
}

export function statusChip(status) {
  const s = document.createElement("span");
  s.className = `chip chip-${status.id}`;
  const i = document.createElement("i"); s.appendChild(i);
  s.appendChild(document.createTextNode(status.label));
  return s;
}

export function tierChip(tier) {
  const s = document.createElement("span");
  s.className = `tier tier-${tier.id}`;
  s.textContent = tier.label;
  return s;
}
