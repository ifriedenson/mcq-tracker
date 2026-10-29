"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AP_RESOURCES_CHECKED_ON,
  AP_RESOURCE_COURSES,
  AP_RESOURCE_POLICY,
  AP_RESOURCE_TYPES,
  allResources,
  resourceTypeLabel,
  resourcesForCourse,
} = require("../src/ap-resources");
const { AP_PROFILES } = require("../src/ap-score");

test("AP resources: every calculator course also has a resource pack", () => {
  assert.deepEqual(
    AP_RESOURCE_COURSES.map((course) => course.id),
    AP_PROFILES.map((profile) => profile.id),
  );
  assert.equal(new Set(AP_RESOURCE_COURSES.map((course) => course.name)).size, AP_RESOURCE_COURSES.length);
});

test("AP resources: every link is HTTPS on an official College Board domain", () => {
  for (const resource of allResources()) {
    const url = new URL(resource.url);
    assert.equal(url.protocol, "https:", resource.url);
    assert.equal(
      ["apcentral.collegeboard.org", "apstudents.collegeboard.org", "apclassroom.collegeboard.org"].includes(url.hostname),
      true,
      `unexpected host in ${resource.url}`,
    );
    assert.ok(resource.title.trim(), "a resource needs a title");
    assert.ok(resource.description.trim(), "a resource needs a description");
    assert.equal(resourceTypeLabel(resource.type), AP_RESOURCE_TYPES[resource.type]);
  }
});

test("AP resources: each course pack is course-specific and starts with the official course page", () => {
  for (const course of AP_RESOURCE_COURSES) {
    const pack = resourcesForCourse(course.id);
    assert.equal(pack.course.id, course.id);
    assert.equal(pack.checkedOn, AP_RESOURCES_CHECKED_ON);
    assert.equal(pack.resources.length, 6);
    assert.equal(pack.resources[0].type, "course");
    assert.match(pack.resources[0].url, new RegExp(`/courses/${course.slug}$`));
    assert.match(pack.resources[1].url, /\/exam$/);
    assert.match(pack.resources[2].url, /\/exam\/past-exam-questions$/);
    assert.match(pack.resources[3].url, new RegExp(`/courses/${course.studentsSlug}$`));
    assert.equal(pack.resources[4].url, "https://apclassroom.collegeboard.org/");
    assert.equal(pack.resources[5].url, "https://apstudents.collegeboard.org/exam-calendar");
    assert.equal(new Set(pack.resources.map((resource) => resource.id)).size, pack.resources.length);
  }
});

test("AP resources: an unknown course falls back safely instead of throwing", () => {
  const pack = resourcesForCourse("not-a-course");
  assert.equal(pack.course.id, AP_RESOURCE_COURSES[0].id);
  assert.equal(resourcesForCourse().course.id, AP_RESOURCE_COURSES[0].id);
});

test("AP resources: the policy is link-only and makes no affiliation claim", () => {
  const text = AP_RESOURCE_POLICY.join(" ");
  assert.match(text, /not a copy/i);
  assert.match(text, /never signs in, scrapes or stores/i);
  assert.match(text, /not affiliated/i);
  assert.match(text, /trademark/i);
});

test("AP resources: the Reference tab renders a course pack and an official link", () => {
  const Module = require("module");
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request !== "obsidian") return originalLoad.call(this, request, parent, isMain);
    return {
      ItemView: class {
        constructor(leaf, plugin) {
          this.leaf = leaf;
          this.plugin = plugin;
          this.contentEl = makeEl("root");
        }
      },
      MarkdownRenderer: { render: () => Promise.resolve() },
    };
  };
  try {
    const { ReferenceView } = require("../src/reference-view");
    const plugin = {
      settings: { reference: { defaultSubject: "all" } },
      referenceEnabled: () => true,
      openSettings: () => {},
    };
    const view = new ReferenceView({}, plugin);
    view.tab = "resources";
    view.render();

    const text = view.contentEl.textContent();
    assert.match(text, /AP resources/);
    assert.match(text, /AP Biology on AP Central/);
    assert.match(text, /Released free-response questions/);
    assert.match(text, /AP Classroom and AP Videos/);
    assert.match(text, /Checked 2026-10-29/);
    assert.match(text, /not affiliated/i);

    const buttons = [];
    const walk = (el) => {
      for (const child of el.children) {
        if (child.tagName === "button") buttons.push(child);
        walk(child);
      }
    };
    walk(view.contentEl);
    const lesson = buttons.find((button) => button.textContent() === "Open released FRQs");
    assert.ok(lesson, "the first released-FRQ link should have an open button");
  } finally {
    Module._load = originalLoad;
  }
});

/* A tiny Obsidian-ish element with the methods the Reference view uses. */
function makeEl(tag) {
  const el = {
    tagName: tag,
    children: [],
    classes: new Set(),
    attributes: {},
    value: "",
    text: "",
    placeholder: "",
    scrollTop: 0,
    empty() {
      this.children = [];
      this.text = "";
    },
    createDiv(options) {
      return append(this, makeEl("div"), options);
    },
    createSpan(options) {
      return append(this, makeEl("span"), options);
    },
    createEl(name, options) {
      return append(this, makeEl(name), options);
    },
    createSvg() {
      return append(this, makeEl("svg"), {});
    },
    addClass(name) {
      this.classes.add(name);
    },
    removeClass(name) {
      this.classes.delete(name);
    },
    toggleClass(name, force) {
      if (force) this.classes.add(name);
      else this.classes.delete(name);
    },
    setText(value) {
      this.text = String(value);
      this.children = [];
      return this;
    },
    setAttr(name, value) {
      this.attributes[name] = String(value);
    },
    addEventListener() {},
    getContext() {
      return { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, set strokeStyle(v) {}, set lineWidth(v) {} };
    },
    getBoundingClientRect() {
      return { width: 300, height: 200 };
    },
    textContent() {
      return [this.text, ...this.children.map((child) => child.textContent())].filter(Boolean).join(" ");
    },
  };
  return el;
}

function append(parent, child, options) {
  const opts = options || {};
  if (opts.cls) {
    for (const name of String(opts.cls).split(/\s+/)) child.classes.add(name);
  }
  if (opts.text !== undefined) child.text = String(opts.text);
  if (opts.attr) Object.assign(child.attributes, opts.attr);
  parent.children.push(child);
  return child;
}
