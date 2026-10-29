"use strict";
// Reference module: pure data checks plus the optional module's entry points.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT, obsidian } = load();
const ref = T.referenceData;

async function setup(saved) {
  const app = makeApp([]);
  const plugin = new QT(app);
  if (saved) plugin.saved = saved;
  await plugin.onload();
  obsidian.notices.length = 0;
  return { app, plugin };
}

test("reference: length, temperature and invalid conversions", () => {
  assert.equal(ref.convertUnit(1, "length", "km", "m"), 1000);
  assert.ok(Math.abs(ref.convertUnit(12, "length", "in", "ft") - 1) < 1e-12);
  assert.equal(ref.convertUnit(100, "temperature", "c", "f"), 212);
  assert.equal(ref.convertUnit(32, "temperature", "f", "c"), 0);
  assert.equal(ref.convertUnit(0, "temperature", "c", "k"), 273.15);
  assert.equal(ref.convertUnit("nope", "length", "m", "ft"), null);
  assert.equal(ref.convertUnit(1, "length", "m", "nope"), null);
  assert.equal(ref.convertUnit(1, "nope", "m", "ft"), null);
});

test("reference: formulas and constants are searchable by name, subject and text", () => {
  const momentum = ref.searchFormulas("momentum", "physics");
  assert.ok(momentum.some((f) => f.id === "momentum"));
  assert.ok(momentum.some((f) => f.id === "impulse"), "the note text is searchable too");
  assert.ok(ref.searchFormulas("", "chemistry").every((f) => f.subject === "chemistry"));
  assert.ok(ref.searchFormulas("quadratic").some((f) => f.id === "quadratic"));
  assert.ok(ref.searchFormulas("", "all").length >= 20);
  assert.ok(ref.searchConstants("avogadro").some((c) => c.id === "avogadro"));
  assert.ok(ref.searchConstants("J/(mol K)").length >= 1);
});

test("reference: settings are off by default, and the view command follows the module", async () => {
  const { plugin } = await setup();
  assert.equal(plugin.referenceEnabled(), false);
  assert.ok(plugin.commands.some((c) => c.id === "open-reference"));
  assert.equal(await plugin.activateReference(), null);
  assert.ok(obsidian.notices.some((n) => /Reference module is off/.test(n)));

  plugin.settings.reference.enabled = true;
  assert.equal(plugin.referenceEnabled(), true);
});

test("reference: reference hides during a timed test unless the user turns that off", async () => {
  const { plugin } = await setup();
  plugin.settings.reference.enabled = true;
  plugin.settings.testSession = { v: 1, items: [{ path: "Q/a.md" }], deadline: Date.now() + 60000 };
  assert.equal(await plugin.activateReference(), null);
  assert.ok(obsidian.notices.some((n) => /hidden while a timed test/.test(n)));

  plugin.settings.reference.hideDuringTests = false;
  // The fake workspace has no real leaf; the guard should now get past the test check.
  let leafRequested = false;
  plugin.app.workspace.getLeavesOfType = () => [];
  plugin.app.workspace.getLeaf = () => {
    leafRequested = true;
    return { setViewState: async () => {}, loadIfDeferred: async () => {}, view: {} };
  };
  plugin.app.workspace.revealLeaf = async () => {};
  await plugin.activateReference();
  assert.equal(leafRequested, true);
});

test("reference: switching it off closes only the reference tab", async () => {
  const { app, plugin } = await setup();
  const detached = [];
  app.workspace.detachLeavesOfType = (type) => detached.push(type);
  plugin.settings.reference.enabled = true;
  await plugin.onReferenceToggled();
  assert.deepEqual(detached, []);
  plugin.settings.reference.enabled = false;
  await plugin.onReferenceToggled();
  assert.deepEqual(detached, ["question-tracker-reference"]);
});

