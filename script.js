// ═══════════════════════════════════════════════
// CONSTANTS & STATE
// ═══════════════════════════════════════════════
const S0 = 1.0; // Proper ship length (light-years)

const state = {
  t: 0.0,
  a: 0.8,
  L_gap: 3.0,
  breakStrain: 0.001,
  aA: 0.0,
  aB: 0.0,
  ropeLength: 1.5,   // Rope natural length as multiple of D (1.0, 1.5, 2.0)
  scenario: "bell",
  isPlaying: false,
  speed: 1.0,
  maxT: 6.0,
  view: "lab",
  selectedObserver: null, // "A", "B", "rope", or null
};

// Hit-test targets for observer buttons (rebuilt each frame)
let observerHitTargets = [];

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
  valRopeLength: $("val-rope-length"),

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
  eqSlabLabel: $("eq-slab-label"),
  eqLabgap: $("eq-labgap"),
  eqLabgapLabel: $("eq-labgap-label"),
  eqLabgapTag: $("eq-labgap-tag"),
  eqLabgapFormula: $("eq-labgap-formula"),
  eqPropgap: $("eq-propgap"),
  eqPropgapLabel: $("eq-propgap-label"),
  eqPropgapTag: $("eq-propgap-tag"),
  eqPropgapFormula: $("eq-propgap-formula"),
  eqLinit: $("eq-linit"),
  eqLinitFormula: $("eq-linit-formula"),
  eqRlab: $("eq-rlab"),
  eqRlabLabel: $("eq-rlab-label"),
  eqRlabFormula: $("eq-rlab-formula"),
  eqRprop: $("eq-rprop"),
  eqRpropLabel: $("eq-rprop-label"),
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

  ropeLengthRow: $("rope-length-row"),
  monitorTitle: $("monitor-title"),
  ctrlBreakName: $("ctrl-break-name"),
  ctrlBreakTip: $("ctrl-break-tip"),
  attachLabelA: $("attach-label-a"),
  attachLabelB: $("attach-label-b"),
};

// Canvas dimensions
let CW = 0,
  CH = 400;
let lastTime = 0,
  animId = null;

// ═══════════════════════════════════════════════
// PHYSICS
// ═══════════════════════════════════════════════

function getLocalTau(a_center, x_local, t) {
  let denom = 1.0 + a_center * x_local;
  if (denom <= 0.001) return null;
  let a_local = a_center / denom;
  return Math.asinh(a_local * t) / a_local;
}

