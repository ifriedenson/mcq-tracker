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
const {
  markerLayout, buildGraph, parseGraphRow, traceAt, compileExpression,
  clampView, zoomView, panView, fitView,
  axisTicks, formatAxisTick,
  STYLE_LIMITS, DASH_PATTERN, resolveRowStyle } = require("./reference-graph");
const { renderSmilesSvg } = require("./smiles");
const { safeSvg } = require("./svg-safety");
const { tableCsv, expressionsText, exportScale, exportFileName, canvasPngBytes, hasDrawableContent } = require("./graph-export");
const { EXAMPLES, exampleById } = require("./graph-examples");
const { statisticsReport } = require("./statistics");
const { parseScalar, numericDerivative, definiteIntegral, summation, productOver } = require("./calculus");
const { rowSummary, graphSummary, graphTable } = require("./graph-accessibility");
const { isFolderRow, normalizeFolderName, folderName, folderGroups, rowVisibility, folderSummary } = require("./graph-folders");
const {
  MAX_COLUMNS,
  normalizeColumns,
  normalizeTable,
  normalizeRegressionPair,
  resolveTable,
  regressionPair,
  tableSummary,
  tableExport,
} = require("./graph-table");
const { printDocument, printSummary } = require("./graph-print");
const { normalizeImageState, imagePlacement, imageRectPixels, imageSummary } = require("./graph-image");
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

/* One colour per expression row, cycled when the list grows. */
const GRAPH_COLORS = ["#5b8def", "#e5534b", "#2ea043", "#d29922", "#a371f7", "#39c5cf", "#f778ba", "#db6d28"];

/* The graph keypad inserts these tokens at the caret of the focused expression row. */
const GRAPH_KEYPAD = [
  { token: "x", label: "Insert x" },
  { token: "y", label: "Insert y" },
  { token: "^", label: "Insert power" },
  { token: "sqrt(", label: "Insert square root" },
  { token: "pi", label: "Insert pi" },
  { token: "theta", label: "Insert theta" },
  { token: "sin(", label: "Insert sine" },
  { token: "cos(", label: "Insert cosine" },
  { token: "tan(", label: "Insert tangent" },
  { token: "ln(", label: "Insert natural logarithm" },
  { token: "log(", label: "Insert logarithm" },
  { token: "e", label: "Insert Euler's number" },
  { token: "(", label: "Insert open parenthesis" },
  { token: ")", label: "Insert close parenthesis" },
  { token: "abs(", label: "Insert absolute value" },
  { token: "<=", label: "Insert less than or equal" },
  { token: ">=", label: "Insert greater than or equal" },
];

/** A grid step near the requested division count: 1, 2, 5 times a power of ten. */
function niceStep(span, divisions) {
  const rough = Math.abs(span) / Math.max(1, divisions);
  if (!(rough > 0) || !Number.isFinite(rough)) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / power;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * power;
}

