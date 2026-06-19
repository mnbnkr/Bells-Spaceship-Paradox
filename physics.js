(function exposePhysics(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RelativityPhysics = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildPhysics() {
  const S0 = 1.0;
  const EPS = 1e-9;

  function normalizeScenario(scenario) {
    if (scenario === "bell" || scenario === "tow" || scenario === "born") {
      return scenario;
    }
    return "bell";
  }

  function safeState(input = {}) {
    return {
      t: Number.isFinite(input.t) ? Math.max(0, input.t) : 0,
      a: Number.isFinite(input.a) ? Math.max(0, input.a) : 0.8,
      L_gap: Number.isFinite(input.L_gap) ? Math.max(0, input.L_gap) : 3.0,
      breakStrain: Number.isFinite(input.breakStrain)
        ? Math.max(0, input.breakStrain)
        : 0.001,
      aA: Number.isFinite(input.aA) ? Math.max(-0.5, Math.min(0.5, input.aA)) : 0,
      aB: Number.isFinite(input.aB) ? Math.max(-0.5, Math.min(0.5, input.aB)) : 0,
      ropeLength: Number.isFinite(input.ropeLength)
        ? Math.max(0, input.ropeLength)
        : 1.5,
      selectedObserver: input.selectedObserver || null,
      scenario: normalizeScenario(input.scenario),
    };
  }

  function baseKinematics(a, t) {
    const safeA = Number.isFinite(a) ? Math.max(0, a) : 0;
    const safeT = Number.isFinite(t) ? Math.max(0, t) : 0;
    if (safeA <= EPS) {
      return { at: 0, gamma: 1, v: 0, tau: safeT, x_disp: 0 };
    }
    const at = safeA * safeT;
    const gamma = Math.sqrt(1.0 + at * at);
    const v = at / gamma;
    const tau = Math.asinh(at) / safeA;
    const x_disp = (gamma - 1.0) / safeA;
    return { at, gamma, v, tau, x_disp };
  }

  function elapsedKinematics(a, elapsed) {
    if (elapsed <= EPS) {
      return { at: 0, gamma: 1, v: 0, tau: 0, x_disp: 0 };
    }
    return baseKinematics(a, elapsed);
  }

  function attachmentSpan(L_gap, aA, aB) {
    const rawSpan = L_gap + (aB - aA) * S0;
    const baseSpan = Math.max(0, rawSpan);
    return {
      rawSpan,
      baseSpan,
      spanDegenerate: baseSpan <= EPS,
    };
  }

  function initialAttachmentSpan(L_gap, aA, aB) {
    return attachmentSpan(L_gap, aA, aB).baseSpan;
  }

  function makeStrain(requiredProperSpan, naturalLength, breakStrain, options = {}) {
    const required = Number.isFinite(requiredProperSpan)
      ? Math.max(0, requiredProperSpan)
      : 0;
    const natural = Number.isFinite(naturalLength)
      ? Math.max(0, naturalLength)
      : 0;
    const spanDegenerate = Boolean(options.spanDegenerate) || natural <= EPS;
    const strainDefined = !spanDegenerate;
    const stretch = Math.max(0, required - natural);
    const strain = strainDefined && stretch > 0 ? stretch / natural : 0;
    const safeReference = Math.max(EPS, breakStrain);
    const loadIndex = strainDefined ? strain / safeReference : 0;
    const canBreak = options.canBreak !== false;
    return {
      stretch,
      strain,
      loadIndex,
      isBroken: canBreak && strainDefined && strain > breakStrain,
      strainDefined,
      spanDegenerate,
      slackFraction: strainDefined ? Math.max(0, (natural - required) / natural) : 0,
    };
  }

  function missionTau(value) {
    if (value === null || !Number.isFinite(value)) return null;
    return Math.max(0, value);
  }

  function delayedAcceleratedPoint(a, x0, startTime, labTime) {
    if (labTime < -EPS) {
      return {
        T: labTime,
        x: x0,
        v: 0,
        gamma: 1,
        tau: null,
        missionActive: false,
      };
    }
    if (labTime <= startTime + EPS) {
      return {
        T: labTime,
        x: x0,
        v: 0,
        gamma: 1,
        tau: labTime,
        missionActive: true,
      };
    }
    const elapsed = labTime - startTime;
    const kin = baseKinematics(a, elapsed);
    return {
      T: labTime,
      x: x0 + kin.x_disp,
      v: kin.v,
      gamma: kin.gamma,
      tau: startTime + kin.tau,
      missionActive: true,
    };
  }

  function acceleratedPoint(a, x0, startTime, labTime) {
    return delayedAcceleratedPoint(a, x0, startTime, labTime);
  }

  function solveSimultaneousPoint(pointAt, observer) {
    const target = observer.T - observer.v * observer.x;
    let low =
      Math.min(0, observer.T) -
      Math.max(20, Math.abs(observer.x) + Math.abs(observer.T) + 10);
    let high =
      Math.max(observer.T, 0) +
      Math.max(20, Math.abs(observer.x) + Math.abs(observer.T) + 10);

    const f = (T) => {
      const p = pointAt(T);
      return T - observer.v * p.x - target;
    };

    let fLow = f(low);
    let fHigh = f(high);
    let guard = 0;
    while (fLow > 0 && guard < 12) {
      low -= high - low;
      fLow = f(low);
      guard += 1;
    }
    guard = 0;
    while (fHigh < 0 && guard < 12) {
      high += high - low;
      fHigh = f(high);
      guard += 1;
    }

    if (fLow > 0 || fHigh < 0) {
      return pointAt(observer.T);
    }

    for (let i = 0; i < 72; i += 1) {
      const mid = (low + high) / 2;
      if (f(mid) < 0) low = mid;
      else high = mid;
    }
    return pointAt((low + high) / 2);
  }

  function properSpanOnObserverSlice(leftPointAt, rightPointAt, observer) {
    const safeV = Math.max(-0.999999, Math.min(0.999999, observer.v || 0));
    const gammaObs = 1 / Math.sqrt(1 - safeV * safeV);
    const obs = { ...observer, v: safeV };
    const left = solveSimultaneousPoint(leftPointAt, obs);
    const right = solveSimultaneousPoint(rightPointAt, obs);
    const xLeft = gammaObs * (left.x - safeV * left.T);
    const xRight = gammaObs * (right.x - safeV * right.T);
    return {
      span: Math.max(0, xRight - xLeft),
      left,
      right,
    };
  }

  function getLocalTau(a_center, x_local, t) {
    if (a_center <= EPS) return Math.max(0, t);
    const denom = 1.0 + a_center * x_local;
    if (denom <= EPS) return null;
    const a_local = a_center / denom;
    return Math.asinh(a_local * t) / a_local;
  }

  function getSimultaneousTime(X, x_offset, t_lab, x_O, v_O) {
    const C = t_lab - v_O * x_O + v_O * x_offset;
    const gamma_O_sq = 1.0 / (1.0 - v_O * v_O);
    if (Math.abs(v_O) < EPS) return C;
    const inside = C * C + (X * X) / gamma_O_sq;
    if (inside < 0) return C;
    return gamma_O_sq * (C + v_O * Math.sqrt(inside));
  }

  function getTauAtSimultaneousTime(X, x_offset, t_lab, x_O, v_O) {
    if (X <= EPS) return null;
    const t_prime = getSimultaneousTime(X, x_offset, t_lab, x_O, v_O);
    return X * Math.asinh(t_prime / X);
  }

  function getMissionSliceTau(X, x_offset, t_lab, x_O, v_O) {
    if (X <= EPS) return null;
    const t_prime = getSimultaneousTime(X, x_offset, t_lab, x_O, v_O);
    if (t_prime < -EPS) return null;
    return missionTau(X * Math.asinh(t_prime / X));
  }

  function missionTauFromPoint(point) {
    if (!point || point.T < -EPS) return null;
    return missionTau(point.tau);
  }

  function observerFramePoint(point, observer) {
    const v = Math.max(-0.999999, Math.min(0.999999, observer.v || 0));
    const gamma = 1 / Math.sqrt(1 - v * v);
    const pointV = Math.max(-0.999999, Math.min(0.999999, point.v || 0));
    return {
      T: gamma * (point.T - v * point.x),
      x: gamma * (point.x - v * point.T),
      v: (pointV - v) / (1 - pointV * v),
      missionActive: point.missionActive !== false,
    };
  }

  function sampleObserverSlice(pointAt, observer) {
    const point = solveSimultaneousPoint(pointAt, observer);
    return {
      point,
      frame: observerFramePoint(point, observer),
      tau: missionTauFromPoint(point),
    };
  }

  function rindlerX(horizonDistance, xi, t) {
    if (!Number.isFinite(horizonDistance)) return xi;
    const X = horizonDistance + xi;
    if (X <= EPS) return null;
    return Math.sqrt(X * X + t * t) - horizonDistance;
  }

  function rindlerVelocity(horizonDistance, xi, t) {
    if (!Number.isFinite(horizonDistance)) return 0;
    const X = horizonDistance + xi;
    if (X <= EPS) return null;
    return t / Math.sqrt(X * X + t * t);
  }

  function rindlerGamma(horizonDistance, xi, t) {
    if (!Number.isFinite(horizonDistance)) return 1;
    const X = horizonDistance + xi;
    if (X <= EPS) return null;
    return Math.sqrt(X * X + t * t) / X;
  }

  function rindlerProperTimeAtLabTime(horizonDistance, xi, t) {
    if (!Number.isFinite(horizonDistance)) return Math.max(0, t);
    const X = horizonDistance + xi;
    if (X <= EPS) return null;
    return X * Math.asinh(t / X);
  }

  function rindlerSliceProperTime(horizonDistance, xi, eta) {
    if (!Number.isFinite(horizonDistance)) return Math.max(0, eta);
    const X = horizonDistance + xi;
    if (X <= EPS) return null;
    return X * eta;
  }

  function computeBell(input = {}) {
    const state = safeState({ ...input, scenario: "bell" });
    const { t, a, L_gap, aA, aB, ropeLength } = state;
    const { gamma, v, tau, x_disp } = baseKinematics(a, t);
    const bellPointAt = (x0, xi, labTime) => {
      if (labTime < -EPS) {
        return {
          T: labTime,
          x: x0 + xi,
          v: 0,
          gamma: 1,
          tau: null,
          missionActive: false,
        };
      }
      if (a <= EPS) {
        return {
          T: labTime,
          x: x0 + xi,
          v: 0,
          gamma: 1,
          tau: missionTau(labTime),
          missionActive: true,
        };
      }
      const X = 1 / a + xi;
      const root = Math.sqrt(X * X + labTime * labTime);
      return {
        T: labTime,
        x: x0 - 1 / a + root,
        v: labTime / root,
        gamma: root / X,
        tau: missionTau(X * Math.asinh(labTime / X)),
        missionActive: true,
      };
    };

    const A_back = bellPointAt(0, -0.5 * S0, t);
    const A_center = bellPointAt(0, 0, t);
    const A_front = bellPointAt(0, 0.5 * S0, t);
    const B_back = bellPointAt(L_gap, -0.5 * S0, t);
    const B_center = bellPointAt(L_gap, 0, t);
    const B_front = bellPointAt(L_gap, 0.5 * S0, t);
    const A_attach = bellPointAt(0, aA * S0, t);
    const B_attach = bellPointAt(L_gap, aB * S0, t);
    const cableMidX0 = (aA * S0 + L_gap + aB * S0) / 2;
    const cable_center = bellPointAt(cableMidX0, 0, t);

    const S_lab = A_front.x - A_back.x;
    const S_lab_B = B_front.x - B_back.x;
    const C_A = A_center.x;
    const C_B = B_center.x;
    const E_A = A_back.x;
    const E_B = B_back.x;
    const P_A = A_attach.x;
    const P_B = B_attach.x;
    const cable_lab = P_B - P_A;
    // This is the familiar central-anchor Lorentz proxy. During active Bell
    // acceleration, only a selected MCIF slice has an exact simultaneous span.
    const requiredSpan = cable_lab * gamma;
    const attachment = attachmentSpan(L_gap, aA, aB);
    const baseSpan = attachment.baseSpan;
    const L_init = ropeLength * baseSpan;
    const strainModel = makeStrain(requiredSpan, L_init, state.breakStrain, {
      spanDegenerate: attachment.spanDegenerate,
    });

    const tau_A_back = missionTauFromPoint(A_back);
    const tau_A_front = missionTauFromPoint(A_front);
    const tau_B_back = missionTauFromPoint(B_back);
    const tau_B_front = missionTauFromPoint(B_front);
    const tau_cable = missionTauFromPoint(cable_center);
    const tau_A_center = missionTauFromPoint(A_center);
    const tau_B_center = missionTauFromPoint(B_center);

    const obs = state.selectedObserver || "B";
    let observer;
    if (obs === "A") {
      observer = bellPointAt(0, 0, t);
    } else if (obs === "B") {
      observer = bellPointAt(L_gap, 0, t);
    } else {
      observer = bellPointAt(cableMidX0, 0, t);
    }

    const sliceAback = sampleObserverSlice(
      (labTime) => bellPointAt(0, -0.5 * S0, labTime),
      observer,
    );
    const sliceAfront = sampleObserverSlice(
      (labTime) => bellPointAt(0, 0.5 * S0, labTime),
      observer,
    );
    const sliceAcenter = sampleObserverSlice(
      (labTime) => bellPointAt(0, 0, labTime),
      observer,
    );
    const sliceBback = sampleObserverSlice(
      (labTime) => bellPointAt(L_gap, -0.5 * S0, labTime),
      observer,
    );
    const sliceBfront = sampleObserverSlice(
      (labTime) => bellPointAt(L_gap, 0.5 * S0, labTime),
      observer,
    );
    const sliceBcenter = sampleObserverSlice(
      (labTime) => bellPointAt(L_gap, 0, labTime),
      observer,
    );
    const sliceAattach = sampleObserverSlice(
      (labTime) => bellPointAt(0, aA * S0, labTime),
      observer,
    );
    const sliceBattach = sampleObserverSlice(
      (labTime) => bellPointAt(L_gap, aB * S0, labTime),
      observer,
    );
    const sliceCableMid = sampleObserverSlice(
      (labTime) => bellPointAt(cableMidX0, 0, labTime),
      observer,
    );
    const slice_gap = Math.max(0, sliceBcenter.frame.x - sliceAcenter.frame.x);
    const slice_cable_span = Math.max(
      0,
      sliceBattach.frame.x - sliceAattach.frame.x,
    );
    const slice_tau_A_back = sliceAback.tau;
    const slice_tau_A_front = sliceAfront.tau;
    const slice_tau_A_center = sliceAcenter.tau;
    const slice_tau_B_back = sliceBback.tau;
    const slice_tau_B_front = sliceBfront.tau;
    const slice_tau_B_center = sliceBcenter.tau;
    const slice_tau_cable = sliceCableMid.tau;

    return {
      scenario: "bell",
      gamma,
      gammaLead: gamma,
      gammaA: gamma,
      gammaB: gamma,
      v,
      vLead: v,
      vA: v,
      vB: v,
      tau,
      S_lab,
      S_lab_B,
      C_A,
      C_B,
      E_A,
      E_B,
      F_A: A_front.x,
      F_B: B_front.x,
      P_A,
      P_B,
      lab_gap: L_gap,
      prop_gap: gamma * L_gap,
      slice_gap,
      slice_cable_span,
      stress_span: requiredSpan,
      bellStressIsProxy: true,
      attachmentStressApproximate: Math.abs(aA) > EPS || Math.abs(aB) > EPS,
      cable_lab,
      cable_prop: requiredSpan,
      L_init,
      baseSpan,
      ...strainModel,
      tau_A_back,
      tau_A_front,
      tau_A_center,
      tau_B_back,
      tau_B_front,
      tau_B_center,
      tau_cable,
      clock_tau_A_back: tau_A_back,
      clock_tau_A_front: tau_A_front,
      clock_tau_A_center: tau_A_center,
      clock_tau_B_back: tau_B_back,
      clock_tau_B_front: tau_B_front,
      clock_tau_B_center: tau_B_center,
      clock_tau_cable: tau_cable,
      slice_tau_A_back,
      slice_tau_A_front,
      slice_tau_A_center,
      slice_tau_B_back,
      slice_tau_B_front,
      slice_tau_B_center,
      slice_tau_cable,
      pf_tau_A_back: slice_tau_A_back,
      pf_tau_A_front: slice_tau_A_front,
      pf_tau_A_center: slice_tau_A_center,
      pf_tau_B_back: slice_tau_B_back,
      pf_tau_B_front: slice_tau_B_front,
      pf_tau_B_center: slice_tau_B_center,
      pf_tau_cable: slice_tau_cable,
      observerVelocity: observer.v,
      frame_observer: observerFramePoint(observer, observer),
      frame_A_back: sliceAback.frame,
      frame_A_front: sliceAfront.frame,
      frame_A_center: sliceAcenter.frame,
      frame_B_back: sliceBback.frame,
      frame_B_front: sliceBfront.frame,
      frame_B_center: sliceBcenter.frame,
      frame_A_attach: sliceAattach.frame,
      frame_B_attach: sliceBattach.frame,
      frame_cable: sliceCableMid.frame,
      properAlphaA: a,
      properAlphaB: a,
      engineAlphaA: a,
      engineAlphaB: a,
      leadAlpha: a,
      trailingAlpha: a,
      rocketAlphaA: a,
      rocketAlphaB: a,
    };
  }

  function computeTow(input = {}) {
    const state = safeState({ ...input, scenario: "tow" });
    const { t, a, L_gap, aA, aB } = state;
    const h = a <= EPS ? Infinity : 1 / a;
    const attachment = attachmentSpan(L_gap, aA, aB);
    const baseSpan = attachment.baseSpan;
    const L_init = baseSpan;
    // This is a UI normalization interval, not a causal stress-wave travel time.
    const loadRampDuration = L_init;
    const loadRampComplete = t >= loadRampDuration;
    const loadProgress = attachment.spanDegenerate
      ? 0
      : Math.max(0, Math.min(1, t / Math.max(EPS, loadRampDuration)));
    const loadReference = Math.max(EPS, state.breakStrain * 1000);
    const towLoad = attachment.spanDegenerate
      ? 0
      : (a / loadReference) * loadProgress;
    const steelStrain = attachment.spanDegenerate
      ? 0
      : Math.min(0.002, 0.0015 * towLoad);
    const elasticStretch = L_init * steelStrain;
    const cable_prop = L_init + elasticStretch;
    const prop_gap = cable_prop - (aB - aA) * S0;
    const stress_span = cable_prop;

    const xiA = 0;
    const xiB = prop_gap;
    const xiABack = xiA - 0.5 * S0;
    const xiAFront = xiA + 0.5 * S0;
    const xiBBack = xiB - 0.5 * S0;
    const xiBFront = xiB + 0.5 * S0;
    const xiAttachA = xiA + aA * S0;
    const xiAttachB = xiB + aB * S0;
    const xiCableMid = xiAttachA + cable_prop / 2;

    const C_A = rindlerX(h, xiA, t);
    const C_B = rindlerX(h, xiB, t);
    const E_A = rindlerX(h, xiABack, t);
    const E_B = rindlerX(h, xiBBack, t);
    const frontA = rindlerX(h, xiAFront, t);
    const frontB = rindlerX(h, xiBFront, t);
    const P_A = rindlerX(h, xiAttachA, t);
    const P_B = rindlerX(h, xiAttachB, t);

    const gammaA = rindlerGamma(h, xiA, t);
    const gammaB = rindlerGamma(h, xiB, t);
    const vA = rindlerVelocity(h, xiA, t);
    const vB = rindlerVelocity(h, xiB, t);
    const tauA = rindlerProperTimeAtLabTime(h, xiA, t);
    const tauB = rindlerProperTimeAtLabTime(h, xiB, t);
    const S_lab = frontA != null && E_A != null ? frontA - E_A : S0 / gammaA;
    const S_lab_B = frontB != null && E_B != null ? frontB - E_B : S0 / gammaB;
    const cable_lab = P_B - P_A;

    const towPointAt = (xi, labTime) => ({
      T: labTime,
      x: rindlerX(h, xi, labTime),
      v: rindlerVelocity(h, xi, labTime) ?? 0,
      gamma: rindlerGamma(h, xi, labTime) ?? 1,
      tau:
        labTime < -EPS
          ? null
          : rindlerProperTimeAtLabTime(h, xi, labTime),
    });

    const obs = state.selectedObserver || "B";
    let observer;
    if (obs === "A") {
      observer = towPointAt(xiA, t);
    } else if (obs === "rope") {
      observer = towPointAt(xiCableMid, t);
    } else {
      observer = towPointAt(xiB, t);
    }

    const slice = properSpanOnObserverSlice(
      (labTime) => towPointAt(xiAttachA, labTime),
      (labTime) => towPointAt(xiAttachB, labTime),
      observer,
    );
    const sliceCenter = properSpanOnObserverSlice(
      (labTime) => towPointAt(xiA, labTime),
      (labTime) => towPointAt(xiB, labTime),
      observer,
    );
    const towLagSpan = 0;
    const strainModel = {
      stretch: elasticStretch,
      strain: steelStrain,
      strainDefined: !attachment.spanDegenerate,
      spanDegenerate: attachment.spanDegenerate,
      slackFraction: 0,
      isBroken: false,
    };
    const tau_A_back = rindlerProperTimeAtLabTime(h, xiABack, t);
    const tau_A_front = rindlerProperTimeAtLabTime(h, xiAFront, t);
    const tau_B_back = rindlerProperTimeAtLabTime(h, xiBBack, t);
    const tau_B_front = rindlerProperTimeAtLabTime(h, xiBFront, t);
    const tau_cable = rindlerProperTimeAtLabTime(h, xiCableMid, t);

    const sliceAback = solveSimultaneousPoint(
      (labTime) => towPointAt(xiABack, labTime),
      observer,
    );
    const sliceAfront = solveSimultaneousPoint(
      (labTime) => towPointAt(xiAFront, labTime),
      observer,
    );
    const sliceAcenter = solveSimultaneousPoint(
      (labTime) => towPointAt(xiA, labTime),
      observer,
    );
    const sliceBback = solveSimultaneousPoint(
      (labTime) => towPointAt(xiBBack, labTime),
      observer,
    );
    const sliceBfront = solveSimultaneousPoint(
      (labTime) => towPointAt(xiBFront, labTime),
      observer,
    );
    const sliceBcenter = solveSimultaneousPoint(
      (labTime) => towPointAt(xiB, labTime),
      observer,
    );
    const sliceCable = solveSimultaneousPoint(
      (labTime) => towPointAt(xiCableMid, labTime),
      observer,
    );
    const slice_tau_A_back = missionTauFromPoint(sliceAback);
    const slice_tau_A_front = missionTauFromPoint(sliceAfront);
    const slice_tau_A_center = missionTauFromPoint(sliceAcenter);
    const slice_tau_B_back = missionTauFromPoint(sliceBback);
    const slice_tau_B_front = missionTauFromPoint(sliceBfront);
    const slice_tau_B_center = missionTauFromPoint(sliceBcenter);
    const slice_tau_cable = missionTauFromPoint(sliceCable);
    const leadAlpha = a / (1 + a * prop_gap);

    return {
      scenario: "tow",
      gamma: gammaB,
      gammaLead: gammaB,
      gammaA,
      gammaB,
      v: vB,
      vLead: vB,
      vA,
      vB,
      tau: tauB,
      tauLead: tauB,
      S_lab,
      S_lab_B,
      C_A,
      C_B,
      E_A,
      E_B,
      F_A: frontA,
      F_B: frontB,
      P_A,
      P_B,
      lab_gap: C_B - C_A,
      prop_gap,
      slice_gap: sliceCenter.span,
      slice_cable_span: slice.span,
      stress_span,
      cable_lab,
      cable_prop,
      L_init,
      baseSpan,
      loadRampDuration,
      loadRampComplete,
      loadProgress,
      ...strainModel,
      loadIndex: towLoad,
      towLoad,
      loadReference,
      steelStrain,
      elasticStretch,
      towLagSpan,
      mechTension: towLoad,
      tau_A_back,
      tau_A_front,
      tau_A_center: tauA,
      tau_B_back,
      tau_B_front,
      tau_B_center: tauB,
      tau_cable,
      clock_tau_A_back: tau_A_back,
      clock_tau_A_front: tau_A_front,
      clock_tau_A_center: tauA,
      clock_tau_B_back: tau_B_back,
      clock_tau_B_front: tau_B_front,
      clock_tau_B_center: tauB,
      clock_tau_cable: tau_cable,
      slice_tau_A_back,
      slice_tau_A_front,
      slice_tau_A_center,
      slice_tau_B_back,
      slice_tau_B_front,
      slice_tau_B_center,
      slice_tau_cable,
      pf_tau_A_back: slice_tau_A_back,
      pf_tau_A_front: slice_tau_A_front,
      pf_tau_A_center: slice_tau_A_center,
      pf_tau_B_back: slice_tau_B_back,
      pf_tau_B_front: slice_tau_B_front,
      pf_tau_B_center: slice_tau_B_center,
      pf_tau_cable: slice_tau_cable,
      observerVelocity: observer.v,
      frame_observer: observerFramePoint(observer, observer),
      frame_A_back: observerFramePoint(sliceAback, observer),
      frame_A_front: observerFramePoint(sliceAfront, observer),
      frame_A_center: observerFramePoint(sliceAcenter, observer),
      frame_B_back: observerFramePoint(sliceBback, observer),
      frame_B_front: observerFramePoint(sliceBfront, observer),
      frame_B_center: observerFramePoint(sliceBcenter, observer),
      frame_A_attach: observerFramePoint(slice.left, observer),
      frame_B_attach: observerFramePoint(slice.right, observer),
      frame_cable: observerFramePoint(sliceCable, observer),
      properAlphaA: a,
      properAlphaB: leadAlpha,
      engineAlphaA: 0,
      engineAlphaB: leadAlpha,
      leadAlpha,
      trailingAlpha: a,
      rocketAlphaA: 0,
      rocketAlphaB: leadAlpha,
    };
  }

  function computeBornRigid(input = {}) {
    const state = safeState({ ...input, scenario: "born" });
    const { t, a, L_gap, aA, aB } = state;
    const h = a <= EPS ? Infinity : 1 / a;
    const eta = a <= EPS ? t : Math.asinh(t / h);

    const xiA = 0;
    const xiB = L_gap;
    const xiABack = xiA - 0.5 * S0;
    const xiAFront = xiA + 0.5 * S0;
    const xiBBack = xiB - 0.5 * S0;
    const xiBFront = xiB + 0.5 * S0;
    const xiAttachA = xiA + aA * S0;
    const xiAttachB = xiB + aB * S0;

    const C_A = rindlerX(h, xiA, t);
    const C_B = rindlerX(h, xiB, t);
    const E_A = rindlerX(h, xiABack, t);
    const E_B = rindlerX(h, xiBBack, t);
    const frontA = rindlerX(h, xiAFront, t);
    const frontB = rindlerX(h, xiBFront, t);
    const P_A = rindlerX(h, xiAttachA, t);
    const P_B = rindlerX(h, xiAttachB, t);

    const gamma = rindlerGamma(h, xiA, t);
    const gammaLead = rindlerGamma(h, xiB, t);
    const v = rindlerVelocity(h, xiA, t);
    const vLead = rindlerVelocity(h, xiB, t);
    const tau = rindlerProperTimeAtLabTime(h, xiA, t);
    const tauLead = rindlerProperTimeAtLabTime(h, xiB, t);
    const S_lab = frontA != null && E_A != null ? frontA - E_A : S0 / gamma;
    const S_lab_B = frontB != null && E_B != null ? frontB - E_B : S0 / gammaLead;

    const lab_gap = C_B - C_A;
    const attachment = attachmentSpan(L_gap, aA, aB);
    const baseSpan = attachment.baseSpan;
    const L_init = baseSpan;
    const cable_lab = P_B - P_A;
    const cable_prop = L_init;
    const xiCableMid = xiAttachA + cable_prop / 2;
    const leadAlpha = a / (1 + a * L_gap);

    const tau_A_back = rindlerProperTimeAtLabTime(h, xiABack, t);
    const tau_A_front = rindlerProperTimeAtLabTime(h, xiAFront, t);
    const tau_A_center = tau;
    const tau_B_back = rindlerProperTimeAtLabTime(h, xiBBack, t);
    const tau_B_front = rindlerProperTimeAtLabTime(h, xiBFront, t);
    const tau_B_center = tauLead;
    const tau_cable = rindlerProperTimeAtLabTime(h, xiCableMid, t);

    const pf_tau_A_back = rindlerSliceProperTime(h, xiABack, eta);
    const pf_tau_A_front = rindlerSliceProperTime(h, xiAFront, eta);
    const pf_tau_A_center = rindlerSliceProperTime(h, xiA, eta);
    const pf_tau_B_back = rindlerSliceProperTime(h, xiBBack, eta);
    const pf_tau_B_front = rindlerSliceProperTime(h, xiBFront, eta);
    const pf_tau_B_center = rindlerSliceProperTime(h, xiB, eta);
    const pf_tau_cable = rindlerSliceProperTime(h, xiCableMid, eta);

    const bornPointAt = (xi, labTime) => ({
      T: labTime,
      x: rindlerX(h, xi, labTime),
      v: rindlerVelocity(h, xi, labTime) ?? 0,
      gamma: rindlerGamma(h, xi, labTime) ?? 1,
      tau:
        labTime < -EPS
          ? null
          : rindlerProperTimeAtLabTime(h, xi, labTime),
    });
    const obs = state.selectedObserver || "B";
    let observer;
    if (obs === "A") {
      observer = bornPointAt(xiA, t);
    } else if (obs === "rope") {
      observer = bornPointAt(xiCableMid, t);
    } else {
      observer = bornPointAt(xiB, t);
    }
    const sliceAback = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiABack, labTime),
      observer,
    );
    const sliceAfront = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiAFront, labTime),
      observer,
    );
    const sliceAcenter = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiA, labTime),
      observer,
    );
    const sliceBback = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiBBack, labTime),
      observer,
    );
    const sliceBfront = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiBFront, labTime),
      observer,
    );
    const sliceBcenter = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiB, labTime),
      observer,
    );
    const sliceCable = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiCableMid, labTime),
      observer,
    );
    const sliceAttachA = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiAttachA, labTime),
      observer,
    );
    const sliceAttachB = solveSimultaneousPoint(
      (labTime) => bornPointAt(xiAttachB, labTime),
      observer,
    );
    const frameAcenter = observerFramePoint(sliceAcenter, observer);
    const frameBcenter = observerFramePoint(sliceBcenter, observer);
    const frameAattach = observerFramePoint(sliceAttachA, observer);
    const frameBattach = observerFramePoint(sliceAttachB, observer);
    const slice_gap = Math.max(0, frameBcenter.x - frameAcenter.x);
    const slice_cable_span = Math.max(0, frameBattach.x - frameAattach.x);
    const slice_tau_A_back = missionTauFromPoint(sliceAback);
    const slice_tau_A_front = missionTauFromPoint(sliceAfront);
    const slice_tau_A_center = missionTauFromPoint(sliceAcenter);
    const slice_tau_B_back = missionTauFromPoint(sliceBback);
    const slice_tau_B_front = missionTauFromPoint(sliceBfront);
    const slice_tau_B_center = missionTauFromPoint(sliceBcenter);
    const slice_tau_cable = missionTauFromPoint(sliceCable);

    return {
      scenario: "born",
      gamma,
      gammaLead,
      gammaA: gamma,
      gammaB: gammaLead,
      v,
      vLead,
      vA: v,
      vB: vLead,
      tau,
      tauLead,
      S_lab,
      S_lab_B,
      C_A,
      C_B,
      E_A,
      E_B,
      F_A: frontA,
      F_B: frontB,
      P_A,
      P_B,
      lab_gap,
      prop_gap: L_gap,
      slice_gap,
      slice_cable_span,
      stress_span: L_init,
      cable_lab,
      cable_prop,
      L_init,
      baseSpan,
      stretch: 0,
      strain: 0,
      loadIndex: 0,
      strainDefined: !attachment.spanDegenerate,
      spanDegenerate: attachment.spanDegenerate,
      isBroken: false,
      slackFraction: 0,
      mechTension: 1,
      tau_A_back,
      tau_A_front,
      tau_A_center,
      tau_B_back,
      tau_B_front,
      tau_B_center,
      tau_cable,
      clock_tau_A_back: tau_A_back,
      clock_tau_A_front: tau_A_front,
      clock_tau_A_center: tau_A_center,
      clock_tau_B_back: tau_B_back,
      clock_tau_B_front: tau_B_front,
      clock_tau_B_center: tau_B_center,
      clock_tau_cable: tau_cable,
      slice_tau_A_back,
      slice_tau_A_front,
      slice_tau_A_center,
      slice_tau_B_back,
      slice_tau_B_front,
      slice_tau_B_center,
      slice_tau_cable,
      pf_tau_A_back: slice_tau_A_back,
      pf_tau_A_front: slice_tau_A_front,
      pf_tau_A_center: slice_tau_A_center,
      pf_tau_B_back: slice_tau_B_back,
      pf_tau_B_front: slice_tau_B_front,
      pf_tau_B_center: slice_tau_B_center,
      pf_tau_cable: slice_tau_cable,
      rindler_tau_A_back: pf_tau_A_back,
      rindler_tau_A_front: pf_tau_A_front,
      rindler_tau_A_center: pf_tau_A_center,
      rindler_tau_B_back: pf_tau_B_back,
      rindler_tau_B_front: pf_tau_B_front,
      rindler_tau_B_center: pf_tau_B_center,
      rindler_tau_cable: pf_tau_cable,
      observerVelocity: observer.v,
      frame_observer: observerFramePoint(observer, observer),
      frame_A_back: observerFramePoint(sliceAback, observer),
      frame_A_front: observerFramePoint(sliceAfront, observer),
      frame_A_center: frameAcenter,
      frame_B_back: observerFramePoint(sliceBback, observer),
      frame_B_front: observerFramePoint(sliceBfront, observer),
      frame_B_center: frameBcenter,
      frame_A_attach: frameAattach,
      frame_B_attach: frameBattach,
      frame_cable: observerFramePoint(sliceCable, observer),
      properAlphaA: a,
      properAlphaB: leadAlpha,
      engineAlphaA: 0,
      engineAlphaB: 0,
      leadAlpha,
      trailingAlpha: a,
      rocketAlphaA: 0,
      rocketAlphaB: 0,
    };
  }

  function compute(input = {}) {
    const state = safeState(input);
    if (state.scenario === "born") return computeBornRigid(state);
    if (state.scenario === "tow") return computeTow(state);
    return computeBell(state);
  }

  return {
    S0,
    EPS,
    normalizeScenario,
    safeState,
    attachmentSpan,
    initialAttachmentSpan,
    makeStrain,
    baseKinematics,
    getLocalTau,
    getSimultaneousTime,
    getTauAtSimultaneousTime,
    getMissionSliceTau,
    acceleratedPoint,
    delayedAcceleratedPoint,
    properSpanOnObserverSlice,
    rindlerX,
    rindlerVelocity,
    rindlerGamma,
    rindlerProperTimeAtLabTime,
    computeBell,
    computeTow,
    computeBornRigid,
    compute,
  };
});
