const test = require("node:test");
const assert = require("node:assert/strict");
const physics = require("../physics.js");

const EPS = 1e-10;

function approx(actual, expected, epsilon = EPS) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function assertFinite(value, label) {
  assert.equal(Number.isFinite(value), true, `${label} should be finite`);
}

function assertFiniteModel(p, label) {
  for (const key of [
    "lab_gap",
    "prop_gap",
    "stress_span",
    "cable_lab",
    "cable_prop",
    "L_init",
    "baseSpan",
    "stretch",
    "strain",
    "loadIndex",
  ]) {
    assertFinite(p[key], `${label} ${key}`);
  }
}

test("Bell mode starts from the intended rest configuration", () => {
  const p = physics.computeBell({
    t: 0,
    a: 0.8,
    L_gap: 3,
    ropeLength: 1,
    breakStrain: 0.001,
  });

  approx(p.gamma, 1);
  approx(p.v, 0);
  approx(p.tau, 0);
  approx(p.lab_gap, 3);
  approx(p.prop_gap, 3);
  approx(p.L_init, 3);
  approx(p.cable_lab, 3);
  approx(p.cable_prop, 3);
  approx(p.strain, 0);
  assert.equal(p.isBroken, false);
  assert.equal(p.strainDefined, true);
});

test("Bell mode velocity, gamma, and proper time match hyperbolic motion", () => {
  const t = 2;
  const a = 0.8;
  const p = physics.computeBell({ t, a, L_gap: 3 });
  const at = a * t;
  const gamma = Math.sqrt(1 + at * at);

  approx(p.gamma, gamma);
  approx(p.v, at / gamma);
  approx(p.tau, Math.asinh(at) / a);
  approx(p.C_A, (gamma - 1) / a);
  approx(p.C_B - p.C_A, 3);
});

test("longitudinal Doppler factor has the correct recession sign convention", () => {
  approx(physics.longitudinalDopplerFactor(0), 1);
  assert.ok(physics.longitudinalDopplerFactor(0.5) < 1);
  assert.ok(physics.longitudinalDopplerFactor(-0.5) > 1);
  approx(
    physics.longitudinalDopplerFactor(0.5) *
      physics.longitudinalDopplerFactor(-0.5),
    1,
  );
});

test("Bell mode natural length respects rope factor and attachment offsets", () => {
  const p = physics.computeBell({
    t: 0,
    a: 0.8,
    L_gap: 3,
    aA: -0.5,
    aB: 0.5,
    ropeLength: 2,
  });

  approx(p.baseSpan, 4);
  approx(p.L_init, 8);
});

test("Bell mode attachment geometry follows the exact rigid-ship worldlines", () => {
  const settings = { t: 2, a: 0.8, L_gap: 3, ropeLength: 1 };
  const center = physics.computeBell({ ...settings, aA: 0, aB: 0 });
  const endToEnd = physics.computeBell({ ...settings, aA: -0.5, aB: 0.5 });
  const nearEnds = physics.computeBell({ ...settings, aA: 0.5, aB: -0.5 });
  const h = 1 / settings.a;
  const point = (xi) => Math.sqrt((h + xi) ** 2 + settings.t ** 2) - h;
  const expectedEndToEndLab =
    settings.L_gap + point(0.5) - point(-0.5);
  const expectedNearEndsLab =
    settings.L_gap + point(-0.5) - point(0.5);

  approx(center.cable_lab, settings.L_gap);
  approx(endToEnd.cable_lab, expectedEndToEndLab);
  approx(nearEnds.cable_lab, expectedNearEndsLab);
  approx(endToEnd.stress_span, endToEnd.cable_lab * endToEnd.gamma);
  approx(nearEnds.stress_span, nearEnds.cable_lab * nearEnds.gamma);
  assert.equal(center.attachmentStressApproximate, false);
  assert.equal(endToEnd.attachmentStressApproximate, true);
  assert.notEqual(endToEnd.stretch, center.stretch);
});

