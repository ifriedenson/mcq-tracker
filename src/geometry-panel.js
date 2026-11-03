"use strict";
/*
 * Event and canvas methods for the Reference Geometry tab.
 *
 * These are attached to ReferenceView.prototype so the large view file only
 * carries the tab markup. All model work stays in the pure geometry module.
 */
const { Notice } = require("obsidian");
const geometry = require("./geometry");
const { exportScale } = require("./graph-export");

function addGeometryPoint(x, y) {
  try {
    const point = geometry.addPoint(this.geometryModel, x, y, "");
    this.persistGeometryState();
    this.geometryA = this.geometryA || point.id;
    this.geometryB = this.geometryB || point.id;
    this.render();
    this.announceGeometry(`Point ${point.id} added.`);
    return { ok: true, point };
  } catch (e) {
    return this.failGeometry(e);
  }
}

function addGeometryObject(type, first, second, polygonText, third, sourceA, sourceB) {
  try {
    let object;
    if (type === "polygon") object = geometry.addPolygon(this.geometryModel, String(polygonText || "").split(/[,\s]+/).filter(Boolean));
    else if (type === "midpoint") object = geometry.addMidpoint(this.geometryModel, first, second);
    else if (type === "intersection") object = geometry.addIntersection(this.geometryModel, sourceA, sourceB);
    else if (type === "parallel") object = geometry.addParallel(this.geometryModel, first, sourceA);
    else if (type === "perpendicular") object = geometry.addPerpendicular(this.geometryModel, first, sourceA);
    else if (type === "perpendicularBisector") object = geometry.addPerpendicularBisector(this.geometryModel, first, second);
    else if (type === "angleBisector") object = geometry.addAngleBisector(this.geometryModel, first, second, third);
    else if (type === "circumcircle") object = geometry.addCircumcircle(this.geometryModel, first, second, third);
    else if (type === "circle") object = geometry.addCircle(this.geometryModel, first, second);
    else if (type === "line") object = geometry.addLine(this.geometryModel, first, second);
    else if (type === "ray") object = geometry.addRay(this.geometryModel, first, second);
    else object = geometry.addSegment(this.geometryModel, first, second);
    this.persistGeometryState();
    this.render();
    this.announceGeometry(`${object.type} added.`);
    return { ok: true, object };
  } catch (e) {
    return this.failGeometry(e);
  }
}

function removeGeometryObject(id) {
  const result = geometry.removeObject(this.geometryModel, id);
  this.persistGeometryState();
  this.render();
  this.announceGeometry(result.ok ? `Removed ${result.removed} geometry object${result.removed === 1 ? "" : "s"}.` : "That geometry object no longer exists.");
  return result;
}

function failGeometry(error) {
  const message = error && error.message ? error.message : "That geometry object could not be created.";
  if (this.geometryStatusEl) this.geometryStatusEl.setText(message);
  new Notice(message);
  return { ok: false, message };
}

function announceGeometry(text) {
  if (this.geometryStatusEl) this.geometryStatusEl.setText(text);
  else new Notice(text);
}

function persistGeometryState() {
  const settings = this.plugin.settings;
  if (!settings) return;
  if (!settings.reference) settings.reference = {};
  settings.reference.geometry = {
    objects: JSON.parse(JSON.stringify(this.geometryModel.objects)),
    nextId: this.geometryModel.nextId,
    view: Object.assign({}, this.geometryViewport),
  };
  if (typeof this.plugin.save === "function") {
    try {
      this.plugin.save();
    } catch (e) {
      // The drawing stays in memory; Obsidian reports a failed settings write itself.
    }
  }
}

function drawGeometry() {
  const canvas = this.geometryCanvas;
  if (!canvas) return;
  const width = Number(canvas.clientWidth) > 0 ? Math.round(Number(canvas.clientWidth)) : 640;
  const height = 320;
  const ratio = exportScale(typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) return;
  if (typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  geometry.paintGeometry(ctx, this.geometryModel, this.geometryViewport, width, height);
}

module.exports = {
  addGeometryObject,
  addGeometryPoint,
  announceGeometry,
  drawGeometry,
  failGeometry,
  persistGeometryState,
  removeGeometryObject,
};
