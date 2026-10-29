"use strict";
const { ItemView } = require("obsidian");
const { VIEW_TYPE_REFERENCE } = require("./constants");
const {
  REFERENCE_SUBJECTS,
  UNIT_CATEGORIES,
  convertUnit,
  defaultUnits,
  formatReferenceNumber,
  searchConstants,
  searchFormulas,
  unitCategory,
} = require("./reference-data");
const { ELEMENTS, categoryLabel, searchElements } = require("./reference-elements");
const { buildPlot } = require("./reference-graph");

/*
 * A local-only reference panel. It deliberately contains no calculator engine,
 * network request or third-party dataset: formulas and constants are static text,
 * and the converter is a pure multiplication/offset table.
 */
class ReferenceView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "formulas"; // formulas | units | constants
    this.subject = (plugin.settings.reference && plugin.settings.reference.defaultSubject) || "all";
    this.query = "";
    this.constantQuery = "";
    this.unitCategoryId = "length";
    const defaults = defaultUnits("length");
    this.fromUnit = defaults[0];
    this.toUnit = defaults[1];
    this.amount = "1";
    this.formulaListEl = null;
    this.constantListEl = null;
    this.unitResultEl = null;
    this.graphExpression = "sin(x)";
    this.graphXMin = "-10";
    this.graphXMax = "10";
    this.graphCanvas = null;
    this.graphErrorEl = null;
    this.elementQuery = "";
    this.selectedElement = null;
    this.periodicGridEl = null;
    this.periodicDetailEl = null;
  }

  getViewType() {
    return VIEW_TYPE_REFERENCE;
  }

  getDisplayText() {
    return "Reference";
  }

  getIcon() {
    return "book-open";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.render();
  }

  render() {
    const el = this.contentEl;
    const top = el.scrollTop;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-ref" });
    if (!this.plugin.referenceEnabled()) {
      const card = root.createDiv({ cls: "qt-settings-card" });
      card.createEl("h3", { text: "Reference is off" });
      card.createDiv({
        cls: "setting-item-description",
        text: "Turn the Reference module on under Settings, Global, Modules to use the formula sheet and unit converter.",
      });
      card.createEl("button", { text: "Open settings", cls: "mod-cta qt-primary" }).addEventListener("click", () => this.plugin.openSettings());
      return;
    }

    root.createEl("h2", { text: "Reference" });
    root.createDiv({
      cls: "qt-ref-intro",
      text: "Bundled formulas, constants and unit conversions. Everything is local and works offline.",
    });

    const tabs = root.createDiv({ cls: "qt-row qt-small-row qt-ref-tabs" });
    for (const [id, label] of [
      ["formulas", "Formulas"],
      ["units", "Unit converter"],
      ["graph", "Graph"],
      ["elements", "Periodic table"],
      ["constants", "Constants"],
    ]) {
      const button = tabs.createEl("button", { text: label, cls: "qt-ref-tab" });
      if (this.tab === id) button.addClass("mod-cta");
      button.addEventListener("click", () => {
        this.tab = id;
        this.render();
      });
    }

    if (this.tab === "units") this.renderUnits(root);
    else if (this.tab === "graph") this.renderGraph(root);
    else if (this.tab === "elements") this.renderPeriodic(root);
    else if (this.tab === "constants") this.renderConstants(root);
    else this.renderFormulas(root);
    el.scrollTop = top;
  }

  renderGraph(root) {
    root.createDiv({
      cls: "qt-ref-note",
      text: "Plot y = f(x). Use x, pi, e and sin, cos, tan, asin, acos, atan, sqrt, abs, ln, log, exp, floor or ceil. Operators are + - * / ^.",
    });
    const controls = root.createDiv({ cls: "qt-ref-graph-controls" });
    const expression = controls.createEl("input", {
      cls: "qt-ref-search",
      attr: { type: "text", placeholder: "sin(x)", "aria-label": "Expression to plot" },
    });
    expression.value = this.graphExpression;
    expression.addEventListener("input", () => {
      this.graphExpression = expression.value;
      this.drawGraph();
    });
    for (const [key, label] of [["graphXMin", "Minimum x"], ["graphXMax", "Maximum x"]]) {
      const field = controls.createEl("input", {
        cls: "qt-ref-amount",
        attr: { type: "number", step: "any", "aria-label": label },
      });
      field.value = this[key];
      field.addEventListener("input", () => {
        this[key] = field.value;
        this.drawGraph();
      });
    }
    this.graphCanvas = root.createEl("canvas", { cls: "qt-ref-canvas", attr: { "aria-label": "Graph of the expression" } });
    this.graphErrorEl = root.createDiv({ cls: "qt-ref-note" });
    this.drawGraph();
  }

  drawGraph() {
    const canvas = this.graphCanvas;
    if (!canvas) return;
    const rawWidth = Number(canvas.clientWidth);
    const width = Number.isFinite(rawWidth) && rawWidth > 0 ? Math.round(rawWidth) : 640;
    const height = 320;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    let plot;
    try {
      plot = buildPlot(this.graphExpression, { xMin: this.graphXMin, xMax: this.graphXMax });
    } catch (e) {
      if (this.graphErrorEl) this.graphErrorEl.setText(e.message);
      return;
    }
    if (this.graphErrorEl) this.graphErrorEl.setText("");
    const px = (x) => ((x - plot.xMin) / (plot.xMax - plot.xMin)) * width;
    const py = (y) => height - ((y - plot.yMin) / (plot.yMax - plot.yMin)) * height;
    ctx.strokeStyle = "rgba(127, 127, 127, 0.22)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const x = (width * i) / 8;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const y = (height * i) / 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(127, 127, 127, 0.6)";
    if (plot.xMin <= 0 && plot.xMax >= 0) {
      ctx.beginPath();
      ctx.moveTo(px(0), 0);
      ctx.lineTo(px(0), height);
      ctx.stroke();
    }
    if (plot.yMin <= 0 && plot.yMax >= 0) {
      ctx.beginPath();
      ctx.moveTo(0, py(0));
      ctx.lineTo(width, py(0));
      ctx.stroke();
    }
    ctx.strokeStyle = "#5b8def";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let drawing = false;
    let lastY = null;
    for (const point of plot.points) {
      if (point.y === null) {
        drawing = false;
        lastY = null;
        continue;
      }
      const x = px(point.x);
      const y = py(point.y);
      if (!drawing || (lastY !== null && Math.abs(y - lastY) > height * 0.8)) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
      lastY = y;
    }
    ctx.stroke();
  }

  renderPeriodic(root) {
    const search = root.createEl("input", {
      cls: "qt-ref-search",
      attr: { type: "search", placeholder: "Search by name, symbol or atomic number" },
    });
    search.value = this.elementQuery;
    search.addEventListener("input", () => {
      this.elementQuery = search.value;
      this.renderElementGrid();
    });
    this.periodicGridEl = root.createDiv({ cls: "qt-ref-periodic", attr: { role: "grid", "aria-label": "Periodic table" } });
    this.periodicDetailEl = root.createDiv({ cls: "qt-ref-element-detail" });
    this.renderElementGrid();
    this.renderElementDetail();
  }

  renderElementGrid() {
    const grid = this.periodicGridEl;
    if (!grid) return;
    grid.empty();
    for (const element of searchElements(this.elementQuery)) {
      const cell = grid.createEl("button", {
        cls: `qt-ref-element is-${element.category}${this.selectedElement && this.selectedElement.z === element.z ? " is-selected" : ""}`,
        attr: { "aria-label": `${element.name}, atomic number ${element.z}`, role: "gridcell" },
      });
      if (element.block === "f") {
        const index = element.z <= 71 ? element.z - 57 : element.z - 89;
        cell.style.gridColumn = String(3 + index);
        cell.style.gridRow = element.z <= 71 ? "9" : "10";
      } else {
        cell.style.gridColumn = String(element.group);
        cell.style.gridRow = String(element.period);
      }
      cell.createSpan({ cls: "qt-ref-element-number", text: String(element.z) });
      cell.createSpan({ cls: "qt-ref-element-symbol", text: element.symbol });
      cell.addEventListener("click", () => {
        this.selectedElement = element;
        this.render();
      });
    }
    if (!searchElements(this.elementQuery).length) grid.createDiv({ cls: "qt-hint", text: "No elements match that search." });
  }

  renderElementDetail() {
    const detail = this.periodicDetailEl;
    if (!detail) return;
    detail.empty();
    const element = this.selectedElement;
    if (!element) {
      detail.createDiv({ cls: "qt-ref-note", text: "Tap an element to see its name, atomic mass and category." });
      return;
    }
    detail.createEl("h3", { text: `${element.symbol} - ${element.name}` });
    detail.createDiv({ cls: "qt-ref-note", text: `Atomic number ${element.z} - mass ${element.mass} - ${categoryLabel(element.category)}` });
    detail.createDiv({ cls: "qt-ref-note", text: `Period ${element.period}, group ${element.group}, ${element.block}-block.` });
  }

  renderFormulas(root) {
    const search = root.createEl("input", {
      cls: "qt-ref-search",
      attr: { type: "search", placeholder: "Search formulas (for example: quadratic, momentum, dilution)" },
    });
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderFormulaList();
    });

    const subjects = root.createDiv({ cls: "qt-row qt-small-row qt-ref-subjects" });
    for (const subject of REFERENCE_SUBJECTS) {
      const button = subjects.createEl("button", { text: subject.label, cls: "qt-ref-subject" });
      if (this.subject === subject.id) button.addClass("mod-cta");
      button.addEventListener("click", () => {
        this.subject = subject.id;
        this.render();
      });
    }

    this.formulaListEl = root.createDiv({ cls: "qt-ref-formula-list" });
    this.renderFormulaList();
  }

  renderFormulaList() {
    const list = this.formulaListEl;
    if (!list) return;
    list.empty();
    const formulas = searchFormulas(this.query, this.subject);
    if (!formulas.length) {
      list.createDiv({ cls: "qt-hint", text: "No formulas match that search." });
      return;
    }
    for (const formula of formulas) {
      const card = list.createDiv({ cls: "qt-ref-formula" });
      const head = card.createDiv({ cls: "qt-ref-formula-head" });
      head.createEl("strong", { text: formula.name });
      head.createSpan({ cls: "qt-ref-badge", text: formula.subject });
      card.createEl("code", { cls: "qt-ref-equation", text: formula.formula });
      if (formula.note) card.createDiv({ cls: "qt-ref-note", text: formula.note });
    }
  }

  renderUnits(root) {
    const categories = root.createDiv({ cls: "qt-row qt-small-row qt-ref-subjects" });
    for (const category of UNIT_CATEGORIES) {
      const button = categories.createEl("button", { text: category.label, cls: "qt-ref-subject" });
      if (this.unitCategoryId === category.id) button.addClass("mod-cta");
      button.addEventListener("click", () => {
        this.unitCategoryId = category.id;
        const defaults = defaultUnits(category.id);
        this.fromUnit = defaults[0];
        this.toUnit = defaults[1];
        this.render();
      });
    }

    const category = unitCategory(this.unitCategoryId);
    if (!category) return;
    const card = root.createDiv({ cls: "qt-ref-converter" });
    const amount = card.createEl("input", {
      cls: "qt-ref-amount",
      attr: { type: "number", step: "any", inputmode: "decimal", "aria-label": "Value to convert" },
    });
    amount.value = this.amount;
    amount.addEventListener("input", () => {
      this.amount = amount.value;
      this.updateUnitResult();
    });

    const from = this.makeUnitSelect(card, category, this.fromUnit, "From unit");
    const arrow = card.createSpan({ cls: "qt-ref-arrow", text: "to" });
    arrow.setAttr("aria-hidden", "true");
    const to = this.makeUnitSelect(card, category, this.toUnit, "To unit");
    from.addEventListener("change", () => {
      this.fromUnit = from.value;
      this.updateUnitResult();
    });
    to.addEventListener("change", () => {
      this.toUnit = to.value;
      this.updateUnitResult();
    });

    this.unitResultEl = card.createDiv({ cls: "qt-ref-result", attr: { "aria-live": "polite" } });
    this.updateUnitResult();
    card.createDiv({ cls: "qt-ref-note", text: "Conversions use exact defined factors where possible. Temperature conversions are exact offsets." });
  }

  makeUnitSelect(parent, category, selected, label) {
    const select = parent.createEl("select", {
      cls: "qt-ref-unit",
      attr: { "aria-label": label },
    });
    for (const unit of category.units) {
      select.createEl("option", { text: unit.label, value: unit.id });
    }
    select.value = selected;
    return select;
  }

  updateUnitResult() {
    if (!this.unitResultEl) return;
    const out = convertUnit(this.amount, this.unitCategoryId, this.fromUnit, this.toUnit);
    if (out === null) {
      this.unitResultEl.setText("Enter a number to convert.");
      return;
    }
    const category = unitCategory(this.unitCategoryId);
    const toUnit = category ? category.units.find((u) => u.id === this.toUnit) : null;
    const suffix = toUnit ? toUnit.label.replace(/^.*\(([^)]+)\)$/, "$1") : this.toUnit;
    this.unitResultEl.setText(`${formatReferenceNumber(this.amount)} -> ${formatReferenceNumber(out)} ${suffix}`);
  }

  renderConstants(root) {
    const search = root.createEl("input", {
      cls: "qt-ref-search",
      attr: { type: "search", placeholder: "Search constants" },
    });
    search.value = this.constantQuery;
    search.addEventListener("input", () => {
      this.constantQuery = search.value;
      this.renderConstantList();
    });
    this.constantListEl = root.createDiv({ cls: "qt-ref-constant-list" });
    this.renderConstantList();
  }

  renderConstantList() {
    const list = this.constantListEl;
    if (!list) return;
    list.empty();
    const constants = searchConstants(this.constantQuery);
    if (!constants.length) {
      list.createDiv({ cls: "qt-hint", text: "No constants match that search." });
      return;
    }
    for (const constant of constants) {
      const row = list.createDiv({ cls: "qt-ref-constant" });
      row.createEl("strong", { cls: "qt-ref-symbol", text: constant.symbol });
      const body = row.createDiv({ cls: "qt-ref-constant-body" });
      body.createDiv({ cls: "qt-ref-constant-name", text: constant.name });
      body.createEl("code", { cls: "qt-ref-constant-value", text: `${constant.value} ${constant.unit}` });
    }
  }
}

module.exports = {
  ReferenceView,
};