test("Bell mode uses slack before material strain grows", () => {
  const slack = physics.computeBell({
    t: 0,
    a: 0.8,
    L_gap: 3,
    ropeLength: 1.5,
  });
  const taut = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    ropeLength: 1.5,
  });

  assert.ok(slack.slackFraction > 0);
  approx(slack.strain, 0);
  assert.ok(taut.stretch > 0);
  assert.ok(taut.strain > 0);
});

test("Bell mode stress demand increases monotonically with lab time", () => {
  const settings = { a: 0.8, L_gap: 3, ropeLength: 1 };
  const samples = [0, 0.5, 1, 2, 4].map((t) =>
    physics.computeBell({ ...settings, t }),
  );

  for (let i = 1; i < samples.length; i += 1) {
    assert.ok(samples[i].stress_span >= samples[i - 1].stress_span);
  }
});

test("display mission clocks are monotonic in all scenarios", () => {
  const scenarios = ["bell", "tow", "born"];
  const observers = [null, "A", "B", "rope"];
  const keys = [
    "clock_tau_A_back",
    "clock_tau_A_front",
    "clock_tau_A_center",
    "clock_tau_B_back",
    "clock_tau_B_front",
    "clock_tau_B_center",
    "clock_tau_cable",
  ];

  for (const scenario of scenarios) {
    for (const selectedObserver of observers) {
      const previous = Object.fromEntries(keys.map((key) => [key, -Infinity]));
      for (const t of [0, 0.1, 0.5, 1.5, 4, 6]) {
        const p = physics.compute({
          scenario,
          selectedObserver,
          t,
          a: 0.8,
          L_gap: 3,
        });
        for (const key of keys) {
          assert.ok(p[key] === null || p[key] >= 0, `${scenario} ${key}`);
          if (p[key] !== null && previous[key] !== -Infinity) {
            assert.ok(
              p[key] + EPS >= previous[key],
              `${scenario} ${selectedObserver} ${key} should not decrease`,
            );
          }
          if (p[key] !== null) previous[key] = p[key];
        }
      }
    }
  }
});

test("Bell slice samples remain separate from display clocks", () => {
  const p = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "B",
  });

  approx(p.clock_tau_A_center, p.clock_tau_B_center);
  assert.equal(p.slice_tau_A_center, null);
  assert.equal(p.pf_tau_A_center, null);
  approx(p.pf_tau_B_center, p.clock_tau_B_center);
});

test("Bell proper-slice clocks depend on the selected observer without fake zeroes", () => {
  const fromA = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "A",
  });
  const fromB = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "B",
  });

  approx(fromA.slice_tau_A_center, fromA.clock_tau_A_center);
  assert.ok(fromA.slice_tau_B_center > fromA.clock_tau_B_center);
  assert.equal(fromB.slice_tau_A_center, null);
  approx(fromB.slice_tau_B_center, fromB.clock_tau_B_center);
});

test("Bell selected-slice spans use the physical piecewise launch worldlines", () => {
  const fromA = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "A",
  });
  const fromMid = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "rope",
  });
  const fromB = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "B",
  });

  assert.ok(fromA.slice_gap > fromA.prop_gap);
  assert.ok(fromMid.slice_gap > fromMid.prop_gap);
  assert.ok(fromB.slice_gap > 0);
  assert.ok(fromB.slice_gap < 3);
  assert.equal(fromB.slice_tau_A_center, null);
  assert.equal(fromB.frame_A_center.missionActive, false);
  assert.equal(fromB.frame_B_center.missionActive, true);
  approx(fromB.frame_A_center.v, -fromB.v);
  approx(
    fromB.slice_gap,
    fromB.frame_B_center.x - fromB.frame_A_center.x,
  );
  approx(fromA.slice_cable_span, fromA.slice_gap);
  approx(fromMid.slice_cable_span, fromMid.slice_gap);
  approx(fromB.slice_cable_span, fromB.slice_gap);
});

test("Bell midpoint reference remains between attachment events on its MCIF", () => {
  for (const t of [0, 0.5, 2, 6]) {
    for (const aA of [-0.5, 0, 0.5]) {
      for (const aB of [-0.5, 0, 0.5]) {
        const p = physics.computeBell({
          t,
          a: 0.8,
          L_gap: 3,
          aA,
          aB,
          selectedObserver: "rope",
        });
        const left = Math.min(p.frame_A_attach.x, p.frame_B_attach.x);
        const right = Math.max(p.frame_A_attach.x, p.frame_B_attach.x);
        assert.ok(p.frame_cable.x >= left - EPS);
        assert.ok(p.frame_cable.x <= right + EPS);
        approx(p.frame_cable.x, p.frame_observer.x);
      }
    }
  }
});

