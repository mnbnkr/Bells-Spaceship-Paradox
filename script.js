// ═══════════════════════════════════════════════
// CONSTANTS & STATE
// ═══════════════════════════════════════════════
const Physics = window.RelativityPhysics;
const { S0 } = Physics;

const state = {
  t: 0.0,
  a: 0.8,
  L_gap: 3.0,
  breakStrain: 0.001,
  aA: 0.0,
  aB: 0.0,
  ropeLength: 1.5, // Rope natural length as multiple of D (1.0, 1.5, 2.0)
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
  slRopeLength: $("sl-rope-length"),
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
  observerBadge: $("observer-badge"),

  eqV: $("eq-v"),
  eqVFormula: $("eq-v-formula"),
  eqGamma: $("eq-gamma"),
  eqGammaFormula: $("eq-gamma-formula"),
  eqTau: $("eq-tau"),
  eqTauFormula: $("eq-tau-formula"),
  eqSlab: $("eq-slab"),
  eqSlabFormula: $("eq-slab-formula"),
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
  eqRpropFormula: $("eq-rprop-formula"),
  eqRpropLabel: $("eq-rprop-label"),
  eqStretchLabelText: $("eq-stretch-label-text"),
  eqStretch: $("eq-stretch"),
  eqStretchFormula: $("eq-stretch-formula"),
  eqStrainLabelText: $("eq-strain-label-text"),
  eqStrainFormula: $("eq-strain-formula"),
  eqStrain: $("eq-strain"),
  eqMechDivider: $("eq-mech-divider"),
  eqMechLabel: $("eq-mech-label"),
  eqMech: $("eq-mech"),

  insightTitle: $("insight-title"),
  insightEq: $("insight-eq"),
  insightSub: $("insight-sub"),

  svStrain: $("sv-strain"),
  svStrainLabel: $("sv-strain-label"),
  svBreakLabel: $("sv-break-label"),
  svBreak: $("sv-break"),
  svStretchLabel: $("sv-stretch-label"),
  svStretch: $("sv-stretch"),
  statusBadge: $("status-badge"),
  strainFill: $("strain-fill"),
  strainBarNote: $("strain-bar-note"),
  towExtra: $("tow-extra"),
  svMechLoad: $("sv-mech-load"),
  svTowGap: $("sv-tow-gap"),

  ropeLengthRow: $("rope-length-row"),
  breakControlRow: $("break-control-row"),
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

function compute() {
  return Physics.compute(state);
}

function selectedProperObserver() {
  return state.selectedObserver || "B";
}

function selectedObserverName(phys = null) {
  if (state.view === "lab") return "Lab frame";
  const selected = selectedProperObserver();
  if (selected === "A") return "Ship A";
  if (selected === "rope") {
    if (phys?.scenario === "born") return "Reference midpoint";
    return phys?.scenario === "tow" ? "Cable midpoint" : "Rope midpoint";
  }
  return "Ship B";
}

function selectedObserverVelocity(phys) {
  if (Number.isFinite(phys.observerVelocity)) return phys.observerVelocity;
  const selected = selectedProperObserver();
  if (selected === "A") return phys.vA ?? phys.v;
  if (selected === "rope") return ((phys.vA ?? phys.v) + (phys.vB ?? phys.v)) / 2;
  return phys.vB ?? phys.v;
}

function strainRatioForDisplay(phys) {
  if (!phys.strainDefined || phys.spanDegenerate) return 0;
  if (phys.scenario === "born") return 0;
  if (phys.scenario === "tow") return Math.min(1, phys.loadIndex ?? phys.towLoad ?? 0);
  return Math.min(1, phys.strain / Math.max(Physics.EPS, state.breakStrain));
}

function formatStrainPercent(phys) {
  if (!phys.strainDefined || phys.spanDegenerate) return "n/a";
  return `${(phys.strain * 100).toFixed(3)}%`;
}

function formatLoadIndex(phys) {
  if (!phys.strainDefined || phys.spanDegenerate) return "n/a";
  return `${(phys.loadIndex ?? phys.towLoad ?? 0).toFixed(3)}× ref`;
}

function formatFixed(value, digits = 4, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(digits)}${suffix}`;
}

function connectorClockLabel(scenario) {
  if (scenario === "born") return "REF τ";
  return scenario === "tow" ? "CABLE τ" : "ROPE τ";
}

function frameClockTau(phys, key) {
  if (state.view === "proper") {
    return phys[`slice_tau_${key}`] ?? null;
  }
  return phys[`clock_tau_${key}`] ?? null;
}

function displayedProperGap(phys) {
  if (state.view === "proper" && Number.isFinite(phys?.slice_gap)) {
    return phys.slice_gap;
  }
  return phys?.prop_gap ?? 0;
}

function displayedCableSpan(phys) {
  if (state.view === "proper" && Number.isFinite(phys?.slice_cable_span)) {
    return phys.slice_cable_span;
  }
  return phys?.cable_prop ?? 0;
}

function setLeadingText(element, value) {
  if (element?.childNodes[0]) element.childNodes[0].textContent = value;
}

function plumeAlphaForDisplay(phys, alpha) {
  return alpha;
}

function updateRopeLengthValue(labelText = null) {
  if (labelText) {
    el.valRopeLength.textContent = labelText;
    return;
  }
  el.valRopeLength.textContent = `${state.ropeLength.toFixed(1)} × span`;
}

function updateBreakControlValue(scenario = state.scenario) {
  if (!el.valBreak) return;
  if (scenario === "born") {
    el.valBreak.textContent = "exact";
    return;
  }
  if (scenario === "tow") {
    el.valBreak.textContent = `${(state.breakStrain * 1000).toFixed(1)} ref`;
  } else {
    el.valBreak.textContent = `${(state.breakStrain * 100).toFixed(1)}%`;
  }
}

function setBreakControlEnabled(enabled) {
  if (!el.breakControlRow || !el.slBreak) return;
  el.breakControlRow.classList.toggle("disabled", !enabled);
  el.slBreak.disabled = !enabled;
  el.slBreak.setAttribute("aria-disabled", enabled ? "false" : "true");
}

function setRopeLengthControlEnabled(enabled, labelText = null) {
  if (!el.ropeLengthRow || !el.slRopeLength) return;
  el.ropeLengthRow.classList.toggle("disabled", !enabled);
  el.slRopeLength.disabled = !enabled;
  el.slRopeLength.setAttribute("aria-disabled", enabled ? "false" : "true");
  updateRopeLengthValue(labelText);
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

function drawRopeVisual(
  ctx,
  rxA,
  rxB,
  ry,
  slackFraction,
  strainRatio,
  isBroken,
  scenario,
  dScale,
  now,
) {
  const isCable = scenario !== "bell";
  const isBorn = scenario === "born";
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

    // Two drooping halves, each hangs near its own ship
    ctx.lineWidth = 2.0 * dScale;
    ctx.strokeStyle = `rgba(220, 110, 55, 0.95)`;
    ctx.shadowColor = `rgba(255, 90, 40, 0.75)`;
    ctx.shadowBlur = 10 * dScale;

    // Left half (Ship A's side)
    ctx.beginPath();
    ctx.moveTo(rxA, ry);
    ctx.bezierCurveTo(
      rxA + retractLen * 0.35,
      ry + 8 * dScale,
      rxA + retractLen * 0.75,
      droopY - 2 * dScale,
      leftEndX,
      leftEndY,
    );
    ctx.stroke();

    // Right half (Ship B's side)
    ctx.beginPath();
    ctx.moveTo(rxB, ry);
    ctx.bezierCurveTo(
      rxB - retractLen * 0.35,
      ry + 8 * dScale,
      rxB - retractLen * 0.75,
      droopY - 2 * dScale,
      rightEndX,
      rightEndY,
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Frayed ends, fiber wisps at each broken tip
    const frayOffsetsLeft = [
      [4, -3, 0.5, 7],
      [6, 2, 0.9, 6],
      [2, 4, 5],
      [8, -1, 0.3, 8],
      [5, 3, 0.7, 6],
    ];
    const frayOffsetsRight = [
      [-4, -3, -0.5, 7],
      [-6, 2, -0.9, 6],
      [-2, 4, -1.2, 5],
      [-8, -1, -0.3, 8],
      [-5, 3, -0.7, 6],
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

    // Floating sparks split between both broken ends
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + now * 0.001 * 0.6;
      const dist =
        (3 + Math.sin(now * 0.0018 + i * 0.9) * 5 + i * 1.1) * dScale;
      const px = leftEndX + Math.cos(angle) * dist;
      const py = leftEndY + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(255,${88 + i * 20},0,${0.55 - i * 0.06})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.3 * dScale, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + now * 0.001 * 0.6 + 0.5;
      const dist =
        (3 + Math.sin(now * 0.0018 + i * 0.9 + 1.5) * 5 + i * 1.1) * dScale;
      const px = rightEndX + Math.cos(angle) * dist;
      const py = rightEndY + Math.sin(angle) * dist;
      ctx.fillStyle = `rgba(255,${88 + i * 20},0,${0.55 - i * 0.06})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.3 * dScale, 0, Math.PI * 2);
      ctx.fill();
    }

    // "ROPE SNAPPED" label centered between ships
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
  if (isCable) {
    r = 120;
    g = 180;
    b = 220;
  } else {
    [r, g, b] = ropeColorBell(strainRatio);
  }

  const ropeThick = isCable
    ? Math.max(2.5, 1.5 + state.breakStrain / 0.02) * dScale
    : 1.8 * dScale;
  const glow = isCable ? 4 : strainRatio > 0.45 ? 3 + strainRatio * 10 : 2;

  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth = ropeThick;
  ctx.shadowColor = `rgb(${r},${g},${b})`;
  ctx.shadowBlur = glow * dScale;

  if (isCable || slackFraction < 0.004) {
    // Straight taut line
    ctx.beginPath();
    ctx.moveTo(rxA, ry);
    ctx.lineTo(rxB, ry);
    ctx.stroke();
  } else {
    // Sinusoidal slack rope
    // Number of half-cycles based on rope length factor
    const n_half =
      state.ropeLength <= 1.0 ? 1 : state.ropeLength <= 1.5 ? 3 : 5;
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

  if (isCable) {
    ctx.fillStyle = "rgba(120,180,220,0.8)";
    ctx.font = `${Math.max(9, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    const label = isBorn
      ? dScale < 0.75
        ? "BORN-RIGID REFERENCE"
        : "BORN-RIGID REFERENCE, NO MATERIAL ROPE"
      : dScale < 0.75
        ? "STIFF STEEL CABLE"
        : "STIFF STEEL CABLE, SMALL ELASTIC STRAIN";
    ctx.fillText(label, midX, ry + 18 * dScale);
  }
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
  nullLabel = "N/A",
) {
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

  ctx.font = `700 ${Math.max(9, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  if (timeVal === null) {
    ctx.fillStyle = "rgba(216, 236, 255, 0.58)";
    if (nullLabel.length > 7) {
      ctx.font = `700 ${Math.max(7, Math.round(9 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    }
    ctx.fillText(nullLabel, px, py + 4 * dScale);
  } else {
    ctx.fillStyle = color;
    ctx.fillText(timeVal.toFixed(3) + "y", px, py + 4 * dScale);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  ctx.font = `${Math.max(7, Math.round(8 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.fillText(label, px, py - 16 * dScale);
}

// ═══════════════════════════════════════════════
// RENDER - DISPATCH
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
    S_lab_B,
    C_A,
    C_B,
    E_A,
    E_B,
    F_A,
    F_B,
    P_A,
    P_B,
    rocketAlphaA,
    rocketAlphaB,
    strain,
    isBroken,
    slackFraction,
    scenario,
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
  const compactCanvas = CW < 520;

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

  function drawShip(
    cx_phys,
    ePosPhys,
    fPosPhys,
    pPosPhys,
    color,
    label,
    hasEngine,
    thrustAlpha = state.a,
  ) {
    const sx = toSX(Math.min(ePosPhys, fPosPhys));
    const sw = Math.max(5 * dScale, Math.abs(toSX(fPosPhys) - toSX(ePosPhys)));
    const sy = cy - sh / 2;
    const esx = toSX(ePosPhys);
    const psx = toSX(pPosPhys);

    if (hasEngine) {
      const displayAlpha = plumeAlphaForDisplay(phys, thrustAlpha);
      const alphaNorm = Math.max(0, Math.min(1, displayAlpha / 1.5));
      const flicker =
        scenario === "born"
          ? 0
          : Math.sin(now * 0.055 + (label === "A" ? 0 : 1.8)) * 2.5 +
            Math.sin(now * 0.022 + (label === "A" ? 0 : 2.5)) * 1.8;
      const flameLen =
        Math.max(2, 7 + 26 * alphaNorm + flicker) *
        dScale;

      const fg = ctx.createLinearGradient(esx, cy, esx - flameLen, cy);
      fg.addColorStop(0, `rgba(70,210,255,${0.55 + 0.37 * alphaNorm})`);
      fg.addColorStop(0.45, `rgba(70,210,255,${0.14 + 0.22 * alphaNorm})`);
      fg.addColorStop(1, "rgba(70,210,255,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(esx, cy - 7 * dScale);
      ctx.lineTo(esx - flameLen, cy);
      ctx.lineTo(esx, cy + 7 * dScale);
      ctx.closePath();
      ctx.fill();

      const ig = ctx.createRadialGradient(esx, cy, 0, esx, cy, 11 * dScale);
      ig.addColorStop(0, `rgba(110,230,255,${0.35 + 0.4 * alphaNorm})`);
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

    const noseX = toSX(Math.max(ePosPhys, fPosPhys));
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
  }

  const engineAlphaA = phys.engineAlphaA ?? rocketAlphaA;
  const engineAlphaB = phys.engineAlphaB ?? rocketAlphaB;
  const hasEngineA = engineAlphaA > 0;
  const hasEngineB = engineAlphaB > 0;
  const sh_half = sh / 2;

  // Draw clocks FIRST (behind ship labels).
  // Stagger A and B clocks vertically to prevent horizontal overlap when ships are close,
  // and draw B's clocks before A's so any faint lines from A don't cross B's boxes.
  const clockY_A = cy + sh_half + 58 * dScale;
  const clockY_B = cy + sh_half + 88 * dScale;
  const targetY = cy + sh_half;
  const sxCA = toSX(C_A);
  const sxCB = toSX(C_B);
  const clockOffset = 34 * dScale;

  drawClock(
    ctx,
    sxCB - clockOffset,
    clockY_B,
    toSX(E_B),
    targetY,
    phys.clock_tau_B_back,
    "B-REAR τ",
    "#66e5ff",
    dScale,
  );
  drawClock(
    ctx,
    sxCB + clockOffset,
    clockY_B,
    toSX(F_B),
    targetY,
    phys.clock_tau_B_front,
    "B-FRONT τ",
    "#66e5ff",
    dScale,
  );
  drawClock(
    ctx,
    sxCA - clockOffset,
    clockY_A,
    toSX(E_A),
    targetY,
    phys.clock_tau_A_back,
    "A-REAR τ",
    "#ffb866",
    dScale,
  );
  drawClock(
    ctx,
    sxCA + clockOffset,
    clockY_A,
    toSX(F_A),
    targetY,
    phys.clock_tau_A_front,
    "A-FRONT τ",
    "#ffb866",
    dScale,
  );

  // Draw Ships
  drawShip(
    C_A,
    E_A !== null ? E_A : C_A - 0.5 * S_lab,
    F_A !== null ? F_A : C_A + 0.5 * S_lab,
    P_A,
    "#ffb866",
    "A",
    hasEngineA,
    engineAlphaA,
  );
  drawShip(
    C_B,
    E_B,
    F_B !== null ? F_B : C_B + 0.5 * S_lab_B,
    P_B,
    "#66e5ff",
    "B",
    hasEngineB,
    engineAlphaB,
  );

  // Ship Labels
  ctx.fillStyle = "#ffb866";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP A`, sxCA, cy + sh_half + 18 * dScale);
  ctx.fillStyle = "rgba(150,200,245,0.55)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.fillText(`lab slice: ${S_lab.toFixed(3)} L`, sxCA, cy + sh_half + 32 * dScale);

  ctx.fillStyle = "#66e5ff";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP B`, sxCB, cy + sh_half + 18 * dScale);
  ctx.fillStyle = "rgba(150,200,245,0.55)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.fillText(
    `lab slice: ${S_lab_B.toFixed(3)} L`,
    sxCB,
    cy + sh_half + 32 * dScale,
  );

  // ── ROPE / CABLE ──
  const rxA = toSX(P_A);
  const rxB = toSX(P_B);
  const ry_rope = cy - 55 * dScale;
  const midX = (rxA + rxB) / 2;
  const strainRatio = strainRatioForDisplay(phys);
  const isCable = scenario !== "bell";

  drawRopeVisual(
    ctx,
    rxA,
    rxB,
    ry_rope,
    slackFraction,
    strainRatio,
    isBroken,
    scenario,
    dScale,
    now,
  );

  // Rope/Cable tau clock is always visible, orange and dimmed when broken.
  {
    const [cR, cG, cB] = isCable
      ? [120, 180, 220]
      : ropeColorBell(isBroken ? 1 : strainRatio);
    const clockColor = isBroken ? "rgb(255,105,55)" : `rgb(${cR},${cG},${cB})`;
    if (isBroken) ctx.globalAlpha = 0.5;
    const ropeClockLift = compactCanvas ? 76 : 44;
    const ropeClockY = Math.max(20 * dScale, ry_rope - ropeClockLift * dScale);
    drawClock(
      ctx,
      midX,
      ropeClockY,
      midX,
      ry_rope,
      phys.clock_tau_cable,
      connectorClockLabel(scenario),
      clockColor,
      dScale,
    );
    ctx.globalAlpha = 1.0;
  }

  // Stretch annotation in lab frame (Bell's only, when taut)
  if (scenario === "bell" && !isBroken && strain > 0.001) {
    const L_init = phys.L_init;
    const halfNat = ((L_init / S0) * (S_lab * scale)) / 2;
    const anY = ry_rope + 14 * dScale;
    const [cR, cG, cB] = ropeColorBell(strainRatio);
    ctx.fillStyle = `rgba(${cR},${cG},${cB},0.75)`;
    ctx.font = `${Math.max(9, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`stretch: ${phys.stretch.toFixed(3)} L`, midX, anY);
  }

  // ── Gap bracket ──
  const bY = cy + 125 * dScale;
  const gapColor = isCable
    ? "rgba(102,229,255,0.3)"
    : "rgba(86,197,240,0.28)";
  const gapTextColor = isCable
    ? "rgba(102,229,255,0.7)"
    : "rgba(86,197,240,0.55)";

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
    scenario === "bell"
      ? `D = ${state.L_gap.toFixed(1)} L (constant in lab)`
      : scenario === "tow"
        ? `Δx = ${phys.lab_gap.toFixed(3)} L (contracted tow span)`
        : `Δx = ${phys.lab_gap.toFixed(3)} L (lab slice)`;
  ctx.fillText(gapLabel, (sxCA + sxCB) / 2, bY + 18 * dScale);

}

function renderProper(phys) {
  const ctx = el.ctx;
  const {
    strain,
    isBroken,
    slackFraction,
    L_init,
    stretch,
    scenario,
    rocketAlphaA,
    rocketAlphaB,
  } = phys;
  ctx.clearRect(0, 0, CW, CH);
  observerHitTargets = [];

  const dScale = (CW / 800) * 1.35;
  const frameV = selectedObserverVelocity(phys);

  // Doppler Shift Background
  const dopplerGradient = ctx.createLinearGradient(0, 0, CW, 0);
  dopplerGradient.addColorStop(
    0,
    `rgba(${12 + 150 * frameV}, ${32 - 20 * frameV}, ${72 - 40 * frameV}, ${0.45 + 0.2 * frameV})`,
  );
  dopplerGradient.addColorStop(0.5, `rgba(12, 32, 72, 0.45)`);
  dopplerGradient.addColorStop(
    1,
    `rgba(${12 - 10 * frameV}, ${32 + 50 * frameV}, ${72 + 150 * frameV}, ${0.45 + 0.2 * frameV})`,
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

  const frameX = (sample, fallback) =>
    Number.isFinite(sample?.x) ? sample.x : fallback;
  const A_cx = frameX(phys.frame_A_center, 0);
  const B_cx = frameX(phys.frame_B_center, displayedProperGap(phys));
  const properGap = Math.max(0, B_cx - A_cx);
  const A_back = frameX(phys.frame_A_back, A_cx - S0 / 2);
  const A_front = frameX(phys.frame_A_front, A_cx + S0 / 2);
  const B_back = frameX(phys.frame_B_back, B_cx - S0 / 2);
  const B_front = frameX(phys.frame_B_front, B_cx + S0 / 2);
  const A_left = Math.min(A_back, A_front);
  const A_right = Math.max(A_back, A_front);
  const B_left = Math.min(B_back, B_front);
  const B_right = Math.max(B_back, B_front);
  const A_span = Math.max(Physics.EPS, A_right - A_left);
  const B_span = Math.max(Physics.EPS, B_right - B_left);
  const A_attach = frameX(phys.frame_A_attach, A_cx + state.aA * S0);
  const B_attach = frameX(phys.frame_B_attach, B_cx + state.aB * S0);
  const cableCenter = frameX(phys.frame_cable, (A_attach + B_attach) / 2);
  const BASE_PROPER = 8.0;
  const neededProper = properGap + A_span + B_span + S0 * 1.2;
  const totalW = Math.max(BASE_PROPER, neededProper);
  const scaleP = CW / totalW; // camera scale (zooms out with gap)
  const camX_p = (A_cx + B_cx) / 2;
  const toSX = (x) => (x - camX_p) * scaleP + CW / 2;
  const cy = Math.round(CH * 0.42);
  const sh = 38 * dScale;
  const compactCanvas = CW < 520;

  ctx.strokeStyle = "rgba(86,197,240,0.055)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(CW, cy);
  ctx.stroke();

  const sxA_center = toSX(A_cx);
  const sxB_center = toSX(B_cx);
  const psx_A = toSX(A_attach);
  const psx_B = toSX(B_attach);
  const ry = cy - 55 * dScale;

  const halfNat = (L_init * scaleP) / 2;
  const midPx = (psx_A + psx_B) / 2;

  // L0 natural length indicator, hidden when "ROPE SNAPPED" text is drawn.
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
    if (!compactCanvas) {
      ctx.fillStyle = "rgba(160,176,192,0.65)";
      ctx.font = `${Math.max(9, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(
        `L₀ = ${L_init.toFixed(3)} L (natural)`,
        midPx,
        ry - 18 * dScale,
      );
    }
  }

  function drawProperShip(
    cx,
    left,
    right,
    color,
    label,
    hasEngine,
    thrustAlpha = state.a,
  ) {
    const sxL = toSX(left);
    const sw = Math.max(5 * dScale, toSX(right) - toSX(left));
    const sy = cy - sh / 2;
    const esx = sxL;

    if (hasEngine) {
      const displayAlpha = plumeAlphaForDisplay(phys, thrustAlpha);
      const alphaNorm = Math.max(0, Math.min(1, displayAlpha / 1.5));
      const flicker =
        scenario === "born"
          ? 0
          : Math.sin(now * 0.055 + (label === "A" ? 0 : 1.8)) * 2.5;
      const flameLen = Math.max(3, 7 + 26 * alphaNorm + flicker) * dScale;

      const fg = ctx.createLinearGradient(esx, cy, esx - flameLen, cy);
      fg.addColorStop(0, `rgba(70,210,255,${0.55 + 0.37 * alphaNorm})`);
      fg.addColorStop(0.45, `rgba(70,210,255,${0.14 + 0.22 * alphaNorm})`);
      fg.addColorStop(1, "rgba(70,210,255,0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(esx, cy - 7 * dScale);
      ctx.lineTo(esx - flameLen, cy);
      ctx.lineTo(esx, cy + 7 * dScale);
      ctx.closePath();
      ctx.fill();

      const ig = ctx.createRadialGradient(esx, cy, 0, esx, cy, 11 * dScale);
      ig.addColorStop(0, `rgba(110,230,255,${0.35 + 0.4 * alphaNorm})`);
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

    // ── Observer button inside ship ──
    const obsId = label === "A" ? "A" : "B";
    const isSelected =
      state.selectedObserver === obsId ||
      (state.selectedObserver === null && obsId === "B");
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

    observerHitTargets.push({
      id: obsId,
      x: btnX,
      y: btnY,
      r: btnR + 4 * dScale,
    });
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

  // Draw clocks FIRST (behind ships).
  // Staggering A and B clocks vertically to prevent horizontal overlap when ships are close.
  // Drawing B's clocks before A's so any faint lines from A don't cross B's boxes.
  const clockY_A = cy + sh / 2 + 58 * dScale;
  const clockY_B = cy + sh / 2 + 88 * dScale;
  const targetY = cy + sh / 2;
  const clockOffset = 34 * dScale;

  drawClock(
    ctx,
    sxB_center - clockOffset,
    clockY_B,
    toSX(B_left),
    targetY,
    frameClockTau(phys, "B_back"),
    "B-REAR τ",
    "#66e5ff",
    dScale,
    "PRE-START",
  );
  drawClock(
    ctx,
    sxB_center + clockOffset,
    clockY_B,
    toSX(B_right),
    targetY,
    frameClockTau(phys, "B_front"),
    "B-FRONT τ",
    "#66e5ff",
    dScale,
    "PRE-START",
  );
  drawClock(
    ctx,
    sxA_center - clockOffset,
    clockY_A,
    toSX(A_left),
    targetY,
    frameClockTau(phys, "A_back"),
    "A-REAR τ",
    "#ffb866",
    dScale,
    "PRE-START",
  );
  drawClock(
    ctx,
    sxA_center + clockOffset,
    clockY_A,
    toSX(A_right),
    targetY,
    frameClockTau(phys, "A_front"),
    "A-FRONT τ",
    "#ffb866",
    dScale,
    "PRE-START",
  );

  const engineAlphaA = phys.engineAlphaA ?? rocketAlphaA;
  const engineAlphaB = phys.engineAlphaB ?? rocketAlphaB;
  const engineActiveA =
    engineAlphaA > 0 && phys.frame_A_center?.missionActive !== false;
  const engineActiveB =
    engineAlphaB > 0 && phys.frame_B_center?.missionActive !== false;
  drawProperShip(
    A_cx,
    A_left,
    A_right,
    "#ffb866",
    "A",
    engineActiveA,
    engineAlphaA,
  );
  drawProperShip(
    B_cx,
    B_left,
    B_right,
    "#66e5ff",
    "B",
    engineActiveB,
    engineAlphaB,
  );
  drawProperPylon(psx_A);
  drawProperPylon(psx_B);

  // Ship Labels
  ctx.fillStyle = "#ffb866";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP A`, sxA_center, cy + sh / 2 + 18 * dScale);
  ctx.fillStyle = "rgba(150,195,240,0.45)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.fillText(
    `slice length = ${A_span.toFixed(3)} L`,
    sxA_center,
    cy + sh / 2 + 32 * dScale,
  );

  ctx.fillStyle = "#66e5ff";
  ctx.font = `600 ${Math.max(10, Math.round(12 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`SHIP B`, sxB_center, cy + sh / 2 + 18 * dScale);
  ctx.fillStyle = "rgba(150,195,240,0.45)";
  ctx.font = `${Math.max(8, Math.round(10 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
  ctx.fillText(
    `slice length = ${B_span.toFixed(3)} L`,
    sxB_center,
    cy + sh / 2 + 32 * dScale,
  );

  // ── ROPE / CABLE (Proper Frame) ──
  const strainRatio = strainRatioForDisplay(phys);
  const isCable = scenario !== "bell";

  drawRopeVisual(
    ctx,
    psx_A,
    psx_B,
    ry,
    slackFraction,
    strainRatio,
    isBroken,
    scenario,
    dScale,
    now,
  );

  // Observer star marker follows selectedObserver and is drawn above the cable.
  {
    const obs = selectedProperObserver();
    let starX, starY, starColor;
    if (obs === "A") {
      starX = sxA_center;
      starY = ry - 14 * dScale;
      starColor = "rgba(255,184,102,0.9)";
    } else if (obs === "rope") {
      starX = toSX(cableCenter);
      starY = ry;
      const [roR, roG, roB] = isCable
        ? [120, 180, 220]
        : ropeColorBell(strainRatio);
      starColor = `rgb(${roR},${roG},${roB})`;
    } else {
      starX = sxB_center;
      starY = ry - 14 * dScale;
      starColor = "rgba(102,229,255,0.9)";
    }
    ctx.fillStyle = starColor;
    ctx.font = `bold ${Math.max(10, Math.round(11 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText("★", starX, starY);
    if (!compactCanvas) {
      ctx.globalAlpha = 0.72;
      ctx.font = `${Math.max(7, Math.round(8 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
      ctx.fillText("OBSERVER", starX, starY + 11 * dScale);
      ctx.globalAlpha = 1.0;
    }
  }

  // Rope/Cable observer button at midpoint, visible even after break.
  {
    const ropeObsSelected = state.selectedObserver === "rope";
    const ropeBtnR = 6 * dScale;
    const [roR, roG, roB] = isBroken
      ? [180, 140, 100] // muted brown when broken
      : isCable
        ? [120, 180, 220]
        : ropeColorBell(strainRatio);
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
    const ropeButtonX = toSX(cableCenter);
    ctx.arc(ropeButtonX, ry, ropeBtnR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = ropeObsSelected ? "#07101e" : ropeBtnColor;
    ctx.font = `${Math.max(6, Math.round(8 * dScale))}px 'JetBrains Mono', 'Space Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◉", ropeButtonX, ry);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1.0;

    observerHitTargets.push({
      id: "rope",
      x: ropeButtonX,
      y: ry,
      r: ropeBtnR + 4 * dScale,
    });
  }

  // Rope/Cable tau clock is always visible. In Proper Frame, it uses the
  // selected simultaneity slice sample and can be outside the modeled mission.
  // When broken: orange tint + dimmed to show the last valid rope state.
  {
    const [cR, cG, cB] = isCable
      ? [120, 180, 220]
      : ropeColorBell(isBroken ? 1 : strainRatio);
    const ropeClock_color = isBroken
      ? "rgb(255,105,55)"
      : `rgb(${cR},${cG},${cB})`;
    if (isBroken) ctx.globalAlpha = 0.55;
    drawClock(
      ctx,
      toSX(cableCenter),
      ry - (compactCanvas ? 76 : 44) * dScale,
      toSX(cableCenter),
      ry,
      frameClockTau(phys, "cable"),
      connectorClockLabel(scenario),
      ropeClock_color,
      dScale,
      "PRE-START",
    );
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
  const bY = cy + 125 * dScale;
  const gapColor = isCable
    ? "rgba(102,229,255,0.35)"
    : "rgba(86,197,240,0.35)";
  const gapTextColor = isCable
    ? "rgba(102,229,255,0.75)"
    : "rgba(86,197,240,0.65)";
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
    `selected MCIF center span = ${properGap.toFixed(3)} L`;
  ctx.fillText(propGapLabel, (toSX(A_cx) + toSX(B_cx)) / 2, bY + 18 * dScale);

}

// ═══════════════════════════════════════════════
// UI UPDATE
// ═══════════════════════════════════════════════
function updateAll() {
  const phys = compute();
  updateBadge(phys);
  updateObserverBadge(phys);
  updateEquations(phys);
  updateStrainBar(phys);
  updateScenarioUI(phys);
  updateFrameDimming();
  render(phys);
}

function updateBadge(phys) {
  const { tau } = phys;
  const displayV = state.view === "proper" ? selectedObserverVelocity(phys) : phys.v;
  const displayGamma = 1 / Math.sqrt(1 - displayV * displayV);
  el.badgeGamma.textContent = displayGamma.toFixed(4);
  el.badgeV.textContent = displayV.toFixed(4);

  // Show selected observer's proper time (at ship centre), or default tau
  let displayTau = state.view === "proper"
    ? phys.clock_tau_B_center
    : tau;
  let obsLabel = "";
  const selected = state.view === "proper" ? selectedProperObserver() : state.selectedObserver;
  if (selected === "A") {
    displayTau = phys.clock_tau_A_center != null ? phys.clock_tau_A_center : null;
    obsLabel = " [A]";
  } else if (selected === "B") {
    displayTau = phys.clock_tau_B_center != null ? phys.clock_tau_B_center : null;
    obsLabel = " [B]";
  } else if (selected === "rope") {
    displayTau = phys.clock_tau_cable != null ? phys.clock_tau_cable : null;
    obsLabel =
      phys.scenario === "bell"
        ? " [rope]"
        : phys.scenario === "tow"
          ? " [cable]"
          : " [ref]";
  }
  el.badgeTau.textContent =
    (displayTau != null ? displayTau.toFixed(3) : "n/a") + obsLabel;
}

function updateObserverBadge(phys) {
  if (!el.observerBadge) return;
  const scenarioLabel =
    phys.scenario === "bell"
      ? "Bell"
      : phys.scenario === "tow"
        ? "Strong Tow"
        : "Born Reference";
  el.observerBadge.textContent =
    state.view === "lab"
      ? `Observer: lab frame · ${scenarioLabel}`
      : `Proper slice: ${selectedObserverName(phys)} · ${scenarioLabel}`;
}

function updateScenarioUI({ scenario }) {
  if (scenario === "bell") {
    el.scenarioBadge.className = "scenario-badge sb-bell";
    el.scenarioBadge.textContent = "Bell's Paradox";
    setBreakControlEnabled(true);
    updateBreakControlValue(scenario);
    setRopeLengthControlEnabled(true);
    el.monitorTitle.textContent = "Rope Proxy Monitor";
    el.ctrlBreakName.childNodes[0].textContent = "Rope Break Strain ";
    if (el.ctrlBreakTip)
      el.ctrlBreakTip.textContent =
        "Maximum fractional elongation used by Bell's kinematic break proxy. A truly inextensible idealization has near 0%. This control is not a full material-stress model.";
    if (el.attachLabelA)
      el.attachLabelA.childNodes[0].textContent = "Rope Attachment Point";
    if (el.attachLabelB)
      el.attachLabelB.childNodes[0].textContent = "Rope Attachment Point";
  } else if (scenario === "tow") {
    el.scenarioBadge.className = "scenario-badge sb-tow";
    el.scenarioBadge.textContent = "Strong Tow";
    setBreakControlEnabled(true);
    updateBreakControlValue(scenario);
    setRopeLengthControlEnabled(false, "fixed span");
    el.monitorTitle.textContent = "Tow Load Monitor";
    el.ctrlBreakName.childNodes[0].textContent = "Tow Load Reference ";
    if (el.ctrlBreakTip)
      el.ctrlBreakTip.textContent =
        "Normalized load reference used to scale the tow load index. The loaded steel cable remains intact, contracts in the lab frame, and develops only a small elastic strain in this approximation.";
    if (el.attachLabelA)
      el.attachLabelA.childNodes[0].textContent = "Cable Attachment Point";
    if (el.attachLabelB)
      el.attachLabelB.childNodes[0].textContent = "Cable Attachment Point";
  } else {
    el.scenarioBadge.className = "scenario-badge sb-born";
    el.scenarioBadge.textContent = "Born-Rigid Reference";
    setBreakControlEnabled(false);
    updateBreakControlValue(scenario);
    setRopeLengthControlEnabled(false, "reference");
    el.monitorTitle.textContent = "Reference Monitor";
    el.ctrlBreakName.childNodes[0].textContent = "Reference Status ";
    if (el.ctrlBreakTip)
      el.ctrlBreakTip.textContent =
        "The Born-rigid reference is an exact kinematic benchmark, not a material rope model. This inactive control has no tolerance setting because it has no Bell-type threshold.";
    if (el.attachLabelA)
      el.attachLabelA.childNodes[0].textContent = "Reference Attachment Point";
    if (el.attachLabelB)
      el.attachLabelB.childNodes[0].textContent = "Reference Attachment Point";
  }
}

// Grey out equations irrelevant to the current frame view
function updateFrameDimming() {
  const isProper = state.view === "proper";

  // These are primarily observer-frame concepts
  const obsDimWhenProper = [
    el.eqSlabLabel,
    el.eqSlab,
    el.eqLabgapLabel,
    el.eqLabgap,
    el.eqRlabLabel,
    el.eqRlab,
  ];
  // These are primarily proper-frame concepts
  const propDimWhenObs = [
    el.eqPropgapLabel,
    el.eqPropgap,
    el.eqRpropLabel,
    el.eqRprop,
  ];

  obsDimWhenProper.forEach((e) => {
    if (e) {
      if (isProper) e.classList.add("eq-dimmed");
      else e.classList.remove("eq-dimmed");
    }
  });
  propDimWhenObs.forEach((e) => {
    if (e) {
      if (!isProper) e.classList.add("eq-dimmed");
      else e.classList.remove("eq-dimmed");
    }
  });
}

function updateEquations(phys) {
  const {
    gamma,
    gammaLead,
    gammaA,
    gammaB,
    v,
    vLead,
    vA,
    vB,
    tau,
    S_lab,
    S_lab_B,
    lab_gap,
    prop_gap,
    cable_lab,
    cable_prop,
    L_init,
    stretch,
    strain,
    isBroken,
    scenario,
    spanDegenerate,
    strainDefined,
  } = phys;
  const { L_gap } = state;
  const hasTwoShipValues = scenario !== "bell";
  const hasDefinedStrain = strainDefined && !spanDegenerate;
  const displayPropGap = displayedProperGap(phys);
  const displayCable = displayedCableSpan(phys);
  const isProper = state.view === "proper";

  setLeadingText(
    el.eqPropgapLabel,
    isProper ? "Selected MCIF Gap " : "Reference Gap ",
  );
  setLeadingText(
    el.eqRpropLabel,
    isProper ? "Selected Slice Span " : "Required Span ",
  );

  el.eqV.textContent = hasTwoShipValues
    ? `A ${vA.toFixed(4)}, B ${vB.toFixed(4)} c`
    : `${v.toFixed(4)} c`;
  el.eqGamma.textContent = hasTwoShipValues
    ? `A ${gammaA.toFixed(4)}, B ${gammaB.toFixed(4)}`
    : `${gamma.toFixed(4)}`;
  const tauAForEq = state.view === "proper"
    ? phys.slice_tau_A_center
    : phys.clock_tau_A_center;
  const tauBForEq = state.view === "proper"
    ? phys.slice_tau_B_center
    : phys.clock_tau_B_center;
  el.eqTau.textContent =
    state.view === "proper" || hasTwoShipValues
      ? `A ${formatFixed(tauAForEq)}, B ${formatFixed(tauBForEq)} yr`
      : `${tau.toFixed(4)} yr`;
  el.eqSlab.textContent = hasTwoShipValues
    ? `A ${S_lab.toFixed(4)}, B ${S_lab_B.toFixed(4)} L`
    : `${S_lab.toFixed(4)} L`;

  if (scenario === "born") {
    el.eqVFormula.textContent = "A/B from shared Rindler horizon";
    el.eqGammaFormula.textContent = "A/B center values";
    el.eqTauFormula.textContent =
      state.view === "proper"
        ? `${selectedObserverName(phys)} slice samples`
        : "A center at lab time t";
    el.eqSlabFormula.textContent = "exact A/B lab-slice span";
    el.eqLabgapTag.className = "eq-scenario-tag tag-born";
    el.eqLabgapTag.textContent = "Born ref.";
    el.eqLabgapFormula.textContent = "xB(t)-xA(t), exact";
    el.eqLabgap.textContent = `${lab_gap.toFixed(4)} L`;

    el.eqPropgapTag.className = "eq-scenario-tag tag-born";
    el.eqPropgapTag.textContent = "Born ref.";
    el.eqPropgapFormula.textContent = isProper
      ? "exact selected MCIF center slice"
      : "Rindler D (constant)";
    el.eqPropgap.textContent = `${displayPropGap.toFixed(4)} L`;
    el.eqPropgap.className = "eq-result tow-color";

    el.eqRlabFormula.textContent = "x(ξB)-x(ξA), exact";
    el.eqRpropFormula.textContent = isProper
      ? "exact selected MCIF cable slice"
      : "Born: natural span";
    el.eqStretchLabelText.textContent = "Reference Stretch";
    el.eqStretchFormula.textContent = "0, Born rigid";
    el.eqLinitFormula.textContent = "D+(ΔAttach)·S₀";
    el.eqStrainLabelText.textContent = "Reference Strain";
    el.eqStrainFormula.textContent = "exact Born-rigid reference";

    el.eqMechDivider.style.display = "";
    el.eqMechLabel.style.display = "";
    el.eqMechLabel.childNodes[0].textContent = "Proper Accel. Split ";
    el.eqMech.style.display = "";
    el.eqMech.textContent = `αA = ${phys.properAlphaA.toFixed(4)}, αB = ${phys.properAlphaB.toFixed(4)} c/yr`;
  } else if (scenario === "tow") {
    el.eqVFormula.textContent = "B engine; A cable-constrained";
    el.eqGammaFormula.textContent = "A/B center values";
    el.eqTauFormula.textContent =
      state.view === "proper"
        ? `${selectedObserverName(phys)} slice samples`
        : "material-point mission clocks";
    el.eqSlabFormula.textContent = "A/B lab-slice span";
    el.eqLabgapTag.className = "eq-scenario-tag tag-tow";
    el.eqLabgapTag.textContent = "Tow";
    el.eqLabgapFormula.textContent = "contracted loaded-cable span";
    el.eqLabgap.textContent = `${lab_gap.toFixed(4)} L`;

    el.eqPropgapTag.className = "eq-scenario-tag tag-tow";
    el.eqPropgapTag.textContent = "Tow";
    el.eqPropgapFormula.textContent = isProper
      ? "exact selected MCIF center slice"
      : "Rindler-like reference center span";
    el.eqPropgap.textContent = `${displayPropGap.toFixed(4)} L`;
    el.eqPropgap.className = "eq-result tow-color";

    el.eqRlabFormula.textContent = "contracted attachment span";
    el.eqRpropFormula.textContent = isProper
      ? "exact selected MCIF cable slice"
      : "loaded material span";
    el.eqStretchLabelText.textContent = "Elastic Stretch";
    el.eqStretchFormula.textContent = "steel strain × L₀";
    el.eqLinitFormula.textContent = "D+(ΔAttach)·S₀";
    el.eqStrainLabelText.textContent = "Steel Strain";
    el.eqStrainFormula.textContent = "min(0.2%, 0.15% × load)";

    el.eqMechDivider.style.display = "";
    el.eqMechLabel.style.display = "";
    el.eqMechLabel.childNodes[0].textContent = "Tow Accel. Split ";
    el.eqMech.style.display = "";
    el.eqMech.textContent = `αA = ${phys.properAlphaA.toFixed(4)}, αB = ${phys.properAlphaB.toFixed(4)} c/yr`;
  } else {
    el.eqVFormula.textContent = "Bell: αt / √(1+(αt)²)";
    el.eqGammaFormula.textContent = "Bell: √(1+(αt)²)";
    el.eqTauFormula.textContent =
      state.view === "proper"
        ? `${selectedObserverName(phys)} slice samples`
        : "Bell center: arcsinh(αt)/α";
    el.eqSlabFormula.textContent = "exact local rigid-body lab span";
    el.eqLabgapTag.className = "eq-scenario-tag tag-bell";
    el.eqLabgapTag.textContent = "Bell's";
    el.eqLabgapFormula.textContent = "D (constant!)";
    el.eqLabgap.textContent = `${lab_gap.toFixed(4)} L`;

    el.eqPropgapTag.className = "eq-scenario-tag tag-bell";
    el.eqPropgapTag.textContent = "Bell's";
    el.eqPropgapFormula.textContent =
      isProper
        ? "exact selected-slice span"
        : "γ·D center-line proxy";
    el.eqPropgap.textContent = `${displayPropGap.toFixed(4)} L`;
    el.eqPropgap.className = "eq-result cable-color";

    el.eqRlabFormula.textContent = "exact attachment-point lab slice";
    el.eqRpropFormula.textContent = isProper
      ? "exact selected attachment span"
      : "Bell: Coord. Span × γ proxy";
    el.eqStretchLabelText.textContent = "Kinematic Stretch Proxy";
    el.eqStretchFormula.textContent = "max(0, proxy − L₀)";
    el.eqLinitFormula.textContent = `${state.ropeLength.toFixed(1)}×(D+(ΔAttach)·S₀)`;
    el.eqStrainLabelText.textContent = "Proxy Strain";
    el.eqStrainFormula.textContent = "Stretch / L₀";

    el.eqMechDivider.style.display = "none";
    el.eqMechLabel.style.display = "none";
    el.eqMech.style.display = "none";
  }

  el.eqLinit.textContent = spanDegenerate
    ? "0.0000 L (contact)"
    : `${L_init.toFixed(4)} L`;
  el.eqRlab.textContent = `${cable_lab.toFixed(4)} L`;
  el.eqRprop.textContent = `${displayCable.toFixed(4)} L`;
  el.eqStretch.textContent = `${stretch.toFixed(4)} L`;

  if (!hasDefinedStrain) {
    el.eqStrain.textContent = "n/a";
    el.eqStrain.style.color = "var(--text-dim)";
  } else if (scenario === "tow") {
    el.eqStrain.textContent = formatStrainPercent(phys);
    el.eqStrain.style.color =
      (phys.loadIndex ?? 0) > 0.75 ? "var(--cable-warn)" : "var(--text-bright)";
  } else if (scenario === "born") {
    el.eqStrain.textContent = "0.000%";
    el.eqStrain.style.color = "var(--cable-ok)";
  } else if (isBroken) {
    el.eqStrain.textContent = "SNAPPED";
    el.eqStrain.style.color = "var(--cable-danger)";
  } else {
    el.eqStrain.textContent = formatStrainPercent(phys);
    el.eqStrain.style.color =
      strain > state.breakStrain * 0.75
        ? "var(--cable-warn)"
        : "var(--text-bright)";
  }

  if (scenario === "born") {
    el.insightTitle.textContent = "Key Insight: Born-Rigid Reference";
    el.insightEq.textContent = `αA = ${phys.properAlphaA.toFixed(4)} c/yr, αB = ${phys.properAlphaB.toFixed(4)} c/yr, D = ${prop_gap.toFixed(4)} L`;
    el.insightSub.innerHTML =
      "This is an exact Rindler kinematic reference, not a material rope model. The trailing worldline has higher proper acceleration, the leading worldline has lower proper acceleration, and the proper separation stays fixed. No exhaust plume specifies a physical propulsion arrangement for this benchmark.";
  } else if (scenario === "tow") {
    el.insightTitle.textContent = "Key Insight: Strong Tow";
    el.insightEq.textContent = `B engine α = ${phys.engineAlphaB.toFixed(4)} c/yr; A constraint α = ${phys.properAlphaA.toFixed(4)} c/yr; steel strain = ${formatStrainPercent(phys)}`;
    el.insightSub.innerHTML =
      "Only Ship B uses rocket thrust. Ship A's acceleration is supplied by cable tension in this loaded steel-cable approximation. The material span stays nearly fixed, its lab-frame span contracts as speed rises, and the displayed steel strain is a small bounded load annotation.";
  } else {
    el.insightTitle.textContent = "Key Insight: Bell's Paradox";
    el.insightEq.textContent = `Proxy stretch = max(0, required − L₀) = ${stretch.toFixed(4)} L`;
    el.insightSub.innerHTML =
      "Bell mode holds the lab-frame coordinate gap fixed while an unstressed comoving rope would occupy a shorter lab span. The break display uses the familiar central-anchor Lorentz proxy after slack is used. During active acceleration there is no shared ship rest frame, so the Proper Frame exposes the exact selected MCIF slice separately.";
  }
}

function updateStrainBar(phys) {
  const {
    strain,
    isBroken,
    stretch,
    scenario,
    slackFraction,
    leadAlpha,
    loadRampDuration,
    loadRampComplete,
    prop_gap,
    spanDegenerate,
    strainDefined,
  } = phys;
  const ratio = strainRatioForDisplay(phys);

  if (scenario === "born") {
    el.strainFill.style.width = "0%";
    el.strainFill.style.backgroundColor = "rgb(80,232,178)";
    el.svStrainLabel.textContent = "Reference Strain";
    el.svStrain.textContent = "0.000%";
    el.svStrain.style.color = "var(--cable-ok)";
    el.svBreakLabel.textContent = "Reference";
    el.svBreak.textContent = "exact";
    el.svStretchLabel.textContent = "Ref. Stretch";
    el.svStretch.textContent = "0.000 L";
    el.strainBarNote.textContent =
      "Born-Rigid Reference is an exact Rindler benchmark, not a failure model.";
    el.statusBadge.className = "status-badge s-born";
    el.statusBadge.textContent = "REFERENCE";
    el.towExtra.style.display = "";
    el.svMechLoad.textContent = `αA ${phys.properAlphaA.toFixed(4)}, αB ${leadAlpha.toFixed(4)} c/yr`;
    el.svTowGap.textContent = state.L_gap.toFixed(1);
    return;
  }

  if (scenario === "tow") {
    el.towExtra.style.display = "";
    const fillPct = Math.min(100, ratio * 100);
    el.strainFill.style.width = `${fillPct}%`;

    const [r, g, b] = uiStrainColor(fillPct / 100);
    el.strainFill.style.backgroundColor = `rgb(${r},${g},${b})`;

    el.svStrainLabel.textContent = "Tow Load";
    el.svStrain.textContent = formatLoadIndex(phys);
    el.svBreakLabel.textContent = "Steel Strain";
    el.svBreak.textContent = strainDefined ? formatStrainPercent(phys) : "n/a";
    el.svStretchLabel.textContent = "Elastic Stretch";
    el.svStretch.textContent = strainDefined ? `${stretch.toFixed(4)} L` : "n/a";
    el.strainBarNote.textContent =
      "Bar fills 0 to 100% against the selected load reference. The loaded steel cable remains intact.";

    if (spanDegenerate) {
      el.statusBadge.className = "status-badge s-tow";
      el.statusBadge.textContent = "CONTACT SPAN";
      el.svStrain.style.color = "var(--text-dim)";
    } else if (!loadRampComplete) {
      el.statusBadge.className = "status-badge s-slack";
      el.statusBadge.textContent = "REFERENCE RAMP";
      el.svStrain.style.color = "var(--text-dim)";
    } else if (ratio > 0.72) {
      el.statusBadge.className = "status-badge s-tension";
      el.statusBadge.textContent = "HIGH LOAD";
      el.svStrain.style.color = "var(--cable-warn)";
    } else {
      el.statusBadge.className = "status-badge s-tow";
      el.statusBadge.textContent = "IDEAL TOW";
      el.svStrain.style.color = "var(--text-bright)";
    }

    el.svMechLoad.textContent = loadRampComplete
      ? `αA ${phys.properAlphaA.toFixed(4)}, αB ${phys.properAlphaB.toFixed(4)} c/yr`
      : `illustrative ramp ${(phys.loadProgress * 100).toFixed(0)}% of ${loadRampDuration.toFixed(3)} yr`;
    el.svTowGap.textContent = phys.cable_lab.toFixed(3);
    return;
  }

  el.towExtra.style.display = "none";
  const fillPct = Math.min(100, ratio * 100);
  el.strainFill.style.width = `${fillPct}%`;

  const [r, g, b] = uiStrainColor(fillPct / 100);
  el.strainFill.style.backgroundColor = `rgb(${r},${g},${b})`;

  el.svStrainLabel.textContent = "Proxy Strain";
  el.svStretchLabel.textContent = "Abs. Stretch";
  el.svStrain.textContent = !strainDefined || spanDegenerate
    ? "n/a"
    : isBroken
      ? `>${(state.breakStrain * 100).toFixed(1)}%`
      : `${(strain * 100).toFixed(3)}%`;
  el.svBreakLabel.textContent = "Snaps At";
  el.svBreak.textContent = `${(state.breakStrain * 100).toFixed(1)}%`;
  el.svStretch.textContent = strainDefined
    ? `${stretch.toFixed(4)} L`
    : "n/a";
  el.strainBarNote.textContent =
    "Bar fills 0 to 100% from slack or zero proxy strain to the selected threshold.";

  if (!strainDefined || spanDegenerate) {
    el.statusBadge.className = "status-badge s-slack";
    el.statusBadge.textContent = "CONTACT SPAN";
    el.svStrain.style.color = "var(--text-dim)";
  } else if (isBroken) {
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
    updateBreakControlValue();
    updateAll();
  });

  el.slRopeLength.addEventListener("input", (e) => {
    state.ropeLength = +e.target.value;
    updateRopeLengthValue();
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
      state.scenario = Physics.normalizeScenario(e.target.value);
      $("sc-bell").className =
        "scenario-card" + (state.scenario === "bell" ? " active-bell" : "");
      $("sc-tow").className =
        "scenario-card" + (state.scenario === "tow" ? " active-tow" : "");
      $("sc-born").className =
        "scenario-card" + (state.scenario === "born" ? " active-born" : "");
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

  // ── Observer button click + hover handlers ──
  el.canvas.addEventListener("click", (e) => {
    const rect = el.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

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
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

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
