# Bell's Spaceship Paradox

Interactive static website for exploring Bell's spaceship paradox, a loaded
steel-cable tow comparison, and an exact Born-Rigid Reference profile.

The simulator uses units where `c = 1`. Distance is shown in `L`, time in
years, and proper acceleration in `c/yr`.

## Purpose

Bell's paradox begins with two ships initially at rest in the lab frame,
separated by center distance `D`, and connected by a fragile rope. In Bell mode
both ship centers follow the same constant proper-acceleration program. Their
lab-frame separation stays fixed, while the familiar central-anchor Lorentz
proxy increases. After slack is used, the site displays a threshold crossing for
that proxy rather than a full material-failure calculation.

The launch is modeled as beginning simultaneously at lab time `t = 0`. Before
that time the ships are at rest. This matters in the Proper Frame: an
instantaneous slice through Ship B can intersect Ship A before the modeled
launch. The page shows that clock as `PRE-START`, rather than extending an
accelerated worldline into an unmodeled earlier history.

`Strong Tow` is a quasi-static loaded very-strong-cable comparison, not a
causal launch-transient calculation. Only Ship B has a rocket marker. Ship A's
displayed acceleration is tension-driven, so the canvas does not draw a Ship A
exhaust plume. The geometry uses a Rindler-like stiff limit: its lab-frame span
contracts, its material span stays nearly fixed, and the trailing constraint has
greater proper acceleration than the leading engine. The cable is treated as
strong enough not to fail, with a small illustrative steel-like elastic strain
capped at `0.2%`. The normalization ramp is not a stress wave or a signal
propagation prediction.

`Born-Rigid Reference` is the exact Rindler benchmark. It is not a material rope
model. The trailing ship uses `alpha_A = alpha`, the leading ship uses

```text
alpha_B = alpha_A / (1 + alpha_A D)
```

and the proper separation remains fixed.

## Navigating The Website

The left canvas is the main simulator.

- `Play`, `Reset`, and `Speed` control animation playback.
- `Observer Frame` shows the inertial lab frame.
- `Proper Frame` shows one momentarily comoving inertial (MCIF) slice for the
  selected marker. Only the selected marker is at rest on that slice. Click
  Ship A, Ship B, or the rope/cable/reference midpoint marker on the canvas to
  change the slice.
- The top badge reports the selected observer's Lorentz factor, velocity, and
  ordinary mission clock. Ordinary mission clocks are monotonic.
- The bottom observer badge states the active frame and selected marker.

The `Simulation Controls` panel changes the model.

- `Time (t)` moves through the run.
- `Acceleration (alpha)` sets the scenario command. Bell gives this rocket
  setting to both ships. Strong Tow uses it as the trailing cable constraint,
  computes the lower Ship B engine acceleration, and shows rocket thrust only on
  Ship B. Born-Rigid Reference uses it as Ship A's kinematic proper
  acceleration and computes the lower Ship B acceleration.
- `Separation (D)` sets the initial center-to-center distance.
- `Rope Break Strain` applies only to Bell's fragile rope.
- `Tow Load Reference` applies only to Strong Tow and scales the load index. It
  does not turn the tow cable into a fragile rope.
- `Reference Status` is disabled in Born-Rigid Reference because the exact
  kinematic benchmark has no material tolerance or failure threshold.
- `Rope Natural Length (L0)` is a slider from `1.0 x span` to `2.0 x span`.
  It changes Bell's fragile-rope slack. It remains visible but disabled in
  Strong Tow and Born-Rigid Reference because those models do not use Bell's
  natural rope length.
- `Scenario` switches between Bell's Paradox, Strong Tow, and Born-Rigid
  Reference.
- `Rope Attachment Point` or `Cable Attachment Point` changes where the
  connector meets each ship. The initial attachment span is
  `D + DeltaAttach*S0`, clamped to contact span when endpoints coincide.

The right column explains the numbers.

- `Live Equations` shows velocity, Lorentz factor, ship proper time or
  selected-slice clock samples, lab gap, the selected-MCIF gap, natural or
  reference span, coordinate span, selected cable slice, Bell's kinematic
  threshold proxy, Tow acceleration split, steel strain, and Born reference
  values.
- The monitor panel shows Bell strain, Tow load, or Born reference status.
- `Details` under the insight box gives compact scenario-specific notes.
- `The Physics Explained` gives the lab-frame and proper-slice interpretation.

## Clocks And Slice Samples

Ordinary mission clocks use `clock_tau_*` fields. They are elapsed proper times
along each displayed object and never run backward. In Strong Tow, rear and
front clock values are computed from the corresponding material worldlines, so
they need not match the center clocks.

Proper Frame canvas clocks and the proper-frame clock row use `slice_tau_*`
fields. The older `pf_tau_*` names remain aliases for those simultaneity-slice
samples. A slice sample is the clock reading on a remote worldline at the event
that the selected observer regards as simultaneous. These samples change when
Ship A, the midpoint, or Ship B is selected as the observer marker.

In Bell mode, `gamma*D` is the familiar central-anchor Lorentz proxy. It gives
the standard required span once the common acceleration program has ended, but
it is not a unique simultaneous rope length while acceleration is active. The
Proper Frame drawing uses exact selected-MCIF events, so changing the observer
marker can change the displayed slice span and can put a remote clock before the
modeled mission start.

