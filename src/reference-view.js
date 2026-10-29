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
const { openExternal } = require("./settings-ui");
const { AP_PROFILES, DEFAULT_CUTOFFS, calculateApScore, profileById, requiredForTarget } = require("./ap-score");
const {
  AP_RESOURCE_COURSES,
  AP_RESOURCE_POLICY,
  resourceTypeLabel,
  resourcesForCourse,
} = require("./ap-resources");

/*
 * A local-only reference panel. It deliberately contains no calculator engine,
 * network request or third-party dataset: formulas and constants are static text,
 * and the converter is a pure multiplication/offset table.
 */
class ReferenceView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.tab = "formulas"; // formulas | units | graph | elements | constants | ap | resources
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
    this.apCourse = AP_PROFILES[0].id;
    this.apScores = {};
    this.apCutoffs = { ...DEFAULT_CUTOFFS };
    this.apTarget = "4";
    this.apResultEl = null;
    this.apResourceCourse = AP_RESOURCE_COURSES[0].id;
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
      text: "Bundled formulas, constants, unit conversions and an unofficial AP score estimator. Everything is local and works offline.",
    });

    const tabs = root.createDiv({ cls: "qt-row qt-small-row qt-ref-tabs" });
    for (const [id, label] of [
      ["formulas", "Formulas"],
      ["units", "Unit converter"],
      ["graph", "Graph"],
      ["elements", "Periodic table"],
      ["constants", "Constants"],
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

    if (this.tab === "units") this.renderUnits(root);
    else if (this.tab === "graph") this.renderGraph(root);
    else if (this.tab === "elements") this.renderPeriodic(root);
    else if (this.tab === "constants") this.renderConstants(root);
    else if (this.tab === "ap") this.renderApScore(root);
    else if (this.tab === "resources") this.renderApResources(root);
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
      card.createEl("button", { text: actionLabels[resource.type] || "Open link", cls: "qt-link" }).addEventListener("click", () =>
        openExternal(resource.url),
      );
    }

    const policy = root.createDiv({ cls: "qt-ap-policy" });
    for (const line of AP_RESOURCE_POLICY) policy.createDiv({ cls: "qt-hint", text: line });
    policy.createDiv({ cls: "qt-hint", text: `Checked ${pack.checkedOn}. Links can move; report a stale link rather than copying the page into your vault.` });
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