test("Bell Ship B slice uses Ship A's inertial pre-launch event exactly", () => {
  const t = 2;
  const a = 0.8;
  const D = 3;
  const p = physics.computeBell({ t, a, L_gap: D, selectedObserver: "B" });
  const gamma = Math.sqrt(1 + (a * t) ** 2);
  const v = (a * t) / gamma;
  const xB = (gamma - 1) / a + D;
  const simultaneousLabTimeAtA = t - v * xB;
  const expectedAFrameX = gamma * (-v * simultaneousLabTimeAtA);
  const expectedBFrameX = gamma * (xB - v * t);

  assert.ok(simultaneousLabTimeAtA < 0);
  approx(p.frame_A_center.x, expectedAFrameX);
  approx(p.frame_B_center.x, expectedBFrameX);
  approx(p.slice_gap, expectedBFrameX - expectedAFrameX);
  approx(p.frame_A_center.v, -v);
  assert.equal(p.frame_A_center.missionActive, false);
});

test("Bell endpoint slice clocks follow material point worldlines", () => {
  const fromA = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "A",
  });
  const fromB = physics.computeBell({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "B",
  });

  assert.ok(fromA.slice_tau_A_back < fromA.slice_tau_A_center);
  assert.ok(fromA.slice_tau_A_center < fromA.slice_tau_A_front);
  assert.ok(fromA.slice_tau_B_back < fromA.slice_tau_B_center);
  assert.ok(fromA.slice_tau_B_center < fromA.slice_tau_B_front);
  assert.equal(fromB.slice_tau_A_back, null);
  assert.equal(fromB.slice_tau_A_center, null);
  assert.ok(fromB.slice_tau_B_back < fromB.slice_tau_B_center);
  assert.ok(fromB.slice_tau_B_center < fromB.slice_tau_B_front);
});

test("Strong Tow starts with a Ship B engine marker and an illustrative load ramp", () => {
  const p = physics.computeTow({ t: 0, a: 0.8, L_gap: 3 });
  const expectedLeadAlpha = 0.8 / (1 + 0.8 * 3);

  approx(p.vA, 0);
  approx(p.vB, 0);
  approx(p.lab_gap, 3);
  approx(p.prop_gap, 3);
  approx(p.cable_lab, 3);
  approx(p.cable_prop, 3);
  approx(p.engineAlphaA, 0);
  approx(p.engineAlphaB, expectedLeadAlpha);
  approx(p.properAlphaA, 0.8);
  approx(p.properAlphaB, expectedLeadAlpha);
  assert.ok(p.properAlphaA > p.properAlphaB);
  approx(p.loadRampDuration, 3);
  assert.equal(p.loadRampComplete, false);
  assert.equal(p.isBroken, false);
});

test("Strong Tow contracts in the lab while load builds", () => {
  const p = physics.computeTow({ t: 1, a: 0.8, L_gap: 3 });

  assert.ok(p.vA > 0);
  assert.ok(p.vA > p.vB);
  assert.ok(p.clock_tau_A_center > 0);
  assert.ok(p.clock_tau_B_center > 0);
  assert.notEqual(p.clock_tau_A_center, p.clock_tau_B_center);
  assert.ok(p.lab_gap < 3);
  assert.ok(p.cable_lab < p.cable_prop);
  assert.ok(p.cable_prop > p.L_init);
  assert.equal(p.loadRampComplete, false);
  assert.equal(p.engineAlphaA, 0);
  approx(p.engineAlphaB, p.properAlphaB);
  assert.ok(p.properAlphaA > p.properAlphaB);
  assert.equal(p.rocketAlphaA, 0);
  assert.equal(p.isBroken, false);
  assert.ok(p.loadProgress > 0);
  assert.ok(p.loadProgress < 1);
  assert.ok(p.loadIndex > 0);
  assert.ok(p.strain > 0);
  assert.ok(p.strain <= 0.002);
  approx(p.stretch, p.L_init * p.strain);
  approx(p.cable_prop, p.L_init + p.stretch);
  assert.ok(p.clock_tau_A_back < p.clock_tau_A_front);
  assert.ok(p.clock_tau_B_back < p.clock_tau_B_front);
});

