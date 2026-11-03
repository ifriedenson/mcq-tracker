"use strict";
/*
 * Markup, events and canvas adapter for the Reference Vector field tab.
 * The field math, arrows and streamlines stay in vector-field.js.
 */
const { Notice } = require("obsidian");
const vectorField = require("./vector-field");

function formatFieldNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  const rounded = Number(number.toPrecision(6));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function persistVectorFieldState() {
  const settings = this.plugin.settings;
  if (!settings) return;
  if (!settings.reference) settings.reference = {};
  settings.reference.vectorField = Object.assign({
    p: this.vectorFieldP,
    q: this.vectorFieldQ,
  }, this.vectorFieldSettings);
  if (typeof this.plugin.save === "function") {
    try { this.plugin.save(); } catch (e) { /* Obsidian reports a failed settings write itself. */ }
  }
}

function failVectorField(error) {
  const message = error && error.message ? error.message : "That vector field could not be drawn.";
  if (this.vectorFieldErrorEl) this.vectorFieldErrorEl.setText(message);
  if (this.vectorFieldStatusEl) this.vectorFieldStatusEl.setText(message);
  new Notice(message);
  return { ok: false, message };
}

function announceVectorField(text) {
  if (this.vectorFieldStatusEl) this.vectorFieldStatusEl.setText(text);
  else new Notice(text);
}

function applyVectorField(pText, qText, settings) {
  const p = String(pText === undefined || pText === null ? "" : pText).trim();
  const q = String(qText === undefined || qText === null ? "" : qText).trim();
  const next = vectorField.normalizeSettings(Object.assign({}, this.vectorFieldSettings, settings || {}));
  try {
    const field = vectorField.compileField(p, q);
    vectorField.sampleField(field, next);
  } catch (e) {
    return failVectorField.call(this, e);
  }
  this.vectorFieldP = p;
  this.vectorFieldQ = q;
  this.vectorFieldSettings = next;
  persistVectorFieldState.call(this);
  this.render();
  return { ok: true, p, q, settings: Object.assign({}, next) };
}

function setVectorFieldOption(key, value) {
  const allowed = new Set(["xMin", "xMax", "yMin", "yMax", "density", "scale", "normalize", "streamlines", "streamlineLength", "color"]);
  if (!allowed.has(key)) return { ok: false, message: `Unknown vector field setting ${key}.` };
  const candidate = Object.assign({}, this.vectorFieldSettings, { [key]: value });
  const next = vectorField.normalizeSettings(candidate);
  if (["xMin", "xMax", "yMin", "yMax"].includes(key) && !(next.xMax > next.xMin && next.yMax > next.yMin)) {
    this.render();
    return failVectorField.call(this, new Error("The vector field window needs finite minimums below its maximums."));
  }
  this.vectorFieldSettings = next;
  persistVectorFieldState.call(this);
  this.drawVectorField();
  return { ok: true, settings: Object.assign({}, next) };
}

function drawVectorField() {
  const canvas = this.vectorFieldCanvas;
  if (!canvas) return null;
  const width = Math.max(320, Math.min(720, Math.round(Number(canvas.clientWidth) || 640)));
  const height = 320;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) return failVectorField.call(this, new Error("This device did not provide a 2D canvas."));
  let field;
  try {
    field = vectorField.compileField(this.vectorFieldP, this.vectorFieldQ);
  } catch (e) {
    this.vectorFieldBuilt = null;
    return failVectorField.call(this, e);
  }
  const built = vectorField.paintVectorField(ctx, field, this.vectorFieldSettings, width, height);
  this.vectorFieldBuilt = Object.assign({ field, width, height }, built || {});
  if (this.vectorFieldErrorEl) this.vectorFieldErrorEl.setText("");
  announceVectorField.call(this, (built && built.summary) || "Vector field drawn.");
  return this.vectorFieldBuilt;
}