function computeBell() {
  const { t, a, L_gap, aA, aB, ropeLength } = state;
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

  // Natural rope length: ropeLength × (full attachment-point gap).
  // The attachment offset adds to the base gap, and the ropeLength factor
  // multiplies the ENTIRE span — so back-end-to-front-end attachment
  // correctly produces a longer L₀ proportional to ropeLength.
  const L_init = ropeLength * (L_gap + (aB - aA) * S0);

  // Rope only stretches once cable_prop exceeds L_init
  const stretch = Math.max(0, cable_prop - L_init);
  const strain = stretch > 0 ? stretch / L_init : 0;
  const isBroken = strain > state.breakStrain;

  // Slack fraction: how much of natural length is unused (rope sagging)
  const slackFraction = Math.max(0, (L_init - cable_prop) / L_init);

  // Each ship is internally Born-rigid: front and rear have different
  // proper accelerations → different proper times.  The rear (closer to
  // the Rindler horizon) ticks slower; the front ticks faster.
  // Both ships are identical (same α, same S₀) so A-pair = B-pair.
  const tau_A_back  = getLocalTau(a, -0.5 * S0, t);
  const tau_A_front = getLocalTau(a,  0.5 * S0, t);
  const tau_B_back  = getLocalTau(a, -0.5 * S0, t);
  const tau_B_front = getLocalTau(a,  0.5 * S0, t);
  // Rope midpoint: same centre acceleration as ship centres
  const tau_cable   = tau;

  // Centre proper times (for badge display — observer sits at ship centre)
  const tau_A_center = tau;   // both centres share the same α
  const tau_B_center = tau;

  return {
    scenario: "bell",
    gamma, v, tau, S_lab,
    C_A, C_B, E_A, E_B, P_A, P_B,
    lab_gap: L_gap,
    prop_gap: gamma * L_gap,
    cable_lab, cable_prop,
    L_init, stretch, strain, isBroken, slackFraction,
    tau_A_back, tau_A_front, tau_A_center,
    tau_B_back, tau_B_front, tau_B_center,
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
  const slackFraction = 0.0;
  const mechTension = 1.0;

  const tau_B_back = getLocalTau(a, -0.5 * S0, t);
  const tau_B_front = getLocalTau(a, 0.5 * S0, t);
  const tau_B_center = tau;                            // Ship B centre is Rindler origin
  const tau_A_back = getLocalTau(a, -L_gap - 0.5 * S0, t);
  const tau_A_front = getLocalTau(a, -L_gap + 0.5 * S0, t);
  const tau_A_center = getLocalTau(a, -L_gap, t);     // may be null (HORIZON)
  const tau_cable = getLocalTau(a, -L_gap / 2, t);

  return {
    scenario: "tow",
    gamma, v, tau, S_lab,
    C_A, C_B, E_A, E_B, P_A, P_B,
    lab_gap: labGap,
    prop_gap: L_gap,
    cable_lab, cable_prop,
    L_init, stretch, strain, isBroken, slackFraction,
    mechTension,
    tau_A_back, tau_A_front, tau_A_center,
    tau_B_back, tau_B_front, tau_B_center,
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

// ═══════════════════════════════════════════════
// COLOR HELPERS
// ═══════════════════════════════════════════════

// Rope color: natural hemp (196,156,100) → taut warning (210,100,60) → near-break red (255,60,40)
function ropeColorBell(ratio) {
  ratio = Math.max(0, Math.min(1, ratio));
  let r, g, b;
  if (ratio < 0.6) {
    const s = ratio / 0.6;
    r = Math.round(196 + (215 - 196) * s);
    g = Math.round(156 + (100 - 156) * s);
    b = Math.round(100 + (55 - 100) * s);
  } else {
    const s = (ratio - 0.6) / 0.4;
    r = Math.round(215 + (255 - 215) * s);
    g = Math.round(100 + (55 - 100) * s);
    b = Math.round(55 + (30 - 55) * s);
  }
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
// ROPE / CABLE DRAWING
// ═══════════════════════════════════════════════

/**
 * Draws the rope (Bell's) or cable (Tow) between two attachment points.
 * rxA, rxB: screen x positions of attachment points
 * ry: screen y position
 * slackFraction: 0 = fully taut, >0 = slack (rope sags)
 * strainRatio: 0..1 ratio of strain to break strain
 * isBroken: whether rope has snapped
 * isTow: true = strong cable (tow mode), false = fragile rope (Bell's)
 * dScale: DPI/size scaling factor
 * now: performance.now() for animations
 */
function drawRopeVisual(ctx, rxA, rxB, ry, slackFraction, strainRatio, isBroken, isTow, dScale, now) {
  const midX = (rxA + rxB) / 2;
  const spanPx = rxB - rxA;

  // ── BROKEN STATE ──
  if (isBroken) {
    const retractLen = Math.min(spanPx * 0.15, 40 * dScale);
    const droopY = ry + 22 * dScale;

    // Left end position (Ship A's broken end)
    const leftEndX = rxA + retractLen;
    const leftEndY = droopY;
    // Right end position (Ship B's broken end)
    const rightEndX = rxB - retractLen;
    const rightEndY = droopY;

    // Two drooping halves — each hangs near its own ship
    ctx.lineWidth = 2.0 * dScale;
    ctx.strokeStyle = `rgba(220, 110, 55, 0.95)`;
    ctx.shadowColor = `rgba(255, 90, 40, 0.75)`;
    ctx.shadowBlur = 10 * dScale;

    // Left half (Ship A's side)
    ctx.beginPath();
    ctx.moveTo(rxA, ry);
    ctx.bezierCurveTo(
      rxA + retractLen * 0.35, ry + 8 * dScale,
      rxA + retractLen * 0.75, droopY - 2 * dScale,
      leftEndX, leftEndY
    );
    ctx.stroke();

    // Right half (Ship B's side)
    ctx.beginPath();
    ctx.moveTo(rxB, ry);
    ctx.bezierCurveTo(
      rxB - retractLen * 0.35, ry + 8 * dScale,
      rxB - retractLen * 0.75, droopY - 2 * dScale,
      rightEndX, rightEndY
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Frayed ends — fiber wisps at each broken tip
    const frayOffsetsLeft = [
      [4, -3, 0.5, 7], [6, 2, 0.9, 6], [2, 4, 1.2, 5],
      [8, -1, 0.3, 8], [5, 3, 0.7, 6],
    ];
    const frayOffsetsRight = [
      [-4, -3, -0.5, 7], [-6, 2, -0.9, 6], [-2, 4, -1.2, 5],
      [-8, -1, -0.3, 8], [-5, 3, -0.7, 6],
    ];

    frayOffsetsLeft.forEach(([ox, oy, angle, len], i) => {
      const ex = leftEndX + ox * dScale * 0.5;
      const ey = leftEndY + oy * dScale * 0.3;
      const flen = len * dScale;
      ctx.strokeStyle = `rgba(${190 + i * 6}, ${90 + i * 12}, ${40}, ${0.7 - i * 0.06})`;
      ctx.lineWidth = (0.8 + (i % 3) * 0.3) * dScale;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(angle) * flen, ey + Math.sin(angle) * flen);
      ctx.stroke();
    });

    frayOffsetsRight.forEach(([ox, oy, angle, len], i) => {
      const ex = rightEndX + ox * dScale * 0.5;
      const ey = rightEndY + oy * dScale * 0.3;
      const flen = len * dScale;
      ctx.strokeStyle = `rgba(${190 + i * 6}, ${90 + i * 12}, ${40}, ${0.7 - i * 0.06})`;
      ctx.lineWidth = (0.8 + (i % 3) * 0.3) * dScale;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(angle) * flen, ey + Math.sin(angle) * flen);
      ctx.stroke();
    });

    // Floating embers/sparks — split between both broken ends
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + now * 0.001 * 0.6;
      const dist = (3 + Math.sin(now * 0.0018 + i * 0.9) * 5 + i * 1.1) * dScale;
      const px = leftEndX + Math.cos(angle) * dist;
      const py = leftEndY + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(255,${88 + i * 20},0,${0.55 - i * 0.06})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.3 * dScale, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + now * 0.001 * 0.6 + 0.5;
      const dist = (3 + Math.sin(now * 0.0018 + i * 0.9 + 1.5) * 5 + i * 1.1) * dScale;
      const px = rightEndX + Math.cos(angle) * dist;
      const py = rightEndY + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(255,${88 + i * 20},0,${0.55 - i * 0.06})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.3 * dScale, 0, Math.PI * 2);
      ctx.fill();
    }

    // "ROPE SNAPPED" label — centered between ships
    ctx.fillStyle = "rgba(255, 105, 55, 0.95)";
    ctx.font = `700 ${Math.max(11, Math.round(13 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(255, 80, 35, 0.85)";
    ctx.shadowBlur = 12 * dScale;
    ctx.fillText("ROPE SNAPPED", midX, ry - 16 * dScale);
    ctx.shadowBlur = 0;
    return;
  }

  // ── INTACT ROPE ──
  let r, g, b;
  if (isTow) {
    r = 120; g = 180; b = 220;
  } else {
    [r, g, b] = ropeColorBell(strainRatio);
  }

  const ropeThick = isTow
    ? Math.max(2.5, (1.5 + state.breakStrain / 0.02)) * dScale
    : 1.8 * dScale;
  const glow = isTow ? 4 : (strainRatio > 0.45 ? (3 + strainRatio * 10) : 2);

  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth = ropeThick;
  ctx.shadowColor = `rgb(${r},${g},${b})`;
  ctx.shadowBlur = glow * dScale;

  if (isTow || slackFraction < 0.004) {
    // Straight taut line
    ctx.beginPath();
    ctx.moveTo(rxA, ry);
    ctx.lineTo(rxB, ry);
    ctx.stroke();
  } else {
    // Sinusoidal slack rope
    // Number of half-cycles based on rope length factor
    const n_half = state.ropeLength <= 1.0 ? 1 :
                   state.ropeLength <= 1.5 ? 3 : 5;
    const maxAmp = Math.min(20 * dScale, spanPx * 0.11);
    const amplitude = maxAmp * Math.sqrt(slackFraction);

    ctx.beginPath();
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = rxA + t * spanPx;
      const y = ry + amplitude * Math.sin(n_half * Math.PI * t);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  // Tow mode label
  if (isTow) {
    ctx.fillStyle = "rgba(120,180,220,0.8)";
    ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("STRONG CABLE — MECHANICAL TENSION", midX, ry + 18 * dScale);
  }
}

// ═══════════════════════════════════════════════
// UI DRAWING HELPERS
// ═══════════════════════════════════════════════
function drawClock(ctx, px, py, targetX, targetY, timeVal, label, color, dScale) {
  const boxTop = py - 12 * dScale;
  const boxBottom = py + 12 * dScale;
  const lineStartY = py < targetY ? boxBottom : boxTop;

  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(px, lineStartY);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = "rgba(10, 18, 30, 0.95)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 * dScale;
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(px - 30 * dScale, boxTop, 60 * dScale, 24 * dScale, 4 * dScale);
  else ctx.rect(px - 30 * dScale, boxTop, 60 * dScale, 24 * dScale);
  ctx.fill();
  ctx.stroke();

  ctx.font = `700 ${Math.max(9, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  if (timeVal === null) {
    ctx.fillStyle = "#ff6868";
    ctx.fillText("HORIZON", px, py + 4 * dScale);
  } else {
    ctx.fillStyle = color;
    ctx.fillText(timeVal.toFixed(3) + "y", px, py + 4 * dScale);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = `${Math.max(7, Math.round(8 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
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
    gamma, v, S_lab,
    C_A, C_B, E_A, E_B, P_A, P_B,
    strain, isBroken, slackFraction, scenario,
  } = phys;
  ctx.clearRect(0, 0, CW, CH);
  observerHitTargets = [];

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
  const cy = Math.round(CH * 0.42);
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

  const sh = 38 * dScale;

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
      ctx.roundRect(sx, sy, sw, sh, [3 * dScale, 7 * dScale, 7 * dScale, 3 * dScale]);
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

    const ry_pylon = cy - 55 * dScale;
    const pylonBot = sy - 4 * dScale;
    ctx.strokeStyle = "#243f5e";
    ctx.lineWidth = 3 * dScale;
    ctx.beginPath();
    ctx.moveTo(psx, pylonBot);
    ctx.lineTo(psx, ry_pylon);
    ctx.stroke();

    ctx.fillStyle = "#d8ecff";
    ctx.shadowColor = "#90ccff";
    ctx.shadowBlur = 5 * dScale;
    ctx.beginPath();
    ctx.arc(psx, ry_pylon, 3.5 * dScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // (Observer buttons are only shown in Proper Frame)
  }

  const hasEngineA = scenario === "bell";
  const hasEngineB = true;
  const sh_half = sh / 2;

  // Draw clocks FIRST (behind ship labels)
  const clockY = cy + sh_half + 65 * dScale;
  const targetY = cy + sh_half;
  const sxCA = toSX(C_A);
  const sxCB = toSX(C_B);
  const clockOffset = 38 * dScale;

  drawClock(ctx, sxCA - clockOffset, clockY, toSX(C_A - S_lab / 2), targetY, phys.tau_A_back, "A-REAR τ", "#ffb866", dScale);
  drawClock(ctx, sxCA + clockOffset, clockY, toSX(C_A + S_lab / 2), targetY, phys.tau_A_front, "A-FRONT τ", "#ffb866", dScale);
  drawClock(ctx, sxCB - clockOffset, clockY, toSX(C_B - S_lab / 2), targetY, phys.tau_B_back, "B-REAR τ", "#66e5ff", dScale);
  drawClock(ctx, sxCB + clockOffset, clockY, toSX(C_B + S_lab / 2), targetY, phys.tau_B_front, "B-FRONT τ", "#66e5ff", dScale);

  // Draw Ships
  drawShip(C_A, E_A !== null ? E_A : C_A - 0.5 * S_lab, P_A, "#ffb866", "A", hasEngineA);
  drawShip(C_B, E_B, P_B, "#66e5ff", "B", hasEngineB);

  // Ship Labels
  ctx.fillStyle = "#ffb866";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP A`, sxCA, cy + sh_half + 18 * dScale);
  ctx.fillStyle = "rgba(150,200,245,0.55)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.fillText(`|← L₀/γ →|`, sxCA, cy + sh_half + 32 * dScale);

  ctx.fillStyle = "#66e5ff";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP B`, sxCB, cy + sh_half + 18 * dScale);
  ctx.fillStyle = "rgba(150,200,245,0.55)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.fillText(`|← L₀/γ →|`, sxCB, cy + sh_half + 32 * dScale);

  // ── ROPE / CABLE ──
  const rxA = toSX(P_A);
  const rxB = toSX(P_B);
  const ry_rope = cy - 55 * dScale;
  const midX = (rxA + rxB) / 2;
  const strainRatio = Math.min(1.0, strain / state.breakStrain);
  const isTow = scenario === "tow";

  drawRopeVisual(ctx, rxA, rxB, ry_rope, slackFraction, strainRatio, isBroken, isTow, dScale, now);

  // (Rope/Cable observer button is only shown in Proper Frame)

  // Rope/Cable τ clock — always visible; orange + dimmed when broken
  {
    const [cR, cG, cB] = isTow ? [120, 180, 220] : ropeColorBell(isBroken ? 1 : strainRatio);
    const clockColor = isBroken ? "rgb(255,105,55)" : `rgb(${cR},${cG},${cB})`;
    if (isBroken) ctx.globalAlpha = 0.5;
    drawClock(ctx, midX, ry_rope - 44 * dScale, midX, ry_rope,
      phys.tau_cable, isTow ? "CABLE τ" : "ROPE τ", clockColor, dScale);
    ctx.globalAlpha = 1.0;
  }

  // Stretch annotation in lab frame (Bell's only, when taut)
  if (scenario === "bell" && !isBroken && strain > 0.001) {
    const L_init = phys.L_init;
    const halfNat = (L_init / S0) * (S_lab * scale) / 2;
    // Actually just show a label for the stretch
    const anY = ry_rope + 14 * dScale;
    const [cR, cG, cB] = ropeColorBell(strainRatio);
    ctx.fillStyle = `rgba(${cR},${cG},${cB},0.75)`;
    ctx.font = `${Math.max(9, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`stretch: ${phys.stretch.toFixed(3)} L`, midX, anY);
  }

  // ── Gap bracket ──
  const bY = cy + 115 * dScale;
  const gapColor = scenario === "tow" ? "rgba(102,229,255,0.3)" : "rgba(86,197,240,0.28)";
  const gapTextColor = scenario === "tow" ? "rgba(102,229,255,0.7)" : "rgba(86,197,240,0.55)";

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
  ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  const gapLabel =
    scenario === "tow"
      ? `D/γ = ${phys.lab_gap.toFixed(3)} L (contracting)`
      : `D = ${state.L_gap.toFixed(1)} L (constant in lab)`;
  ctx.fillText(gapLabel, (sxCA + sxCB) / 2, bY + 18 * dScale);

  ctx.fillStyle = "rgba(86,197,240,0.35)";
  ctx.font = `700 ${Math.max(8, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText("OBSERVER (LAB) FRAME — ships moving right", 10 * dScale, CH - 10 * dScale);
}

function renderProper(phys) {
  const ctx = el.ctx;
  const { gamma, v, strain, isBroken, slackFraction, cable_prop, L_init, stretch, scenario } = phys;
  ctx.clearRect(0, 0, CW, CH);
  observerHitTargets = [];

  const dScale = (CW / 800) * 1.35;

  // Doppler Shift Background
  const dopplerGradient = ctx.createLinearGradient(0, 0, CW, 0);
  dopplerGradient.addColorStop(0, `rgba(${12 + 150 * v}, ${32 - 20 * v}, ${72 - 40 * v}, ${0.45 + 0.2 * v})`);
  dopplerGradient.addColorStop(0.5, `rgba(12, 32, 72, 0.45)`);
  dopplerGradient.addColorStop(1, `rgba(${12 - 10 * v}, ${32 + 50 * v}, ${72 + 150 * v}, ${0.45 + 0.2 * v})`);
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
  const scaleP = CW / totalW;          // camera scale (zooms out with gap)
  const camX_p = properGap / 2;
  const toSX = (x) => (x - camX_p) * scaleP + CW / 2;
  const cy = Math.round(CH * 0.42);
  const sh = 38 * dScale;

  // ── FIXED ship visual width (ships are at rest in this frame — they must never shrink) ──
  const sw = Math.max(S0 * (CW / BASE_PROPER), 46 * dScale);

  ctx.strokeStyle = "rgba(86,197,240,0.055)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(CW, cy);
  ctx.stroke();

  const A_cx = 0.0;
  const B_cx = properGap;

  // Pylon attachment positions on fixed-size ships
  // state.aA / state.aB are in [-0.5, +0.5] of ship half-width fraction
  const sxA_center = toSX(A_cx);
  const sxB_center = toSX(B_cx);
  const psx_A = sxA_center + state.aA * sw;
  const psx_B = sxB_center + state.aB * sw;
  const ry = cy - 55 * dScale;

  const halfNat = (L_init * scaleP) / 2;
  const midPx = (psx_A + psx_B) / 2;

  // ── L₀ natural length indicator (only when rope is intact — hides when "ROPE SNAPPED" text is drawn) ──
  if (!isBroken) {
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
    ctx.font = `${Math.max(9, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`L₀ = ${L_init.toFixed(3)} L (natural)`, midPx, ry - 18 * dScale);
  }

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
      ctx.roundRect(sxL, sy, sw, sh, [3 * dScale, 7 * dScale, 7 * dScale, 3 * dScale]);
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

    // ── Observer button inside ship ──
    const obsId = label === "A" ? "A" : "B";
    const isSelected = state.selectedObserver === obsId;
    const btnR = 7 * dScale;
    const btnX = toSX(cx);
    const btnY = cy;

    if (isSelected) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * dScale;
    }
    ctx.fillStyle = isSelected ? color : "rgba(10, 18, 30, 0.85)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * dScale;
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = isSelected ? "#07101e" : color;
    ctx.font = `${Math.max(7, Math.round(9 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◉", btnX, btnY);
    ctx.textBaseline = "alphabetic";

    observerHitTargets.push({ id: obsId, x: btnX, y: btnY, r: btnR + 4 * dScale });
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

  // Draw clocks FIRST (behind ships)
  const clockY = cy + sh / 2 + 65 * dScale;
  const targetY = cy + sh / 2;
  const clockOffset = 38 * dScale;

  drawClock(ctx, sxA_center - clockOffset, clockY, sxA_center - sw / 2, targetY, phys.tau_A_back,  "A-REAR τ",  "#ffb866", dScale);
  drawClock(ctx, sxA_center + clockOffset, clockY, sxA_center + sw / 2, targetY, phys.tau_A_front, "A-FRONT τ", "#ffb866", dScale);
  drawClock(ctx, sxB_center - clockOffset, clockY, sxB_center - sw / 2, targetY, phys.tau_B_back,  "B-REAR τ",  "#66e5ff", dScale);
  drawClock(ctx, sxB_center + clockOffset, clockY, sxB_center + sw / 2, targetY, phys.tau_B_front, "B-FRONT τ", "#66e5ff", dScale);

  drawProperShip(A_cx, "#ffb866", "A", scenario === "bell");
  drawProperShip(B_cx, "#66e5ff", "B", true);
  drawProperPylon(psx_A);
  drawProperPylon(psx_B);

  // Ship Labels
  // Ship labels
  ctx.fillStyle = "#ffb866";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP A`, sxA_center, cy + sh / 2 + 18 * dScale);
  {
    const isObsA = state.selectedObserver === "A";
    ctx.fillStyle = isObsA ? "rgba(255,184,102,0.65)" : "rgba(150,195,240,0.45)";
    ctx.font = `${Math.max(8, Math.round(isObsA ? 9 : 10) * dScale)}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.fillText(
      isObsA ? `◉ OBSERVER` : `S₀ = ${S0.toFixed(1)} L (proper)`,
      sxA_center, cy + sh / 2 + 32 * dScale
    );
  }

  ctx.fillStyle = "#66e5ff";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP B`, sxB_center, cy + sh / 2 + 18 * dScale);
  {
    const isObsB = state.selectedObserver === "B" || state.selectedObserver === null;
    ctx.fillStyle = isObsB ? "rgba(102,229,255,0.65)" : "rgba(150,195,240,0.45)";
    ctx.font = `${Math.max(8, Math.round(isObsB ? 9 : 10) * dScale)}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.fillText(
      isObsB ? `◉ OBSERVER` : `S₀ = ${S0.toFixed(1)} L (proper)`,
      sxB_center, cy + sh / 2 + 32 * dScale
    );
  }

  // ── ROPE / CABLE (Proper Frame) ──
  const strainRatio = Math.min(1.0, strain / state.breakStrain);
  const isTow = scenario === "tow";

  // ── Observer star marker — follows selectedObserver ──
  {
    const obs = state.selectedObserver;
    let starX, starColor;
    if (obs === "A") {
      starX = sxA_center;
      starColor = "rgba(255,184,102,0.9)";
    } else if (obs === "rope") {
      starX = midPx;
      const [roR, roG, roB] = isTow ? [120, 180, 220] : ropeColorBell(strainRatio);
      starColor = `rgb(${roR},${roG},${roB})`;
    } else {
      // Default (B or null) — Ship B is the natural comoving-frame origin
      starX = sxB_center;
      starColor = "rgba(102,229,255,0.9)";
    }
    // Position star above the pylon ball (ships) or above L₀ bracket (rope)
    const starY = obs === "rope" ? ry - 28 * dScale : ry - 14 * dScale;
    ctx.fillStyle = starColor;
    ctx.font = `bold ${Math.max(10, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("★", starX, starY);
    ctx.globalAlpha = 0.6;
    ctx.font = `${Math.max(7, Math.round(8 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.fillText("OBSERVER", starX, starY + 11 * dScale);
    ctx.globalAlpha = 1.0;
  }

  drawRopeVisual(ctx, psx_A, psx_B, ry, slackFraction, strainRatio, isBroken, isTow, dScale, now);

  // ── Rope/Cable observer button (at midpoint — always visible, even after break) ──
  {
    const ropeObsSelected = state.selectedObserver === "rope";
    const ropeBtnR = 6 * dScale;
    const [roR, roG, roB] = isBroken
      ? [180, 140, 100]    // muted brown when broken
      : (isTow ? [120, 180, 220] : ropeColorBell(strainRatio));
    const ropeBtnColor = `rgb(${roR},${roG},${roB})`;

    if (isBroken) ctx.globalAlpha = 0.6;
    if (ropeObsSelected) {
      ctx.shadowColor = ropeBtnColor;
      ctx.shadowBlur = 10 * dScale;
    }
    ctx.fillStyle = ropeObsSelected ? ropeBtnColor : "rgba(10, 18, 30, 0.85)";
    ctx.strokeStyle = ropeBtnColor;
    ctx.lineWidth = 1.2 * dScale;
    ctx.beginPath();
    ctx.arc(midPx, ry, ropeBtnR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = ropeObsSelected ? "#07101e" : ropeBtnColor;
    ctx.font = `${Math.max(6, Math.round(8 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◉", midPx, ry);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1.0;

    observerHitTargets.push({ id: "rope", x: midPx, y: ry, r: ropeBtnR + 4 * dScale });
  }

  // Rope/Cable τ clock — always visible; pass actual tau, never null.
  // When broken: orange tint + dimmed to show last valid time at snap.
  {
    const [cR, cG, cB] = isTow ? [120, 180, 220] : ropeColorBell(isBroken ? 1 : strainRatio);
    const ropeClock_color = isBroken ? "rgb(255,105,55)" : `rgb(${cR},${cG},${cB})`;
    if (isBroken) ctx.globalAlpha = 0.55;
    drawClock(ctx, midPx, ry - 48 * dScale, midPx, ry,
      phys.tau_cable, isTow ? "CABLE τ" : "ROPE τ", ropeClock_color, dScale);
    ctx.globalAlpha = 1.0;
  }

  // Stretch annotation arrows (Bell's only, when taut)
  if (scenario === "bell" && !isBroken && stretch > 0.001) {
    const anY = ry + 16 * dScale;
    const [aR, aG, aB] = ropeColorBell(strainRatio);
    const rr = `rgba(${aR},${aG},${aB},0.65)`;
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
    ctx.fillStyle = `rgba(${aR},${aG},${aB},0.85)`;
    ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`stretch: ${stretch.toFixed(3)} L`, midPx, anY + 14 * dScale);
  }

  // Gap bracket
  const bY = cy + 115 * dScale;
  const gapColor = scenario === "tow" ? "rgba(102,229,255,0.35)" : "rgba(86,197,240,0.35)";
  const gapTextColor = scenario === "tow" ? "rgba(102,229,255,0.75)" : "rgba(86,197,240,0.65)";
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
  ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  const propGapLabel =
    scenario === "tow"
      ? `D = ${phys.prop_gap.toFixed(3)} L (constant — Born rigid)`
      : `γ·D = ${phys.prop_gap.toFixed(3)} L (expanding!)`;
  ctx.fillText(propGapLabel, (toSX(A_cx) + toSX(B_cx)) / 2, bY + 18 * dScale);

  // Frame annotation at bottom
  ctx.fillStyle = "rgba(86,197,240,0.35)";
  ctx.font = `700 ${Math.max(8, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText("SHIP B's COMOVING FRAME — both ships at rest here", 10 * dScale, CH - 10 * dScale);
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
  updateFrameDimming();
  render(phys);
}

function updateBadge(phys) {
  const { gamma, v, tau } = phys;
  el.badgeGamma.textContent = gamma.toFixed(4);
  el.badgeV.textContent = v.toFixed(4);

  // Show selected observer's proper time (at ship centre), or default tau
  let displayTau = tau;
  let obsLabel = "";
  if (state.selectedObserver === "A") {
    displayTau = phys.tau_A_center != null ? phys.tau_A_center : null;
    obsLabel = " [A]";
  } else if (state.selectedObserver === "B") {
    displayTau = phys.tau_B_center != null ? phys.tau_B_center : null;
    obsLabel = " [B]";
  } else if (state.selectedObserver === "rope") {
    displayTau = phys.tau_cable != null ? phys.tau_cable : null;
    obsLabel = phys.scenario === "tow" ? " [cable]" : " [rope]";
  }
  el.badgeTau.textContent = (displayTau != null ? displayTau.toFixed(3) : "—") + obsLabel;
}

function updateScenarioUI({ scenario }) {
  if (scenario === "tow") {
    el.scenarioBadge.className = "scenario-badge sb-tow";
    el.scenarioBadge.textContent = "Tow Mode";
    el.ropeLengthRow.classList.remove("visible");
    el.monitorTitle.textContent = "Cable Strain Monitor";
    el.ctrlBreakName.childNodes[0].textContent = "Cable Tolerance ";
    if (el.ctrlBreakTip) el.ctrlBreakTip.textContent =
      "Maximum fractional elongation the cable can endure. In Tow mode the cable never breaks relativistically — it only carries mechanical tension.";
    if (el.attachLabelA) el.attachLabelA.childNodes[0].textContent = "Cable Attachment Point";
    if (el.attachLabelB) el.attachLabelB.childNodes[0].textContent = "Cable Attachment Point";
  } else {
    el.scenarioBadge.className = "scenario-badge sb-bell";
    el.scenarioBadge.textContent = "Bell's Paradox";
    el.ropeLengthRow.classList.add("visible");
    el.monitorTitle.textContent = "Rope Strain Monitor";
    el.ctrlBreakName.childNodes[0].textContent = "Rope Break Strain ";
    if (el.ctrlBreakTip) el.ctrlBreakTip.textContent =
      "Maximum fractional elongation the rope can endure before snapping. A truly inextensible rope has near 0%. Higher values = more forgiving material.";
    if (el.attachLabelA) el.attachLabelA.childNodes[0].textContent = "Rope Attachment Point";
    if (el.attachLabelB) el.attachLabelB.childNodes[0].textContent = "Rope Attachment Point";
  }
}

// Grey out equations irrelevant to the current frame view
function updateFrameDimming() {
  const isProper = state.view === "proper";

  // These are primarily observer-frame concepts
  const obsDimWhenProper = [
    el.eqSlabLabel, el.eqSlab,
    el.eqLabgapLabel, el.eqLabgap,
    el.eqRlabLabel, el.eqRlab,
  ];
  // These are primarily proper-frame concepts
  const propDimWhenObs = [
    el.eqPropgapLabel, el.eqPropgap,
    el.eqRpropLabel, el.eqRprop,
  ];

  obsDimWhenProper.forEach(e => {
    if (e) { if (isProper) e.classList.add("eq-dimmed"); else e.classList.remove("eq-dimmed"); }
  });
  propDimWhenObs.forEach(e => {
    if (e) { if (!isProper) e.classList.add("eq-dimmed"); else e.classList.remove("eq-dimmed"); }
  });
}

function updateEquations(phys) {
  const {
    gamma, v, tau, S_lab,
    lab_gap, prop_gap,
    cable_lab, cable_prop,
    L_init, stretch, strain, isBroken, scenario,
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
    el.eqLinitFormula.textContent = "D+(ΔAttach)·S₀";

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
    el.eqStretchFormula.textContent = "max(0, cable_prop − L₀)";
    el.eqLinitFormula.textContent = `${state.ropeLength.toFixed(1)}×(D+(ΔAttach)·S₀)`;

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
      strain > state.breakStrain * 0.75 ? "var(--cable-warn)" : "var(--text-bright)";
  }

  if (scenario === "tow") {
    el.insightTitle.textContent = "🔗 Key Insight — Tow Mode (Born Rigid Motion)";
    el.insightEq.textContent = `Lab gap = D/γ = ${L_gap.toFixed(2)}/${gamma.toFixed(4)} = ${lab_gap.toFixed(4)} L`;
    el.insightSub.innerHTML =
      "When only Ship B fires and drags Ship A, the system undergoes <em>Born rigid acceleration</em>. The proper distance between ships stays constant at D. The lab gap Lorentz-contracts. The cable carries mechanical tension but never stretches — it will not snap from relativistic effects.";
  } else {
    el.insightTitle.textContent = "⚡ Key Insight — Bell's Paradox";
    el.insightEq.textContent = `Stretch = max(0, cable_prop − L₀) = ${stretch.toFixed(4)} L`;
    el.insightSub.innerHTML =
      "The absolute stretch equals D·(γ−1) regardless of where the rope is attached. Moving attachment points apart only lengthens L₀ — reducing the <em>percentage</em> of strain without reducing the absolute elongation. A fragile rope snaps almost immediately once taut.";
  }
}

function updateStrainBar({ strain, isBroken, stretch, scenario, slackFraction }) {
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
    } else if (slackFraction > 0.005) {
      el.statusBadge.className = "status-badge s-slack";
      el.statusBadge.textContent = "SLACK";
      el.svStrain.style.color = "var(--text-dim)";
    } else if (ratio > 0.72) {
      el.statusBadge.className = "status-badge s-tension";
      el.statusBadge.textContent = "HIGH TENSION";
      el.svStrain.style.color = "var(--cable-warn)";
    } else {
      el.statusBadge.className = "status-badge s-intact";
      el.statusBadge.textContent = "TAUT";
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

  // Rope length buttons
  document.querySelectorAll(".rope-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".rope-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.ropeLength = parseFloat(btn.dataset.rope);
      el.valRopeLength.textContent = state.ropeLength.toFixed(1) + " × D";
      updateAll();
    });
  });

  document.querySelectorAll('input[name="scenario"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      state.scenario = e.target.value;
      $("sc-bell").className = "scenario-card" + (state.scenario === "bell" ? " active-bell" : "");
      $("sc-tow").className = "scenario-card" + (state.scenario === "tow" ? " active-tow" : "");
      updateAll();
    });
  });

  el.btnPlay.addEventListener("click", () =>
    state.isPlaying ? pause() : play(),
  );
  el.btnReset.addEventListener("click", reset);

  document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".speed-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.speed = +btn.dataset.speed;
    });
  });

  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".view-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.view = tab.dataset.view;
      updateAll();
    });
  });

  // ── Observer button click + hover handlers ──
  el.canvas.addEventListener("click", (e) => {
    const rect = el.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mx = (e.clientX - rect.left);
    const my = (e.clientY - rect.top);

    let hit = null;
    for (const target of observerHitTargets) {
      const dx = mx - target.x;
      const dy = my - target.y;
      if (dx * dx + dy * dy <= target.r * target.r) {
        hit = target.id;
        break;
      }
    }

    if (hit) {
      // Toggle: if already selected, deselect; otherwise select
      state.selectedObserver = state.selectedObserver === hit ? null : hit;
      updateAll();
    }
  });

  el.canvas.addEventListener("mousemove", (e) => {
    const rect = el.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left);
    const my = (e.clientY - rect.top);

    let overButton = false;
    for (const target of observerHitTargets) {
      const dx = mx - target.x;
      const dy = my - target.y;
      if (dx * dx + dy * dy <= target.r * target.r) {
        overButton = true;
        break;
      }
    }
    el.canvas.style.cursor = overButton ? "pointer" : "default";
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
