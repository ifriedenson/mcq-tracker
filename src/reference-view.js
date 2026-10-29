"use strict";
const { ItemView, Notice } = require("obsidian");
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
const { renderSmilesSvg } = require("./smiles");
const { BASIC_KEYS, SCIENTIFIC_KEYS, appendCalculatorToken, evaluateCalculator, normalizeCalculatorMode } = require("./calculator");
const { openExternal } = require("./settings-ui");
const { AP_PROFILES, DEFAULT_CUTOFFS, calculateApScore, profileById, requiredForTarget } = require("./ap-score");
const {
  AP_RESOURCE_COURSES,
  AP_RESOURCE_POLICY,
  resourceTypeLabel,
  resourcesForCourse,
} = require("./ap-resources");
const { apExamTrend } = require("./ap-exam-history");
const { PUNNETT_GENOTYPES, TRIG_IDENTITIES, UNIT_CIRCLE, normalizeGenotype, punnettSquare, searchCodons } = require("./reference-sheets");

/*
 * A local-only reference panel. It contains no network request or third-party
 * dataset: formulas and constants are static text, the converter is a pure
 * multiplication/offset table, and the calculator uses the restricted evaluator.
 */
class ReferenceView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "formulas"; // formulas | structures | units | calculator | graph | elements | constants | ap | resources
    this.subject = (plugin.settings.reference && plugin.settings.reference.defaultSubject) || "all";
    this.query = "";
    this.constantQuery = "";
    this.unitCategoryId = "length";
    const defaults = defaultUnits("length");
    this.fromUnit = defaults[0];
    this.toUnit = defaults[1];
    this.amount = "1";
    this.formulaListEl = null;
    this.smilesInput = "c1ccccc1";
    this.constantListEl = null;
    this.unitResultEl = null;
    this.graphExpression = "sin(x)";
    this.graphXMin = "-10";
    this.graphXMax = "10";
    this.graphCanvas = null;
    this.graphErrorEl = null;
    this.calculatorMode = "basic";
    this.calculatorExpression = "";
    this.calculatorResult = "";
    this.calculatorError = "";
    this.calculatorExpressionEl = null;
    this.calculatorResultEl = null;
    this.calculatorErrorEl = null;
    this.elementQuery = "";
    this.selectedElement = null;
    this.periodicGridEl = null;
    this.periodicDetailEl = null;
    this.apCourse = AP_PROFILES[0].id;
    this.apScores = {};
    this.apCutoffs = { ...DEFAULT_CUTOFFS };
    this.apTarget = "4";
    this.apResultEl = null;
    this.apResourceCourse = AP_RESOURCE_COURSES[0].id;
    this.apHistoryEl = null;
    this.apSaving = false;
    this.apResourceUnit = "";
    this.apResourceNotesEl = null;
    this.apResourceSaving = false;
    this.sheet = "unit-circle";
    this.codonQuery = "";
    this.punnettA = "Aa";
    this.punnettB = "Aa";
    this.codonListEl = null;
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
      text: "Bundled formulas, constants, unit conversions, one-screen reference sheets, a local calculator and an unofficial AP score estimator. Everything is local and works offline.",
    });

    const tabs = root.createDiv({ cls: "qt-row qt-small-row qt-ref-tabs" });
    for (const [id, label] of [
      ["formulas", "Formulas"],
      ["structures", "Structures"],
      ["units", "Unit converter"],
      ["calculator", "Calculator"],
      ["graph", "Graph"],
      ["elements", "Periodic table"],
      ["constants", "Constants"],
      ["sheets", "Sheets"],
      ["ap", "AP score"],
      ["resources", "AP resources"],
    ]) {
      const button = tabs.createEl("button", { text: label, cls: "qt-ref-tab" });
      if (this.tab === id) button.addClass("mod-cta");
      button.addEventListener("click", () => {
        this.tab = id;
        this.render();
      });
    }

    if (this.tab === "structures") this.renderStructures(root);
    else if (this.tab === "units") this.renderUnits(root);
    else if (this.tab === "calculator") this.renderCalculator(root);
    else if (this.tab === "graph") this.renderGraph(root);
    else if (this.tab === "elements") this.renderPeriodic(root);
    else if (this.tab === "constants") this.renderConstants(root);
    else if (this.tab === "sheets") this.renderSheets(root);
    else if (this.tab === "ap") this.renderApScore(root);
    else if (this.tab === "resources") this.renderApResources(root);
    else this.renderFormulas(root);
    el.scrollTop = top;
  }

  renderCalculator(root) {
    const settings = this.plugin.settings.reference || {};
    if (settings.calculator === false) {
      root.createDiv({ cls: "qt-ref-note", text: "The calculator is turned off under Settings, Reference, Tools." });
      return;
    }
    if (this.plugin.timedTestRunning() && settings.hideCalculatorDuringTests !== false) {
      root.createDiv({
        cls: "qt-ref-note",
        text: "The calculator is hidden while a timed test is running, so a no-calculator section stays closed-book. You can change this under Settings, Reference, Tools.",
      });
      return;
    }

    root.createDiv({
      cls: "qt-ref-note",
      text: "A local calculator. Basic mode has the four operations; scientific mode adds powers, parentheses, roots, logarithms, trigonometry, pi and e. Nothing is sent anywhere.",
    });

    const modes = root.createDiv({ cls: "qt-row qt-ref-calculator-modes" });
    for (const mode of ["basic", "scientific"]) {
      const button = modes.createEl("button", { text: mode === "basic" ? "Basic" : "Scientific", cls: "qt-ref-tab" });
      if (this.calculatorMode === mode) button.addClass("mod-cta");
      button.addEventListener("click", () => {
        this.calculatorMode = mode;
        this.render();
      });
    }

    const display = root.createDiv({ cls: "qt-calc-display" });
    const input = display.createEl("input", {
      cls: "qt-calc-input",
      attr: { type: "text", inputmode: "decimal", placeholder: "0", "aria-label": "Calculator expression" },
    });
    input.value = this.calculatorExpression;
    this.calculatorExpressionEl = input;
    this.calculatorResultEl = display.createDiv({ cls: "qt-calc-result", attr: { "aria-live": "polite" } });
    this.calculatorErrorEl = display.createDiv({ cls: "qt-calc-error", attr: { "aria-live": "polite" } });
    input.addEventListener("input", () => {
      this.calculatorExpression = input.value;
      this.calculatorResult = "";
      this.calculatorError = "";
      this.paintCalculator();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.calculatorEquals();
      } else if (event.key === "Escape") {
        this.calculatorExpression = "";
        this.calculatorResult = "";
        this.calculatorError = "";
        this.paintCalculator();
      }
    });

    const pad = root.createDiv({ cls: "qt-calc-pad" });
    const rows = [...BASIC_KEYS, ...(this.calculatorMode === "scientific" ? SCIENTIFIC_KEYS : [])];
    for (const row of rows) {
      const rowEl = pad.createDiv({ cls: "qt-calc-row" });
      for (const token of row) {
        const button = rowEl.createEl("button", { text: token, cls: "qt-calc-key" });
        if (token === "=") button.addClass("mod-cta");
        button.addEventListener("click", () => this.pressCalculator(token));
      }
    }
    this.paintCalculator();
  }

  paintCalculator() {
    if (this.calculatorExpressionEl && this.calculatorExpressionEl.value !== this.calculatorExpression) {
      this.calculatorExpressionEl.value = this.calculatorExpression;
    }
    if (this.calculatorResultEl) this.calculatorResultEl.setText(this.calculatorResult ? `= ${this.calculatorResult}` : "");
    if (this.calculatorErrorEl) this.calculatorErrorEl.setText(this.calculatorError);
  }

  pressCalculator(token) {
    if (token === "=") {
      this.calculatorEquals();
      return;
    }
    this.calculatorExpression = appendCalculatorToken(this.calculatorExpression, token);
    this.calculatorResult = "";
    this.calculatorError = "";
    this.paintCalculator();
  }

  calculatorEquals() {
    const result = evaluateCalculator(this.calculatorExpression);
    this.calculatorResult = result.text;
    this.calculatorError = result.ok ? "" : result.error;
    this.paintCalculator();
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
    root.createDiv({
      cls: "qt-ref-note",
      text: "Atomic masses and blanks follow the AP Chemistry Periodic Table of the Elements (2020).",
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
    const mass = element.mass ? `mass ${element.mass}` : "mass not listed on the AP table";
    detail.createDiv({ cls: "qt-ref-note", text: `Atomic number ${element.z} - ${mass} - ${categoryLabel(element.category)}` });
    const placement =
      element.block === "f"
        ? `Period ${element.period}, ${categoryLabel(element.category)}, f-block.`
        : `Period ${element.period}, group ${element.group}, ${element.block}-block.`;
    detail.createDiv({ cls: "qt-ref-note", text: placement });
  }

  renderStructures(root) {
    root.createEl("h3", { text: "Chemical structures" });
    root.createDiv({
      cls: "qt-hint",
      text: "Paste a SMILES string to draw it locally. You can also put a smiles code block in any note. No structure data or drawing service is contacted.",
    });
    const input = root.createEl("input", {
      cls: "qt-ref-search",
      attr: { type: "text", placeholder: "SMILES (for example: c1ccccc1, CCO, CC(=O)O)" },
    });
    input.value = this.smilesInput;
    const preview = root.createDiv({ cls: "qt-ref-smiles" });
    const error = root.createDiv({ cls: "qt-smiles-error" });
    const draw = () => {
      this.smilesInput = input.value.trim();
      preview.empty();
      error.setText("");
      if (!this.smilesInput) return;
      const result = renderSmilesSvg(this.smilesInput);
      if (!result.ok) {
        error.setText(result.error);
        return;
      }
      preview.innerHTML = result.svg;
    };
    input.addEventListener("input", draw);
    const examples = root.createDiv({ cls: "qt-row qt-small-row qt-ref-subjects" });
    for (const example of ["c1ccccc1", "CCO", "CC(=O)O", "C1CCCCC1", "[NH4+].[Cl-]"]) {
      examples.createEl("button", { text: example, cls: "qt-ref-subject" }).addEventListener("click", () => {
        input.value = example;
        draw();
      });
    }
    draw();
    root.createEl("p", {
      cls: "qt-ref-note",
      text: "Supported: common organic atoms, bracket atoms with charge and hydrogen counts, single/double/triple/aromatic bonds, branches, ring labels and disconnected fragments. Unsupported SMILES shows an error rather than a guessed structure.",
    });
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

    if (this.subject === "chemistry") {
      root.createDiv({
        cls: "qt-ref-note",
        text: "Chemistry equations and constants follow the AP Chemistry Equations and Constants (2025).",
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

  async saveApExam(profile, result, button) {
    if (this.apSaving) return;
    if (!this.plugin.saveApExamResult) {
      new Notice("Practice-exam history is unavailable in this build.");
      return;
    }
    this.apSaving = true;
    if (button) button.disabled = true;
    try {
      const saved = await this.plugin.saveApExamResult(profile, result, this.apCutoffs);
      new Notice(`Saved ${saved.path}.`);
      await this.loadApHistory(saved.entry);
    } catch (err) {
      new Notice(err && err.message ? err.message : "Could not save this practice exam.");
    } finally {
      this.apSaving = false;
      if (button) button.disabled = false;
    }
  }

  async loadApHistory(extra) {
    if (!this.apHistoryEl) return;
    let entries = [];
    try {
      entries = (this.plugin.getApExamHistory && this.plugin.getApExamHistory()) || [];
    } catch (e) {
      entries = [];
    }
    if (extra) {
      const index = entries.findIndex((entry) => entry.path === extra.path);
      if (index >= 0) entries[index] = extra;
      else entries = [extra, ...entries];
    }
    this.renderApHistory(entries);
  }

  renderApHistory(entries) {
    const el = this.apHistoryEl;
    if (!el) return;
    el.empty();
    const trend = apExamTrend(entries);
    if (!trend.count) {
      el.createDiv({ cls: "qt-hint", text: "No saved practice exams yet. Enter every section and save one to start a trend." });
      return;
    }
    const summary = el.createDiv({ cls: "qt-ap-history-summary" });
    summary.createSpan({ text: `${trend.count} saved · average ${trend.average}%` });
    const writtenLabel = trend.writtenLabel || "FRQ";
    if (trend.frqAverage !== null) {
      const frqSign = trend.frqDelta > 0 ? "+" : "";
      const frqChange = trend.frqDelta === null ? "" : ` · ${frqSign}${trend.frqDelta} ${writtenLabel.toLowerCase()} points vs previous`;
      summary.createSpan({ cls: "qt-ap-history-frq", text: ` · ${writtenLabel} avg ${trend.frqAverage}%${frqChange}` });
    }
    if (trend.count > 1) {
      const sign = trend.delta > 0 ? "+" : "";
      summary.createSpan({ cls: `qt-ap-trend qt-ap-trend-${trend.direction}`, text: `${sign}${trend.delta} points vs previous` });
    }
    if (trend.written.length > 1) {
      const details = trend.written.map((section) => {
        const sign = section.delta > 0 ? "+" : "";
        const change = section.delta === null ? "" : ` (${sign}${section.delta})`;
        return `${section.label} ${section.average}%${change}`;
      }).join(" · ");
      el.createDiv({ cls: "qt-ap-written-sections", text: details });
    }
    for (const entry of entries.slice(0, 8)) {
      const row = el.createDiv({ cls: "qt-ap-history-row" });
      const text = row.createDiv({ cls: "qt-ap-history-text" });
      text.createEl("strong", { text: `${entry.takenOn || "Undated"} · ${entry.course}` });
      const frq = entry.frqPercent === null || entry.frqPercent === undefined ? "" : ` · ${trend.writtenLabel || "FRQ"} ${entry.frqEarned}/${entry.frqMax} (${entry.frqPercent}%)`;
      const sections = entry.writtenSections && entry.writtenSections.length > 1
        ? ` · ${entry.writtenSections.map((section) => `${section.label} ${section.earned}/${section.max}`).join(" · ")}`
        : "";
      text.createDiv({ cls: "qt-hint", text: `${entry.composite}% composite · estimated ${entry.estimated}${entry.low !== entry.high ? ` (${entry.low}-${entry.high})` : ""}${frq}${sections}` });
      row.createEl("button", { text: "Open", cls: "qt-link" }).addEventListener("click", () => {
        if (this.app && this.app.workspace && this.app.workspace.openLinkText) this.app.workspace.openLinkText(entry.path, "", false);
      });
    }
  }

  async saveApResource(course, resource, button) {
    if (this.apResourceSaving) return;
    if (!this.plugin.saveApResourceNote) {
      new Notice("Saved resource notes are unavailable in this build.");
      return;
    }
    this.apResourceSaving = true;
    if (button) button.disabled = true;
    try {
      const saved = await this.plugin.saveApResourceNote(course, resource, this.apResourceUnit);
      new Notice(saved.created ? `Saved ${saved.path}.` : `Already saved at ${saved.path}.`);
      await this.loadApResourceNotes(saved.entry);
    } catch (err) {
      new Notice(err && err.message ? err.message : "Could not save this resource.");
    } finally {
      this.apResourceSaving = false;
      if (button) button.disabled = false;
    }
  }

  async loadApResourceNotes(extra) {
    if (!this.apResourceNotesEl) return;
    let entries = [];
    try {
      entries = (this.plugin.getApResourceNotes && this.plugin.getApResourceNotes()) || [];
    } catch (e) {
      entries = [];
    }
    if (extra) {
      const index = entries.findIndex((entry) => entry.path === extra.path);
      if (index >= 0) entries[index] = extra;
      else entries = [extra, ...entries];
    }
    this.renderApResourceNotes(entries);
  }

  renderApResourceNotes(entries) {
    const el = this.apResourceNotesEl;
    if (!el) return;
    el.empty();
    if (!entries.length) {
      el.createDiv({ cls: "qt-hint", text: "No saved resource notes yet. Save a link to keep its course, unit and checked date." });
      return;
    }
    const stale = entries.filter((entry) => entry.stale).length;
    const summary = el.createDiv({ cls: "qt-ap-saved-summary" });
    summary.createSpan({ text: `${entries.length} saved${stale ? ` · ${stale} stale` : ""}` });
    for (const entry of entries.slice(0, 12)) {
      const row = el.createDiv({ cls: "qt-ap-saved-row" });
      const text = row.createDiv({ cls: "qt-ap-saved-text" });
      const title = entry.path.split("/").pop().replace(/\.md$/i, "");
      text.createEl("strong", { text: title });
      text.createDiv({ cls: "qt-hint", text: `${entry.course}${entry.unit ? ` · ${entry.unit}` : ""} · checked ${entry.checkedOn || "unknown"}` });
      if (entry.stale) text.createSpan({ cls: "qt-ap-stale", text: `Stale${entry.ageDays === null ? "" : ` · ${entry.ageDays} days old`}` });
      if (entry.examUid) text.createDiv({ cls: "qt-hint", text: `Attached to exam: ${entry.examTitle || entry.examDate || "an exam"}` });
      if (entry.studySlotDate) {
        text.createDiv({ cls: "qt-hint", text: `Study block: ${entry.studySlotDate}${entry.studySlotStart ? ` ${entry.studySlotStart}` : ""}${entry.studySlotSubject ? ` · ${entry.studySlotSubject}` : ""}` });
      }
      const actions = row.createDiv({ cls: "qt-row qt-ap-saved-actions" });
      actions.createEl("button", { text: "Mark checked", cls: "qt-link" }).addEventListener("click", () => this.markApResourceChecked(entry));
      if (entry.examUid) {
        actions.createEl("button", { text: "Detach exam", cls: "qt-link" }).addEventListener("click", () => this.detachApResource(entry, "exam"));
      }
      if (entry.studySlotDate) {
        actions.createEl("button", { text: "Detach block", cls: "qt-link" }).addEventListener("click", () => this.detachApResource(entry, "study"));
      }
      actions.createEl("button", { text: "Open", cls: "qt-link" }).addEventListener("click", () => {
        if (this.app && this.app.workspace && this.app.workspace.openLinkText) this.app.workspace.openLinkText(entry.path, "", false);
      });
    }
  }

  async detachApResource(entry, kind) {
    const detach = kind === "exam" ? this.plugin.detachApResourceFromExam : this.plugin.detachApResourceFromStudySlot;
    if (!detach) return;
    try {
      const updated = await detach.call(this.plugin, entry.path);
      if (!updated) {
        new Notice("That resource note is no longer in the vault.");
        return;
      }
      new Notice(`Detached ${kind === "exam" ? "the exam" : "the study block"} from ${updated.path}.`);
      await this.loadApResourceNotes(updated);
    } catch (err) {
      new Notice(err && err.message ? err.message : "Could not detach that resource.");
    }
  }

  async markApResourceChecked(entry) {
    if (!this.plugin.markApResourceChecked) return;
    try {
      const updated = await this.plugin.markApResourceChecked(entry.path);
      if (!updated) {
        new Notice("That resource note is no longer in the vault.");
        return;
      }
      new Notice(`Checked ${updated.path}.`);
      await this.loadApResourceNotes(updated);
    } catch (err) {
      new Notice(err && err.message ? err.message : "Could not update the checked date.");
    }
  }

  /* ---- one-screen reference sheets */

  renderSheets(root) {
    root.createDiv({
      cls: "qt-ref-note",
      text: "One-screen references bundled with the plugin. Everything here is local and works offline; nothing is fetched.",
    });
    const sub = root.createDiv({ cls: "qt-row qt-small-row qt-ref-subjects" });
    for (const [id, label] of [
      ["unit-circle", "Unit circle"],
      ["identities", "Trig identities"],
      ["codons", "Codon table"],
      ["punnett", "Punnett square"],
    ]) {
      const button = sub.createEl("button", { text: label, cls: "qt-ref-subject" });
      if (this.sheet === id) button.addClass("mod-cta");
      button.addEventListener("click", () => {
        this.sheet = id;
        this.render();
      });
    }
    if (this.sheet === "identities") this.renderTrigIdentities(root);
    else if (this.sheet === "codons") this.renderCodonTable(root);
    else if (this.sheet === "punnett") this.renderPunnett(root);
    else this.renderUnitCircle(root);
  }

  renderUnitCircle(root) {
    root.createDiv({
      cls: "qt-ref-note",
      text: "sin is the y-coordinate, cos is the x-coordinate and tan is sin / cos. At 90 and 270 degrees the tangent is undefined.",
    });
    const wrap = root.createDiv({ cls: "qt-ref-table-wrap" });
    const table = wrap.createEl("table", { cls: "qt-ref-table" });
    const head = table.createEl("thead").createEl("tr");
    for (const label of ["Degrees", "Radians", "sin θ", "cos θ", "tan θ"]) head.createEl("th", { text: label });
    const body = table.createEl("tbody");
    for (const row of UNIT_CIRCLE) {
      const tr = body.createEl("tr");
      for (const value of [String(row.degrees), row.radians, row.sin, row.cos, row.tan]) tr.createEl("td", { text: value });
    }
  }

  renderTrigIdentities(root) {
    for (const group of TRIG_IDENTITIES) {
      root.createEl("h4", { text: group.group });
      const list = root.createDiv({ cls: "qt-ref-identity-list" });
      for (const item of group.items) {
        const row = list.createDiv({ cls: "qt-ref-identity" });
        row.createEl("strong", { text: item.name });
        row.createEl("code", { cls: "qt-ref-equation", text: item.formula });
      }
    }
  }

  renderCodonTable(root) {
    const search = root.createEl("input", {
      cls: "qt-ref-search",
      attr: { type: "search", placeholder: "Search a codon or amino acid (for example: AUG, methionine)" },
    });
    search.value = this.codonQuery;
    search.addEventListener("input", () => {
      this.codonQuery = search.value;
      this.renderCodonList();
    });
    root.createDiv({ cls: "qt-ref-note", text: "The standard RNA genetic code. DNA codons use T; the lookup accepts either spelling." });
    this.codonListEl = root.createDiv({ cls: "qt-ref-table-wrap" });
    this.renderCodonList();
  }

  renderCodonList() {
    const wrap = this.codonListEl;
    if (!wrap) return;
    wrap.empty();
    const rows = searchCodons(this.codonQuery);
    if (!rows.length) {
      wrap.createDiv({ cls: "qt-hint", text: "No codons match that search." });
      return;
    }
    const table = wrap.createEl("table", { cls: "qt-ref-table" });
    const head = table.createEl("thead").createEl("tr");
    for (const label of ["Codon", "Code", "Amino acid"]) head.createEl("th", { text: label });
    const body = table.createEl("tbody");
    for (const row of rows) {
      const tr = body.createEl("tr");
      tr.createEl("td", { text: row.codon });
      tr.createEl("td", { text: row.code === "*" ? "Stop" : row.code });
      tr.createEl("td", { text: row.aminoAcid });
    }
  }

  renderPunnett(root) {
    root.createDiv({
      cls: "qt-ref-note",
      text: "A one-gene cross. Each parent contributes one allele; the grid shows every equally likely offspring genotype.",
    });
    const controls = root.createDiv({ cls: "qt-row qt-ref-punnett-controls" });
    const makeSelect = (label, value, onChange) => {
      const field = controls.createEl("label", { cls: "qt-ref-punnett-field" });
      field.createSpan({ text: label });
      const select = field.createEl("select", { cls: "qt-ref-unit" });
      for (const genotype of PUNNETT_GENOTYPES) select.createEl("option", { text: genotype, value: genotype });
      select.value = value;
      select.addEventListener("change", () => onChange(select.value));
    };
    makeSelect("Parent 1", this.punnettA, (value) => {
      this.punnettA = normalizeGenotype(value);
      this.render();
    });
    makeSelect("Parent 2", this.punnettB, (value) => {
      this.punnettB = normalizeGenotype(value);
      this.render();
    });

    const result = punnettSquare(this.punnettA, this.punnettB);
    const wrap = root.createDiv({ cls: "qt-ref-table-wrap" });
    const table = wrap.createEl("table", { cls: "qt-ref-table qt-ref-punnett" });
    const head = table.createEl("thead").createEl("tr");
    head.createEl("th", { text: `${result.parentA} x ${result.parentB}` });
    for (const allele of [result.parentB[0], result.parentB[1]]) head.createEl("th", { text: allele });
    const body = table.createEl("tbody");
    for (let i = 0; i < 2; i++) {
      const tr = body.createEl("tr");
      tr.createEl("th", { text: result.parentA[i] });
      for (let j = 0; j < 2; j++) tr.createEl("td", { text: result.cells[i * 2 + j] });
    }
    root.createDiv({
      cls: "qt-ref-result",
      text: `Genotypes ${result.counts.AA} AA : ${result.counts.Aa} Aa : ${result.counts.aa} aa (ratio ${result.ratio}).`,
    });
    root.createDiv({
      cls: "qt-hint",
      text: `${result.dominant} of ${result.total} offspring show the dominant trait and ${result.recessive} show the recessive trait.`,
    });
  }

  renderApResources(root) {
    const pack = resourcesForCourse(this.apResourceCourse);
    root.createDiv({
      cls: "qt-ref-note",
      text: "Official study links for the four supported AP courses. This is a link index, not a copy of AP material: prompts, rubrics, videos and question banks stay on College Board's sites.",
    });

    const controls = root.createDiv({ cls: "qt-row qt-ap-controls" });
    controls.createEl("label", { cls: "qt-ap-label", text: "Course" });
    const select = controls.createEl("select", { cls: "dropdown" });
    for (const course of AP_RESOURCE_COURSES) select.createEl("option", { text: course.name, value: course.id });
    select.value = pack.course.id;
    select.addEventListener("change", () => {
      this.apResourceCourse = select.value;
      this.render();
    });
    const source = controls.createEl("button", { text: "Open course page", cls: "qt-link" });
    source.addEventListener("click", () => openExternal(pack.resources[0].url));
    const unitWrap = controls.createDiv({ cls: "qt-ap-unit" });
    unitWrap.createEl("label", { cls: "qt-ap-label", text: "Unit" });
    const unit = unitWrap.createEl("input", { type: "text", attr: { placeholder: "e.g. Unit 3" } });
    unit.value = this.apResourceUnit;
    unit.addEventListener("input", () => (this.apResourceUnit = unit.value));

    const list = root.createDiv({ cls: "qt-ap-resource-list" });
    const actionLabels = {
      course: "Open course page",
      exam: "Open exam format",
      practice: "Open released FRQs",
      students: "Open dates and registration",
      account: "Open AP Classroom",
      calendar: "Open exam calendar",
    };
    for (const resource of pack.resources) {
      const card = list.createDiv({ cls: "qt-ap-resource" });
      const head = card.createDiv({ cls: "qt-ap-resource-head" });
      head.createEl("strong", { text: resource.title });
      head.createSpan({ cls: "qt-ap-resource-type", text: resourceTypeLabel(resource.type) });
      card.createDiv({ cls: "qt-ap-resource-desc", text: resource.description });
      const actions = card.createDiv({ cls: "qt-row qt-ap-resource-actions" });
      const save = actions.createEl("button", { text: "Save as note", cls: "qt-link" });
      save.addEventListener("click", () => this.saveApResource(pack.course, resource, save));
      actions.createEl("button", { text: actionLabels[resource.type] || "Open link", cls: "qt-link" }).addEventListener("click", () =>
        openExternal(resource.url),
      );
    }

    const policy = root.createDiv({ cls: "qt-ap-policy" });
    for (const line of AP_RESOURCE_POLICY) policy.createDiv({ cls: "qt-hint", text: line });
    policy.createDiv({ cls: "qt-hint", text: `Checked ${pack.checkedOn}. Links can move; report a stale link rather than copying the page into your vault.` });

    const saved = root.createDiv({ cls: "qt-ap-saved" });
    saved.createEl("h4", { text: "Saved resource notes" });
    saved.createDiv({ cls: "qt-hint", text: "Saved notes keep a course, optional unit, type, official URL and checked-on date. A link checked more than 180 days ago is marked stale." });
    this.apResourceNotesEl = saved.createDiv({ cls: "qt-ap-saved-list" });
    this.loadApResourceNotes();
  }

  renderApScore(root) {
    const profile = profileById(this.apCourse);
    root.createDiv({
      cls: "qt-ref-note",
      text: "An unofficial practice estimate, not a College Board score. Section weights and point values come from the official 2027 exam pages; cut scores are editable practice defaults because curves vary by year and form.",
    });

    const controls = root.createDiv({ cls: "qt-row qt-ap-controls" });
    controls.createEl("label", { cls: "qt-ap-label", text: "Exam" });
    const select = controls.createEl("select", { cls: "dropdown" });
    for (const item of AP_PROFILES) select.createEl("option", { text: item.name, value: item.id });
    select.value = profile.id;
    select.addEventListener("change", () => {
      this.apCourse = select.value;
      this.apScores = {};
      this.render();
    });
    const source = controls.createEl("button", { text: "Official exam page", cls: "qt-link" });
    source.addEventListener("click", () => openExternal(profile.source));

    const sections = root.createDiv({ cls: "qt-ap-sections" });
    for (const section of profile.sections) {
      const card = sections.createDiv({ cls: "qt-ap-section" });
      const head = card.createDiv({ cls: "qt-ap-section-head" });
      head.createEl("strong", { text: section.label });
      head.createSpan({ cls: "qt-ap-weight", text: `${Math.round(Number(section.weight) * 100)}% of exam` });
      const parts = section.parts && section.parts.length ? section.parts : [{ id: "score", label: `Correct (out of ${section.max})`, max: section.max }];
      for (const part of parts) {
        const row = card.createDiv({ cls: "qt-ap-input-row" });
        row.createEl("label", { text: part.label });
        const input = row.createEl("input", { type: "number", attr: { min: "0", max: String(part.max), step: "0.5", "aria-label": `${section.label}: ${part.label}` } });
        const saved = this.apScores[section.id] && this.apScores[section.id][part.id];
        input.value = saved === undefined ? "" : String(saved);
        input.addEventListener("input", () => {
          if (!this.apScores[section.id]) this.apScores[section.id] = {};
          this.apScores[section.id][part.id] = input.value;
          this.renderApResult();
        });
        row.createSpan({ cls: "qt-ap-max", text: `/ ${part.max}` });
      }
    }

    const cutCard = root.createDiv({ cls: "qt-ap-section qt-ap-cutoffs" });
    cutCard.createEl("strong", { text: "Practice cut scores" });
    cutCard.createDiv({ cls: "qt-hint", text: "Percent of the weighted exam needed for each score. Replace these with a released scoring worksheet if you have one." });
    const cutRow = cutCard.createDiv({ cls: "qt-ap-cutoff-row" });
    for (const score of [5, 4, 3, 2]) {
      const wrap = cutRow.createDiv({ cls: "qt-ap-cutoff" });
      wrap.createSpan({ text: String(score) });
      const input = wrap.createEl("input", { type: "number", attr: { min: "0", max: "100", step: "1", "aria-label": `Minimum percent for a ${score}` } });
      input.value = String(this.apCutoffs[score]);
      input.addEventListener("input", () => {
        this.apCutoffs[score] = input.value;
        this.renderApResult();
      });
    }

    const reverse = root.createDiv({ cls: "qt-row qt-ap-controls" });
    reverse.createEl("label", { cls: "qt-ap-label", text: "What do I need for a" });
    const target = reverse.createEl("select", { cls: "dropdown" });
    for (const score of [5, 4, 3, 2]) target.createEl("option", { text: String(score), value: String(score) });
    target.value = this.apTarget;
    target.addEventListener("change", () => {
      this.apTarget = target.value;
      this.renderApResult();
    });
    reverse.createEl("button", { text: "Reset cut scores", cls: "qt-link" }).addEventListener("click", () => {
      this.apCutoffs = { ...DEFAULT_CUTOFFS };
      this.render();
    });

    this.apResultEl = root.createDiv({ cls: "qt-ap-result" });
    this.renderApResult();

    const history = root.createDiv({ cls: "qt-ap-history" });
    history.createEl("h4", { text: "Saved practice exams" });
    history.createDiv({ cls: "qt-hint", text: "Saving writes an ordinary note with your section scores and practice cut scores, so the result stays in the vault and can be edited or deleted." });
    this.apHistoryEl = history.createDiv({ cls: "qt-ap-history-list" });
    this.loadApHistory();
  }

  renderApResult() {
    const el = this.apResultEl;
    if (!el) return;
    el.empty();
    const profile = profileById(this.apCourse);
    const result = calculateApScore(profile, this.apScores, this.apCutoffs);
    const card = el.createDiv({ cls: "qt-ap-result-card" });
    if (!result || !result.complete) {
      card.createEl("h3", { text: "Incomplete estimate" });
      card.createDiv({ cls: "qt-hint", text: "Enter every section to get a score. You can still see the section breakdown below." });
    } else {
      card.createEl("h3", { text: `Estimated AP score: ${result.estimated}` });
      card.createDiv({ cls: "qt-ap-big", text: `${result.composite}% weighted` });
      const range = result.range && result.range[0] !== result.range[1] ? `${result.range[0]}–${result.range[1]}` : String(result.estimated);
      card.createDiv({ cls: "qt-hint", text: `Likely band at ±4 composite points: ${range}. This is a study estimate, not an official score.` });
      const save = card.createEl("button", { text: "Save practice exam", cls: "mod-cta qt-ap-save" });
      save.disabled = this.apSaving;
      save.addEventListener("click", () => this.saveApExam(profile, result, save));
    }

    const breakdown = el.createDiv({ cls: "qt-ap-breakdown" });
    for (const section of result.sections) {
      const row = breakdown.createDiv({ cls: "qt-ap-breakdown-row" });
      row.createSpan({ text: section.label });
      row.createSpan({
        cls: "qt-ap-breakdown-value",
        text: section.complete ? `${formatReferenceNumber(section.earned)} / ${section.max} · ${Math.round(section.percent)}%` : `Not entered · max ${section.max}`,
      });
    }

    const reverse = requiredForTarget(profile, this.apScores, this.apTarget, this.apCutoffs);
    if (!reverse) return;
    const plan = el.createDiv({ cls: "qt-ap-section qt-ap-reverse" });
    plan.createEl("strong", { text: `To reach a ${reverse.target} (cutoff ${reverse.cutoff}%)` });
    for (const item of reverse.requirements) {
      let text;
      if (item.possible === null) text = `${item.label}: ${item.reason}`;
      else if (item.alreadyEnough) text = `${item.label}: already enough at the scores entered.`;
      else if (!item.possible) text = `${item.label}: not possible with the other scores entered.`;
      else text = `${item.label}: ${item.neededPercent}% · ${item.neededPoints} / ${item.max} points.`;
      plan.createDiv({ cls: "qt-ap-requirement", text });
    }
  }
}

module.exports = {
  ReferenceView,
};
