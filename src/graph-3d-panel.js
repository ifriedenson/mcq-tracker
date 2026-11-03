"use strict";
/*
 * Markup, event and canvas methods for the Reference 3D tab.
 *
 * The ray-marcher and camera math stay in graph-3d.js. This adapter only reads
 * the form, keeps the state, and paints the returned raster plus projected
 * points. It never uses WebGL, a mesh library or a network request.
 */
const { Notice } = require("obsidian");
const graph3d = require("./graph-3d");
const graph3dExport = require("./graph-3d-export");
const audioTrace = require("./audio-trace");
const { canvasPngBytes, exportFileName } = require("./graph-export");

function formatThreeDNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const rounded = Number(n.toPrecision(6));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function persistThreeDState() {
  const settings = this.plugin.settings;
  if (!settings) return;
  if (!settings.reference) settings.reference = {};
  settings.reference.threeD = {
    mode: this.threeDMode,
    surface: this.threeDSurface,
    bounds: Object.assign({}, this.threeDBounds),
    camera: Object.assign({}, this.threeDCamera),
    points: this.threeDPointsText,
    lod: this.threeDLod,
    curves: this.threeDCurves.map((entry) => Object.assign({}, entry)),
    curveText: this.threeDCurveText,
    curveColor: this.threeDCurveColor,
    curveTMin: this.threeDCurveTMin,
    curveTMax: this.threeDCurveTMax,
  };
  if (typeof this.plugin.save === "function") {
    try {
      this.plugin.save();
    } catch (e) {
      // The image stays in memory; Obsidian reports a failed settings write itself.
    }
  }
}

function announceThreeD(text) {
  if (this.threeDStatusEl) this.threeDStatusEl.setText(text);
  else new Notice(text);
}

function failThreeD(error) {
  const message = error && error.message ? error.message : "That 3D view could not be drawn.";
  if (this.threeDErrorEl) this.threeDErrorEl.setText(message);
  announceThreeD.call(this, message);
  new Notice(message);
  return { ok: false, message };
}

function applyThreeDSurface(text) {
  const source = String(text === undefined || text === null ? "" : text).trim();
  try {
    graph3d.compileSurface(source, this.threeDMode);
  } catch (e) {
    return failThreeD.call(this, e);
  }
  this.threeDSurface = source;
  persistThreeDState.call(this);
  this.drawThreeD();
  return { ok: true, surface: source, mode: this.threeDMode };
}

function applyThreeDCurve(text, tMin, tMax, color) {
  const source = String(text === undefined || text === null ? "" : text).trim();
  const start = Number(tMin);
  const end = Number(tMax);
  const hue = graph3d.normalizeCurveColor(color, "#ffd166");
  try {
    if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) throw new Error("A 3D curve needs a finite start below its end.");
    const curve = graph3d.compileCurve(source);
    graph3d.sampleCurve(curve, { tMin: start, tMax: end, samples: 8 });
  } catch (e) {
    return failThreeD.call(this, e);
  }
  if (this.threeDCurves.length >= graph3d.MAX_CURVES) return failThreeD.call(this, new Error(`A 3D scene can have at most ${graph3d.MAX_CURVES} curves.`));
  this.threeDCurves.push({ text: source, tMin: start, tMax: end, color: hue });
  this.threeDCurveText = source;
  this.threeDCurveColor = hue;
  this.threeDCurveTMin = String(start);
  this.threeDCurveTMax = String(end);
  persistThreeDState.call(this);
  this.render();
  return { ok: true, curve: this.threeDCurves[this.threeDCurves.length - 1] };
}

function removeThreeDCurve(index) {
  const at = Math.round(Number(index));
  if (!Number.isInteger(at) || at < 0 || at >= this.threeDCurves.length) return { ok: false, message: "That 3D curve no longer exists." };
  this.threeDCurves.splice(at, 1);
  persistThreeDState.call(this);
  this.render();
  return { ok: true, curves: this.threeDCurves.length };
}

function setThreeDLod(value) {
  this.threeDLod = graph3d.normalizeLod(value);
  persistThreeDState.call(this);
  this.render();
  return { ok: true, lod: this.threeDLod };
}