test("reference: the view shows formulas, the converter and the off state", async () => {
  const { app, plugin } = await setup();
  const dom = makeDom();
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  view.contentEl = dom.root;
  view.render();
  assert.ok(dom.texts().some((t) => /Reference is off/.test(t)));

  plugin.settings.reference.enabled = true;
  const again = makeDom();
  view.contentEl = again.root;
  view.render();
  assert.ok(again.texts().includes("Reference"));
  assert.ok(again.texts().includes("Formulas"));
  assert.ok(again.texts().includes("Quadratic formula"));

  view.tab = "units";
  const units = makeDom();
  view.contentEl = units.root;
  view.render();
  assert.ok(units.texts().includes("Unit converter"));
  assert.ok(units.texts().includes("Length"));

  view.tab = "constants";
  const constants = makeDom();
  view.contentEl = constants.root;
  view.render();
  assert.ok(constants.texts().includes("Avogadro constant"));
});


test("chemistry: AP equations and constants match the 2025 reference sheet", () => {
  const actual = ref.FORMULAS.filter((f) => f.subject === "chemistry").map((f) => f.formula);
  for (const equation of [
    '1 hertz = 1 s^-1',
    '1 atm = 760 mm Hg = 760 torr',
    'K = °C + 273.15',
    '1 volt = 1 joule/coulomb',
    '1 ampere = 1 coulomb/second',
    'E = hν',
    'c = λν',
    'F_coulombic ∝ q1 q2 / r^2',
    'P1 V1 / T1 = P2 V2 / T2',
    'P V = n R T',
    'P_A = P_total X_A',
    'P_total = P_A + P_B + P_C + ...',
    'n = m / M',
    'D = m / V',
    'KE = (1/2) m v^2',
    'M = n_solute / L_solution',
    'A = εbc',
    '[A]_t - [A]_0 = -k t',
    'ln[A]_t - ln[A]_0 = -k t',
    '1 / [A]_t - 1 / [A]_0 = k t',
    't_1/2 = 0.693 / k',
    'K_c = [C]^c [D]^d / ([A]^a [B]^b)',
    'K_p = (P_C)^c (P_D)^d / ((P_A)^a (P_B)^b)',
    'K_w = [H3O+][OH-] = 1.0 x 10^-14 at 25 °C',
    'pK_w = 14 = pH + pOH at 25 °C',
    'pH = -log[H3O+]',
    'pOH = -log[OH-]',
    'K_a = [H3O+][A-] / [HA]',
    'K_b = [OH-][HB+] / [B]',
    'pK_a = -log K_a; pK_b = -log K_b',
    'K_w = K_a x K_b; pK_w = pK_a + pK_b',
    'pH = pK_a + log([A-] / [HA])',
    'q = m c ΔT',
    'ΔH°_reaction = Σ ΔH°_f products - Σ ΔH°_f reactants',
    'ΔS°_reaction = Σ S° products - Σ S° reactants',
    'ΔG°_reaction = Σ ΔG°_f products - Σ ΔG°_f reactants',
    'ΔG° = ΔH° - T ΔS°',
    'ΔG° = -R T ln K',
    'ΔG° = -n F E°',
    'I = q / t',
    'E_cell = E°_cell - (R T / n F) ln Q',
  ]) {
    assert.ok(actual.includes(equation), equation);
  }

  const constants = Object.fromEntries(ref.CONSTANTS.map((item) => [item.id, item]));
  const expected = {
    planck: ["6.626 x 10^-34", "J s"],
    "speed-of-light": ["2.998 x 10^8", "m/s"],
    avogadro: ["6.022 x 10^23", "1/mol"],
    "gas-constant": ["8.314", "J/(mol K)"],
    "gas-constant-atm": ["0.08206", "L atm/(mol K)"],
    faraday: ["96,485", "C/mol e-"],
    "molar-volume-stp": ["22.4", "L/mol"],
    "water-ion-product": ["1.0 x 10^-14", "at 25 °C"],
    "stp-temperature": ["273.15", "K"],
    "stp-pressure": ["1.0", "atm"],
  };
  for (const [id, [value, unit]] of Object.entries(expected)) {
    assert.equal(constants[id] && constants[id].value, value, id);
    assert.equal(constants[id] && constants[id].unit, unit, id);
  }
  assert.ok(Math.abs(ref.convertUnit(1, "pressure", "atm", "mmhg") - 760) < 1e-9);
});