test("Strong Tow shows its steady reference after the illustrative ramp", () => {
  const p = physics.computeTow({ t: 5, a: 0.8, L_gap: 3 });

  assert.equal(p.loadRampComplete, true);
  assert.ok(p.vA > 0);
  assert.ok(p.vA > p.vB);
  assert.ok(p.lab_gap < 3);
  assert.ok(p.cable_lab < p.cable_prop);
  assert.ok(p.cable_lab < p.L_init);
  assert.ok(p.cable_prop > p.L_init);
  assert.ok(p.stretch > 0);
  assert.ok(p.stretch < 0.0021 * p.L_init);
  assert.ok(p.loadIndex > 0);
  assert.equal(p.engineAlphaA, 0);
  approx(p.engineAlphaB, p.properAlphaB);
  assert.ok(p.properAlphaA > p.properAlphaB);
  assert.equal(p.isBroken, false);
});

test("Strong Tow attachment span contracts for all non-contact endpoints", () => {
  const endpoints = [-0.5, 0, 0.5];

  for (const aA of endpoints) {
    for (const aB of endpoints) {
      const p = physics.computeTow({
        t: 2,
        a: 0.8,
        L_gap: 3,
        aA,
        aB,
        breakStrain: 0.001,
      });
      assertFiniteModel(p, `tow attachment ${aA} ${aB}`);
      if (!p.spanDegenerate) {
        assert.ok(p.cable_lab < p.cable_prop);
        assert.ok(p.slice_cable_span >= p.cable_prop - 1e-9);
      }
    }
  }
});

test("Strong Tow slice samples are observer-dependent while mission clocks keep advancing", () => {
  const fromA = physics.computeTow({
    t: 5,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "A",
  });
  const fromB = physics.computeTow({
    t: 5,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "B",
  });

  assert.ok(fromA.clock_tau_A_center > 0);
  assert.ok(fromA.clock_tau_B_center > 0);
  approx(fromA.slice_tau_A_center, fromA.clock_tau_A_center);
  assert.ok(fromA.slice_tau_B_center > fromA.clock_tau_B_center);
  assert.ok(fromB.slice_tau_A_center < fromB.clock_tau_A_center);
  approx(fromB.slice_tau_B_center, fromB.clock_tau_B_center);
});

test("Strong Tow never snaps and keeps small steel strain at UI extremes", () => {
  for (const settings of [
    { t: 6, a: 1.5, L_gap: 1, aA: -0.5, aB: 0.5, breakStrain: 0.001 },
    { t: 6, a: 1.5, L_gap: 5, aA: 0.5, aB: -0.5, breakStrain: 0.001 },
    { t: 6, a: 0.1, L_gap: 1, aA: -0.5, aB: 0.5, breakStrain: 0.15 },
  ]) {
    const p = physics.computeTow(settings);
    assert.equal(p.isBroken, false);
    assertFiniteModel(p, `tow ${JSON.stringify(settings)}`);
    assert.ok(p.strain >= 0);
    assert.ok(p.strain <= 0.002);
    approx(p.stretch, p.L_init * p.strain);
    assert.ok(p.cable_prop - p.L_init <= 0.0021 * Math.max(1, p.L_init));
    assert.equal(p.engineAlphaA, 0);
    assert.ok(p.engineAlphaB > 0);
    approx(p.engineAlphaB, p.properAlphaB);
    assert.ok(p.properAlphaA > p.properAlphaB);
  }
});