function switchThreeDMode(mode) {
  const next = mode === "implicit" ? "implicit" : "explicit";
  if (this.threeDMode === next) return { ok: true, mode: next, surface: this.threeDSurface };
  let source = this.threeDSurface;
  try {
    graph3d.compileSurface(source, next);
  } catch (e) {
    source = next === "implicit" ? "x^2 + y^2 + z^2 = 9" : "z = x^2 + y^2";
  }
  this.threeDMode = next;
  this.threeDSurface = source;
  persistThreeDState.call(this);
  this.render();
  return { ok: true, mode: next, surface: source };
}

function applyThreeDPoints(text) {
  const source = String(text === undefined || text === null ? "" : text);
  let points;
  try {
    points = graph3d.parsePoints(source);
  } catch (e) {
    return failThreeD.call(this, e);
  }
  this.threeDPointsText = source;
  persistThreeDState.call(this);
  this.drawThreeD();
  return { ok: true, points };
}

function setThreeDBound(key, value) {
  const raw = Number(value);
  const next = Object.assign({}, this.threeDBounds, { [key]: raw });
  if (!Number.isFinite(raw) || !(next.xMax > next.xMin) || !(next.yMax > next.yMin) || !(next.zMax > next.zMin)) {
    this.render();
    return failThreeD.call(this, new Error("The 3D box needs six finite numbers with each minimum below its maximum."));
  }
  this.threeDBounds = graph3d.normalizeBounds(next);
  persistThreeDState.call(this);
  this.render();
  return { ok: true, bounds: Object.assign({}, this.threeDBounds) };
}

function setThreeDCamera(key, value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) {
    this.render();
    return failThreeD.call(this, new Error("Camera values must be finite numbers."));
  }
  this.threeDCamera = graph3d.normalizeCamera(Object.assign({}, this.threeDCamera, { [key]: raw }));
  persistThreeDState.call(this);
  this.render();
  return { ok: true, camera: Object.assign({}, this.threeDCamera) };
}

function orbitThreeD(deltaYaw, deltaPitch, distanceFactor) {
  const next = {
    yaw: this.threeDCamera.yaw + Number(deltaYaw || 0),
    pitch: this.threeDCamera.pitch + Number(deltaPitch || 0),
    distance: this.threeDCamera.distance * (Number(distanceFactor) || 1),
  };
  this.threeDCamera = graph3d.normalizeCamera(next);
  persistThreeDState.call(this);
  this.render();
  return { ok: true, camera: Object.assign({}, this.threeDCamera) };
}

function resetThreeDView() {
  this.threeDBounds = Object.assign({}, graph3d.DEFAULT_BOUNDS);
  this.threeDCamera = Object.assign({}, graph3d.DEFAULT_CAMERA);
  persistThreeDState.call(this);
  this.render();
  return { ok: true, bounds: Object.assign({}, this.threeDBounds), camera: Object.assign({}, this.threeDCamera) };
}

