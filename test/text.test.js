const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const releaseFiles = [
  "AGENTS.md",
  "README.md",
  "index.html",
  "script.js",
  "style.css",
  "physics.js",
  "notes.md",
].filter((file) => fs.existsSync(path.join(root, file)));

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("release text does not contain em dashes", () => {
  const emDash = "\u2014";
  for (const file of releaseFiles) {
    const text = read(file);
    assert.equal(text.includes(emDash), false, `${file} contains an em dash`);
  }
});

test("Strong Tow copy describes a loaded steel non-snapping tow model", () => {
  const html = read("index.html");
  const readme = read("README.md");
  const script = read("script.js");
  const userFacing = `${html}\n${readme}`;

  assert.match(userFacing, /Strong Tow/);
  assert.match(userFacing, /loaded steel/i);
  assert.match(userFacing, /contracts in the lab frame|lab-frame span contracts/i);
  assert.match(userFacing, /small elastic strain|steel-like elastic strain/i);
  assert.match(script, /Tow Load Reference/);
  assert.match(script, /Tow Accel\. Split/);
  assert.match(script, /Steel Strain/);
  assert.match(script, /Elastic Stretch/);
  assert.equal(/Cable Break Strain/i.test(userFacing + script), false);
  assert.equal(/Tow Cable Monitor/i.test(userFacing + script), false);
  assert.equal(/Strong Tow[\s\S]{0,260}(SNAPPED|snapped)/i.test(userFacing + script), false);
});

test("engine plume copy stays separate from proper acceleration", () => {
  const physics = read("physics.js");
  const script = read("script.js");
  const userFacing = `${read("index.html")}\n${read("README.md")}`;

  assert.match(physics, /engineAlphaA/);
  assert.match(physics, /properAlphaA/);
  assert.match(physics, /rocketAlphaA: 0/);
  assert.match(script, /engineAlphaA/);
  assert.match(userFacing, /does not draw a\s+Ship A\s+exhaust plume/i);
  assert.match(userFacing, /Born-Rigid Reference draws no engine marker/i);
});

test("Natural Length is a disabled slider outside Bell mode", () => {
  const html = read("index.html");
  const script = read("script.js");
  const style = read("style.css");

  assert.match(html, /id="sl-rope-length"/);
  assert.match(html, /type="range"/);
  assert.match(html, /min="1\.0"/);
  assert.match(html, /max="2\.0"/);
  assert.match(html, /step="0\.1"/);
  assert.match(html, /visible but disabled/);
  assert.match(script, /setRopeLengthControlEnabled\(false, "fixed span"\)/);
  assert.match(script, /setRopeLengthControlEnabled\(false, "reference"\)/);
  assert.match(style, /\.rope-length-row\.disabled/);
});

test("Born-Rigid Reference disables its non-applicable threshold control", () => {
  const html = read("index.html");
  const script = read("script.js");
  const style = read("style.css");

  assert.match(html, /id="break-control-row"/);
  assert.match(script, /function setBreakControlEnabled/);
  assert.match(script, /setBreakControlEnabled\(false\)/);
  assert.match(script, /Reference Status/);
  assert.match(style, /\.ctrl-row\.disabled/);
});

test("frame tabs are styled as a prominent segmented control", () => {
  const html = read("index.html");
  const style = read("style.css");

  assert.match(html, /class="view-tabs"/);
  assert.match(html, /Observer Frame/);
  assert.match(html, /Proper Frame/);
  assert.match(style, /\.view-tabs[\s\S]*border:/);
  assert.match(style, /\.view-tabs[\s\S]*background:/);
  assert.match(style, /\.view-tab\.active[\s\S]*box-shadow:/);
});

test("visible clocks and slice samples use separate names", () => {
  const physics = read("physics.js");
  const script = read("script.js");
  const readme = read("README.md");

  assert.match(physics, /clock_tau_A_back/);
  assert.match(physics, /slice_tau_A_back/);
  assert.match(physics, /pf_tau_A_back/);
  assert.match(script, /frameClockTau\(phys, "A_back"\)/);
  assert.equal(/phys\.pf_tau_A_back/.test(script), false);
  assert.match(readme, /clock_tau_\*/);
  assert.match(readme, /slice_tau_\*/);
  assert.match(readme, /pf_tau_\*/);
  assert.match(readme, /slice[-\s]samples/i);
});

test("Live Equations expose scenario-specific Tow and Born labels", () => {
  const html = read("index.html");
  const script = read("script.js");

  assert.match(html, /id="eq-stretch-label-text"/);
  assert.match(script, /Elastic Stretch/);
  assert.match(script, /Steel Strain/);
  assert.match(script, /Tow Accel\. Split/);
  assert.match(script, /Proper Accel\. Split/);
  assert.match(script, /contracted loaded-cable span/);
  assert.match(html, /id="eq-linit-label"/);
  assert.match(html, /id="ctrl-rope-length-label"/);
  assert.match(html, /id="ctrl-rope-length-tip"/);
  assert.match(html, /id="attach-tip-a"/);
  assert.match(html, /id="attach-tip-b"/);
  assert.match(script, /Cable Baseline Span/);
  assert.match(script, /Reference Span/);
  assert.match(script, /Born: reference span/);
  assert.match(script, /exact Rindler attachment span/);
  assert.match(script, /scenarioDetailNote/);
});