function renderVectorField(root) {
  root.createDiv({
    cls: "qt-ref-note",
    text: "A local 2D vector field. Enter P(x, y) and Q(x, y), then draw arrows, optional RK4 streamlines and magnitude-scaled vectors. Everything is evaluated by the restricted graph parser; there is no WebGL, network request or eval.",
  });
  const form = root.createDiv({ cls: "qt-ref-geometry-form" });
  form.createDiv({ cls: "qt-ref-graph-data-head", text: "Vector field" });
  const fields = form.createDiv({ cls: "qt-row qt-ref-geometry-fields" });
  const textField = (label, aria, value) => {
    const wrap = fields.createEl("label", { cls: "qt-ref-graph-bound" });
    wrap.createSpan({ text: label });
    const input = wrap.createEl("input", { cls: "qt-ref-amount", attr: { type: "text", "aria-label": aria } });
    input.value = value;
    return input;
  };
  const pInput = textField("P(x, y)", "Vector field P", this.vectorFieldP);
  const qInput = textField("Q(x, y)", "Vector field Q", this.vectorFieldQ);
  const color = fields.createEl("label", { cls: "qt-ref-graph-bound" });
  color.createSpan({ text: "colour" });
  const colorInput = color.createEl("input", { cls: "qt-ref-amount", attr: { type: "color", "aria-label": "Vector field colour" } });
  colorInput.value = this.vectorFieldSettings.color;
  const bounds = form.createDiv({ cls: "qt-row qt-ref-geometry-fields qt-ref-3d-fields" });
  const numberField = (label, aria, value, key) => {
    const wrap = bounds.createEl("label", { cls: "qt-ref-graph-bound" });
    wrap.createSpan({ text: label });
    const input = wrap.createEl("input", { cls: "qt-ref-amount", attr: { type: "number", step: "any", "aria-label": aria } });
    input.value = formatFieldNumber(value);
    input.addEventListener("change", () => this.setVectorFieldOption(key, input.value));
    return input;
  };
  for (const [key, label] of [["xMin", "min x"], ["xMax", "max x"], ["yMin", "min y"], ["yMax", "max y"]]) numberField(label, `Vector field ${label}`, this.vectorFieldSettings[key], key);
  const controls = form.createDiv({ cls: "qt-row qt-ref-geometry-fields" });
  const density = controls.createEl("label", { cls: "qt-ref-graph-bound" });
  density.createSpan({ text: "density" });
  const densityInput = density.createEl("input", { cls: "qt-ref-amount", attr: { type: "number", min: "3", max: "25", step: "1", "aria-label": "Vector field density" } });
  densityInput.value = String(this.vectorFieldSettings.density);
  densityInput.addEventListener("change", () => this.setVectorFieldOption("density", densityInput.value));
  const scale = controls.createEl("label", { cls: "qt-ref-graph-bound" });
  scale.createSpan({ text: "arrow scale" });
  const scaleInput = scale.createEl("input", { cls: "qt-ref-amount", attr: { type: "number", min: "0.1", max: "3", step: "0.1", "aria-label": "Vector field arrow scale" } });
  scaleInput.value = formatFieldNumber(this.vectorFieldSettings.scale);
  scaleInput.addEventListener("change", () => this.setVectorFieldOption("scale", scaleInput.value));
  const length = controls.createEl("label", { cls: "qt-ref-graph-bound" });
  length.createSpan({ text: "streamline steps" });
  const lengthInput = length.createEl("input", { cls: "qt-ref-amount", attr: { type: "number", min: "12", max: "160", step: "1", "aria-label": "Vector field streamline steps" } });
  lengthInput.value = String(this.vectorFieldSettings.streamlineLength);
  lengthInput.addEventListener("change", () => this.setVectorFieldOption("streamlineLength", lengthInput.value));
  const checks = form.createDiv({ cls: "qt-row qt-ref-graph-view" });
  const check = (label, aria, key) => {
    const wrap = checks.createEl("label", { cls: "qt-ref-graph-check" });
    const input = wrap.createEl("input", { attr: { type: "checkbox", "aria-label": aria } });
    input.checked = this.vectorFieldSettings[key] === true;
    input.addEventListener("change", () => this.setVectorFieldOption(key, input.checked));
    wrap.createSpan({ text: label });
  };
  check("Normalize magnitude", "Normalize vector field magnitude", "normalize");
  check("Show streamlines", "Show vector field streamlines", "streamlines");
  form.createEl("button", { text: "Draw field", attr: { type: "button", "aria-label": "Draw vector field" } })
    .addEventListener("click", () => this.applyVectorField(pInput.value, qInput.value, { color: colorInput.value }));
  form.createDiv({ cls: "qt-ref-matrix-hint", text: "Magnitude scaling keeps the arrow directions readable; turn normalize off to compare relative lengths." });

  this.vectorFieldStatusEl = root.createDiv({ cls: "qt-ref-geometry-status", attr: { "aria-live": "polite", "aria-label": "Vector field status" } });
  this.vectorFieldErrorEl = root.createDiv({ cls: "qt-calc-error", attr: { "aria-live": "polite", "aria-label": "Vector field error" } });
  this.vectorFieldCanvas = root.createEl("canvas", { cls: "qt-ref-canvas qt-ref-vector-canvas", attr: { role: "img", "aria-label": "Vector field rendering. Change P, Q or the window to redraw it." } });
  this.drawVectorField();
}

module.exports = {
  announceVectorField,
  applyVectorField,
  drawVectorField,
  failVectorField,
  persistVectorFieldState,
  renderVectorField,
  setVectorFieldOption,
};