function renderThreeD(root) {
  root.createDiv({
    cls: "qt-ref-note",
    text: "A local software-rendered 3D surface. Choose an explicit surface z = f(x, y) or an implicit surface F(x, y, z) = 0, set the box and camera, and optionally add points as x, y, z. Both modes use the same bounded ray-marcher; there is no WebGL, mesh library, network request or eval.",
  });
  const surfaceForm = root.createDiv({ cls: "qt-ref-geometry-form" });
  surfaceForm.createDiv({ cls: "qt-ref-graph-data-head", text: "Surface" });
  const modes = surfaceForm.createDiv({ cls: "qt-row qt-ref-calculator-modes" });
  for (const [mode, label] of [["explicit", "Explicit"], ["implicit", "Implicit"]]) {
    const button = modes.createEl("button", { text: label, cls: "qt-ref-tab", attr: { type: "button", "aria-label": `3D ${label.toLowerCase()} surface mode` } });
    if (this.threeDMode === mode) button.addClass("mod-cta");
    button.addEventListener("click", () => this.switchThreeDMode(mode));
  }
  const implicit = this.threeDMode === "implicit";
  const surfaceWrap = surfaceForm.createEl("label", { cls: "qt-ref-graph-bound qt-ref-3d-wide" });
  surfaceWrap.createSpan({ text: implicit ? "F(x, y, z) = 0" : "z = f(x, y)" });
  const surfaceInput = surfaceWrap.createEl("input", {
    cls: "qt-ref-amount qt-ref-3d-expression",
    attr: { type: "text", placeholder: implicit ? "x^2 + y^2 + z^2 = 9" : "z = x^2 + y^2", "aria-label": `3D ${implicit ? "implicit" : "explicit"} surface expression` },
  });
  surfaceInput.value = this.threeDSurface;
  const applySurface = () => this.applyThreeDSurface(surfaceInput.value);
  surfaceInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      if (event.preventDefault) event.preventDefault();
      applySurface();
    }
  });
  surfaceForm.createEl("button", { text: "Render surface", attr: { type: "button", "aria-label": "Render 3D surface" } })
    .addEventListener("click", applySurface);
  const detailWrap = surfaceForm.createEl("label", { cls: "qt-ref-graph-bound" });
  detailWrap.createSpan({ text: "Detail" });
  const detail = detailWrap.createEl("select", { cls: "qt-ref-amount", attr: { "aria-label": "3D rendering detail" } });
  for (const [value, label] of Object.entries(graph3d.LOD_LEVELS)) detail.createEl("option", { value, text: label.label });
  detail.value = this.threeDLod;
  detail.addEventListener("change", () => this.setThreeDLod(detail.value));

  const boxForm = root.createDiv({ cls: "qt-ref-geometry-form" });
  boxForm.createDiv({ cls: "qt-ref-graph-data-head", text: "Bounding box" });
  const boxFields = boxForm.createDiv({ cls: "qt-row qt-ref-geometry-fields qt-ref-3d-fields" });
  const boundField = (key, label) => {
    const wrap = boxFields.createEl("label", { cls: "qt-ref-graph-bound" });
    wrap.createSpan({ text: label });
    const input = wrap.createEl("input", { cls: "qt-ref-amount", attr: { type: "number", step: "any", "aria-label": `3D ${label}` } });
    input.value = formatThreeDNumber(this.threeDBounds[key]);
    input.addEventListener("change", () => this.setThreeDBound(key, input.value));
  };
  for (const [key, label] of [["xMin", "min x"], ["xMax", "max x"], ["yMin", "min y"], ["yMax", "max y"], ["zMin", "min z"], ["zMax", "max z"]]) boundField(key, label);

  const pointsForm = root.createDiv({ cls: "qt-ref-geometry-form" });
  pointsForm.createDiv({ cls: "qt-ref-graph-data-head", text: "Points" });
  const pointsWrap = pointsForm.createEl("label", { cls: "qt-ref-graph-bound qt-ref-3d-wide" });
  pointsWrap.createSpan({ text: "x, y, z; x, y, z" });
  const pointsInput = pointsWrap.createEl("input", {
    cls: "qt-ref-amount qt-ref-3d-expression",
    attr: { type: "text", placeholder: "0, 0, 0; 1, 2, 3", "aria-label": "3D point list" },
  });
  pointsInput.value = this.threeDPointsText;
  pointsForm.createEl("button", { text: "Apply points", attr: { type: "button", "aria-label": "Apply 3D points" } })
    .addEventListener("click", () => this.applyThreeDPoints(pointsInput.value));
  pointsForm.createDiv({ cls: "qt-ref-matrix-hint", text: "Separate points with semicolons or new lines. Each point needs three finite coordinates." });

  const cameraForm = root.createDiv({ cls: "qt-ref-geometry-form" });
  cameraForm.createDiv({ cls: "qt-ref-graph-data-head", text: "Camera" });
  const cameraFields = cameraForm.createDiv({ cls: "qt-row qt-ref-geometry-fields qt-ref-3d-fields" });
  const cameraField = (key, label) => {
    const wrap = cameraFields.createEl("label", { cls: "qt-ref-graph-bound" });
    wrap.createSpan({ text: label });
    const input = wrap.createEl("input", { cls: "qt-ref-amount", attr: { type: "number", step: "any", "aria-label": `3D camera ${label}` } });
    input.value = formatThreeDNumber(this.threeDCamera[key]);
    input.addEventListener("change", () => this.setThreeDCamera(key, input.value));
  };
  cameraField("yaw", "yaw");
  cameraField("pitch", "pitch");
  cameraField("distance", "distance");
  const cameraActions = cameraForm.createDiv({ cls: "qt-row qt-ref-graph-view" });
  const orbitButton = (label, aria, action) => cameraActions.createEl("button", { text: label, attr: { type: "button", "aria-label": aria } }).addEventListener("click", action);
  orbitButton("Orbit left", "Orbit the 3D camera left", () => this.orbitThreeD(-0.25, 0, 1));
  orbitButton("Orbit right", "Orbit the 3D camera right", () => this.orbitThreeD(0.25, 0, 1));
  orbitButton("Tilt up", "Tilt the 3D camera up", () => this.orbitThreeD(0, 0.15, 1));
  orbitButton("Tilt down", "Tilt the 3D camera down", () => this.orbitThreeD(0, -0.15, 1));
  orbitButton("Zoom in", "Zoom the 3D camera in", () => this.orbitThreeD(0, 0, 0.85));
  orbitButton("Zoom out", "Zoom the 3D camera out", () => this.orbitThreeD(0, 0, 1.18));
  orbitButton("Reset view", "Reset the 3D box and camera", () => this.resetThreeDView());

  const curveForm = root.createDiv({ cls: "qt-ref-geometry-form" });
  curveForm.createDiv({ cls: "qt-ref-graph-data-head", text: "Parametric curves" });
  const curveWrap = curveForm.createEl("label", { cls: "qt-ref-graph-bound qt-ref-3d-wide" });
  curveWrap.createSpan({ text: "(x(t), y(t), z(t))" });
  const curveInput = curveWrap.createEl("input", { cls: "qt-ref-amount qt-ref-3d-expression", attr: { type: "text", placeholder: "(cos(t), sin(t), t / 3)", "aria-label": "3D parametric curve" } });
  curveInput.value = this.threeDCurveText;
  const curveFields = curveForm.createDiv({ cls: "qt-row qt-ref-geometry-fields" });
  const curveField = (label, aria, value) => {
    const wrap = curveFields.createEl("label", { cls: "qt-ref-graph-bound" });
    wrap.createSpan({ text: label });
    const input = wrap.createEl("input", { cls: "qt-ref-amount", attr: { type: "number", step: "any", "aria-label": aria } });
    input.value = value;
    return input;
  };
  const curveMin = curveField("t from", "3D curve start", this.threeDCurveTMin);
  const curveMax = curveField("to", "3D curve end", this.threeDCurveTMax);
  const curveColor = curveFields.createEl("label", { cls: "qt-ref-graph-bound" });
  curveColor.createSpan({ text: "colour" });
  const curveColorInput = curveColor.createEl("input", { cls: "qt-ref-amount", attr: { type: "color", "aria-label": "3D curve colour" } });
  curveColorInput.value = this.threeDCurveColor;
  curveForm.createEl("button", { text: "Add curve", attr: { type: "button", "aria-label": "Add 3D parametric curve" } })
    .addEventListener("click", () => this.applyThreeDCurve(curveInput.value, curveMin.value, curveMax.value, curveColorInput.value));
  for (let index = 0; index < this.threeDCurves.length; index++) {
    const entry = this.threeDCurves[index];
    const row = curveForm.createDiv({ cls: "qt-row qt-ref-geometry-object" });
    row.createSpan({ cls: "qt-ref-geometry-object-text", text: `${entry.text} · t ${entry.tMin} to ${entry.tMax} · ${entry.color}` });
    row.createEl("button", { text: "×", cls: "qt-ref-graph-remove", attr: { type: "button", "aria-label": `Remove 3D curve ${index + 1}` } })
      .addEventListener("click", () => this.removeThreeDCurve(index));
  }

  const outputForm = root.createDiv({ cls: "qt-ref-geometry-form" });
  outputForm.createDiv({ cls: "qt-ref-graph-data-head", text: "Export, print and audio" });
  const output = outputForm.createDiv({ cls: "qt-row qt-ref-graph-view" });
  output.createEl("button", { text: "Save 3D PNG", attr: { type: "button", "aria-label": "Save 3D view as PNG" } }).addEventListener("click", () => this.saveThreeDImage());
  output.createEl("button", { text: "Print 3D view", attr: { type: "button", "aria-label": "Print 3D view" } }).addEventListener("click", () => this.printThreeDView());
  output.createEl("button", { text: "Play audio trace", attr: { type: "button", "aria-label": "Play 3D audio trace" } }).addEventListener("click", () => this.playThreeDAudio());
  output.createEl("button", { text: "Stop audio", attr: { type: "button", "aria-label": "Stop 3D audio trace" } }).addEventListener("click", () => this.stopThreeDAudio());
  this.threeDAudioStatusEl = outputForm.createDiv({ cls: "qt-ref-matrix-hint", attr: { "aria-live": "polite", "aria-label": "3D audio trace status" } });

  this.threeDStatusEl = root.createDiv({ cls: "qt-ref-geometry-status", attr: { "aria-live": "polite", "aria-label": "3D status" } });
  this.threeDErrorEl = root.createDiv({ cls: "qt-calc-error", attr: { "aria-live": "polite", "aria-label": "3D error" } });
  this.threeDCanvas = root.createEl("canvas", {
    cls: "qt-ref-canvas qt-ref-3d-canvas",
    attr: { role: "img", "aria-label": "3D surface rendering. Change the expression, box or camera to redraw it." },
  });
  this.drawThreeD();
}