test("Simulation Control sliders have a stable label row for alignment", () => {
  const html = read("index.html");
  const style = read("style.css");

  assert.match(style, /\.ctrl-row[\s\S]*grid-template-rows: minmax\(2\.45rem, auto\) 22px/);
  assert.match(style, /\.ctrl-label[\s\S]*min-height: 2\.45rem/);
  assert.match(style, /@media \(min-width: 1380px\)[\s\S]*\.controls-grid[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(style, /@media \(min-width: 1380px\)[\s\S]*\.controls-grid \.ctrl-row[\s\S]*grid-template-rows: 2\.15rem 22px/);
  assert.match(style, /\.rope-length-row[\s\S]*display: grid/);
  assert.match(
    html,
    /ctrl-name-text" id="ctrl-rope-length-label"[\s\S]*Rope Natural Length/,
  );
  assert.match(html, /id="ctrl-rope-length-label"[\s\S]*<span class="info-wrap">/);
  assert.equal(/\.rope-length-row \.ctrl-name \.info-wrap/.test(style), false);
  assert.match(style, /\.rope-length-row \.rope-length-value[\s\S]*align-self: end/);
  assert.match(style, /\.rope-length-row \.rope-length-value[\s\S]*white-space: nowrap/);
});

test("control tooltip identities stay attached to their own labels", () => {
  const html = read("index.html");
  const script = read("script.js");

  assert.match(html, /Acceleration \(α\)<\/span>[\s\S]*id="ctrl-acceleration-tip"/);
  assert.match(html, /Separation \(D\)<\/span>[\s\S]*id="ctrl-separation-tip"/);
  assert.match(html, /id="ctrl-rope-length-label"[\s\S]*id="ctrl-rope-length-tip"/);
  assert.match(html, /id="attach-label-text-a"[\s\S]*id="attach-tip-a"/);
  assert.match(html, /id="attach-label-text-b"[\s\S]*id="attach-tip-b"/);
  assert.match(script, /ctrlRopeLengthTip: \$\("ctrl-rope-length-tip"\)/);
  assert.match(script, /attachTipA: \$\("attach-tip-a"\)/);
  assert.match(script, /attachTipB: \$\("attach-tip-b"\)/);
});

test("desktop and stacked layouts keep the explanatory panel in the required order", () => {
  const html = read("index.html");
  const style = read("style.css");
  const controlsIndex = html.indexOf('class="panel controls-panel"');
  const sidebarIndex = html.indexOf('class="right-col"');
  const physicsIndex = html.indexOf('class="panel physics-panel"');

  assert.ok(controlsIndex > 0);
  assert.ok(sidebarIndex > controlsIndex);
  assert.ok(physicsIndex > sidebarIndex);
  assert.match(style, /grid-template-areas:[\s\S]*"left"[\s\S]*"controls"[\s\S]*"right"[\s\S]*"physics"/);
  assert.match(style, /@media \(min-width: 1380px\)[\s\S]*"left right"[\s\S]*"controls right"[\s\S]*"physics right"/);
  assert.match(style, /\.controls-panel[\s\S]*grid-area: controls/);
  assert.match(style, /\.physics-panel[\s\S]*grid-area: physics/);
});

test("equation panels can shrink without forcing a horizontal overflow", () => {
  const html = read("index.html");
  const style = read("style.css");
  const eqRowRule = style.match(/\.eq-row-label\s*\{([\s\S]*?)\n\}/)?.[1];

  assert.ok(eqRowRule);
  assert.match(style, /\.eq-table[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, max-content\)/);
  assert.match(eqRowRule, /display: block/);
  assert.doesNotMatch(eqRowRule, /display: flex/);
  assert.match(style, /\.eq-label-with-info[\s\S]*white-space: nowrap/);
  assert.match(style, /\.eq-formula[\s\S]*display: block/);
  assert.match(html, /class="eq-label-with-info"[\s\S]*id="eq-linit-label"[\s\S]*id="eq-linit-tip"/);
  assert.match(html, /class="eq-label-with-info"[\s\S]*id="eq-mech-label-text"[\s\S]*αB = αA/);
  assert.match(style, /\.eq-row-label[\s\S]*min-width: 0/);
  assert.match(style, /\.eq-result[\s\S]*overflow-wrap: anywhere/);
  assert.match(style, /\.tow-tension-val[\s\S]*overflow-wrap: anywhere/);
});

test("Proper Frame camera centers the displayed scene, not the selected observer", () => {
  const script = read("script.js");

  assert.match(script, /const sceneCenter = \(sceneLeft \+ sceneRight\) \/ 2/);
  assert.match(script, /const camX_p = sceneCenter/);
  assert.equal(/const camX_p = observerX/.test(script), false);
  assert.match(script, /connectorClockTau\(phys\)/);
  assert.match(script, /FORMER REF\./);
  assert.match(script, /isBroken \? "NO CLOCK" : "PRE-START"/);
});

test("context tints remain explicitly illustrative and use a sign-correct Doppler helper", () => {
  const html = read("index.html");
  const readme = read("README.md");
  const physics = read("physics.js");
  const script = read("script.js");

  assert.match(physics, /function longitudinalDopplerFactor/);
  assert.match(script, /function visualDopplerTint/);
  assert.match(script, /drawDopplerContext/);
  assert.match(html + readme, /illustrative, not a spectrum\s+simulation/i);
});

test("only Bell Proper Frame draws a natural-length guide", () => {
  const script = read("script.js");

  assert.match(script, /if \(scenario === "bell" && !isBroken\)/);
  assert.match(script, /Strong Tow and Born-rigid[\s\S]*do not have a Bell natural length/);
});

test("connector clock labels clear the Proper Frame telemetry badge", () => {
  const script = read("script.js");

  assert.match(script, /Keep the reference-clock label below the top-right telemetry badge/);
  assert.match(script, /compactCanvas \? 76 : 32/);
  assert.match(script, /labelBelow = false/);
  assert.match(script, /!isBroken,/);
});

test("Bell midpoint marker is described as a reference, not a solved rope clock", () => {
  const html = read("index.html");
  const readme = read("README.md");
  const script = read("script.js");

  assert.match(html + readme, /midpoint reference/i);
  assert.match(html + readme, /does not solve relativistic rope elasticity/i);
  assert.match(script, /Rope midpoint reference/);
  assert.match(script, /MIDPOINT REF\./);
});

test("Bell proper-frame copy distinguishes exact selected slices from the break proxy", () => {
  const html = read("index.html");
  const readme = read("README.md");
  const script = read("script.js");

  assert.match(html, /momentarily comoving inertial \(MCIF\) slice/);
  assert.match(readme, /not a unique simultaneous rope length/i);
  assert.match(readme, /central-anchor Lorentz proxy/);
  assert.match(readme, /before the modeled\s+launch/);
  assert.match(script, /exact selected attachment span/);
  assert.match(script, /Kinematic Stretch Proxy/);
});

test("off-center Bell attachment controls disclose their non-material proxy convention", () => {
  const html = read("index.html");
  const readme = read("README.md");
  const script = read("script.js");

  assert.match(script, /attachmentStressApproximate/);
  assert.match(script, /γ × lab coord\. proxy \(offsets\)/);
  assert.match(html + readme, /not an exact endpoint rest length/i);
});

test("Strong Tow avoids presenting its illustrative ramp as a causal signal front", () => {
  const script = read("script.js");
  const userFacing = `${read("index.html")}\n${read("README.md")}`;

  assert.match(userFacing, /quasi-static/i);
  assert.match(userFacing, /not a causal launch-transient/i);
  assert.match(script, /illustrative ramp/);
  assert.equal(/load front/i.test(script), false);
});

test("mobile equation values stack to avoid horizontal overflow", () => {
  const style = read("style.css");

  assert.match(style, /@media \(max-width: 540px\)[\s\S]*\.eq-table[\s\S]*grid-template-columns: 1fr/);
  assert.match(style, /@media \(max-width: 540px\)[\s\S]*\.eq-result[\s\S]*overflow-wrap: anywhere/);
});

test("playback controls keep Speed beside Play and Reset", () => {
  const html = read("index.html");
  const style = read("style.css");
  const toolbarIndex = html.indexOf('class="top-toolbar"');
  const playIndex = html.indexOf('id="btn-play"');
  const resetIndex = html.indexOf('id="btn-reset"');
  const speedIndex = html.indexOf('class="speed-group"');

  assert.ok(toolbarIndex > 0, "top toolbar should exist");
  assert.ok(playIndex > toolbarIndex, "play button should be in the toolbar");
  assert.ok(resetIndex > playIndex, "reset should follow play");
  assert.ok(speedIndex > resetIndex, "speed should follow reset");
  assert.match(style, /\.speed-group[\s\S]*margin-left: 0/);
});

test("test files are kept under the test folder", () => {
  const rootEntries = fs.readdirSync(root, { withFileTypes: true });
  const rootTestFiles = rootEntries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(test|spec)\.[cm]?js$/i.test(name));

  assert.deepEqual(rootTestFiles, []);
  assert.ok(fs.existsSync(path.join(root, "test", "physics.test.js")));
  assert.ok(fs.existsSync(path.join(root, "test", "text.test.js")));
});