For Bell, some selected instantaneous slices intersect a remote worldline before
the modeled mission starts. The simulator displays those cases as `PRE-START`
on the canvas and `n/a` in the equation row instead of clamping them to
`0.000 yr` or showing a negative mission time.

## Scenario Guide

In `Bell's Paradox`, both centers share the same acceleration program and the
lab gap remains `D`. The increasing central-anchor Lorentz proxy drives the
displayed threshold once slack is exhausted.

In `Strong Tow`, Ship B is the only rocket-marked source. Ship A's displayed
motion is supplied by cable tension in a loaded steel-cable approximation. The
model uses Rindler-family material worldlines as a steady stiff-cable reference,
so the lab span contracts while the material span remains nearly fixed:

```text
alpha_B = alpha_A / (1 + alpha_A D_eff)
```

The load index is converted into a small steel-like strain using

```text
steelStrain = min(0.002, 0.0015 * loadIndex)
```

so the cable can stretch slightly while remaining far from a failure state. The
load ramp is only a reference cue, not a signal front or a transient wave
solution. This is not a relativistic elasticity solver.

In `Born-Rigid Reference`, the ships belong to one Rindler family. Ship A has
greater proper acceleration than Ship B. The lab-frame gap decreases at common
lab time, while the proper separation stays fixed.

## Notation

- `D`: initial center-to-center separation.
- `S0`: each ship's proper length.
- `L0`: Bell rope's unstressed natural length.
- `alpha`: proper acceleration setting.
- `gamma`: Lorentz factor for the displayed or selected observer.
- `tau`: ordinary mission proper time.
- `DeltaAttach`: Ship B attachment offset minus Ship A attachment offset.
- `Coord. Span`: exact attachment-point distance on the displayed lab slice.
- `Selected Slice Span`: exact attachment-point distance on the chosen MCIF
  slice.
- `Required Span`: Observer Frame's scenario-specific span. In Bell mode it is
  a central-anchor kinematic proxy during acceleration.
- `Kinematic Stretch Proxy`: Bell's proxy span minus `L0`, after slack is used.
- `Proxy Strain`: Kinematic Stretch Proxy divided by `L0`; it drives the Bell
  threshold display and is not a stress-tensor calculation.
- `Tow Load Index`: Strong Tow load demand divided by the selected reference.
  It is not cable elongation or a failure threshold.
- `Steel Strain`: Strong Tow's reduced elastic strain, capped at `0.2%`.
- `Tow Accel. Split`: Strong Tow proper acceleration values, with the trailing
  cable constraint larger than the leading engine value.
- `Engine Alpha`: visual rocket thrust marker. Strong Tow draws Ship B's marker
  only. Born-Rigid Reference draws no engine marker because it specifies a
  kinematic congruence, not a propulsion arrangement.

## Physics Scope

This site models special-relativistic kinematics and a simplified fragile-rope
threshold for Bell mode. Ship endpoint placement uses exact local Born-rigid
worldlines. The Bell break threshold is deliberately simpler: it is a
central-anchor kinematic proxy, not a stress tensor or a full rope dynamics
solution. The site does not model continuum elasticity, material sound speed,
plastic deformation, thermal effects, or quantum material limits.

Strong Tow uses a non-snapping loaded steel cable with a small reduced elastic
response. The displayed load is a reference demand, and the displayed steel
strain is not a full stress tensor, finite-density cable simulation, material
sound-speed solution, or plastic deformation model.

Useful references:

- [Dewan and Beran, “Note on Stress Effects Due to Relativistic Contraction”](https://doi.org/10.1119/1.1934929)
- [Bell's Spaceship Paradox, UCR Physics FAQ](https://math.ucr.edu/home/baez/physics/Relativity/SR/BellSpaceships/spaceship_puzzle.html)
- [Bell's spaceship paradox overview](https://en.wikipedia.org/wiki/Bell%27s_spaceship_paradox)
- [Rindler coordinates and Born-rigid acceleration](https://en.wikipedia.org/wiki/Rindler_coordinates)

## Running Locally

Open [index.html](C:\Users\russi\Documents\GitHub\Bells-Spaceship-Paradox\index.html) directly in a browser, or serve the folder with any static file server. No build step is required.

Run checks with `pnpm`:

```bash
pnpm test
pnpm check
```

The tests use Node's built-in `node:test` runner and do not require runtime
dependencies.

## Files

- [index.html](C:\Users\russi\Documents\GitHub\Bells-Spaceship-Paradox\index.html): page structure, controls, and explanatory text.
- [style.css](C:\Users\russi\Documents\GitHub\Bells-Spaceship-Paradox\style.css): visual design and responsive layout.
- [physics.js](C:\Users\russi\Documents\GitHub\Bells-Spaceship-Paradox\physics.js): pure formula module used by the browser and tests.
- [script.js](C:\Users\russi\Documents\GitHub\Bells-Spaceship-Paradox\script.js): canvas rendering, controls, and DOM updates.
- [test](C:\Users\russi\Documents\GitHub\Bells-Spaceship-Paradox\test): formula and release-text checks.