function drawThreeD() {
  const canvas = this.threeDCanvas;
  if (!canvas) return null;
  const width = Math.max(32, Math.min(640, Math.round(Number(this.threeDRenderWidth) || 320)));
  const height = Math.max(24, Math.min(420, Math.round(Number(this.threeDRenderHeight) || 200)));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) {
    if (this.threeDErrorEl) this.threeDErrorEl.setText("This device did not provide a 2D canvas.");
    return null;
  }
  ctx.clearRect(0, 0, width, height);

  const lod = graph3d.lodSettings(this.threeDLod);
  let image;
  try {
    const surface = graph3d.compileSurface(this.threeDSurface, this.threeDMode);
    image = graph3d.renderSurface(surface, {
      width,
      height,
      bounds: this.threeDBounds,
      camera: this.threeDCamera,
      steps: lod.steps,
    });
  } catch (e) {
    this.threeDBuilt = null;
    const message = e && e.message ? e.message : "That 3D surface could not be drawn.";
    if (this.threeDErrorEl) this.threeDErrorEl.setText(message);
    announceThreeD.call(this, "3D surface not drawn.");
    return null;
  }
  this.threeDBuilt = image;
  if (this.threeDErrorEl) this.threeDErrorEl.setText("");

  let data = null;
  if (typeof ctx.createImageData === "function") {
    data = ctx.createImageData(image.width, image.height);
    if (data && data.data && typeof data.data.set === "function") data.data.set(image.pixels);
    else data = null;
  }
  if (!data && typeof ImageData !== "undefined") {
    try { data = new ImageData(image.pixels, image.width, image.height); } catch (e) { data = null; }
  }
  if (data && typeof ctx.putImageData === "function") ctx.putImageData(data, 0, 0);

  const compiledCurves = [];
  let curveError = "";
  for (const entry of this.threeDCurves) {
    try {
      compiledCurves.push(Object.assign({}, entry, { curve: graph3d.compileCurve(entry.text) }));
    } catch (e) {
      curveError = e && e.message ? e.message : "A stored 3D curve could not be read.";
    }
  }
  const curveOverlay = graph3d.drawCurveOverlay(ctx, compiledCurves, this.threeDCamera, image.width, image.height, { samples: lod.samples });
  let points = [];
  let pointError = "";
  try {
    points = graph3d.parsePoints(this.threeDPointsText);
  } catch (e) {
    pointError = e && e.message ? e.message : "The 3D points could not be read.";
  }
  const drawnPoints = graph3d.drawPointsOverlay(ctx, points, this.threeDCamera, image.width, image.height);
  this.threeDBuilt = Object.assign({}, image, { curves: curveOverlay.curves, points: drawnPoints, lod: lod.name });
  if (curveError || pointError) this.threeDErrorEl && this.threeDErrorEl.setText(curveError || pointError);
  const pointText = points.length === 1 ? "1 point" : `${points.length} points`;
  announceThreeD.call(this, `${image.summary} ${graph3d.curveSummary(this.threeDCurves, { lod: lod.name })} ${pointText}. ${lod.label} detail.`);
  return this.threeDBuilt;}