function formatGraphTick(value) {
  const rounded = Number(Number(value).toPrecision(6));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/* Fitted coefficients and R², short enough to sit under a row. */
function formatGraphFit(value) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) return Number(value.toExponential(3)).toString();
  const rounded = Number(Number(value).toPrecision(5));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

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
    this.tabScrollLeft = 0;
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
    const storedGraph = (plugin.settings && plugin.settings.reference && plugin.settings.reference.graph) || {};
    this.graphRows = [
      { text: "sin(x)", hidden: false },
      { text: "x^2 + y^2 = 9", hidden: false },
    ];
    if (Array.isArray(storedGraph.rows) && storedGraph.rows.length) {
      const restored = storedGraph.rows
        .filter((row) => row && typeof row === "object")
        .map((row) => (typeof row.folder === "string"
          ? { folder: normalizeFolderName(row.folder) || "Untitled folder", collapsed: row.collapsed === true }
          : {
            text: String(row.text || ""),
            hidden: row.hidden === true,
            styling: resolveRowStyle(row.styling),
          }));
      if (restored.length) this.graphRows = restored;
    }
    const storedDisplay = storedGraph.display || {};
    this.graphViewport = clampView(storedGraph.view);
    this.graphLocked = storedGraph.locked === true;
    this.graphDisplay = {
      minorGrid: storedDisplay.minorGrid === true,
      axisLabels: storedDisplay.axisLabels === true,
      piTicks: storedDisplay.piTicks === true,
      angle: storedDisplay.angle === "degrees" ? "degrees" : "radians",
    };
    this.graphViewInputs = {};
    this.graphDrag = null;
    this.graphColumns = normalizeColumns([{ name: "x" }, { name: "y" }]);
    this.graphData = [];
    if (storedGraph.table && typeof storedGraph.table === "object") {
      const restoredTable = normalizeTable(storedGraph.table);
      this.graphColumns = restoredTable.columns;
      this.graphData = restoredTable.rows;
    } else if (Array.isArray(storedGraph.data)) {
      this.graphData = normalizeTable({ columns: this.graphColumns, rows: storedGraph.data }).rows;
    }
    this.graphRegression = normalizeRegressionPair(storedGraph.regression, this.graphColumns);
    this.graphImageState = normalizeImageState(storedGraph.image);
    this.graphImage = null;
    this.graphImagePath = "";
    this.graphImageLoading = false;
    this.graphPolarGrid = false;
    this.graphInterest = true;
    this.graphTrace = null;
    this.graphTraceEl = null;
    this.graphBuilt = null;
    this.graphCanvas = null;
    this.graphErrorEl = null;
    this.graphRowErrorEls = [];
    this.graphFitEls = [];
    this.graphSliderEls = [];
    this.graphAnimationTimer = null;
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
    const root = el.createDiv({ cls: "qt-wrap qt-ref qt-screen" });
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

    const head = root.createDiv({ cls: "qt-screen-head" });
    head.createEl("h2", { text: "Reference" });
    head.createDiv({
      cls: "qt-ref-intro",
      text: "Bundled formulas, constants, unit conversions, one-screen reference sheets, a local calculator and an unofficial AP score estimator. Everything is local and works offline.",
    });

    const sections = [
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
    ];
    const picker = root.createEl("select", {
      cls: "qt-ref-picker qt-select",
      attr: { "aria-label": "Reference section" },
    });
    for (const [id, label] of sections) picker.createEl("option", { value: id, text: label });
    picker.value = this.tab;
    picker.addEventListener("change", () => {
      this.tab = picker.value;
      this.render();
    });
    const tabs = root.createDiv({ cls: "qt-row qt-small-row qt-ref-tabs" });
    for (const [id, label] of sections) {
      const button = tabs.createEl("button", { text: label, cls: "qt-ref-tab" });
      if (this.tab === id) button.addClass("mod-cta");
      button.addEventListener("click", () => {
        this.tabScrollLeft = tabs.scrollLeft;
        this.tab = id;
        this.render();
      });
    }
    tabs.scrollLeft = this.tabScrollLeft;

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
      text: "One expression per row, like a Desmos list. A row can be sin(x), y = sin(x), f(x) = x^2 (reuse f, g or h in later rows) or an implicit relation such as y^2 = 2x + 1 and x^2 + y^2 = 9. Polar rows start with r, like r = 1 + cos(theta) or r = 2 sin(3 theta): theta (or θ) sweeps 0 to 2π, sliders work inside the radius, an optional {theta > 0} or {r > 0} restriction limits the sweep, and the polar grid control overlays rings and spokes on any row. A parametric row is a pair of expressions in a shared parameter, like (cos(t), sin(t)): t (or theta) runs 0 to 2π unless a two-sided bound such as {0 < t < 2pi} sets the range, other {…} conditions filter the sweep, sliders and definitions work in both coordinates, and the word fill after the pair shades a closed curve. A pair without the parameter, like (1, 2) or (a, b) with sliders, is a point marker: add open for a hollow marker or closed for a filled one, and a quoted text such as \"A\" replaces its coordinate label. Square brackets hold a list, like [(1, 2), (3, 4)], and restrictions filter which points show. A row with <, >, <=, >=, ≤ or ≥ shades a region, like y < 2x + 1 or x^2 + y^2 <= 9, with a dashed boundary when the comparison is strict. A trailing brace restricts a row to part of its domain or range, like y = x^2 {0 < x < 3} or {0 < y < 1}, and braces with cases make a piecewise row, like y = {x < 0: -x, x >= 0: x}. A row with ~ fits a model to the data table below, like y ~ m x + b or y ~ a e^(b x); every other name in the row becomes a fitted parameter, shown with R² under the row. Use x, y, pi, e, tau and sin, cos, tan, sec, csc, cot, asin, acos, atan, sinh, cosh, tanh, csch, sech, coth, asinh, acosh, atanh, acsch, asech, acoth, sqrt, abs, ln, log, exp, floor, ceil, sign or round, plus mod, nthroot, gcd, lcm, nCr and nPr, which take two values. Operators are + - * / ^. Roots, y-intercepts, extrema and crossings between rows are marked with small rings, which the points-of-interest control turns off, and hovering the canvas reads out the x and y of the nearest curve.",
    });
    const controls = root.createDiv({ cls: "qt-ref-graph-controls" });
    for (const [key, label] of [["xMin", "min x"], ["xMax", "max x"], ["yMin", "min y"], ["yMax", "max y"]]) {
      const field = controls.createDiv({ cls: "qt-ref-graph-bound" });
      field.createEl("span", { text: label });
      const input = field.createEl("input", {
        cls: "qt-ref-amount",
        attr: { type: "number", step: "any", "aria-label": `Graph ${label}` },
      });
      input.value = formatGraphTick(this.graphViewport[key]);
      this.graphViewInputs[key] = input;
      input.addEventListener("change", () => {
        if (this.graphLocked) {
          input.value = formatGraphTick(this.graphViewport[key]);
          if (this.graphTraceEl) this.graphTraceEl.setText("The viewport is locked. Unlock it to change the window.");
          return;
        }
        const next = Object.assign({}, this.graphViewport, { [key]: Number(input.value) });
        if (!(next.xMax > next.xMin) || !(next.yMax > next.yMin)) {
          input.value = formatGraphTick(this.graphViewport[key]);
          return;
        }
        this.graphViewport = clampView(next);
        this.syncGraphViewInputs();
        this.persistGraphView();
        this.drawGraph();
      });
    }

    const polarField = controls.createEl("label", { cls: "qt-ref-graph-polar" });
    const polarToggle = polarField.createEl("input", { attr: { type: "checkbox", "aria-label": "Polar grid" } });
    polarToggle.checked = this.graphPolarGrid;
    polarToggle.addEventListener("change", () => {
      this.graphPolarGrid = polarToggle.checked === true;
      this.drawGraph();
    });
    polarField.createSpan({ text: "polar grid" });

    const interestField = controls.createEl("label", { cls: "qt-ref-graph-polar" });
    const interestToggle = interestField.createEl("input", { attr: { type: "checkbox", "aria-label": "Points of interest" } });
    interestToggle.checked = this.graphInterest;
    interestToggle.addEventListener("change", () => {
      this.graphInterest = interestToggle.checked === true;
      this.drawGraph();
    });
    interestField.createSpan({ text: "points of interest" });

    const viewActions = controls.createDiv({ cls: "qt-row qt-ref-graph-view" });
    viewActions.createEl("button", { text: "\u2212", attr: { type: "button", "aria-label": "Zoom out" } })
      .addEventListener("click", () => this.zoomGraph(1.25));
    viewActions.createEl("button", { text: "+", attr: { type: "button", "aria-label": "Zoom in" } })
      .addEventListener("click", () => this.zoomGraph(0.8));
    viewActions.createEl("button", { text: "Reset view", attr: { type: "button", "aria-label": "Reset view to fit the expressions" } })
      .addEventListener("click", () => this.resetGraphView());
    viewActions.createEl("button", {
      text: this.graphLocked ? "Unlock view" : "Lock view",
      attr: {
        type: "button",
        "aria-label": this.graphLocked ? "Unlock the viewport" : "Lock the viewport",
        "aria-pressed": String(this.graphLocked),
      },
    }).addEventListener("click", () => {
      this.graphLocked = !this.graphLocked;
      this.persistGraphView();
      this.render();
    });

    const displayActions = controls.createDiv({ cls: "qt-row qt-ref-graph-display" });
    const displayBox = (key, label) => {
      const field = displayActions.createEl("label", { cls: "qt-ref-graph-polar" });
      const box = field.createEl("input", { attr: { type: "checkbox", "aria-label": label } });
      box.checked = this.graphDisplay[key] === true;
      box.addEventListener("change", () => {
        this.graphDisplay = Object.assign({}, this.graphDisplay, { [key]: box.checked === true });
        this.persistGraphDisplay();
        this.drawGraph();
      });
      field.createSpan({ text: label.toLowerCase() });
    };
    displayBox("minorGrid", "Minor gridlines");
    displayBox("axisLabels", "Axis labels");
    displayBox("piTicks", "Pi ticks");
    const angleField = displayActions.createEl("label", { cls: "qt-ref-graph-polar" });
    angleField.createSpan({ text: "angle" });
    const angleSelect = angleField.createEl("select", { cls: "qt-ref-amount", attr: { "aria-label": "Angle mode" } });
    for (const [value, label] of [["radians", "Radians"], ["degrees", "Degrees"]]) {
      const option = angleSelect.createEl("option", { text: label });
      option.value = value;
      option.selected = this.graphDisplay.angle === value;
    }
    angleSelect.value = this.graphDisplay.angle;
    angleSelect.addEventListener("change", () => {
      this.graphDisplay = Object.assign({}, this.graphDisplay, {
        angle: angleSelect.value === "degrees" ? "degrees" : "radians",
      });
      this.persistGraphDisplay();
      this.drawGraph();
    });

    const keypad = root.createDiv({ cls: "qt-row qt-ref-graph-keypad" });
    keypad.createSpan({ cls: "qt-ref-graph-keypad-label", text: "Keypad" });
    for (const key of GRAPH_KEYPAD) {
      keypad.createEl("button", {
        cls: "qt-ref-graph-key",
        text: key.token,
        attr: { type: "button", "aria-label": key.label },
      }).addEventListener("click", () => this.insertGraphToken(key.token));
    }

    const gallery = root.createDiv({ cls: "qt-row qt-ref-graph-examples" });
    gallery.createSpan({ cls: "qt-ref-graph-examples-label", text: "Examples" });
    for (const example of EXAMPLES) {
      gallery.createEl("button", {
        cls: "qt-ref-graph-example",
        text: example.name,
        attr: { type: "button", "aria-label": `Load example: ${example.name}` },
      }).addEventListener("click", () => this.loadGraphExample(example.id));
    }

    const list = root.createDiv({ cls: "qt-ref-graph-rows" });
    this.graphRowErrorEls = [];
    this.graphRowInputs = [];
    this.graphFitEls = [];
    this.graphSliderEls = [];
    const visibility = rowVisibility(this.graphRows);
    this.graphRows.forEach((row, index) => {
      if (isFolderRow(row)) {
        this.renderGraphFolder(list, row, index);
        return;
      }
      if (!visibility[index]) return;
      const color = GRAPH_COLORS[index % GRAPH_COLORS.length];
      const rowEl = list.createDiv({ cls: "qt-ref-graph-row" });
      const swatch = rowEl.createEl("button", {
        cls: "qt-ref-graph-swatch",
        text: row.hidden ? "○" : "●",
        attr: { "aria-label": row.hidden ? `Show expression ${index + 1}` : `Hide expression ${index + 1}` },
      });
      swatch.style.color = color;
      if (row.hidden) swatch.addClass("is-hidden");
      swatch.addEventListener("click", () => {
        row.hidden = !row.hidden;
        this.render();
      });
      const input = rowEl.createEl("input", {
        cls: "qt-ref-graph-input",
        attr: { type: "text", placeholder: index === 0 ? "y = sin(x)" : index === 1 ? "y^2 = 2x + 1" : "y ~ m x + b", "aria-label": `Graph expression ${index + 1}` },
      });
      input.value = row.text;
      input.style.borderLeft = `3px solid ${color}`;
      this.graphRowInputs[index] = input;
      input.addEventListener("focus", () => {
        this.graphKeypadIndex = index;
        this.graphKeypadTarget = input;
      });
      input.addEventListener("input", () => {
        row.text = input.value;
        try {
          const parsed = parseGraphRow(row.text);
          if (parsed.kind === "parameter") {
            row.name = parsed.name;
            row.value = parsed.value;
            if (row.min === undefined) row.min = "-10";
            if (row.max === undefined) row.max = "10";
            if (row.step === undefined) row.step = "0.1";
          }
        } catch (e) {
          // the row shows its own error when the graph is drawn
        }
        this.persistGraphState();
        this.drawGraph();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !row.text && this.graphRows.length > 1) {
          event.preventDefault();
          this.removeGraphRow(index);
        }
      });
      rowEl.createEl("button", {
        cls: "qt-ref-graph-remove",
        text: "×",
        attr: { "aria-label": `Remove expression ${index + 1}` },
      }).addEventListener("click", () => this.removeGraphRow(index));
      rowEl.createEl("button", {
        cls: "qt-ref-graph-remove",
        text: "\u29c9",
        attr: { type: "button", "aria-label": `Copy expression ${index + 1}` },
      }).addEventListener("click", () => this.copyGraphExpression(index));
      this.graphRowErrorEls[index] = rowEl.createDiv({ cls: "qt-ref-graph-row-error", attr: { "aria-live": "polite" } });
      this.graphFitEls[index] = rowEl.createDiv({ cls: "qt-ref-graph-fit", attr: { "aria-live": "polite" } });
      let parsed = null;
      try {
        parsed = parseGraphRow(row.text);
      } catch (e) {
        parsed = null;
      }
      if (parsed && parsed.kind === "parameter") {
        if (row.name !== parsed.name) {
          row.name = parsed.name;
          row.value = parsed.value;
        }
        if (row.min === undefined) row.min = "-10";
        if (row.max === undefined) row.max = "10";
        if (row.step === undefined) row.step = "0.1";
        this.renderGraphSlider(rowEl, row, index);
      } else {
        row.name = undefined;
      }
      this.renderGraphStyleControls(rowEl, row, index, parsed);
    });

    const actions = root.createDiv({ cls: "qt-row qt-ref-graph-actions" });
    actions.createEl("button", { text: "Add expression", cls: "qt-ref-graph-add" }).addEventListener("click", () => {
      this.graphRows.push({ text: "", hidden: false, styling: resolveRowStyle(null) });
      this.persistGraphState();
      this.render();
    });
    actions.createEl("button", { text: "Add folder", cls: "qt-ref-graph-add", attr: { type: "button", "aria-label": "Add folder" } })
      .addEventListener("click", () => this.addGraphFolder());

    const exportActions = root.createDiv({ cls: "qt-row qt-ref-graph-export" });
    exportActions.createEl("button", { text: "Export PNG", attr: { type: "button", "aria-label": "Export graph as PNG" } })
      .addEventListener("click", () => this.exportGraphImage());
    exportActions.createEl("button", { text: "Export CSV", attr: { type: "button", "aria-label": "Export data table as CSV" } })
      .addEventListener("click", () => this.exportGraphCsv());
    exportActions.createEl("button", { text: "Copy expressions", attr: { type: "button", "aria-label": "Copy all expressions" } })
      .addEventListener("click", () => this.copyGraphExpressions());
    exportActions.createEl("button", { text: "Print graph", attr: { type: "button", "aria-label": "Print graph" } })
      .addEventListener("click", () => this.printGraph());
    exportActions.createEl("button", { text: "Save print sheet", attr: { type: "button", "aria-label": "Save print sheet" } })
      .addEventListener("click", () => this.saveGraphPrint());
    this.graphPrintStatusEl = root.createDiv({
      cls: "qt-ref-graph-print-status",
      attr: { "aria-live": "polite", "aria-label": "Print status" },
    });
    this.renderGraphImageControls(root);

    const dataSection = root.createDiv({ cls: "qt-ref-graph-data" });
    dataSection.createDiv({ cls: "qt-ref-graph-data-head", text: "Data table for regression rows" });
    const tableState = resolveTable(this.graphColumns, this.graphData);
    const columnFields = dataSection.createDiv({ cls: "qt-ref-graph-columns" });
    this.graphColumns.forEach((column, index) => {
      const field = columnFields.createDiv({ cls: "qt-ref-graph-column" });
      const nameInput = field.createEl("input", {
        cls: "qt-ref-graph-column-name",
        attr: { type: "text", "aria-label": `Table column ${index + 1} name`, placeholder: "name" },
      });
      nameInput.value = column.name;
      nameInput.addEventListener("change", () => this.renameGraphColumn(index, nameInput.value));
      const expressionInput = field.createEl("input", {
        cls: "qt-ref-graph-column-expression",
        attr: { type: "text", "aria-label": `Table column ${index + 1} expression`, placeholder: "expression (optional)" },
      });
      expressionInput.value = column.expression;
      expressionInput.addEventListener("input", () => {
        column.expression = expressionInput.value;
        this.persistGraphState();
        this.drawGraph();
      });
      if (column.expression) field.createSpan({ cls: "qt-ref-graph-column-computed", text: "computed" });
      field.createEl("button", {
        cls: "qt-ref-graph-remove",
        text: "×",
        attr: { type: "button", "aria-label": `Remove table column ${column.name}` },
      }).addEventListener("click", () => this.removeGraphColumn(index));
    });
    const columnActions = dataSection.createDiv({ cls: "qt-row qt-ref-graph-column-actions" });
    columnActions.createEl("button", { text: "Add column", cls: "qt-ref-graph-add", attr: { type: "button", "aria-label": "Add table column" } })
      .addEventListener("click", () => this.addGraphColumn());
    const pairRow = dataSection.createDiv({ cls: "qt-row qt-ref-graph-pair" });
    const pairField = (axis, label) => {
      const field = pairRow.createEl("label", { cls: "qt-ref-graph-bound" });
      field.createSpan({ text: label });
      const select = field.createEl("select", { cls: "qt-ref-amount", attr: { "aria-label": `Regression ${axis} column` } });
      for (const column of this.graphColumns) select.createEl("option", { text: column.name, value: column.name });
      select.value = this.graphRegression[axis];
      select.addEventListener("change", () => {
        this.graphRegression = Object.assign({}, this.graphRegression, { [axis]: select.value });
        this.persistGraphState();
        this.drawGraph();
      });
    };
    pairField("x", "regression x");
    pairField("y", "regression y");
    dataSection.createDiv({ cls: "qt-ref-graph-table-note", text: "A column with an expression is computed from the other columns by name." });
    const dataRows = dataSection.createDiv({ cls: "qt-ref-graph-data-rows" });
    this.graphData.forEach((point, index) => {
      const dataRow = dataRows.createDiv({ cls: "qt-ref-graph-data-row" });
      for (const column of this.graphColumns) {
        if (column.expression) {
          const value = tableState.byName[column.name].values[index];
          dataRow.createSpan({
            cls: "qt-ref-graph-data-computed",
            text: Number.isFinite(value) ? String(Number(value.toPrecision(8))) : "—",
          });
          continue;
        }
        const input = dataRow.createEl("input", {
          cls: "qt-ref-graph-data-input",
          attr: { type: "number", step: "any", placeholder: column.name, "aria-label": `Data ${column.name} row ${index + 1}` },
        });
        input.value = point[column.name] === undefined ? "" : point[column.name];
        input.addEventListener("input", () => {
          point[column.name] = input.value;
          this.persistGraphState();
          this.drawGraph();
        });
      }
      dataRow.createEl("button", {
        cls: "qt-ref-graph-remove",
        text: "×",
        attr: { "aria-label": `Remove data point ${index + 1}` },
      }).addEventListener("click", () => this.removeGraphData(index));
    });
    if (tableState.errors.length) {
      dataSection.createDiv({
        cls: "qt-ref-graph-table-error",
        attr: { "aria-live": "polite" },
        text: tableState.errors.map((error) => error.message).join(" "),
      });
    }
    const dataActions = dataSection.createDiv({ cls: "qt-row qt-ref-graph-data-actions" });
    dataActions.createEl("button", { text: "Add data point", cls: "qt-ref-graph-add" }).addEventListener("click", () => {
      const row = {};
      for (const column of this.graphColumns) row[column.name] = "";
      this.graphData.push(row);
      this.persistGraphState();
      this.render();
    });

    this.graphStats = this.graphStats || { values: "", x: "", y: "", result: "" };
    const statsSection = root.createDiv({ cls: "qt-ref-graph-statistics" });
    statsSection.createDiv({ cls: "qt-ref-graph-data-head", text: "Statistics" });
    const statsFields = statsSection.createDiv({ cls: "qt-row qt-ref-graph-stats-fields" });
    const statsField = (key, label, placeholder) => {
      const field = statsFields.createEl("label", { cls: "qt-ref-graph-bound" });
      field.createSpan({ text: label });
      const input = field.createEl("input", {
        cls: "qt-ref-amount",
        attr: { type: "text", "aria-label": `Statistics ${label.toLowerCase()}`, placeholder },
      });
      input.value = this.graphStats[key];
      input.addEventListener("input", () => {
        this.graphStats[key] = input.value;
      });
      return input;
    };
    statsField("values", "Values", "1, 2, 3, 4");
    statsField("x", "x values", "1, 2, 3");
    statsField("y", "y values", "2, 4, 6");
    statsSection.createEl("button", { text: "Calculate statistics", attr: { type: "button", "aria-label": "Calculate statistics" } })
      .addEventListener("click", () => this.calculateGraphStatistics());
    this.graphStatsEl = statsSection.createDiv({ cls: "qt-ref-graph-stats-result", attr: { "aria-live": "polite" } });
    this.graphStatsEl.setText(this.graphStats.result || "");

    this.graphCalculus = this.graphCalculus || { expression: "", a: "", b: "", result: "" };
    const calculusSection = root.createDiv({ cls: "qt-ref-graph-calculus" });
    calculusSection.createDiv({ cls: "qt-ref-graph-data-head", text: "Calculus" });
    const calculusFields = calculusSection.createDiv({ cls: "qt-row qt-ref-graph-calculus-fields" });
    const calculusField = (key, label, aria, placeholder) => {
      const field = calculusFields.createEl("label", { cls: "qt-ref-graph-bound" });
      field.createSpan({ text: label });
      const input = field.createEl("input", { cls: "qt-ref-amount", attr: { type: "text", "aria-label": aria, placeholder } });
      input.value = this.graphCalculus[key];
      input.addEventListener("input", () => {
        this.graphCalculus[key] = input.value;
      });
      return input;
    };
    calculusField("expression", "f(x)", "Calculus expression", "x^2");
    calculusField("a", "from / at", "Calculus lower bound", "0");
    calculusField("b", "to", "Calculus upper bound", "1");
    const calculusActions = calculusSection.createDiv({ cls: "qt-row qt-ref-graph-calculus-actions" });
    for (const [operation, label, aria] of [
      ["derivative", "Derivative at a", "Calculate derivative"],
      ["integral", "Integral a to b", "Calculate integral"],
      ["sum", "Sum a to b", "Calculate sum"],
      ["product", "Product a to b", "Calculate product"],
    ]) {
      calculusActions.createEl("button", { text: label, attr: { type: "button", "aria-label": aria } })
        .addEventListener("click", () => this.calculateGraphCalculus(operation));
    }
    this.graphCalculusEl = calculusSection.createDiv({ cls: "qt-ref-graph-calculus-result", attr: { "aria-live": "polite" } });
    this.graphCalculusEl.setText(this.graphCalculus.result || "");

    this.graphCanvas = root.createEl("canvas", {
      cls: "qt-ref-canvas qt-ref-graph-canvas",
      attr: {
        tabindex: "0",
        role: "application",
        "aria-label": "Graph of the expressions. Drag to pan, scroll to zoom, arrow keys pan and plus or minus zoom.",
      },
    });
    this.graphTraceEl = root.createDiv({ cls: "qt-ref-graph-trace", attr: { "aria-live": "polite" } });
    const accessibility = root.createDiv({ cls: "qt-ref-graph-accessibility" });
    accessibility.createDiv({ cls: "qt-ref-graph-data-head", text: "Accessible summary" });
    this.graphSummaryEl = accessibility.createDiv({
      cls: "qt-ref-graph-summary qt-sr-only",
      attr: { "aria-live": "polite", "aria-label": "Graph row summaries" },
    });
    const tableField = accessibility.createEl("label", { cls: "qt-ref-graph-polar" });
    const tableToggle = tableField.createEl("input", { attr: { type: "checkbox", "aria-label": "Show graph data table" } });
    tableToggle.checked = this.graphTableView === true;
    tableToggle.addEventListener("change", () => this.toggleGraphTable(tableToggle.checked === true));
    tableField.createSpan({ text: "data table view" });
    this.graphTableEl = accessibility.createDiv({ cls: "qt-ref-graph-table" });
    const pointAt = (event) => {
      const graph = this.graphBuilt;
      if (!graph) return null;
      const rect = this.graphCanvas.getBoundingClientRect ? this.graphCanvas.getBoundingClientRect() : null;
      const width = rect && Number(rect.width) > 0 ? Number(rect.width) : Number(this.graphCanvas.clientWidth) || 640;
      const height = rect && Number(rect.height) > 0 ? Number(rect.height) : 320;
      const left = rect ? Number(rect.left) || 0 : 0;
      const top = rect ? Number(rect.top) || 0 : 0;
      const across = Math.min(1, Math.max(0, (event.clientX - left) / width));
      const down = Math.min(1, Math.max(0, (event.clientY - top) / height));
      return {
        width,
        height,
        x: graph.xMin + across * (graph.xMax - graph.xMin),
        y: graph.yMin + (1 - down) * (graph.yMax - graph.yMin),
      };
    };
    const paintTrace = (at) => {
      const graph = this.graphBuilt;
      if (!graph || !this.graphTraceEl) return;
      const traces = traceAt(graph, at.x);
      if (!traces.length) {
        this.graphTraceEl.setText("No curve at this x.");
        return;
      }
      let best = traces[0];
      for (const trace of traces) if (Math.abs(trace.y - at.y) < Math.abs(best.y - at.y)) best = trace;
      this.graphTraceEl.setText(`x = ${formatGraphTick(best.x)} · y = ${formatGraphTick(best.y)} · row ${best.rowIndex + 1}`);
    };
    this.graphCanvas.addEventListener("pointerdown", (event) => {
      if (!this.graphBuilt) return;
      this.graphDrag = {
        x: Number(event.clientX) || 0,
        y: Number(event.clientY) || 0,
        view: Object.assign({}, this.graphViewport),
        moved: false,
        id: event.pointerId,
      };
      if (this.graphCanvas.setPointerCapture && event.pointerId !== undefined) {
        try {
          this.graphCanvas.setPointerCapture(event.pointerId);
        } catch (e) {
          // pointer capture is an enhancement, not required for dragging
        }
      }
    });
    this.graphCanvas.addEventListener("pointermove", (event) => {
      const at = pointAt(event);
      if (!at) return;
      if (this.graphDrag) {
        const dx = (Number(event.clientX) || 0) - this.graphDrag.x;
        const dy = (Number(event.clientY) || 0) - this.graphDrag.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.graphDrag.moved = true;
        if (this.graphDrag.moved && !this.graphLocked) {
          this.graphViewport = panView(this.graphDrag.view, -dx / at.width, dy / at.height);
          this.syncGraphViewInputs();
          this.drawGraph();
          return;
        }
        if (this.graphDrag.moved) return;
      }
      this.graphTrace = { x: at.x, y: at.y };
      paintTrace(at);
      this.drawGraph();
    });
    const endGraphDrag = () => {
      if (!this.graphDrag) return;
      const moved = this.graphDrag.moved;
      this.graphDrag = null;
      if (moved) {
        this.persistGraphView();
        this.graphTrace = null;
        if (this.graphTraceEl) this.graphTraceEl.setText("");
        this.drawGraph();
      }
    };
    this.graphCanvas.addEventListener("pointerup", endGraphDrag);
    this.graphCanvas.addEventListener("pointercancel", endGraphDrag);
    this.graphCanvas.addEventListener("pointerleave", () => {
      if (this.graphDrag) return;
      if (!this.graphTrace) return;
      this.graphTrace = null;
      if (this.graphTraceEl) this.graphTraceEl.setText("");
      this.drawGraph();
    });
    this.graphCanvas.addEventListener("wheel", (event) => {
      const at = pointAt(event);
      if (!at) return;
      if (event.preventDefault) event.preventDefault();
      if (this.graphLocked) {
        if (this.graphTraceEl) this.graphTraceEl.setText("The viewport is locked. Unlock it to zoom.");
        return;
      }
      const factor = Math.min(2, Math.max(0.5, Math.exp((Number(event.deltaY) || 0) * 0.0015)));
      this.graphViewport = zoomView(this.graphViewport, factor, { x: at.x, y: at.y });
      this.syncGraphViewInputs();
      this.persistGraphView();
      this.graphTrace = { x: at.x, y: at.y };
      paintTrace(at);
      this.drawGraph();
    }, { passive: false });
    this.graphCanvas.addEventListener("keydown", (event) => this.onGraphKeydown(event));
    this.graphErrorEl = root.createDiv({ cls: "qt-ref-note" });
    if (this.graphImageState.path && !this.graphImageLoading && (!this.graphImage || this.graphImagePath !== this.graphImageState.path)) {
      this.loadGraphImage();
    }
    this.drawGraph();
  }

  renderGraphSlider(rowEl, row, index) {
    const wrap = rowEl.createDiv({ cls: "qt-ref-graph-slider" });
    const range = wrap.createEl("input", {
      cls: "qt-ref-graph-range",
      attr: { type: "range", min: row.min, max: row.max, step: row.step, "aria-label": `${row.name} slider` },
    });
    range.value = String(row.value);
    const readout = wrap.createDiv({ cls: "qt-ref-graph-slider-readout", text: `${row.name} = ${formatGraphFit(row.value)}` });
    range.addEventListener("input", () => {
      row.value = Number(range.value);
      readout.setText(`${row.name} = ${formatGraphFit(row.value)}`);
      this.drawGraph();
    });
    wrap.createEl("button", {
      cls: "qt-ref-graph-play",
      text: row.playing ? "Pause" : "Play",
      attr: { "aria-label": row.playing ? `Pause ${row.name}` : `Animate ${row.name}` },
    }).addEventListener("click", () => this.toggleGraphAnimation(index));
    const bounds = rowEl.createDiv({ cls: "qt-ref-graph-slider-bounds" });
    for (const key of ["min", "max", "step"]) {
      const field = bounds.createDiv({ cls: "qt-ref-graph-bound" });
      field.createEl("span", { text: key });
      const input = field.createEl("input", {
        cls: "qt-ref-amount",
        attr: { type: "number", step: "any", "aria-label": `${row.name} ${key}` },
      });
      input.value = row[key];
      input.addEventListener("change", () => {
        row[key] = input.value;
        this.render();
      });
    }
    this.graphSliderEls[index] = { range, readout };
  }

  toggleGraphAnimation(index) {
    if (this.graphAnimationTimer) {
      this.stopGraphAnimation();
      return;
    }
    const row = this.graphRows[index];
    if (!row) return;
    row.playing = true;
    this.startGraphAnimation(index);
    this.render();
  }

  startGraphAnimation(index) {
    const step = Math.abs(Number(this.graphRows[index] && this.graphRows[index].step)) || 0.1;
    this.graphAnimationTimer = setInterval(() => {
      const row = this.graphRows[index];
      if (!row) {
        this.stopGraphAnimation();
        return;
      }
      let min = Number(row.min);
      let max = Number(row.max);
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
        min = -10;
        max = 10;
      }
      let next = Number(row.value) + step;
      if (!Number.isFinite(next) || next > max + 1e-9) next = min;
      row.value = Number(next.toFixed(6));
      this.drawGraph();
    }, 60);
  }

  stopGraphAnimation(redraw) {
    if (this.graphAnimationTimer) {
      clearInterval(this.graphAnimationTimer);
      this.graphAnimationTimer = null;
    }
    for (const row of this.graphRows) row.playing = false;
    if (redraw !== false) this.render();
  }

  onClose() {
    this.stopGraphAnimation(false);
  }

  renderGraphStyleControls(rowEl, row, index, parsed) {
    const kind = parsed ? parsed.kind : "";
    const strokes = ["explicit", "regression", "implicit", "inequality", "polar", "parametric"].indexOf(kind) >= 0;
    const filled = kind === "parametric" && parsed && parsed.fill === true;
    const points = kind === "point" || kind === "points";
    if (!strokes && !filled && !points) return;
    const style = resolveRowStyle(row.styling);
    row.styling = style;
    const wrap = rowEl.createDiv({ cls: "qt-ref-graph-style" });
    const numberField = (key, name, min, max, step) => {
      const field = wrap.createEl("label", { cls: "qt-ref-graph-bound" });
      field.createSpan({ text: name });
      const input = field.createEl("input", {
        cls: "qt-ref-amount",
        attr: { type: "number", min, max, step, "aria-label": `${name} for expression ${index + 1}` },
      });
      input.value = String(style[key]);
      input.addEventListener("change", () => {
        row.styling = resolveRowStyle(Object.assign({}, row.styling, { [key]: Number(input.value) }));
        input.value = String(row.styling[key]);
        this.persistGraphState();
        this.drawGraph();
      });
    };
    if (strokes) numberField("width", "Line width", STYLE_LIMITS.minWidth, STYLE_LIMITS.maxWidth, 0.5);
    if (strokes) {
      const field = wrap.createEl("label", { cls: "qt-ref-graph-polar" });
      const box = field.createEl("input", { attr: { type: "checkbox", "aria-label": `Dashed line for expression ${index + 1}` } });
      box.checked = style.dashed;
      box.addEventListener("change", () => {
        row.styling = resolveRowStyle(Object.assign({}, row.styling, { dashed: box.checked === true }));
        this.persistGraphState();
        this.drawGraph();
      });
      field.createSpan({ text: "dashed" });
    }
    if (filled) numberField("fillOpacity", "Fill opacity", 0, 1, 0.05);
    if (points) numberField("pointSize", "Point size", STYLE_LIMITS.minPoint, STYLE_LIMITS.maxPoint, 0.5);
  }

  renderGraphFolder(list, row, index) {
    const wrap = list.createDiv({ cls: "qt-ref-graph-folder" });
    const name = folderName(row);
    const toggle = wrap.createEl("button", {
      cls: "qt-ref-graph-folder-toggle",
      text: row.collapsed ? "\u25b8" : "\u25be",
      attr: {
        type: "button",
        "aria-label": `${row.collapsed ? "Expand" : "Collapse"} folder ${name}`,
        "aria-expanded": String(!row.collapsed),
      },
    });
    toggle.addEventListener("click", () => this.toggleGraphFolder(index));
    const input = wrap.createEl("input", {
      cls: "qt-ref-graph-folder-name",
      attr: { type: "text", placeholder: "Folder", "aria-label": `Folder name ${index + 1}` },
    });
    input.value = row.folder;
    input.addEventListener("input", () => {
      row.folder = input.value;
      this.persistGraphState();
    });
    const group = folderGroups(this.graphRows).find((entry) => entry.index === index);
    const count = group ? group.count : 0;
    wrap.createSpan({ cls: "qt-ref-graph-folder-count", text: `${count} expression${count === 1 ? "" : "s"}` });
    wrap.createEl("button", {
      cls: "qt-ref-graph-remove",
      text: "\u00d7",
      attr: { type: "button", "aria-label": `Remove folder ${name}` },
    }).addEventListener("click", () => this.removeGraphFolder(index));
  }

  addGraphFolder() {
    this.graphRows.push({ folder: "Folder", collapsed: false });
    this.graphRows.push({ text: "", hidden: false, styling: resolveRowStyle(null) });
    this.persistGraphState();
    this.render();
    return this.graphRows.length;
  }

  toggleGraphFolder(index) {
    const row = this.graphRows[index];
    if (!isFolderRow(row)) return false;
    row.collapsed = row.collapsed !== true;
    this.persistGraphState();
    this.render();
    return row.collapsed;
  }

  removeGraphFolder(index) {
    if (!isFolderRow(this.graphRows[index])) return false;
    this.graphRows.splice(index, 1);
    if (!this.graphRows.length) this.graphRows.push({ text: "", hidden: false, styling: resolveRowStyle(null) });
    this.persistGraphState();
    this.render();
    return true;
  }

  renderGraphAccessible(graph) {
    const folders = folderSummary(this.graphRows);
    const tableText = tableSummary(this.graphColumns, this.graphData, this.graphRegression);
    const printText = printSummary(this.graphRows.map((row) => row.text), tableExport(this.graphColumns, this.graphData));
    const imageText = imageSummary(this.graphImageState);
    if (this.graphSummaryEl) this.graphSummaryEl.setText([graphSummary(graph), folders, tableText, printText, imageText].filter(Boolean).join(" "));
    const report = graphTable(graph);
    this.graphTableReport = report;
    if (!this.graphTableEl) return report;
    if (typeof this.graphTableEl.empty === "function") this.graphTableEl.empty();
    else this.graphTableEl.setText("");
    if (!this.graphTableView) return report;
    if (!report.ok) {
      this.graphTableEl.setText(report.message);
      return report;
    }
    const table = this.graphTableEl.createEl("table", { attr: { "aria-label": report.caption } });
    table.createEl("caption", { text: report.caption });
    const head = table.createEl("thead");
    const headRow = head.createEl("tr");
    for (const header of report.headers) headRow.createEl("th", { text: header, attr: { scope: "col" } });
    const body = table.createEl("tbody");
    for (const row of report.rows) {
      const tableRow = body.createEl("tr");
      tableRow.createEl("th", { text: row.number, attr: { scope: "row" } });
      tableRow.createEl("td", { text: row.expression });
      tableRow.createEl("td", { text: row.kind });
      tableRow.createEl("td", { text: row.detail });
    }
    return report;
  }

  toggleGraphTable(checked) {
    this.graphTableView = checked === true;
    const report = this.renderGraphAccessible(this.graphBuilt);
    if (this.graphTableView && !report.ok) new Notice(report.message);
    return report;
  }

  calculateGraphCalculus(operation) {
    this.graphCalculus = this.graphCalculus || { expression: "", a: "", b: "", result: "" };
    const state = this.graphCalculus;
    const fail = (report) => {
      state.result = report.message;
      if (this.graphCalculusEl) this.graphCalculusEl.setText(report.message);
      new Notice(report.message);
      return report;
    };
    const text = String(state.expression || "").trim();
    if (!text) return fail({ ok: false, reason: "function", message: "Enter an expression in x." });
    let fn;
    try {
      const bindings = Object.fromEntries(
        this.graphRows.filter((row) => row.name && row.value !== undefined).map((row) => [row.name, Number(row.value)])
      );
      fn = compileExpression(text, bindings);
    } catch (e) {
      return fail({ ok: false, reason: "expression", message: e && e.message ? e.message : "That expression could not be parsed." });
    }
    const first = parseScalar(state.a);
    if (!first.ok) return fail(first);
    let report;
    if (operation === "derivative") {
      report = numericDerivative(fn, first.value);
    } else {
      const second = parseScalar(state.b);
      if (!second.ok) return fail(second);
      if (operation === "integral") report = definiteIntegral(fn, first.value, second.value);
      else if (operation === "sum") report = summation(fn, first.value, second.value);
      else if (operation === "product") report = productOver(fn, first.value, second.value);
      else report = { ok: false, reason: "operation", message: "Choose derivative, integral, sum or product." };
    }
    if (!report.ok) return fail(report);
    const shown = formatReferenceNumber(report.value);
    const low = formatReferenceNumber(first.value);
    const high = formatReferenceNumber(Number(state.b));
    const labels = {
      derivative: `Derivative at ${low} = ${shown}`,
      integral: `Integral from ${low} to ${high} = ${shown}`,
      sum: `Sum from ${low} to ${high} = ${shown}`,
      product: `Product from ${low} to ${high} = ${shown}`,
    };
    state.result = labels[operation] || shown;
    if (this.graphCalculusEl) this.graphCalculusEl.setText(state.result);
    return report;
  }

  calculateGraphStatistics() {
    this.graphStats = this.graphStats || { values: "", x: "", y: "", result: "" };
    const report = statisticsReport(this.graphStats.values, this.graphStats.x, this.graphStats.y);
    const show = (message) => {
      this.graphStats.result = message;
      if (this.graphStatsEl) this.graphStatsEl.setText(message);
    };
    if (!report.ok) {
      show(report.message);
      return report;
    }
    const format = (value) => (value === null || value === undefined || !Number.isFinite(value) ? "—" : formatReferenceNumber(value));
    const stats = report.stats;
    const parts = [
      `n ${stats.count}`,
      `mean ${format(stats.mean)}`,
      `median ${format(stats.median)}`,
      `stdev ${format(stats.stdev)}`,
      `Q1 ${format(stats.q1)}`,
      `Q3 ${format(stats.q3)}`,
      `min ${format(stats.min)}`,
      `max ${format(stats.max)}`,
      `r ${format(report.correlation)}`,
    ];
    show(parts.join(" · ") + (report.correlationError ? ` (${report.correlationError})` : ""));
    return report;
  }

  insertGraphToken(token) {
    const index = Number.isInteger(this.graphKeypadIndex) && this.graphRowInputs[this.graphKeypadIndex] ? this.graphKeypadIndex : 0;
    const source = this.graphRowInputs[index] || (this.graphRowInputs || [])[0];
    const row = this.graphRows[index];
    if (!source || !row) {
      this.graphExportStatus("Add an expression before using the keypad.");
      return { ok: false, reason: "empty" };
    }
    const value = typeof source.value === "string" ? source.value : String(row.text || "");
    const rawStart = Number(source.selectionStart);
    const rawEnd = Number(source.selectionEnd);
    const start = Number.isFinite(rawStart) && rawStart >= 0 && rawStart <= value.length ? rawStart : value.length;
    const end = Number.isFinite(rawEnd) && rawEnd >= start && rawEnd <= value.length ? rawEnd : start;
    row.text = value.slice(0, start) + String(token) + value.slice(end);
    source.value = row.text;
    const caret = start + String(token).length;
    if (typeof source.setSelectionRange === "function") {
      try {
        source.setSelectionRange(caret, caret);
      } catch (e) {
        // a read-only selection is harmless; the text still updates
      }
    }
    try {
      const parsed = parseGraphRow(row.text);
      if (parsed.kind === "parameter") {
        row.name = parsed.name;
        row.value = parsed.value;
        if (row.min === undefined) row.min = "-10";
        if (row.max === undefined) row.max = "10";
        if (row.step === undefined) row.step = "0.1";
      }
    } catch (e) {
      // the row reports its own parse error when the graph is drawn
    }
    this.persistGraphState();
    this.drawGraph();
    if (typeof source.focus === "function") source.focus();
    return { ok: true, text: row.text, caret };
  }

  loadGraphExample(id) {
    const example = exampleById(id);
    if (!example) return { ok: false, reason: "unknown" };
    const kept = this.graphRows.filter((row) => isFolderRow(row) || String(row.text || "").trim());
    const added = example.rows.map((text) => ({ text, hidden: false, styling: resolveRowStyle(null) }));
    const replaced = kept.length === 0;
    this.graphRows = (replaced ? [] : kept).concat(added);
    this.persistGraphState();
    this.render();
    this.drawGraph();
    return { ok: true, replaced, rows: added.length, total: this.graphRows.length };
  }

  removeGraphRow(index) {
    if (this.graphAnimationTimer) this.stopGraphAnimation(false);
    this.graphRows.splice(index, 1);
    if (!this.graphRows.length) this.graphRows.push({ text: "", hidden: false });
    this.persistGraphState();
    this.render();
  }

  removeGraphData(index) {
    this.graphData.splice(index, 1);
    this.persistGraphState();
    this.render();
  }

  renameGraphColumn(index, value) {
    const column = this.graphColumns[index];
    if (!column) return { ok: false, reason: "column" };
    const oldName = column.name;
    const next = normalizeColumns(this.graphColumns.map((entry, i) => (i === index ? { name: value, expression: entry.expression } : entry)));
    const newName = next[index].name;
    if (newName === oldName) {
      this.render();
      return { ok: true, name: oldName };
    }
    this.graphColumns = next;
    for (const row of this.graphData) {
      if (Object.prototype.hasOwnProperty.call(row, oldName)) row[newName] = row[oldName];
      delete row[oldName];
    }
    if (this.graphRegression.x === oldName) this.graphRegression.x = newName;
    if (this.graphRegression.y === oldName) this.graphRegression.y = newName;
    this.graphRegression = normalizeRegressionPair(this.graphRegression, this.graphColumns);
    this.persistGraphState();
    this.render();
    return { ok: true, name: newName };
  }

  addGraphColumn() {
    if (this.graphColumns.length >= MAX_COLUMNS) {
      new Notice(`A table can have at most ${MAX_COLUMNS} columns.`);
      return { ok: false, reason: "maximum" };
    }
    const next = normalizeColumns(this.graphColumns.concat([{ name: `column${this.graphColumns.length + 1}` }]));
    const added = next[this.graphColumns.length];
    this.graphColumns = next;
    for (const row of this.graphData) row[added.name] = "";
    this.persistGraphState();
    this.render();
    return { ok: true, name: added.name };
  }

  removeGraphColumn(index) {
    if (this.graphColumns.length <= 2) {
      new Notice("Keep at least two table columns.");
      return { ok: false, reason: "minimum" };
    }
    const column = this.graphColumns[index];
    if (!column) return { ok: false, reason: "column" };
    this.graphColumns.splice(index, 1);
    for (const row of this.graphData) delete row[column.name];
    this.graphRegression = normalizeRegressionPair(this.graphRegression, this.graphColumns);
    this.persistGraphState();
    this.render();
    return { ok: true, name: column.name };
  }

  renderGraphImageControls(root) {
    const state = this.graphImageState;
    const section = root.createDiv({ cls: "qt-ref-graph-image" });
    section.createDiv({ cls: "qt-ref-graph-data-head", text: "Background image" });
    section.createDiv({
      cls: "qt-ref-graph-table-note",
      text: "Enter a vault image path, then calibrate two image points. Image points run from 0 to 1 across and down.",
    });
    const pathRow = section.createDiv({ cls: "qt-row qt-ref-graph-image-path" });
    const pathField = pathRow.createEl("label", { cls: "qt-ref-graph-bound" });
    pathField.createSpan({ text: "image path" });
    const pathInput = pathField.createEl("input", {
      cls: "qt-ref-amount",
      attr: { type: "text", "aria-label": "Background image path", placeholder: "Attachments/diagram.png" },
    });
    pathInput.value = state.path;
    pathInput.addEventListener("change", () => this.insertGraphImage(pathInput.value));
    pathRow.createEl("button", { text: "Insert image", attr: { type: "button", "aria-label": "Insert background image" } })
      .addEventListener("click", () => this.insertGraphImage(pathInput.value));
    pathRow.createEl("button", { text: "Remove image", attr: { type: "button", "aria-label": "Remove background image" } })
      .addEventListener("click", () => this.removeGraphImage());
    const points = section.createDiv({ cls: "qt-ref-graph-image-points" });
    for (const [key, label] of [["pointA", "Image point 1"], ["pointB", "Image point 2"]]) {
      const row = points.createDiv({ cls: "qt-ref-graph-image-point" });
      row.createSpan({ cls: "qt-ref-graph-image-point-name", text: label });
      for (const [field, suffix] of [["imageX", "across"], ["imageY", "down"], ["graphX", "graph x"], ["graphY", "graph y"]]) {
        const fieldWrap = row.createEl("label", { cls: "qt-ref-graph-bound" });
        fieldWrap.createSpan({ text: suffix });
        const input = fieldWrap.createEl("input", {
          cls: "qt-ref-amount",
          attr: { type: "number", step: "any", "aria-label": `${label} ${suffix}` },
        });
        input.value = String(state[key][field]);
        input.addEventListener("change", () => this.setGraphImagePoint(key, field, input.value));
      }
    }
    const opacityRow = section.createDiv({ cls: "qt-row qt-ref-graph-image-opacity" });
    const opacityField = opacityRow.createEl("label", { cls: "qt-ref-graph-bound" });
    opacityField.createSpan({ text: "opacity" });
    const opacity = opacityField.createEl("input", {
      cls: "qt-ref-graph-image-opacity-input",
      attr: { type: "range", min: "0", max: "1", step: "0.05", "aria-label": "Background image opacity" },
    });
    opacity.value = String(state.opacity);
    opacity.addEventListener("input", () => this.setGraphImageOpacity(opacity.value));
  }

  announceGraphImage(text) {
    if (this.graphTraceEl && typeof this.graphTraceEl.setText === "function") this.graphTraceEl.setText(text);
    else new Notice(text);
  }

  graphImageSource(path) {
    const adapter = this.app && this.app.vault && this.app.vault.adapter;
    if (adapter && typeof adapter.getResourcePath === "function") {
      try { return adapter.getResourcePath(path); } catch (error) { return path; }
    }
    return path;
  }

  loadGraphImage() {
    const state = this.graphImageState;
    if (!state || !state.path) {
      this.graphImage = null;
      this.graphImagePath = "";
      return { ok: false, reason: "empty" };
    }
    if (this.graphImageLoading) return { ok: true, path: state.path };
    if (this.graphImage && this.graphImagePath === state.path) return { ok: true, path: state.path };
    const ImageCtor = typeof Image !== "undefined" ? Image : null;
    if (!ImageCtor) {
      this.announceGraphImage("This device cannot load a background image.");
      return { ok: false, reason: "image" };
    }
    const image = new ImageCtor();
    this.graphImageLoading = true;
    image.onload = () => {
      this.graphImage = image;
      this.graphImagePath = state.path;
      this.graphImageLoading = false;
      this.announceGraphImage(`Background image ${state.path} loaded.`);
      this.drawGraph();
    };
    image.onerror = () => {
      this.graphImage = null;
      this.graphImagePath = "";
      this.graphImageLoading = false;
      this.announceGraphImage(`Could not load ${state.path}. Check the vault image path.`);
    };
    try {
      image.src = this.graphImageSource(state.path);
    } catch (error) {
      this.graphImageLoading = false;
      this.announceGraphImage(`Could not load ${state.path}. Check the vault image path.`);
      return { ok: false, reason: "image" };
    }
    return { ok: true, path: state.path };
  }

  insertGraphImage(path) {
    const next = normalizeImageState(Object.assign({}, this.graphImageState, { path: String(path === null || path === undefined ? "" : path).trim() }));
    if (!next.path) {
      this.announceGraphImage("Enter a vault image path first.");
      new Notice("Enter a vault image path first.");
      return { ok: false, reason: "path" };
    }
    this.graphImageState = next;
    this.graphImage = null;
    this.graphImagePath = "";
    this.persistGraphState();
    this.render();
    this.loadGraphImage();
    this.announceGraphImage(`Inserted background image ${next.path}.`);
    return { ok: true, path: next.path };
  }

  removeGraphImage() {
    this.graphImageState = normalizeImageState(null);
    this.graphImage = null;
    this.graphImagePath = "";
    this.persistGraphState();
    this.render();
    this.announceGraphImage("Background image removed.");
    return { ok: true };
  }

  setGraphImagePoint(key, field, value) {
    const current = this.graphImageState[key];
    const next = normalizeImageState(Object.assign({}, this.graphImageState, {
      [key]: Object.assign({}, current, { [field]: value }),
    }));
    this.graphImageState = next;
    this.persistGraphState();
    const placement = imagePlacement(next);
    if (!placement.ok) {
      this.announceGraphImage(placement.message);
      return { ok: false, reason: "calibration", message: placement.message };
    }
    this.drawGraph();
    this.announceGraphImage(imageSummary(next));
    return { ok: true, placement };
  }

  setGraphImageOpacity(value) {
    this.graphImageState = normalizeImageState(Object.assign({}, this.graphImageState, { opacity: value }));
    this.persistGraphState();
    this.drawGraph();
    this.announceGraphImage(`Background image opacity ${this.graphImageState.opacity}.`);
    return { ok: true, opacity: this.graphImageState.opacity };
  }

  paintGraphImage(ctx, graph, width, height) {
    if (!this.graphImage) return;
    const rect = imageRectPixels(this.graphImageState, graph, width, height);
    if (!rect.ok) return;
    if (typeof ctx.save === "function") ctx.save();
    ctx.globalAlpha = this.graphImageState.opacity;
    if (typeof ctx.drawImage === "function") ctx.drawImage(this.graphImage, rect.left, rect.top, rect.width, rect.height);
    ctx.globalAlpha = 1;
    if (typeof ctx.restore === "function") ctx.restore();
  }

  drawGraph() {
    const canvas = this.graphCanvas;
    if (!canvas) return;
    const rawWidth = Number(canvas.clientWidth);
    const width = Number.isFinite(rawWidth) && rawWidth > 0 ? Math.round(rawWidth) : 640;
    const height = 320;
    this.graphWidth = width;
    this.graphHeight = height;
    const ratio = exportScale(typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) return;
    if (typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    let graph;
    try {
      const visibility = rowVisibility(this.graphRows);
      const pair = regressionPair(this.graphColumns, this.graphData, this.graphRegression.x, this.graphRegression.y);
      graph = buildGraph({
        rows: this.graphRows.map((row, index) => (row.hidden || !visibility[index] ? "" : { text: row.text, guess: row.guess, styling: row.styling })),
        data: pair.ok ? pair.points : [],
        parameters: Object.fromEntries(
          this.graphRows.filter((row) => row.name && row.value !== undefined).map((row) => [row.name, row.value])
        ),
        xMin: this.graphViewport.xMin,
        xMax: this.graphViewport.xMax,
        yMin: this.graphViewport.yMin,
        yMax: this.graphViewport.yMax,
        samples: Math.max(3, Math.round(width * 1.5)),
        resolution: { x: Math.round(width / 3), y: Math.round(height / 3) },
        regionResolution: { x: Math.round(width / 7), y: Math.round(height / 10) },
      });
    } catch (e) {
      if (this.graphErrorEl) this.graphErrorEl.setText(e.message);
      return;
    }
    if (this.graphErrorEl) this.graphErrorEl.setText(graph.dataError || "");
    this.graphBuilt = graph;
    for (const row of graph.rows) {
      const statusEl = this.graphRowErrorEls[row.index];
      if (statusEl) statusEl.setText(row.error || (row.kind === "definition" ? "Function defined" : ""));
      const fitEl = this.graphFitEls[row.index];
      if (fitEl) {
        if (row.parameters && row.parameters.length) {
          const parts = row.parameters.map((param) => `${param.name} = ${formatGraphFit(param.value)}`);
          parts.push(row.r2 === null ? "R² —" : `R² = ${formatGraphFit(row.r2)}`);
          fitEl.setText(parts.join(" · "));
          const source = this.graphRows[row.index];
          if (source) source.guess = Object.fromEntries(row.parameters.map((param) => [param.name, param.value]));
        } else {
          fitEl.setText("");
        }
      }
      const slider = this.graphSliderEls[row.index];
      if (slider && row.kind === "parameter") {
        slider.range.value = String(row.value);
        slider.readout.setText(`${row.name} = ${formatGraphFit(row.value)}`);
        const parameterRow = this.graphRows[row.index];
        if (parameterRow) parameterRow.value = row.value;
      }
    }
    this.paintGraphScene(ctx, graph, width, height);
    this.renderGraphAccessible(graph);
  }

  /** Paints one built graph into any 2D context; the screen canvas and PNG export share it. */
  paintGraphScene(ctx, graph, width, height) {
    const px = (x) => ((x - graph.xMin) / (graph.xMax - graph.xMin)) * width;
    const py = (y) => height - ((y - graph.yMin) / (graph.yMax - graph.yMin)) * height;
    this.paintGraphImage(ctx, graph, width, height);
    this.paintGraphGrid(ctx, graph, width, height, px, py);
    if (this.graphPolarGrid) this.paintPolarGrid(ctx, graph, width, height);
    for (const row of graph.rows) {
      if (row.region) this.paintGraphRegion(ctx, row.region, GRAPH_COLORS[row.index % GRAPH_COLORS.length], px, py);
    }
    for (const row of graph.rows) {
      const color = GRAPH_COLORS[row.index % GRAPH_COLORS.length];
      if (row.markers && row.markers.length) this.paintGraphMarkers(ctx, row, graph, width, height, color);
      if (row.polygon && row.polygon.length) this.paintGraphPolygon(ctx, row, color, px, py);
      if (row.points && row.points.length) this.paintGraphPoints(ctx, row, width, height, px, py, color);
      if (row.segments && row.segments.length) this.paintGraphSegments(ctx, row, px, py, color);
    }
    if (graph.data.length && graph.rows.some((row) => row.kind === "regression")) {
      this.paintGraphData(ctx, graph.data, px, py);
    }
    if (this.graphInterest) this.paintGraphInterest(ctx, graph, width, height, px, py);
    this.paintGraphTrace(ctx, graph, width, height, px, py);
  }

  graphExportStatus(text) {
    if (this.graphTraceEl && typeof this.graphTraceEl.setText === "function") this.graphTraceEl.setText(text);
    else new Notice(text);
  }

  async saveGraphFile(name, data, binary) {
    const vault = this.app && this.app.vault;
    if (!vault) return { ok: false, reason: "vault" };
    const folder = "Exports";
    try {
      if (typeof vault.createFolder === "function" && typeof vault.getAbstractFileByPath === "function") {
        const existing = await vault.getAbstractFileByPath(folder);
        if (!existing) await vault.createFolder(folder);
      }
      const path = `${folder}/${name}`;
      const write = binary && typeof vault.createBinary === "function"
        ? (payload) => vault.createBinary(path, payload)
        : typeof vault.create === "function" ? (payload) => vault.create(path, payload) : null;
      if (!write) {
        this.graphExportStatus("This device cannot write files into the vault.");
        return { ok: false, reason: "vault" };
      }
      await write(data);
      this.graphExportStatus(`Saved ${path}.`);
      return { ok: true, path };
    } catch (e) {
      this.graphExportStatus(`Could not save ${name}: ${e && e.message ? e.message : "unknown error"}.`);
      return { ok: false, reason: "save" };
    }
  }

  async exportGraphCsv() {
    const table = tableExport(this.graphColumns, this.graphData);
    const csv = tableCsv(table.rows, table.headers);
    if (!csv) {
      this.graphExportStatus("Add a data point before exporting a CSV.");
      return { ok: false, reason: "empty" };
    }
    return this.saveGraphFile(exportFileName("graph-data", new Date(), "csv"), `${csv}\n`, false);
  }

  graphPrintStatus(text) {
    if (this.graphPrintStatusEl && typeof this.graphPrintStatusEl.setText === "function") this.graphPrintStatusEl.setText(text);
    else this.graphExportStatus(text);
  }

  async buildGraphPrintDocument() {
    if (!this.graphBuilt) this.drawGraph();
    const graph = this.graphBuilt;
    if (!graph || !hasDrawableContent(graph)) {
      this.graphPrintStatus("Add an expression that draws something before printing.");
      return { ok: false, reason: "empty", message: "Add an expression that draws something before printing." };
    }
    const doc = this.graphExportDocument();
    if (!doc || typeof doc.createElement !== "function") {
      this.graphPrintStatus("This device cannot prepare a print sheet.");
      return { ok: false, reason: "canvas", message: "This device cannot prepare a print sheet." };
    }
    const ratio = exportScale(typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1);
    const width = this.graphWidth || 640;
    const height = this.graphHeight || 320;
    let canvas = null;
    let ctx = null;
    try {
      canvas = doc.createElement("canvas");
      if (canvas) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        ctx = canvas.getContext ? canvas.getContext("2d") : null;
      }
    } catch (e) {
      canvas = null;
    }
    if (!canvas || !ctx) {
      this.graphPrintStatus("This device cannot prepare a print sheet.");
      return { ok: false, reason: "canvas", message: "This device cannot prepare a print sheet." };
    }
    if (typeof ctx.scale === "function") ctx.scale(ratio, ratio);
    this.paintGraphScene(ctx, graph, width, height);
    let imageDataUrl = "";
    try {
      imageDataUrl = typeof canvas.toDataURL === "function" ? canvas.toDataURL("image/png") : "";
    } catch (e) {
      imageDataUrl = "";
    }
    if (!imageDataUrl) {
      this.graphPrintStatus("The graph image could not be prepared for printing.");
      return { ok: false, reason: "canvas", message: "The graph image could not be prepared for printing." };
    }
    const table = tableExport(this.graphColumns, this.graphData);
    const built = printDocument({
      title: "Graph",
      imageDataUrl,
      expressions: this.graphRows.map((row) => (isFolderRow(row) ? "" : row.text)),
      window: this.graphViewport,
      table,
      regression: this.graphRegression,
    });
    if (!built.ok) {
      this.graphPrintStatus(built.message);
      return built;
    }
    this.graphPrintStatus(printSummary(this.graphRows.map((row) => row.text), table));
    return built;
  }

  async saveGraphPrintSheet(built) {
    const saved = await this.saveGraphFile(exportFileName("graph-print", new Date(), "html"), built.html, false);
    if (saved.ok) this.graphPrintStatus(`Saved ${saved.path}. Open it and print from the browser.`);
    return saved;
  }

  async saveGraphPrint() {
    const built = await this.buildGraphPrintDocument();
    if (!built.ok) {
      new Notice(built.message);
      return built;
    }
    return this.saveGraphPrintSheet(built);
  }

  async printGraph() {
    const built = await this.buildGraphPrintDocument();
    if (!built.ok) {
      new Notice(built.message);
      return built;
    }
    const targetWindow = typeof window !== "undefined" ? window : null;
    if (targetWindow && typeof targetWindow.open === "function") {
      try {
        const opened = targetWindow.open("", "_blank");
        if (opened && opened.document && typeof opened.document.write === "function") {
          opened.document.write(built.html);
          opened.document.close();
          if (typeof opened.focus === "function") opened.focus();
          if (typeof opened.print === "function") opened.print();
          this.graphPrintStatus("Print sheet opened. Choose Print in the browser dialog.");
          return { ok: true, method: "print" };
        }
      } catch (e) {
        // A blocked popup falls through to the saved sheet below.
      }
    }
    const saved = await this.saveGraphPrintSheet(built);
    if (!saved.ok) return saved;
    return { ok: true, method: "file", path: saved.path };
  }

  graphExportDocument() {
    if (typeof document !== "undefined" && document && typeof document.createElement === "function") return document;
    if (typeof activeDocument !== "undefined" && activeDocument && typeof activeDocument.createElement === "function") return activeDocument;
    return null;
  }

  async exportGraphImage() {
    const graph = this.graphBuilt;
    if (!graph || !hasDrawableContent(graph)) {
      this.graphExportStatus("Add an expression that draws something before exporting an image.");
      return { ok: false, reason: "empty" };
    }
    const doc = this.graphExportDocument();
    if (!doc) {
      this.graphExportStatus("This device cannot build an image from the graph.");
      return { ok: false, reason: "canvas" };
    }
    const ratio = exportScale(typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1);
    const width = this.graphWidth || 640;
    const height = this.graphHeight || 320;
    let canvas = null;
    let ctx = null;
    try {
      canvas = doc.createElement("canvas");
      if (canvas) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        ctx = canvas.getContext ? canvas.getContext("2d") : null;
      }
    } catch (e) {
      canvas = null;
    }
    if (!canvas || !ctx) {
      this.graphExportStatus("This device cannot build an image from the graph.");
      return { ok: false, reason: "canvas" };
    }
    if (typeof ctx.scale === "function") ctx.scale(ratio, ratio);
    this.paintGraphScene(ctx, graph, width, height);
    let bytes;
    try {
      bytes = await canvasPngBytes(canvas);
    } catch (e) {
      this.graphExportStatus(e && e.message ? e.message : "The image could not be encoded on this device.");
      return { ok: false, reason: "encode" };
    }
    return this.saveGraphFile(exportFileName("graph", new Date(), "png"), bytes, true);
  }

  copyTextToClipboard(text, success) {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== "function") {
      this.graphExportStatus("The clipboard is not available on this device.");
      return Promise.resolve({ ok: false, reason: "clipboard" });
    }
    try {
      return Promise.resolve(nav.clipboard.writeText(text)).then(
        () => {
          this.graphExportStatus(success);
          return { ok: true };
        },
        () => {
          this.graphExportStatus("The clipboard refused the copy.");
          return { ok: false, reason: "clipboard" };
        }
      );
    } catch (e) {
      this.graphExportStatus("The clipboard refused the copy.");
      return Promise.resolve({ ok: false, reason: "clipboard" });
    }
  }

  copyGraphExpression(index) {
    const row = this.graphRows[index];
    const text = row && typeof row.text === "string" ? row.text : "";
    if (!text.trim()) {
      this.graphExportStatus("This expression is empty.");
      return Promise.resolve({ ok: false, reason: "empty" });
    }
    return this.copyTextToClipboard(text, `Copied expression ${index + 1}.`);
  }

  copyGraphExpressions() {
    const text = expressionsText(this.graphRows);
    if (!text) {
      this.graphExportStatus("Add an expression before copying.");
      return Promise.resolve({ ok: false, reason: "empty" });
    }
    return this.copyTextToClipboard(text, `Copied ${text.split("\n").length} expressions.`);
  }

  syncGraphViewInputs() {
    for (const key of ["xMin", "xMax", "yMin", "yMax"]) {
      const input = this.graphViewInputs[key];
      if (input) input.value = formatGraphTick(this.graphViewport[key]);
    }
  }

  zoomGraph(factor, focus) {
    if (this.graphLocked) {
      if (this.graphTraceEl) this.graphTraceEl.setText("The viewport is locked. Unlock it to zoom.");
      return;
    }
    this.graphViewport = zoomView(this.graphViewport, factor, focus);
    this.syncGraphViewInputs();
    this.persistGraphView();
    this.drawGraph();
  }

  resetGraphView() {
    if (this.graphLocked) {
      if (this.graphTraceEl) this.graphTraceEl.setText("The viewport is locked. Unlock it to auto-fit.");
      return;
    }
    this.graphViewport = fitView(this.graphBuilt);
    this.syncGraphViewInputs();
    this.persistGraphView();
    this.drawGraph();
  }

  graphRowState() {
    return this.graphRows.map((row) => (isFolderRow(row)
      ? { folder: normalizeFolderName(row.folder) || "Untitled folder", collapsed: row.collapsed === true }
      : {
        text: String(row.text || ""),
        hidden: row.hidden === true,
        styling: resolveRowStyle(row.styling),
      }));
  }

  persistGraphState() {
    const settings = this.plugin.settings;
    if (!settings) return;
    if (!settings.reference) settings.reference = {};
    settings.reference.graph = {
      view: Object.assign({}, this.graphViewport),
      locked: this.graphLocked,
      display: Object.assign({}, this.graphDisplay),
      rows: this.graphRowState(),
      image: this.graphImageState,
      table: {
        columns: this.graphColumns.map((column) => ({ name: column.name, expression: column.expression })),
        rows: this.graphData.map((row) => {
          const cells = {};
          for (const column of this.graphColumns) cells[column.name] = String(row[column.name] === undefined ? "" : row[column.name]);
          return cells;
        }),
      },
      regression: Object.assign({}, this.graphRegression),
    };
    if (typeof this.plugin.save === "function") {
      try {
        this.plugin.save();
      } catch (e) {
        // The graph stays in memory; Obsidian reports a failed settings write itself.
      }
    }
  }

  persistGraphView() {
    this.persistGraphState();
  }

  persistGraphDisplay() {
    this.persistGraphState();
  }

  onGraphKeydown(event) {
    const key = event && event.key;
    if (!key) return;
    const zoomKeys = { "+": 0.8, "=": 0.8, "-": 1.25, "_": 1.25 };
    if (Object.prototype.hasOwnProperty.call(zoomKeys, key)) {
      if (event.preventDefault) event.preventDefault();
      this.zoomGraph(zoomKeys[key]);
      return;
    }
    const steps = {
      ArrowLeft: [-0.1, 0],
      ArrowRight: [0.1, 0],
      ArrowUp: [0, 0.1],
      ArrowDown: [0, -0.1],
    };
    const step = steps[key];
    if (!step) return;
    if (event.preventDefault) event.preventDefault();
    if (this.graphLocked) return;
    this.graphViewport = panView(this.graphViewport, step[0], step[1]);
    this.syncGraphViewInputs();
    this.persistGraphView();
    this.drawGraph();
  }

  paintGraphData(ctx, points, px, py) {
    ctx.fillStyle = "#8b8b8b";
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(px(point.x), py(point.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  paintGraphGrid(ctx, graph, width, height, px, py) {
    const display = this.graphDisplay;
    const top = display.axisLabels ? 16 : 0;
    const bottom = display.axisLabels ? height - 16 : height;
    const xAxis = axisTicks(graph.xMin, graph.xMax, Math.max(4, Math.round(width / 90)), {
      axis: "x",
      piTicks: display.piTicks === true,
      angleMode: display.angle,
    });
    const yAxis = axisTicks(graph.yMin, graph.yMax, Math.max(3, Math.round(height / 70)), { axis: "y" });
    const axisY = Math.min(Math.max(px(0), 0), width);
    const axisX = Math.min(Math.max(py(0), top), bottom - 14);
    if (display.minorGrid) {
      ctx.strokeStyle = "rgba(127, 127, 127, 0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const x of xAxis.minors) {
        ctx.moveTo(px(x), top);
        ctx.lineTo(px(x), bottom);
      }
      for (const y of yAxis.minors) {
        ctx.moveTo(0, py(y));
        ctx.lineTo(width, py(y));
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(127, 127, 127, 0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of xAxis.ticks) {
      ctx.moveTo(px(x), top);
      ctx.lineTo(px(x), bottom);
    }
    for (const y of yAxis.ticks) {
      ctx.moveTo(0, py(y));
      ctx.lineTo(width, py(y));
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(127, 127, 127, 0.55)";
    ctx.beginPath();
    if (graph.yMin <= 0 && graph.yMax >= 0) {
      ctx.moveTo(0, py(0));
      ctx.lineTo(width, py(0));
    }
    if (graph.xMin <= 0 && graph.xMax >= 0) {
      ctx.moveTo(px(0), top);
      ctx.lineTo(px(0), bottom);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(127, 127, 127, 0.85)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const x of xAxis.ticks) {
      if (Math.abs(x) < xAxis.step / 1000) continue;
      ctx.fillText(formatAxisTick(x, { axis: "x", piTicks: display.piTicks, angleMode: display.angle }), px(x), axisX + 3);
    }
    ctx.textAlign = "right";
    for (const y of yAxis.ticks) {
      if (Math.abs(y) < yAxis.step / 1000) continue;
      ctx.fillText(formatAxisTick(y, { axis: "y" }), Math.max(axisY - 4, 16), Math.max(py(y) - 7, top));
    }
    if (display.axisLabels) {
      ctx.fillStyle = "rgba(127, 127, 127, 0.85)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("x", width - 4, height - 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("y", 4, 2);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  paintGraphMarkers(ctx, row, graph, width, height, color) {
    const style = resolveRowStyle(row.styling);
    const layout = markerLayout(row.markers, graph, width, height);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, style.width);
    for (const marker of layout) {
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, style.pointSize, 0, Math.PI * 2);
      if (row.style === "open") ctx.stroke();
      else ctx.fill();
      if (!marker.label) continue;
      ctx.font = "12px sans-serif";
      ctx.textAlign = marker.align;
      ctx.textBaseline = "bottom";
      ctx.fillText(marker.label, marker.labelX, marker.labelY);
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  paintGraphInterest(ctx, graph, width, height, px, py) {
    const entries = Array.isArray(graph.interest) ? graph.interest : [];
    if (!entries.length) return;
    ctx.font = "10px sans-serif";
    ctx.textBaseline = "bottom";
    for (const point of entries) {
      const x = px(point.x);
      const y = py(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const color = GRAPH_COLORS[(point.rowIndex || 0) % GRAPH_COLORS.length];
      ctx.strokeStyle = color;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!point.label) continue;
      ctx.fillStyle = color;
      ctx.textAlign = x > width - 74 ? "right" : "left";
      ctx.fillText(point.label, x + (x > width - 74 ? -7 : 7), Math.max(y - 6, 11));
    }
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  paintGraphTrace(ctx, graph, width, height, px, py) {
    const pointer = this.graphTrace;
    if (!pointer) return;
    const traces = traceAt(graph, pointer.x);
    if (!traces.length) return;
    let best = traces[0];
    for (const trace of traces) if (Math.abs(trace.y - pointer.y) < Math.abs(best.y - pointer.y)) best = trace;
    const x = px(best.x);
    const y = py(best.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    ctx.strokeStyle = "rgba(127, 127, 127, 0.55)";
    ctx.lineWidth = 1;
    if (ctx.setLineDash) ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.fillStyle = GRAPH_COLORS[(best.rowIndex || 0) % GRAPH_COLORS.length];
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  paintGraphPolygon(ctx, row, color, px, py) {
    const polygon = row.polygon;
    if (!polygon || polygon.length < 3) return;
    const style = resolveRowStyle(row.styling);
    ctx.fillStyle = color;
    ctx.globalAlpha = style.fillOpacity;
    ctx.beginPath();
    ctx.moveTo(px(polygon[0].x), py(polygon[0].y));
    for (let i = 1; i < polygon.length; i++) ctx.lineTo(px(polygon[i].x), py(polygon[i].y));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  paintGraphPoints(ctx, row, width, height, px, py, color) {
    const style = resolveRowStyle(row.styling);
    const points = row.points;
    ctx.strokeStyle = color;
    ctx.lineWidth = style.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (style.dashed && ctx.setLineDash) ctx.setLineDash(DASH_PATTERN);
    ctx.beginPath();
    let drawing = false;
    let lastX = null;
    let lastY = null;
    for (const point of points) {
      if (point.y === null) {
        drawing = false;
        lastX = null;
        lastY = null;
        continue;
      }
      const x = px(point.x);
      const y = py(point.y);
      if (!drawing || (lastX !== null && Math.abs(x - lastX) > width * 0.8) || (lastY !== null && Math.abs(y - lastY) > height * 0.8)) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
      lastX = x;
      lastY = y;
    }
    ctx.stroke();
    if (style.dashed && ctx.setLineDash) ctx.setLineDash([]);
  }

  paintPolarGrid(ctx, graph, width, height) {
    const unitX = width / (graph.xMax - graph.xMin);
    const unitY = height / (graph.yMax - graph.yMin);
    const cx = ((0 - graph.xMin) / (graph.xMax - graph.xMin)) * width;
    const cy = height - ((0 - graph.yMin) / (graph.yMax - graph.yMin)) * height;
    const maxRadius = Math.max(Math.abs(graph.xMin), Math.abs(graph.xMax), Math.abs(graph.yMin), Math.abs(graph.yMax));
    if (!(maxRadius > 0)) return;
    const step = niceStep(maxRadius, 5);
    ctx.strokeStyle = "rgba(127, 127, 127, 0.22)";
    ctx.lineWidth = 1;
    for (let radius = step; radius <= maxRadius + step * 1e-6; radius += step) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * unitX, radius * unitY, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    for (let degrees = 0; degrees < 180; degrees += 30) {
      const angle = (degrees * Math.PI) / 180;
      const dx = maxRadius * unitX * Math.cos(angle);
      const dy = maxRadius * unitY * Math.sin(angle);
      ctx.moveTo(cx - dx, cy + dy);
      ctx.lineTo(cx + dx, cy - dy);
    }
    ctx.stroke();
  }

  paintGraphRegion(ctx, region, color, px, py) {
    const cellWidth = Math.abs(px(region.x0 + region.dx) - px(region.x0)) + 0.5;
    const cellHeight = Math.abs(py(region.y0 + region.dy) - py(region.y0)) + 0.5;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.16;
    for (let j = 0; j < region.rows; j++) {
      for (let i = 0; i < region.cols; i++) {
        if (!region.cells[j * region.cols + i]) continue;
        ctx.fillRect(px(region.x0 + region.dx * i), py(region.y0 + region.dy * (j + 1)), cellWidth, cellHeight);
      }
    }
    ctx.globalAlpha = 1;
  }

  paintGraphSegments(ctx, row, px, py, color) {
    const style = resolveRowStyle(row.styling);
    const dashed = style.dashed || row.strict === true;
    ctx.strokeStyle = color;
    ctx.lineWidth = style.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (dashed && ctx.setLineDash) ctx.setLineDash(DASH_PATTERN);
    ctx.beginPath();
    for (const segment of row.segments) {
      ctx.moveTo(px(segment.x1), py(segment.y1));
      ctx.lineTo(px(segment.x2), py(segment.y2));
    }
    ctx.stroke();
    if (dashed && ctx.setLineDash) ctx.setLineDash([]);
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
    const periodicWrap = root.createDiv({
      cls: "qt-ref-periodic-wrap",
      attr: { role: "region", "aria-label": "Periodic table, scroll horizontally" },
    });
    this.periodicGridEl = periodicWrap.createDiv({ cls: "qt-ref-periodic", attr: { role: "grid", "aria-label": "Periodic table" } });
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
      preview.innerHTML = safeSvg(result.svg);
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
      attr: { type: "search", placeholder: "Search formulas (e.g. quadratic)" },
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
