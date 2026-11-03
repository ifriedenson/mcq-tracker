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
    surface: this.threeDSurface,
    bounds: Object.assign({}, this.threeDBounds),
    camera: Object.assign({}, this.threeDCamera),
    points: this.threeDPointsText,
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
    graph3d.compileSurface(source, "explicit");
  } catch (e) {
    return failThreeD.call(this, e);
  }
  this.threeDSurface = source;
  persistThreeDState.call(this);
  this.drawThreeD();
  return { ok: true, surface: source };
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
    text: "A local software-rendered 3D surface. Enter an explicit surface as z = f(x, y), set the box and camera, and optionally add points as x, y, z. The image is ray-marched at a bounded resolution; there is no WebGL, mesh library, network request or eval.",
  });
  const surfaceForm = root.createDiv({ cls: "qt-ref-geometry-form" });
  surfaceForm.createDiv({ cls: "qt-ref-graph-data-head", text: "Surface" });
  const surfaceWrap = surfaceForm.createEl("label", { cls: "qt-ref-graph-bound qt-ref-3d-wide" });
  surfaceWrap.createSpan({ text: "z = f(x, y)" });
  const surfaceInput = surfaceWrap.createEl("input", {
    cls: "qt-ref-amount qt-ref-3d-expression",
    attr: { type: "text", placeholder: "z = x^2 + y^2", "aria-label": "3D surface expression" },
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

  let image;
  try {
    const surface = graph3d.compileSurface(this.threeDSurface, "explicit");
    image = graph3d.renderSurface(surface, {
      width,
      height,
      bounds: this.threeDBounds,
      camera: this.threeDCamera,
      steps: 64,
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

  let points = [];
  let pointError = "";
  try {
    points = graph3d.parsePoints(this.threeDPointsText);
  } catch (e) {
    pointError = e && e.message ? e.message : "The 3D points could not be read.";
  }
  for (let index = 0; index < points.length; index++) {
    const projected = graph3d.projectPoint(points[index], this.threeDCamera, image.width, image.height);
    if (!projected) continue;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd166";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#1f2937";
    ctx.stroke();
    if (typeof ctx.fillText === "function") {
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(`P${index + 1}`, projected.x + 6, projected.y - 6);
    }
  }

  if (pointError && this.threeDErrorEl) this.threeDErrorEl.setText(pointError);
  const pointText = points.length === 1 ? "1 point" : `${points.length} points`;
  announceThreeD.call(this, `${image.summary} ${pointText}.`);
  return image;
}

module.exports = {
  announceThreeD,
  applyThreeDPoints,
  applyThreeDSurface,
  drawThreeD,
  failThreeD,
  orbitThreeD,
  persistThreeDState,
  renderThreeD,
  resetThreeDView,
  setThreeDBound,
  setThreeDCamera,
};
