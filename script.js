// ═══════════════════════════════════════════════
// CONSTANTS & STATE
// ═══════════════════════════════════════════════
const S0 = 1.0; // Proper ship length (light-years)

const state = {
  t: 0.0,
  a: 0.8,
  L_gap: 3.0,
  breakStrain: 0.02, // 2% strain for steel cable tolerance
  aA: 0.0, // Cable attachment offset for Ship A (-0.5=back, 0=center, 0.5=front)
  aB: 0.0, // Cable attachment offset for Ship B
  scenario: "bell", // 'bell' | 'tow'
  isPlaying: false,
  speed: 1.0,
  maxT: 6.0,
  view: "lab",
};

// ═══════════════════════════════════════════════
// STAR FIELD (generated once)
// ═══════════════════════════════════════════════
const NSTARS = 130;
const STARS = Array.from({ length: NSTARS }, () => ({
  fx: Math.random(),
  fy: Math.random(),
  r: Math.random() * 1.1 + 0.2,
  b: Math.random() * 0.55 + 0.15,
  tw: Math.random() * Math.PI * 2,
  d: Math.random() * 0.8 + 0.2,
}));

// ═══════════════════════════════════════════════
// DOM CACHE
// ═══════════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const el = {
  canvas: $("simCanvas"),
  ctx: $("simCanvas").getContext("2d"),

  slT: $("sl-t"),
  slA: $("sl-a"),
  slGap: $("sl-gap"),
  slBreak: $("sl-break"),
  valT: $("val-t"),
  valA: $("val-a"),
  valGap: $("val-gap"),
  valBreak: $("val-break"),

  btnPlay: $("btn-play"),
  btnReset: $("btn-reset"),

  selAA: $("sel-aA"),
  selAB: $("sel-aB"),

  badgeGamma: $("badge-gamma"),
  badgeV: $("badge-v"),
  badgeTau: $("badge-tau"),
  scenarioBadge: $("scenario-badge"),

  eqV: $("eq-v"),
  eqGamma: $("eq-gamma"),
  eqTau: $("eq-tau"),
  eqSlab: $("eq-slab"),
  eqLabgap: $("eq-labgap"),
  eqLabgapLabel: $("eq-labgap-label"),
  eqLabgapTag: $("eq-labgap-tag"),
  eqLabgapFormula: $("eq-labgap-formula"),
  eqPropgap: $("eq-propgap"),
  eqPropgapTag: $("eq-propgap-tag"),
  eqPropgapFormula: $("eq-propgap-formula"),
  eqLinit: $("eq-linit"),
  eqRlab: $("eq-rlab"),
  eqRlabFormula: $("eq-rlab-formula"),
  eqRprop: $("eq-rprop"),
  eqStretch: $("eq-stretch"),
  eqStretchFormula: $("eq-stretch-formula"),
  eqStrain: $("eq-strain"),
  eqMechDivider: $("eq-mech-divider"),
  eqMechLabel: $("eq-mech-label"),
  eqMech: $("eq-mech"),

  insightTitle: $("insight-title"),
  insightEq: $("insight-eq"),
  insightSub: $("insight-sub"),

  svStrain: $("sv-strain"),
  svStrainLabel: $("sv-strain-label"),
  svBreak: $("sv-break"),
  svStretch: $("sv-stretch"),
  statusBadge: $("status-badge"),
  strainFill: $("strain-fill"),
  towExtra: $("tow-extra"),
  svMechLoad: $("sv-mech-load"),
  svTowGap: $("sv-tow-gap"),
};

// Canvas dimensions
let CW = 0,
  CH = 400;
let lastTime = 0,
  animId = null;

// ═══════════════════════════════════════════════
// PHYSICS
// ═══════════════════════════════════════════════

// Get proper time for a point at proper distance x_local from the center
function getLocalTau(a_center, x_local, t) {
  let denom = 1.0 + a_center * x_local;
  if (denom <= 0.001) return null; // Beyond Rindler horizon!
  let a_local = a_center / denom;
  return Math.asinh(a_local * t) / a_local;
}

function computeBell() {
  const { t, a, L_gap, aA, aB } = state;
  const at = a * t;
  const gamma = Math.sqrt(1.0 + at * at);
  const v = at / gamma;
  const tau = Math.asinh(at) / a;
  const S_lab = S0 / gamma;
  const x_disp = (gamma - 1.0) / a;

  const C_A = x_disp;
  const C_B = x_disp + L_gap;

  const E_A = C_A - 0.5 * S_lab;
  const E_B = C_B - 0.5 * S_lab;

  const P_A = C_A + aA * S_lab;
  const P_B = C_B + aB * S_lab;

  const cable_lab = P_B - P_A;
  const cable_prop = cable_lab * gamma;
  const L_init = L_gap + (aB - aA) * S0;

  const stretch = L_gap * (gamma - 1.0);
  const strain = stretch / L_init;
  const isBroken = strain > state.breakStrain;

  // Clocks for Bell's Mode (Ships have identical proper acceleration)
  const tau_A_back = getLocalTau(a, -0.5 * S0, t);
  const tau_A_front = getLocalTau(a, 0.5 * S0, t);
  const tau_B_back = getLocalTau(a, -0.5 * S0, t);
  const tau_B_front = getLocalTau(a, 0.5 * S0, t);
  const tau_cable = getLocalTau(a, 0, t); // Cable center approx

  return {
    scenario: "bell",
    gamma,
    v,
    tau,
    S_lab,
    C_A,
    C_B,
    E_A,
    E_B,
    P_A,
    P_B,
    lab_gap: L_gap,
    prop_gap: gamma * L_gap,
    cable_lab,
    cable_prop,
    L_init,
    stretch,
    strain,
    isBroken,
    tau_A_back,
    tau_A_front,
    tau_B_back,
    tau_B_front,
    tau_cable,
  };
}