test("attachment spans are finite across all endpoint combinations", () => {
  const endpoints = [-0.5, 0, 0.5];

  for (const scenario of ["bell", "tow", "born"]) {
    for (const L_gap of [1, 3]) {
      for (const aA of endpoints) {
        for (const aB of endpoints) {
          const p = physics.compute({
            scenario,
            t: 2,
            a: 0.8,
            L_gap,
            aA,
            aB,
            ropeLength: 1.5,
          });
          const expectedBase = Math.max(0, L_gap + (aB - aA) * physics.S0);
          approx(p.baseSpan, expectedBase);
          if (scenario === "bell") approx(p.L_init, 1.5 * expectedBase);
          else approx(p.L_init, expectedBase);
          assertFiniteModel(p, `${scenario} ${L_gap} ${aA} ${aB}`);
        }
      }
    }
  }
});

test("contact-span attachment case reports undefined strain without breaking", () => {
  for (const scenario of ["bell", "tow", "born"]) {
    const p = physics.compute({
      scenario,
      t: 2,
      a: 0.8,
      L_gap: 1,
      aA: 0.5,
      aB: -0.5,
      ropeLength: 1,
    });

    approx(p.baseSpan, 0);
    approx(p.L_init, 0);
    assert.equal(p.spanDegenerate, true);
    assert.equal(p.strainDefined, false);
    assert.equal(p.isBroken, false);
    assertFinite(p.strain, `${scenario} contact strain`);
    assertFinite(p.loadIndex, `${scenario} contact load`);
  }
});

test("Born-Rigid Reference keeps proper separation fixed", () => {
  const p = physics.computeBornRigid({ t: 2, a: 0.8, L_gap: 3 });

  approx(p.prop_gap, 3);
  approx(p.cable_prop, p.L_init);
  approx(p.strain, 0);
  assert.equal(p.isBroken, false);
});

test("Born-Rigid Reference gives the leading ship lower proper acceleration", () => {
  const a = 0.8;
  const D = 3;
  const p = physics.computeBornRigid({ t: 2, a, L_gap: D });

  approx(p.trailingAlpha, a);
  approx(p.leadAlpha, a / (1 + a * D));
  approx(p.properAlphaA, a);
  approx(p.properAlphaB, p.leadAlpha);
  approx(p.engineAlphaA, 0);
  approx(p.engineAlphaB, 0);
  approx(p.rocketAlphaA, 0);
  approx(p.rocketAlphaB, 0);
  assert.ok(p.leadAlpha < p.trailingAlpha);
  assert.ok(p.vLead < p.v);
});

test("Born-Rigid Reference lab gap decreases at common lab time", () => {
  const a = 0.8;
  const D = 3;
  const t = 2;
  const h = 1 / a;
  const p = physics.computeBornRigid({ t, a, L_gap: D });
  const expectedGap =
    Math.sqrt((h + D) ** 2 + t ** 2) - Math.sqrt(h ** 2 + t ** 2);

  approx(p.lab_gap, expectedGap);
  assert.ok(p.lab_gap < D);
});

test("Born-Rigid Reference keeps attachment span fixed in the Rindler frame", () => {
  const p = physics.computeBornRigid({
    t: 3,
    a: 0.8,
    L_gap: 3,
    aA: -0.5,
    aB: 0.5,
  });

  approx(p.baseSpan, 4);
  approx(p.L_init, 4);
  approx(p.cable_prop, 4);
  approx(p.stress_span, 4);
  approx(p.strain, 0);
});

test("Born-Rigid Reference places the cable clock at the attachment midpoint", () => {
  const a = 0.8;
  const t = 2;
  const p = physics.computeBornRigid({
    t,
    a,
    L_gap: 3,
    aA: 0.5,
    aB: 0.5,
  });
  const h = 1 / a;
  const xiCableMid = 0.5 + p.cable_prop / 2;
  const expectedTau = (h + xiCableMid) * Math.asinh(t / (h + xiCableMid));

  approx(p.clock_tau_cable, expectedTau);
  approx(p.frame_cable.v, 0);
});

test("Born-Rigid Reference slice clocks respond to observer marker selection", () => {
  const fromA = physics.computeBornRigid({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "A",
  });
  const fromB = physics.computeBornRigid({
    t: 2,
    a: 0.8,
    L_gap: 3,
    selectedObserver: "B",
  });

  approx(fromA.slice_tau_A_center, fromA.clock_tau_A_center);
  approx(fromA.pf_tau_A_center, fromA.slice_tau_A_center);
  assert.ok(fromA.slice_tau_B_center > fromA.clock_tau_B_center);
  assert.ok(fromB.slice_tau_A_center < fromB.clock_tau_A_center);
  approx(fromB.pf_tau_B_center, fromB.slice_tau_B_center);
  approx(fromB.slice_tau_B_center, fromB.clock_tau_B_center);
  assert.ok(fromB.rindler_tau_A_center > fromB.slice_tau_A_center);
});

