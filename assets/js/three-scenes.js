/*
 * 3D scenes (Three.js, vendored — no CDN).
 *
 * marketHero  — every fund is a column; height encodes tendered demand as a
 *               % of shares outstanding (√-scaled; exact values in the tooltip)
 *               and a translucent plane floats at the 5% floodgate. Columns
 *               piercing the plane are oversubscribed. Drag to orbit, wheel to
 *               zoom, hover for data, click to open the fund page.
 *
 * gateScene   — a particle simulation of one fund's last tender: shares stream
 *               toward the floodgate; the fund's filed repurchase rate decides
 *               how many clear the gate (aqua) vs. get refused (red).
 */

import * as THREE from "../vendor/three.module.min.js";

const COLORS = {
  oversubscribed: 0xd03b3b,
  "cap-breach": 0xec835a,
  executed: 0x3987e5,
  zero: 0x454c5b,
  "no-filing": 0x333947,
  plane: 0x9085e9,
  floor: 0x1a2030,
};

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function makeRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  return renderer;
}

/* Pause rendering when the canvas is offscreen; resize with the container. */
function runLoop(container, renderer, tick) {
  let visible = true, raf = 0;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  }, { threshold: 0.02 });
  io.observe(container);
  const clock = new THREE.Clock();
  function loop() {
    raf = 0;
    if (!visible) return;
    tick(clock.getDelta(), clock.elapsedTime);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    if (w && h) { renderer.setSize(w, h); tick.onResize?.(w / h); }
  }).observe(container);
}

/* Minimal orbit control: drag to rotate, wheel to zoom, inertia, idle auto-spin. */
function orbit(dom, opts = {}) {
  const s = {
    theta: opts.theta ?? 0.9, phi: opts.phi ?? 1.12,
    dist: opts.dist ?? 46, target: opts.target ?? new THREE.Vector3(0, 3, 0),
    vTheta: 0, dragging: false, lastX: 0, lastY: 0, idle: 0,
    min: opts.min ?? 18, max: opts.max ?? 90,
  };
  dom.style.touchAction = "pan-y";
  dom.addEventListener("pointerdown", (e) => { s.dragging = true; s.lastX = e.clientX; s.lastY = e.clientY; s.idle = 0; dom.setPointerCapture(e.pointerId); });
  dom.addEventListener("pointermove", (e) => {
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX, dy = e.clientY - s.lastY;
    s.lastX = e.clientX; s.lastY = e.clientY;
    s.theta -= dx * 0.006; s.vTheta = -dx * 0.006;
    s.phi = Math.max(0.35, Math.min(1.45, s.phi - dy * 0.005));
  });
  const end = () => { s.dragging = false; };
  dom.addEventListener("pointerup", end); dom.addEventListener("pointercancel", end);
  dom.addEventListener("wheel", (e) => { e.preventDefault(); s.dist = Math.max(s.min, Math.min(s.max, s.dist + e.deltaY * 0.05)); s.idle = 0; }, { passive: false });
  s.apply = (camera, dt) => {
    if (!s.dragging) {
      s.vTheta *= 0.94; s.theta += s.vTheta;
      s.idle += dt;
      if (s.idle > 2.5 && !reduceMotion()) s.theta += dt * (opts.autoSpin ?? 0.07);
    }
    camera.position.set(
      s.target.x + s.dist * Math.sin(s.phi) * Math.sin(s.theta),
      s.target.y + s.dist * Math.cos(s.phi),
      s.target.z + s.dist * Math.sin(s.phi) * Math.cos(s.theta),
    );
    camera.lookAt(s.target);
  };
  return s;
}