function computeTow() {
  const { t, a, L_gap, aA, aB } = state;
  const at = a * t;
  const gamma = Math.sqrt(1.0 + at * at);
  const v = at / gamma;
  const tau = Math.asinh(at) / a;
  const S_lab = S0 / gamma;

  const labGap = L_gap / gamma;
  const x_disp = (gamma - 1.0) / a;

  const C_A = x_disp;
  const C_B = x_disp + labGap;

  const E_A = null;
  const E_B = C_B - 0.5 * S_lab;

  const P_A = C_A + aA * S_lab;
  const P_B = C_B + aB * S_lab;

  const cable_lab = P_B - P_A;
  const cable_prop = cable_lab * gamma;
  const L_init = L_gap + (aB - aA) * S0;

  const stretch = 0.0;
  const strain = 0.0;
  const isBroken = false;
  const mechTension = 1.0;

  // Clocks for Tow Mode (Born Rigid system, Ship B is reference)
  const tau_B_back = getLocalTau(a, -0.5 * S0, t);
  const tau_B_front = getLocalTau(a, 0.5 * S0, t);
  // Ship A is at proper distance -L_gap relative to Ship B
  const tau_A_back = getLocalTau(a, -L_gap - 0.5 * S0, t);
  const tau_A_front = getLocalTau(a, -L_gap + 0.5 * S0, t);
  const tau_cable = getLocalTau(a, -L_gap / 2, t);

  return {
    scenario: "tow",
    gamma,
    v,
    tau,
    S_lab,
    C_A,
    C_B,
    E_A,
    E_B,
    P_A,
    P_B,
    lab_gap: labGap,
    prop_gap: L_gap,
    cable_lab,
    cable_prop,
    L_init,
    stretch,
    strain,
    isBroken,
    mechTension,
    tau_A_back,
    tau_A_front,
    tau_B_back,
    tau_B_front,
    tau_cable,
  };
}

function compute() {
  return state.scenario === "tow" ? computeTow() : computeBell();
}

// ═══════════════════════════════════════════════
// CANVAS SETUP
// ═══════════════════════════════════════════════
function resizeCanvas() {
  const rect = el.canvas.parentElement.getBoundingClientRect();
  CW = rect.width;
  // Increase CH slightly to accommodate the new layout (clocks below ships)
  CH = Math.min(800, Math.max(450, Math.round(CW * 0.55)));
  const dpr = window.devicePixelRatio || 1;
  el.canvas.width = CW * dpr;
  el.canvas.height = CH * dpr;
  el.canvas.style.width = `${CW}px`;
  el.canvas.style.height = `${CH}px`;
  el.ctx.setTransform(1, 0, 0, 1, 0, 0);
  el.ctx.scale(dpr, dpr);
  updateAll();
}

// Steel cable color logic (Silver to Red-Hot)
function cableColor(ratio) {
  ratio = Math.max(0, Math.min(1, ratio));
  // Start: Metallic Silver (160, 176, 192)
  // End: Stressed Red-Hot (255, 80, 48)
  const r = Math.round(160 + (255 - 160) * ratio);
  const g = Math.round(176 + (80 - 176) * ratio);
  const b = Math.round(192 + (48 - 192) * ratio);
  return [r, g, b];
}

// UI strain bar color (Green -> Yellow -> Red)
function uiStrainColor(ratio) {
  ratio = Math.max(0, Math.min(1, ratio));
  let r, g, b;
  if (ratio < 0.55) {
    const s = ratio / 0.55;
    r = Math.round(80 + (248 - 80) * s);
    g = Math.round(232 + (208 - 232) * s);
    b = Math.round(178 + (80 - 178) * s);
  } else {
    const s = (ratio - 0.55) / 0.45;
    r = Math.round(248 + (255 - 248) * s);
    g = Math.round(208 + (104 - 208) * s);
    b = Math.round(80 + (104 - 80) * s);
  }
  return [r, g, b];
}