test("Born-Rigid Reference remains in the Rindler domain at UI extremes", () => {
  const p = physics.computeBornRigid({
    t: 6,
    a: 1.5,
    L_gap: 5,
    aA: -0.5,
    aB: 0.5,
  });

  for (const key of ["C_A", "C_B", "P_A", "P_B", "S_lab", "S_lab_B"]) {
    assertFinite(p[key], key);
  }
  assert.ok(p.leadAlpha > 0);
  assert.ok(p.leadAlpha < p.trailingAlpha);
  assert.ok(p.lab_gap < 5);
});

test("Born-Rigid Reference has the correct t=0 limit", () => {
  const p = physics.computeBornRigid({ t: 0, a: 0.8, L_gap: 3 });

  approx(p.v, 0);
  approx(p.vLead, 0);
  approx(p.lab_gap, 3);
  approx(p.prop_gap, 3);
  approx(p.tau, 0);
  approx(p.tauLead, 0);
});

test("every proper-frame slice is simultaneous in its selected MCIF", () => {
  for (const scenario of ["bell", "tow", "born"]) {
    for (const selectedObserver of ["A", "B", "rope"]) {
      const p = physics.compute({
        scenario,
        selectedObserver,
        t: 2,
        a: 0.8,
        L_gap: 3,
      });
      const frames = [
        p.frame_A_back,
        p.frame_A_center,
        p.frame_A_front,
        p.frame_B_back,
        p.frame_B_center,
        p.frame_B_front,
        p.frame_cable,
      ];
      for (const frame of frames) {
        assertFinite(frame.T, `${scenario} ${selectedObserver} slice time`);
        assertFinite(frame.x, `${scenario} ${selectedObserver} slice position`);
        assertFinite(frame.v, `${scenario} ${selectedObserver} slice velocity`);
        approx(frame.T, p.frame_A_center.T, 1e-8);
      }
      const selectedVelocity =
        selectedObserver === "A"
          ? p.frame_A_center.v
          : selectedObserver === "B"
            ? p.frame_B_center.v
            : p.frame_cable.v;
      approx(selectedVelocity, 0, 1e-8);
    }
  }
});

test("every selected observer remains at its physical marker and connector geometry stays ordered", () => {
  for (const scenario of ["bell", "tow", "born"]) {
    for (const selectedObserver of ["A", "B", "rope"]) {
      for (const t of [0, 0.5, 2, 6]) {
        const p = physics.compute({
          scenario,
          selectedObserver,
          t,
          a: 0.8,
          L_gap: 3,
          aA: -0.5,
          aB: 0.5,
        });
        const selectedFrame =
          selectedObserver === "A"
            ? p.frame_A_center
            : selectedObserver === "B"
              ? p.frame_B_center
              : p.frame_cable;

        approx(selectedFrame.x, p.frame_observer.x, 1e-8);
        approx(selectedFrame.T, p.frame_observer.T, 1e-8);
        approx(selectedFrame.v, 0, 1e-8);
        assert.ok(p.frame_A_back.x <= p.frame_A_attach.x + 1e-8);
        assert.ok(p.frame_A_attach.x <= p.frame_A_front.x + 1e-8);
        assert.ok(p.frame_B_back.x <= p.frame_B_attach.x + 1e-8);
        assert.ok(p.frame_B_attach.x <= p.frame_B_front.x + 1e-8);
        assert.ok(p.frame_A_front.x <= p.frame_B_back.x + 1e-8);
        assert.ok(p.frame_A_attach.x <= p.frame_cable.x + 1e-8);
        assert.ok(p.frame_cable.x <= p.frame_B_attach.x + 1e-8);
      }
    }
  }
});