async function saveThreeDImage() {
  if (!this.threeDCanvas) return failThreeD.call(this, new Error("Open the 3D tab before saving an image."));
  try {
    const bytes = await canvasPngBytes(this.threeDCanvas);
    const path = `Exports/${exportFileName("3d", new Date(), "png")}`;
    await this.plugin.app.vault.createBinary(path, bytes);
    announceThreeD.call(this, `Saved ${path}.`);
    new Notice(`Saved ${path}.`);
    return { ok: true, path };
  } catch (e) {
    return failThreeD.call(this, e);
  }
}

function printThreeDView() {
  if (!this.threeDCanvas || typeof this.threeDCanvas.toDataURL !== "function") return failThreeD.call(this, new Error("This device did not provide a 3D canvas."));
  let dataUrl;
  try { dataUrl = this.threeDCanvas.toDataURL("image/png"); } catch (e) { return failThreeD.call(this, e); }
  const expressions = [this.threeDSurface].concat(this.threeDCurves.map((entry) => entry.text));
  const doc = graph3dExport.printDocument({ dataUrl, expressions, summary: this.threeDBuilt && this.threeDBuilt.summary, title: "MCQ Tracker 3D view" });
  if (!doc.ok) return failThreeD.call(this, new Error(doc.message));
  let win = null;
  try { win = typeof window !== "undefined" ? window.open("", "_blank") : null; } catch (e) { win = null; }
  if (win && win.document) {
    win.document.write(doc.html);
    win.document.close();
    if (typeof win.print === "function") win.print();
    announceThreeD.call(this, "3D print sheet opened.");
    return { ok: true, html: doc.html };
  }
  return failThreeD.call(this, new Error("The print window was blocked; save the 3D PNG instead."));
}