/* ============================ market hero ============================ */
export function marketHero(container, funds, { onSelect, tipEl } = {}) {
  const renderer = makeRenderer(container);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0e14, 60, 130);
  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 300);

  scene.add(new THREE.AmbientLight(0x8899bb, 0.55));
  const key = new THREE.DirectionalLight(0xdfe8ff, 1.5); key.position.set(18, 30, 12); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9085e9, 0.8); rim.position.set(-24, 14, -18); scene.add(rim);

  // floor
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(34, 34, 0.5, 64),
    new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.85, metalness: 0.3 }),
  );
  floor.position.y = -0.25; scene.add(floor);
  const grid = new THREE.GridHelper(66, 22, 0x2a3145, 0x1c2230);
  grid.position.y = 0.02; scene.add(grid);

  // layout: sorted by demand, wound into a spiral so the giants anchor the center
  const cycled = funds.filter((f) => f.dateOfTender !== null).sort((a, b) => b.pctOutstanding - a.pctOutstanding);
  const ghosts = funds.filter((f) => f.dateOfTender === null);
  const H = (pct) => 0.35 + Math.sqrt(pct) * 2.3;
  const CAP_H = H(5.0);

  const pickable = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  cycled.forEach((f, i) => {
    const r = 3.2 + 4.1 * Math.sqrt(i);
    const a = i * golden;
    const h = H(f.pctOutstanding);
    const geo = new THREE.BoxGeometry(2.1, h, 2.1);
    geo.translate(0, h / 2, 0);
    const over = f.status.id === "oversubscribed";
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS[f.status.id] ?? COLORS.executed,
      roughness: 0.38, metalness: 0.45,
      emissive: COLORS[f.status.id] ?? 0x000000,
      emissiveIntensity: over ? 0.34 : 0.10,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    m.userData = { fund: f, baseEmissive: mat.emissiveIntensity, phase: Math.random() * Math.PI * 2 };
    scene.add(m); pickable.push(m);
  });
  // never-filed funds: hollow wireframe markers on the rim
  ghosts.forEach((f, i) => {
    const a = (i / ghosts.length) * Math.PI * 2 + 0.5;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.8, 1.8),
      new THREE.MeshBasicMaterial({ color: 0x4a5266, wireframe: true }),
    );
    m.position.set(Math.cos(a) * 30, 0.9, Math.sin(a) * 30);
    m.userData = { fund: f, ghost: true };
    scene.add(m); pickable.push(m);
  });

  // the floodgate: a translucent plane at the 5% cap — columns piercing it are oversubscribed
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(33, 33, 0.08, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.plane, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  cap.position.y = CAP_H; scene.add(cap);
  const capRing = new THREE.Mesh(
    new THREE.TorusGeometry(33, 0.07, 8, 128),
    new THREE.MeshBasicMaterial({ color: COLORS.plane, transparent: true, opacity: 0.6 }),
  );
  capRing.rotation.x = Math.PI / 2; capRing.position.y = CAP_H; scene.add(capRing);

  // ambient dust
  const dustGeo = new THREE.BufferGeometry();
  const dustN = 360, dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 90;
    dustPos[i * 3 + 1] = Math.random() * 26;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x5a6580, size: 0.12, transparent: true, opacity: 0.5 }));
  scene.add(dust);

  const ctl = orbit(renderer.domElement, { dist: 52, autoSpin: 0.06 });
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hovered = null, moved = false, downAt = 0;

  renderer.domElement.addEventListener("pointermove", (e) => {
    const b = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - b.left) / b.width) * 2 - 1;
    mouse.y = -((e.clientY - b.top) / b.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(pickable)[0];
    const m = hit?.object ?? null;
    if (hovered && hovered !== m && !hovered.userData.ghost) hovered.material.emissiveIntensity = hovered.userData.baseEmissive;
    hovered = m;
    if (m && tipEl) {
      if (!m.userData.ghost) m.material.emissiveIntensity = 0.75;
      const f = m.userData.fund;
      tipEl.replaceChildren();
      const st = document.createElement("strong"); st.textContent = f.name; tipEl.appendChild(st);
      const sp = document.createElement("span");
      sp.textContent = f.dateOfTender === null
        ? "No completed tender cycle on file"
        : `Tendered ${f.pctOutstanding.toFixed(2)}% of outstanding · cap ${f.floodgate.toFixed(1)}% · repurchased ${f.repurchasePct.toFixed(2)}%`;
      tipEl.appendChild(sp);
      tipEl.style.display = "block";
      const pad = 14;
      let tx = e.clientX - b.left + pad, ty = e.clientY - b.top + pad;
      if (tx + 230 > b.width) tx = e.clientX - b.left - 230;
      if (ty + 70 > b.height) ty = e.clientY - b.top - 70;
      tipEl.style.left = tx + "px"; tipEl.style.top = ty + "px";
      renderer.domElement.style.cursor = "pointer";
    } else if (tipEl) {
      tipEl.style.display = "none";
      renderer.domElement.style.cursor = "grab";
    }
  });
  renderer.domElement.addEventListener("pointerleave", () => { if (tipEl) tipEl.style.display = "none"; });
  renderer.domElement.addEventListener("pointerdown", () => { moved = false; downAt = Date.now(); });
  renderer.domElement.addEventListener("pointermove", () => { if (Date.now() - downAt > 120) moved = true; });
  renderer.domElement.addEventListener("click", () => { if (!moved && hovered && onSelect) onSelect(hovered.userData.fund); });

  const tick = (dt, t) => {
    ctl.apply(camera, dt);
    capRing.material.opacity = 0.45 + Math.sin(t * 1.6) * 0.15;
    for (const m of pickable) {
      if (m.userData.ghost) { m.rotation.y += dt * 0.4; continue; }
      const f = m.userData.fund;
      if (f.status.id === "oversubscribed" && m !== hovered) {
        m.material.emissiveIntensity = m.userData.baseEmissive + Math.sin(t * 2 + m.userData.phase) * 0.1;
      }
    }
    dust.rotation.y += dt * 0.008;
    renderer.render(scene, camera);
  };
  tick.onResize = (aspect) => { camera.aspect = aspect; camera.updateProjectionMatrix(); };
  runLoop(container, renderer, tick);
}