test("Born and Tow retain their reference spans on every selected MCIF slice", () => {
  for (const scenario of ["tow", "born"]) {
    const fromA = physics.compute({
      scenario,
      selectedObserver: "A",
      t: 2,
      a: 0.8,
      L_gap: 3,
    });
    const fromB = physics.compute({
      scenario,
      selectedObserver: "B",
      t: 2,
      a: 0.8,
      L_gap: 3,
    });
    assert.ok(fromA.slice_gap > 0);
    assert.ok(fromB.slice_gap > 0);
    approx(fromA.slice_gap, fromA.prop_gap);
    approx(fromB.slice_gap, fromB.prop_gap);
    assert.ok(fromA.prop_gap > 0);
    assert.ok(fromB.prop_gap > 0);
  }
});

test("zero acceleration is a finite inertial limit in every scenario", () => {
  for (const scenario of ["bell", "tow", "born"]) {
    const p = physics.compute({
      scenario,
      selectedObserver: "B",
      t: 2,
      a: 0,
      L_gap: 3,
    });
    assertFiniteModel(p, `${scenario} zero acceleration`);
    approx(p.vA, 0);
    approx(p.vB, 0);
    approx(p.gammaA, 1);
    approx(p.gammaB, 1);
    approx(p.lab_gap, 3);
    approx(p.slice_gap, 3);
    approx(p.clock_tau_A_center, 2);
    approx(p.clock_tau_B_center, 2);
  }
});

test("dense UI-domain sweep preserves frame and kinematic invariants", () => {
  const frameKeys = [
    "frame_A_back",
    "frame_A_front",
    "frame_A_center",
    "frame_B_back",
    "frame_B_front",
    "frame_B_center",
    "frame_A_attach",
    "frame_B_attach",
    "frame_cable",
  ];

  for (const scenario of ["bell", "tow", "born"]) {
    for (const a of [0.1, 0.45, 0.8, 1.15, 1.5]) {
      for (let t = 0; t <= 6; t += 0.25) {
        for (const L_gap of [1, 3, 5]) {
          for (const aA of [-0.5, 0, 0.5]) {
            for (const aB of [-0.5, 0, 0.5]) {
              for (const selectedObserver of ["A", "B", "rope"]) {
                const p = physics.compute({
                  scenario,
                  a,
                  t,
                  L_gap,
                  aA,
                  aB,
                  ropeLength: 1.5,
                  selectedObserver,
                });
                const frameTime = p.frame_A_center.T;
                for (const key of frameKeys) {
                  const frame = p[key];
                  assertFinite(frame.T, `${scenario} ${key} time`);
                  assertFinite(frame.x, `${scenario} ${key} position`);
                  assertFinite(frame.v, `${scenario} ${key} velocity`);
                  approx(frame.T, frameTime, 1e-8);
                  assert.ok(Math.abs(frame.v) < 1, `${scenario} ${key} speed`);
                }
                const observerFrame =
                  selectedObserver === "A"
                    ? p.frame_A_center
                    : selectedObserver === "B"
                      ? p.frame_B_center
                      : p.frame_cable;
                approx(observerFrame.v, 0, 1e-8);
                approx(p.slice_gap, p.frame_B_center.x - p.frame_A_center.x, 1e-8);
                approx(
                  p.slice_cable_span,
                  p.frame_B_attach.x - p.frame_A_attach.x,
                  1e-8,
                );
                assert.ok(p.strain >= 0);
                assert.ok(p.stretch >= 0);

                if (scenario === "bell") {
                  approx(p.lab_gap, L_gap);
                  approx(p.C_B - p.C_A, L_gap);
                  approx(p.gamma, Math.sqrt(1 + (a * t) ** 2));
                  approx(p.stress_span, p.cable_lab * p.gamma);
                } else {
                  assert.equal(p.isBroken, false);
                  assert.equal(p.engineAlphaA, 0);
                  assert.ok(p.properAlphaA >= p.properAlphaB);
                  approx(p.slice_gap, p.prop_gap, 1e-8);
                  approx(p.slice_cable_span, p.cable_prop, 1e-8);
                  if (t > 0) assert.ok(p.vA >= p.vB);
                }
              }
            }
          }
        }
      }
    }
  }
});