function playThreeDAudio() {
  const AudioCtor = typeof globalThis !== "undefined" ? globalThis.AudioContext || globalThis.webkitAudioContext : null;
  if (!AudioCtor) return failThreeD.call(this, new Error("This device did not provide Web Audio."));
  const curves = [];
  for (const entry of this.threeDCurves) {
    try {
      const points = graph3d.sampleCurve(graph3d.compileCurve(entry.text), { tMin: entry.tMin, tMax: entry.tMax, samples: 72 }).points.filter(Boolean);
      curves.push({ points });
    } catch (e) { /* A damaged stored curve is skipped for audio. */ }
  }
  let points = [];
  try { points = graph3d.parsePoints(this.threeDPointsText); } catch (e) { points = []; }
  const trace = audioTrace.buildAudioTrace({ curves, points });
  if (!trace.ok) return failThreeD.call(this, new Error(trace.message));
  try {
    this.stopThreeDAudio();
    this.threeDAudioContext = new AudioCtor();
    this.threeDAudioHandle = audioTrace.playAudioTrace(this.threeDAudioContext, trace);
  } catch (e) {
    return failThreeD.call(this, e);
  }
  if (!this.threeDAudioHandle || !this.threeDAudioHandle.ok) return failThreeD.call(this, new Error((this.threeDAudioHandle && this.threeDAudioHandle.message) || "The audio trace could not be played."));
  if (this.threeDAudioStatusEl) this.threeDAudioStatusEl.setText(trace.summary);
  announceThreeD.call(this, trace.summary);
  return trace;
}

function stopThreeDAudio() {
  if (this.threeDAudioHandle && typeof this.threeDAudioHandle.stop === "function") this.threeDAudioHandle.stop();
  this.threeDAudioHandle = null;
  if (this.threeDAudioContext && typeof this.threeDAudioContext.close === "function") {
    try { this.threeDAudioContext.close(); } catch (e) { /* already closed */ }
  }
  this.threeDAudioContext = null;
  if (this.threeDAudioStatusEl) this.threeDAudioStatusEl.setText("Audio trace stopped.");
  return { ok: true };
}


module.exports = {
  announceThreeD,
  applyThreeDCurve,
  applyThreeDPoints,
  applyThreeDSurface,
  drawThreeD,
  printThreeDView,
  playThreeDAudio,
  removeThreeDCurve,
  saveThreeDImage,
  setThreeDLod,
  stopThreeDAudio,
  failThreeD,
  orbitThreeD,
  persistThreeDState,
  renderThreeD,
  resetThreeDView,
  setThreeDBound,
  setThreeDCamera,
  switchThreeDMode,
};