// ═══════════════════════════════════════════════
// UI DRAWING HELPERS
// ═══════════════════════════════════════════════
function drawClock(
  ctx,
  px,
  py,
  targetX,
  targetY,
  timeVal,
  label,
  color,
  dScale,
) {
  // Determine if clock is above or below the target to prevent line crossing the box
  const boxTop = py - 12 * dScale;
  const boxBottom = py + 12 * dScale;
  const lineStartY = py < targetY ? boxBottom : boxTop;

  // Draw angled callout line to target
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(px, lineStartY);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // Draw box
  ctx.fillStyle = "rgba(10, 18, 30, 0.95)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 * dScale;
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(
      px - 30 * dScale,
      boxTop,
      60 * dScale,
      24 * dScale,
      4 * dScale,
    );
  else ctx.rect(px - 30 * dScale, boxTop, 60 * dScale, 24 * dScale);
  ctx.fill();
  ctx.stroke();

  // Draw text
  ctx.font = `700 ${Math.max(9, Math.round(11 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  if (timeVal === null) {
    ctx.fillStyle = "#ff6868"; // Red warning
    ctx.fillText("HORIZON", px, py + 4 * dScale);
  } else {
    ctx.fillStyle = color;
    ctx.fillText(timeVal.toFixed(3) + "y", px, py + 4 * dScale);
  }

  // Draw label
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = `${Math.max(7, Math.round(8 * dScale))}px 'Space Mono', monospace`;
  ctx.fillText(label, px, py - 16 * dScale);
}

// ═══════════════════════════════════════════════
// RENDER — DISPATCH
// ═══════════════════════════════════════════════
function render(phys) {
  if (state.view === "lab") renderLab(phys);
  else renderProper(phys);
}

// ═══════════════════════════════════════════════
// INERTIAL OBSERVER (LAB) FRAME RENDER
// ═══════════════════════════════════════════════
function renderLab(phys) {
  const ctx = el.ctx;
  const {
    gamma,
    v,
    S_lab,
    C_A,
    C_B,
    E_A,
    E_B,
    P_A,
    P_B,
    strain,
    isBroken,
    scenario,
  } = phys;
  ctx.clearRect(0, 0, CW, CH);

  // Dynamic Scaling Factor (30% boost base)
  const dScale = (CW / 800) * 1.35;

  ctx.fillStyle = "#0a1018";
  ctx.fillRect(0, 0, CW, CH);
  const bg = ctx.createRadialGradient(CW / 2, 0, 0, CW / 2, CH, CH);
  bg.addColorStop(0, "rgba(10,28,68,0.5)");
  bg.addColorStop(0.6, "rgba(4,10,22,0)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  const minScene = 8.0;
  const neededScene = state.L_gap * 1.1 + S0 * 2.8;
  const sceneUnits = Math.max(minScene, neededScene);
  const scale = CW / sceneUnits;

  const camX = (C_A + C_B) / 2;
  const toSX = (x) => (x - camX) * scale + CW / 2;
  const cy = Math.round(CH * 0.42); // Moved up slightly to give room for clocks
  const now = performance.now();

  for (const s of STARS) {
    const parallaxPx = (camX * scale * s.d * 0.18) % CW;
    const sx = (((s.fx * CW - parallaxPx) % CW) + CW) % CW;
    const sy = s.fy * CH;
    const tw = 0.75 + 0.25 * Math.sin(now * 0.0008 + s.tw);
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(185,215,255,${s.b * tw})`;
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.02)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const g0 = Math.floor(camX - sceneUnits / 2 - 1);
  const g1 = Math.ceil(camX + sceneUnits / 2 + 1);
  for (let i = g0; i <= g1; i += 0.5) {
    const sx = toSX(i);
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, CH);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(86,197,240,0.055)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(CW, cy);
  ctx.stroke();

  const sh = 38 * dScale; // Scaled ship height

  function drawShip(cx_phys, ePosPhys, pPosPhys, color, label, hasEngine) {
    const sw = Math.max(5 * dScale, S_lab * scale);
    const sx = toSX(cx_phys) - sw / 2;
    const sy = cy - sh / 2;
    const esx = toSX(ePosPhys);
    const psx = toSX(pPosPhys);

    if (hasEngine) {
      const flicker =
        Math.sin(now * 0.055 + (label === "A" ? 0 : 1.8)) * 2.5 +
        Math.sin(now * 0.022 + (label === "A" ? 0 : 2.5)) * 1.8;
      const flameLen = Math.max(2, 6 + v * 55 + flicker) * dScale;

      const fg = ctx.createLinearGradient(esx, cy, esx - flameLen, cy);
      fg.addColorStop(0, "rgba(70,210,255,0.92)");
      fg.addColorStop(0.45, "rgba(70,210,255,0.28)");
      fg.addColorStop(1, "rgba(70,210,255,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(esx, cy - 7 * dScale);
      ctx.lineTo(esx - flameLen, cy);
      ctx.lineTo(esx, cy + 7 * dScale);
      ctx.closePath();
      ctx.fill();

      const ig = ctx.createRadialGradient(esx, cy, 0, esx, cy, 11 * dScale);
      ig.addColorStop(0, "rgba(110,230,255,0.75)");
      ig.addColorStop(1, "rgba(110,230,255,0)");
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(esx, cy, 11 * dScale, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(102,229,255,0.35)";
      ctx.lineWidth = 1.5 * dScale;
      ctx.setLineDash([2 * dScale, 3 * dScale]);
      ctx.beginPath();
      ctx.moveTo(esx, cy - 5 * dScale);
      ctx.lineTo(esx, cy + 5 * dScale);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "#07101e";
    ctx.beginPath();
    if (ctx.roundRect)
      ctx.roundRect(sx, sy, sw, sh, [
        3 * dScale,
        7 * dScale,
        7 * dScale,
        3 * dScale,
      ]);
    else ctx.rect(sx, sy, sw, sh);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * dScale;
    ctx.shadowColor = color;
    ctx.shadowBlur = 7 * dScale;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const noseX = toSX(cx_phys) + sw / 2;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(noseX - 1 * dScale, sy + 3 * dScale);
    ctx.lineTo(noseX + 9 * dScale, cy);
    ctx.lineTo(noseX - 1 * dScale, sy + sh - 3 * dScale);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1 * dScale;
    ctx.beginPath();
    ctx.moveTo(sx + 4 * dScale, sy + sh * 0.28);
    ctx.lineTo(noseX - 1 * dScale, sy + sh * 0.28);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    const ry = cy - 55 * dScale;
    const pylonTop = ry;
    const pylonBot = sy - 4 * dScale;
    ctx.strokeStyle = "#243f5e";
    ctx.lineWidth = 3 * dScale;
    ctx.beginPath();
    ctx.moveTo(psx, pylonBot);
    ctx.lineTo(psx, pylonTop);
    ctx.stroke();

    ctx.fillStyle = "#d8ecff";
    ctx.shadowColor = "#90ccff";
    ctx.shadowBlur = 5 * dScale;
    ctx.beginPath();
    ctx.arc(psx, pylonTop, 3.5 * dScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const hasEngineA = scenario === "bell";
  const hasEngineB = true;

  // Draw clocks and callout lines FIRST (so they sit behind ship labels)
  const clockY = cy + sh / 2 + 65 * dScale;
  const targetY = cy + sh / 2;

  // Calculate clock positions to prevent overlap
  const sxCA = toSX(C_A);
  const sxCB = toSX(C_B);
  const clockOffset = 38 * dScale;

  drawClock(
    ctx,
    sxCA - clockOffset,
    clockY,
    toSX(C_A - S_lab / 2),
    targetY,
    phys.tau_A_back,
    "A-REAR τ",
    "#ffb866",
    dScale,
  );
  drawClock(
    ctx,
    sxCA + clockOffset,
    clockY,
    toSX(C_A + S_lab / 2),
    targetY,
    phys.tau_A_front,
    "A-FRONT τ",
    "#ffb866",
    dScale,
  );
  drawClock(
    ctx,
    sxCB - clockOffset,
    clockY,
    toSX(C_B - S_lab / 2),
    targetY,
    phys.tau_B_back,
    "B-REAR τ",
    "#66e5ff",
    dScale,
  );
  drawClock(
    ctx,
    sxCB + clockOffset,
    clockY,
    toSX(C_B + S_lab / 2),
    targetY,
    phys.tau_B_front,
    "B-FRONT τ",
    "#66e5ff",
    dScale,
  );

  // Draw Ships
  drawShip(
    C_A,
    E_A !== null ? E_A : C_A - 0.5 * S_lab,
    P_A,
    "#ffb866",
    "A",
    hasEngineA,
  );
  drawShip(C_B, E_B, P_B, "#66e5ff", "B", hasEngineB);

  // Draw Ship Labels (on top of clock lines)
  ctx.fillStyle = "#ffb866";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP A`, sxCA, cy + sh / 2 + 18 * dScale);
  ctx.fillStyle = "rgba(150,200,245,0.55)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'Space Mono', monospace`;
  ctx.fillText(`|← L₀/γ →|`, sxCA, cy + sh / 2 + 32 * dScale);

  ctx.fillStyle = "#66e5ff";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP B`, sxCB, cy + sh / 2 + 18 * dScale);
  ctx.fillStyle = "rgba(150,200,245,0.55)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'Space Mono', monospace`;
  ctx.fillText(`|← L₀/γ →|`, sxCB, cy + sh / 2 + 32 * dScale);

  // ── STEEL CABLE ──
  const rxA = toSX(P_A);
  const rxB = toSX(P_B);
  const ry = cy - 55 * dScale;
  const ratio = Math.min(1.0, strain / state.breakStrain);
  const midX = (rxA + rxB) / 2;

  // Cable thickness scales with tolerance slider (stronger = thicker)
  const thicknessMultiplier = 1 + state.breakStrain / 0.02;
  const baseThick = 1.5 * dScale;
  const cableThick =
    scenario === "tow"
      ? baseThick * thicknessMultiplier
      : baseThick * thicknessMultiplier;

  if (!isBroken) {
    const [r, g, b] = scenario === "tow" ? [120, 180, 220] : cableColor(ratio);

    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = cableThick;
    ctx.shadowColor = `rgb(${r},${g},${b})`;
    ctx.shadowBlur =
      scenario === "tow"
        ? 4 * dScale
        : ratio > 0.45
          ? (4 + ratio * 8) * dScale
          : 2 * dScale;
    ctx.beginPath();
    ctx.moveTo(rxA, ry);
    ctx.lineTo(rxB, ry);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (scenario === "tow") {
      ctx.fillStyle = "rgba(120,180,220,0.8)";
      ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'Space Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText("MECHANICAL TENSION", midX, ry - 14 * dScale);
    }

    // Cable Clock (Moved higher to prevent overlap with text)
    drawClock(
      ctx,
      midX,
      ry - 44 * dScale,
      midX,
      ry,
      phys.tau_cable,
      "CABLE τ",
      `rgb(${r},${g},${b})`,
      dScale,
    );
  } else {
    ctx.strokeStyle = "#ff6868";
    ctx.lineWidth = cableThick;
    ctx.shadowColor = "#ff6868";
    ctx.shadowBlur = 10 * dScale;
    ctx.beginPath();
    ctx.moveTo(rxA, ry);
    ctx.bezierCurveTo(
      rxA + 20 * dScale,
      ry + 5 * dScale,
      midX - 30 * dScale,
      ry + 22 * dScale,
      midX - 10 * dScale,
      ry + 26 * dScale,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rxB, ry);
    ctx.bezierCurveTo(
      rxB - 20 * dScale,
      ry + 5 * dScale,
      midX + 30 * dScale,
      ry + 22 * dScale,
      midX + 10 * dScale,
      ry + 26 * dScale,
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    const t_s = now * 0.001;
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + t_s * 0.6;
      const dist = (4 + Math.sin(t_s * 1.8 + i * 0.9) * 9 + i * 1.5) * dScale;
      const px = midX + Math.cos(angle) * dist;
      const py = ry + 18 * dScale + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(255,${90 + i * 16},0,${0.65 - i * 0.05})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.5 * dScale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ff6868";
    ctx.font = `700 ${Math.max(11, Math.round(13 * dScale))}px 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff6868";
    ctx.shadowBlur = 12 * dScale;
    ctx.fillText("CABLE SNAPPED", midX, ry - 16 * dScale);
    ctx.shadowBlur = 0;
  }

  // ── Gap bracket ──
  const bY = cy + 115 * dScale; // Pushed down to make room for clocks

  const gapColor =
    scenario === "tow" ? "rgba(102,229,255,0.3)" : "rgba(86,197,240,0.28)";
  const gapTextColor =
    scenario === "tow" ? "rgba(102,229,255,0.7)" : "rgba(86,197,240,0.55)";

  ctx.strokeStyle = gapColor;
  ctx.lineWidth = 1.5 * dScale;
  ctx.setLineDash([4 * dScale, 5 * dScale]);
  ctx.beginPath();
  ctx.moveTo(sxCA, bY);
  ctx.lineTo(sxCB, bY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(sxCA, bY - 5 * dScale);
  ctx.lineTo(sxCA, bY + 5 * dScale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sxCB, bY - 5 * dScale);
  ctx.lineTo(sxCB, bY + 5 * dScale);
  ctx.stroke();

  ctx.fillStyle = gapTextColor;
  ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  const gapLabel =
    scenario === "tow"
      ? `D/γ = ${phys.lab_gap.toFixed(3)} L (contracting)`
      : `D = ${state.L_gap.toFixed(1)} L (constant in lab)`;
  ctx.fillText(gapLabel, (sxCA + sxCB) / 2, bY + 18 * dScale);

  ctx.fillStyle = "rgba(86,197,240,0.35)";
  ctx.font = `700 ${Math.max(8, Math.round(10 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText(
    "OBSERVER (LAB) FRAME — ships moving right",
    10 * dScale,
    CH - 10 * dScale,
  );
}

// ═══════════════════════════════════════════════
// SHIPS' COMOVING FRAME RENDER
// ═══════════════════════════════════════════════
function renderProper(phys) {
  const ctx = el.ctx;
  const { gamma, v, strain, isBroken, cable_prop, L_init, stretch, scenario } =
    phys;
  ctx.clearRect(0, 0, CW, CH);

  const dScale = (CW / 800) * 1.35;

  // Doppler Shift Background (Redshift rear, Blueshift front)
  const dopplerGradient = ctx.createLinearGradient(0, 0, CW, 0);
  dopplerGradient.addColorStop(
    0,
    `rgba(${12 + 150 * v}, ${32 - 20 * v}, ${72 - 40 * v}, ${0.45 + 0.2 * v})`,
  );
  dopplerGradient.addColorStop(0.5, `rgba(12, 32, 72, 0.45)`);
  dopplerGradient.addColorStop(
    1,
    `rgba(${12 - 10 * v}, ${32 + 50 * v}, ${72 + 150 * v}, ${0.45 + 0.2 * v})`,
  );
  ctx.fillStyle = dopplerGradient;
  ctx.fillRect(0, 0, CW, CH);

  const now = performance.now();
  for (const s of STARS) {
    const tw = 0.75 + 0.25 * Math.sin(now * 0.0008 + s.tw);
    ctx.beginPath();
    ctx.arc(s.fx * CW, s.fy * CH, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(185,215,255,${s.b * tw * 0.55})`;
    ctx.fill();
  }

  const properGap = phys.prop_gap;
  const BASE_PROPER = 8.0;
  const neededProper = properGap + S0 * 3.2;
  const totalW = Math.max(BASE_PROPER, neededProper);
  const scaleP = CW / totalW;
  const camX_p = properGap / 2;
  const toSX = (x) => (x - camX_p) * scaleP + CW / 2;
  const cy = Math.round(CH * 0.42);
  const sh = 38 * dScale;
  const sw = S0 * scaleP; // Ships at PROPER length

  ctx.strokeStyle = "rgba(86,197,240,0.055)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(CW, cy);
  ctx.stroke();

  const A_cx = 0.0;
  const B_cx = properGap;

  const PA_proper = state.aA * S0;
  const PB_proper = properGap + state.aB * S0;
  const psx_A = toSX(PA_proper);
  const psx_B = toSX(PB_proper);
  const ry = cy - 55 * dScale;

  const halfNat = (L_init * scaleP) / 2;
  const midPx = (psx_A + psx_B) / 2;

  // L0 natural length indicator (moved down slightly from cable)
  ctx.strokeStyle = "rgba(160,176,192,0.22)";
  ctx.lineWidth = 1.8 * dScale;
  ctx.setLineDash([5 * dScale, 6 * dScale]);
  ctx.beginPath();
  ctx.moveTo(midPx - halfNat, ry - 11 * dScale);
  ctx.lineTo(midPx + halfNat, ry - 11 * dScale);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(160,176,192,0.35)";
  ctx.lineWidth = 1 * dScale;
  ctx.beginPath();
  ctx.moveTo(midPx - halfNat, ry - 16 * dScale);
  ctx.lineTo(midPx - halfNat, ry - 6 * dScale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(midPx + halfNat, ry - 16 * dScale);
  ctx.lineTo(midPx + halfNat, ry - 6 * dScale);
  ctx.stroke();
  ctx.fillStyle = "rgba(160,176,192,0.65)";
  ctx.font = `${Math.max(9, Math.round(10 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(
    `L₀ = ${L_init.toFixed(3)} L (natural)`,
    midPx,
    ry - 18 * dScale,
  );

  function drawProperShip(cx, color, label, hasEngine) {
    const sxL = toSX(cx) - sw / 2;
    const sy = cy - sh / 2;
    const esx = sxL;

    if (hasEngine) {
      const flicker = Math.sin(now * 0.055 + (label === "A" ? 0 : 1.8)) * 2.5;
      const flameLen = (15 + flicker) * dScale;

      const fg = ctx.createLinearGradient(esx, cy, esx - flameLen, cy);
      fg.addColorStop(0, "rgba(70,210,255,0.92)");
      fg.addColorStop(0.45, "rgba(70,210,255,0.28)");
      fg.addColorStop(1, "rgba(70,210,255,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(esx, cy - 7 * dScale);
      ctx.lineTo(esx - flameLen, cy);
      ctx.lineTo(esx, cy + 7 * dScale);
      ctx.closePath();
      ctx.fill();

      const ig = ctx.createRadialGradient(esx, cy, 0, esx, cy, 11 * dScale);
      ig.addColorStop(0, "rgba(110,230,255,0.75)");
      ig.addColorStop(1, "rgba(110,230,255,0)");
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.arc(esx, cy, 11 * dScale, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(102,229,255,0.3)";
      ctx.lineWidth = 1.5 * dScale;
      ctx.setLineDash([2 * dScale, 3 * dScale]);
      ctx.beginPath();
      ctx.moveTo(esx, cy - 5 * dScale);
      ctx.lineTo(esx, cy + 5 * dScale);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = "#060f1e";
    ctx.beginPath();
    if (ctx.roundRect)
      ctx.roundRect(sxL, sy, sw, sh, [
        3 * dScale,
        7 * dScale,
        7 * dScale,
        3 * dScale,
      ]);
    else ctx.rect(sxL, sy, sw, sh);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * dScale;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 * dScale;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1 * dScale;
    ctx.beginPath();
    ctx.moveTo(sxL + 4 * dScale, sy + sh * 0.3);
    ctx.lineTo(sxL + sw - 4 * dScale, sy + sh * 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    const noseX = sxL + sw;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(noseX - 1 * dScale, sy + 3 * dScale);
    ctx.lineTo(noseX + 9 * dScale, cy);
    ctx.lineTo(noseX - 1 * dScale, sy + sh - 3 * dScale);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  function drawProperPylon(psx) {
    const sy = cy - sh / 2;
    ctx.strokeStyle = "#243f5e";
    ctx.lineWidth = 3 * dScale;
    ctx.beginPath();
    ctx.moveTo(psx, sy - 4 * dScale);
    ctx.lineTo(psx, ry);
    ctx.stroke();
    ctx.fillStyle = "#d8ecff";
    ctx.shadowColor = "#90ccff";
    ctx.shadowBlur = 5 * dScale;
    ctx.beginPath();
    ctx.arc(psx, ry, 3.5 * dScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Draw Clocks and Lines FIRST
  const clockY = cy + sh / 2 + 65 * dScale;
  const targetY = cy + sh / 2;
  const clockOffset = 38 * dScale;

  drawClock(
    ctx,
    toSX(A_cx) - clockOffset,
    clockY,
    toSX(A_cx - S0 / 2),
    targetY,
    phys.tau_A_back,
    "A-REAR τ",
    "#ffb866",
    dScale,
  );
  drawClock(
    ctx,
    toSX(A_cx) + clockOffset,
    clockY,
    toSX(A_cx + S0 / 2),
    targetY,
    phys.tau_A_front,
    "A-FRONT τ",
    "#ffb866",
    dScale,
  );
  drawClock(
    ctx,
    toSX(B_cx) - clockOffset,
    clockY,
    toSX(B_cx - S0 / 2),
    targetY,
    phys.tau_B_back,
    "B-REAR τ",
    "#66e5ff",
    dScale,
  );
  drawClock(
    ctx,
    toSX(B_cx) + clockOffset,
    clockY,
    toSX(B_cx + S0 / 2),
    targetY,
    phys.tau_B_front,
    "B-FRONT τ",
    "#66e5ff",
    dScale,
  );

  drawProperShip(A_cx, "#ffb866", "A", scenario === "bell");
  drawProperShip(B_cx, "#66e5ff", "B", true);
  drawProperPylon(psx_A);
  drawProperPylon(psx_B);

  // Draw Ship Labels
  ctx.fillStyle = "#ffb866";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP A`, toSX(A_cx), cy + sh / 2 + 18 * dScale);
  ctx.fillStyle = "rgba(150,195,240,0.4)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'Space Mono', monospace`;
  ctx.fillText(`S₀=${S0.toFixed(1)}L`, toSX(A_cx), cy + sh / 2 + 32 * dScale);

  ctx.fillStyle = "#66e5ff";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP B`, toSX(B_cx), cy + sh / 2 + 18 * dScale);
  ctx.fillStyle = "rgba(150,195,240,0.4)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'Space Mono', monospace`;
  ctx.fillText(`S₀=${S0.toFixed(1)}L`, toSX(B_cx), cy + sh / 2 + 32 * dScale);

  // ── Cable ──
  const ratio = Math.min(1.0, strain / state.breakStrain);
  const thicknessMultiplier = 1 + state.breakStrain / 0.02;
  const baseThick = 1.5 * dScale;
  const cableThick = baseThick * thicknessMultiplier;

  if (!isBroken) {
    const [r, g, b] = scenario === "tow" ? [120, 180, 220] : cableColor(ratio);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = cableThick;
    ctx.shadowColor = `rgb(${r},${g},${b})`;
    ctx.shadowBlur =
      scenario === "tow"
        ? 4 * dScale
        : ratio > 0.45
          ? (4 + ratio * 8) * dScale
          : 2 * dScale;
    ctx.beginPath();
    ctx.moveTo(psx_A, ry);
    ctx.lineTo(psx_B, ry);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (scenario === "tow") {
      ctx.fillStyle = "rgba(120,180,220,0.8)";
      ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'Space Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(
        "MECHANICAL TENSION — proper length constant",
        midPx,
        ry - 14 * dScale,
      );
    }

    if (scenario === "bell" && stretch > 0.001) {
      const anY = ry + 16 * dScale;
      const rr = `rgba(${r},${g},${b},0.6)`;
      ctx.strokeStyle = rr;
      ctx.lineWidth = 1 * dScale;
      const leftNat = midPx - halfNat;
      const rightNat = midPx + halfNat;
      if (psx_A < leftNat - 2 * dScale) {
        ctx.beginPath();
        ctx.moveTo(leftNat, anY);
        ctx.lineTo(psx_A, anY);
        ctx.stroke();
        ctx.fillStyle = rr;
        ctx.beginPath();
        ctx.moveTo(psx_A - 1 * dScale, anY);
        ctx.lineTo(psx_A + 6 * dScale, anY - 3 * dScale);
        ctx.lineTo(psx_A + 6 * dScale, anY + 3 * dScale);
        ctx.fill();
      }
      if (psx_B > rightNat + 2 * dScale) {
        ctx.beginPath();
        ctx.moveTo(rightNat, anY);
        ctx.lineTo(psx_B, anY);
        ctx.stroke();
        ctx.fillStyle = rr;
        ctx.beginPath();
        ctx.moveTo(psx_B + 1 * dScale, anY);
        ctx.lineTo(psx_B - 6 * dScale, anY - 3 * dScale);
        ctx.lineTo(psx_B - 6 * dScale, anY + 3 * dScale);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
      ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'Space Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(
        `stretch: ${stretch.toFixed(3)} L`,
        midPx,
        anY + 14 * dScale,
      );
    }

    // Cable Clock (Moved higher to prevent overlap with L0 text)
    drawClock(
      ctx,
      midX,
      ry - 48 * dScale,
      midX,
      ry,
      phys.tau_cable,
      "CABLE τ",
      `rgb(${r},${g},${b})`,
      dScale,
    );
  } else {
    ctx.strokeStyle = "#ff6868";
    ctx.lineWidth = cableThick;
    ctx.shadowColor = "#ff6868";
    ctx.shadowBlur = 10 * dScale;
    ctx.beginPath();
    ctx.moveTo(psx_A, ry);
    ctx.bezierCurveTo(
      psx_A + 20 * dScale,
      ry + 6 * dScale,
      midX - 30 * dScale,
      ry + 22 * dScale,
      midX - 10 * dScale,
      ry + 28 * dScale,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(psx_B, ry);
    ctx.bezierCurveTo(
      psx_B - 20 * dScale,
      ry + 6 * dScale,
      midX + 30 * dScale,
      ry + 22 * dScale,
      midX + 10 * dScale,
      ry + 28 * dScale,
    );
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff6868";
    ctx.font = `700 ${Math.max(11, Math.round(13 * dScale))}px 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.shadowColor = "#ff6868";
    ctx.shadowBlur = 12 * dScale;
    ctx.fillText("CABLE SNAPPED", midX, ry - 16 * dScale);
    ctx.shadowBlur = 0;
  }

  const bY = cy + 115 * dScale;
  const gapColor =
    scenario === "tow" ? "rgba(102,229,255,0.35)" : "rgba(86,197,240,0.35)";
  const gapTextColor =
    scenario === "tow" ? "rgba(102,229,255,0.75)" : "rgba(86,197,240,0.65)";
  ctx.strokeStyle = gapColor;
  ctx.lineWidth = 1.5 * dScale;
  ctx.setLineDash([4 * dScale, 5 * dScale]);
  ctx.beginPath();
  ctx.moveTo(toSX(A_cx), bY);
  ctx.lineTo(toSX(B_cx), bY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(toSX(A_cx), bY - 5 * dScale);
  ctx.lineTo(toSX(A_cx), bY + 5 * dScale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toSX(B_cx), bY - 5 * dScale);
  ctx.lineTo(toSX(B_cx), bY + 5 * dScale);
  ctx.stroke();

  ctx.fillStyle = gapTextColor;
  ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "center";
  const propGapLabel =
    scenario === "tow"
      ? `D = ${phys.prop_gap.toFixed(3)} L (constant — Born rigid)`
      : `γ·D = ${phys.prop_gap.toFixed(3)} L (expanding!)`;
  ctx.fillText(propGapLabel, (toSX(A_cx) + toSX(B_cx)) / 2, bY + 18 * dScale);

  ctx.fillStyle = "rgba(86,197,240,0.35)";
  ctx.font = `700 ${Math.max(8, Math.round(10 * dScale))}px 'Space Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText(
    "PROPER (COMOVING) FRAME — ships at rest here",
    10 * dScale,
    CH - 10 * dScale,
  );
}

// ═══════════════════════════════════════════════
// UI UPDATE
// ═══════════════════════════════════════════════
function updateAll() {
  const phys = compute();
  updateBadge(phys);
  updateEquations(phys);
  updateStrainBar(phys);
  updateScenarioUI(phys);
  render(phys);
}

function updateBadge({ gamma, v, tau }) {
  el.badgeGamma.textContent = gamma.toFixed(4);
  el.badgeV.textContent = v.toFixed(4);
  el.badgeTau.textContent = tau.toFixed(3);
}

function updateScenarioUI({ scenario }) {
  if (scenario === "tow") {
    el.scenarioBadge.className = "scenario-badge sb-tow";
    el.scenarioBadge.textContent = "Tow Mode";
  } else {
    el.scenarioBadge.className = "scenario-badge sb-bell";
    el.scenarioBadge.textContent = "Bell's Paradox";
  }
}

function updateEquations(phys) {
  const {
    gamma,
    v,
    tau,
    S_lab,
    lab_gap,
    prop_gap,
    cable_lab,
    cable_prop,
    L_init,
    stretch,
    strain,
    isBroken,
    scenario,
  } = phys;
  const { a, t, L_gap } = state;

  el.eqV.textContent = `${v.toFixed(4)} c`;
  el.eqGamma.textContent = `${gamma.toFixed(4)}`;
  el.eqTau.textContent = `${tau.toFixed(4)} yr`;
  el.eqSlab.textContent = `${S_lab.toFixed(4)} L`;

  if (scenario === "tow") {
    el.eqLabgapTag.className = "eq-scenario-tag tag-tow";
    el.eqLabgapTag.textContent = "Tow";
    el.eqLabgapFormula.textContent = "D/γ (shrinks!)";
    el.eqLabgap.textContent = `${lab_gap.toFixed(4)} L`;

    el.eqPropgapTag.className = "eq-scenario-tag tag-tow";
    el.eqPropgapTag.textContent = "Tow";
    el.eqPropgapFormula.textContent = "D (constant!)";
    el.eqPropgap.textContent = `${prop_gap.toFixed(4)} L`;
    el.eqPropgap.className = "eq-result tow-color";

    el.eqRlabFormula.textContent = "D/γ+(ΔAttach)·S₀/γ";
    el.eqStretchFormula.textContent = "0 — Born rigid!";

    el.eqMechDivider.style.display = "";
    el.eqMechLabel.style.display = "";
    el.eqMech.style.display = "";
    el.eqMech.textContent = `m·α (const)`;
  } else {
    el.eqLabgapTag.className = "eq-scenario-tag tag-bell";
    el.eqLabgapTag.textContent = "Bell's";
    el.eqLabgapFormula.textContent = "D (constant!)";
    el.eqLabgap.textContent = `${lab_gap.toFixed(4)} L`;

    el.eqPropgapTag.className = "eq-scenario-tag tag-bell";
    el.eqPropgapTag.textContent = "Bell's";
    el.eqPropgapFormula.textContent = "γ·D (grows!)";
    el.eqPropgap.textContent = `${prop_gap.toFixed(4)} L`;
    el.eqPropgap.className = "eq-result cable-color";

    el.eqRlabFormula.textContent = "D+(ΔAttach)·S₀/γ";
    el.eqStretchFormula.textContent = "D·(γ−1)";

    el.eqMechDivider.style.display = "none";
    el.eqMechLabel.style.display = "none";
    el.eqMech.style.display = "none";
  }

  el.eqLinit.textContent = `${L_init.toFixed(4)} L`;
  el.eqRlab.textContent = `${cable_lab.toFixed(4)} L`;
  el.eqRprop.textContent = `${cable_prop.toFixed(4)} L`;
  el.eqStretch.textContent = `${stretch.toFixed(4)} L`;

  if (isBroken) {
    el.eqStrain.textContent = "SNAPPED";
    el.eqStrain.style.color = "var(--cable-danger)";
  } else {
    el.eqStrain.textContent = `${(strain * 100).toFixed(3)}%`;
    el.eqStrain.style.color =
      strain > state.breakStrain * 0.75
        ? "var(--cable-warn)"
        : "var(--text-bright)";
  }

  if (scenario === "tow") {
    el.insightTitle.textContent =
      "🔗 Key Insight — Tow Mode (Born Rigid Motion)";
    el.insightEq.textContent = `Lab gap = D/γ = ${L_gap.toFixed(2)}/${gamma.toFixed(4)} = ${lab_gap.toFixed(4)} L`;
    el.insightSub.innerHTML =
      "When only Ship B fires and drags Ship A, the system undergoes <em>Born rigid acceleration</em>. The proper distance between ships stays constant at D. The lab gap Lorentz-contracts. The cable carries mechanical tension but never stretches — it will not snap from relativistic effects.";
  } else {
    el.insightTitle.textContent = "⚡ Key Insight — Bell's Paradox";
    el.insightEq.textContent = `Stretch = D × (γ − 1) = ${L_gap.toFixed(2)} × ${(gamma - 1).toFixed(4)} = ${stretch.toFixed(4)} L`;
    el.insightSub.innerHTML =
      "The absolute stretch equals D·(γ−1) regardless of where the cable is attached. Moving attachment points apart only lengthens L₀ — reducing the <em>percentage</em> of strain without reducing the absolute elongation. A rigid steel cable snaps almost immediately.";
  }
}

function updateStrainBar({ strain, isBroken, stretch, scenario }) {
  if (scenario === "tow") {
    el.strainFill.style.width = "0%";
    el.strainFill.style.backgroundColor = "rgb(80,232,178)";
    el.svStrain.textContent = "0.000%";
    el.svStrain.style.color = "var(--cable-ok)";
    el.svBreak.textContent = `${(state.breakStrain * 100).toFixed(1)}%`;
    el.svStretch.textContent = "0.000 L";
    el.statusBadge.className = "status-badge s-tow";
    el.statusBadge.textContent = "TOW — INTACT";
    el.towExtra.style.display = "";
    el.svMechLoad.textContent = `m·α (constant)`;
    el.svTowGap.textContent = state.L_gap.toFixed(1);
  } else {
    el.towExtra.style.display = "none";
    const fillPct = Math.min(100, (strain / state.breakStrain) * 100);
    el.strainFill.style.width = `${fillPct}%`;

    const ratio = fillPct / 100;
    const [r, g, b] = uiStrainColor(ratio);
    el.strainFill.style.backgroundColor = `rgb(${r},${g},${b})`;

    el.svStrain.textContent = isBroken
      ? `>${(state.breakStrain * 100).toFixed(1)}%`
      : `${(strain * 100).toFixed(3)}%`;
    el.svBreak.textContent = `${(state.breakStrain * 100).toFixed(1)}%`;
    el.svStretch.textContent = `${stretch.toFixed(4)} L`;

    if (isBroken) {
      el.statusBadge.className = "status-badge s-broken";
      el.statusBadge.textContent = "SNAPPED";
      el.svStrain.style.color = "var(--cable-danger)";
    } else if (ratio > 0.72) {
      el.statusBadge.className = "status-badge s-tension";
      el.statusBadge.textContent = "HIGH TENSION";
      el.svStrain.style.color = "var(--cable-warn)";
    } else {
      el.statusBadge.className = "status-badge s-intact";
      el.statusBadge.textContent = "INTACT";
      el.svStrain.style.color = "var(--text-bright)";
    }
  }
}

// ═══════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════
function play() {
  if (state.t >= state.maxT) state.t = 0;
  state.isPlaying = true;
  el.btnPlay.textContent = "⏸ Pause";
  lastTime = performance.now();
  animId = requestAnimationFrame(tick);
}

function pause() {
  state.isPlaying = false;
  el.btnPlay.textContent = "▶ Play";
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

function reset() {
  pause();
  state.t = 0;
  el.slT.value = 0;
  el.valT.textContent = "0.00 yr";
  updateAll();
}

function tick(now) {
  if (!state.isPlaying) return;
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  state.t = Math.min(state.maxT, state.t + dt * state.speed * 0.38);
  el.slT.value = state.t;
  el.valT.textContent = state.t.toFixed(2) + " yr";
  updateAll();
  if (state.t < state.maxT) animId = requestAnimationFrame(tick);
  else pause();
}

// ═══════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════
function setup() {
  el.slT.addEventListener("input", (e) => {
    state.t = +e.target.value;
    el.valT.textContent = state.t.toFixed(2) + " yr";
    pause();
    updateAll();
  });

  el.slA.addEventListener("input", (e) => {
    state.a = +e.target.value;
    el.valA.textContent = state.a.toFixed(2) + " c/yr";
    updateAll();
  });

  el.slGap.addEventListener("input", (e) => {
    state.L_gap = +e.target.value;
    el.valGap.textContent = state.L_gap.toFixed(1) + " L";
    updateAll();
  });

  el.slBreak.addEventListener("input", (e) => {
    state.breakStrain = +e.target.value / 100;
    el.valBreak.textContent = (+e.target.value).toFixed(1) + "%";
    updateAll();
  });

  el.selAA.addEventListener("change", (e) => {
    state.aA = +e.target.value;
    updateAll();
  });
  el.selAB.addEventListener("change", (e) => {
    state.aB = +e.target.value;
    updateAll();
  });

  document.querySelectorAll('input[name="scenario"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      state.scenario = e.target.value;
      $("sc-bell").className =
        "scenario-card" + (state.scenario === "bell" ? " active-bell" : "");
      $("sc-tow").className =
        "scenario-card" + (state.scenario === "tow" ? " active-tow" : "");
      updateAll();
    });
  });

  el.btnPlay.addEventListener("click", () =>
    state.isPlaying ? pause() : play(),
  );
  el.btnReset.addEventListener("click", reset);

  document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".speed-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.speed = +btn.dataset.speed;
    });
  });

  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".view-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.view = tab.dataset.view;
      updateAll();
    });
  });

  window.addEventListener("resize", debounce(resizeCanvas, 80));
}

function debounce(fn, ms) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}

setup();
resizeCanvas();