/* ============================ per-fund gate scene ============================ */
export function gateScene(container, fund) {
  const renderer = makeRenderer(container);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0e14, 40, 95);
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);

  scene.add(new THREE.AmbientLight(0x8899bb, 0.6));
  const key = new THREE.DirectionalLight(0xdfe8ff, 1.3); key.position.set(10, 18, 14); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9085e9, 0.7); rim.position.set(-14, 8, -10); scene.add(rim);

  const rep = (fund.repurchasePct ?? 100) / 100;
  const hasFlow = fund.dateOfTender !== null && fund.sharesTendered > 0;

  // the floodgate wall at x = 0, with an aperture sized by the repurchase rate
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2e3850, roughness: 0.45, metalness: 0.55 });
  const wallH = 12, wallD = 18;
  const apertureH = Math.max(1.2, rep * (wallH - 2));
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, wallH - apertureH, wallD), wallMat);
  top.position.set(0, apertureH + (wallH - apertureH) / 2, 0);
  scene.add(top);
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x9085e9, transparent: true, opacity: 0.85 });
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, wallD), frameMat);
  lip.position.set(0, apertureH, 0); scene.add(lip);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(60, 0.4, wallD + 4),
    new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.85, metalness: 0.3 }),
  );
  floor.position.y = -0.2; scene.add(floor);
  const grid = new THREE.GridHelper(60, 20, 0x2a3145, 0x1c2230);
  grid.position.y = 0.02; scene.add(grid);

  // particles: each is one "slice" of the tendered shares
  const N = 420;
  const passN = Math.round(N * rep);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const vel = new Float32Array(N);
  const pass = new Uint8Array(N);
  const cPass = new THREE.Color(0x199e70), cBlock = new THREE.Color(0xd03b3b);
  const frozen = reduceMotion() || !hasFlow;
  for (let i = 0; i < N; i++) {
    pass[i] = i < passN ? 1 : 0;
    respawn(i, true);
    // seed the scene mid-flow so it reads instantly (and stays put under reduced motion)
    pos[i * 3] = pass[i] ? -30 + Math.random() * 58 : Math.random() < 0.5 ? -1.2 - (i % 40) * 0.14 - Math.random() * 3 : -8 - Math.random() * 24;
    const c = pass[i] ? cPass : cBlock;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  function respawn(i, initial = false) {
    pos[i * 3] = -30 - Math.random() * (initial ? 26 : 6);
    pos[i * 3 + 1] = 0.4 + Math.random() * (apertureH * 0.85);
    pos[i * 3 + 2] = (Math.random() - 0.5) * (wallD - 2);
    vel[i] = 4.5 + Math.random() * 4;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true }));
  if (hasFlow) scene.add(pts);

  // camera on the +z side so both the queue (left of the gate) and the escapees (right) are visible
  const ctl = orbit(renderer.domElement, { dist: 38, theta: 0.35, phi: 1.18, target: new THREE.Vector3(-2, 3.2, 0), autoSpin: 0.04, min: 16, max: 70 });

  const tick = (dt) => {
    ctl.apply(camera, dt);
    if (!frozen) {
      for (let i = 0; i < N; i++) {
        let x = pos[i * 3] + vel[i] * dt;
        if (pass[i]) {
          if (x > 30) { respawn(i); continue; }
        } else {
          // refused shares stack up just before the gate
          const stop = -1.2 - (i % 40) * 0.14;
          if (x > stop) {
            x = stop;
            pos[i * 3 + 1] += Math.sin(performance.now() * 0.002 + i) * 0.002; // restless queue
            if (Math.random() < dt * 0.05) { respawn(i); continue; } // occasionally re-tenders
          }
        }
        pos[i * 3] = x;
      }
      geo.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  };
  tick.onResize = (aspect) => { camera.aspect = aspect; camera.updateProjectionMatrix(); };
  runLoop(container, renderer, tick);
}
