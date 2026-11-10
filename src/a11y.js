"use strict";
/*
 * Dialog accessibility.
 *
 * Obsidian's Modal creates the dialog chrome but does not name it, so a screen
 * reader announces an unnamed dialog even when the content starts with a
 * visible heading. `describeDialog` points the container at that heading (or
 * falls back to a written label) and `QtModal` applies it once the modal has
 * rendered. The static audit in tests/helpers/a11y-audit.js fails when a modal
 * class bypasses this layer.
 */
const { FuzzySuggestModal, Modal } = require("obsidian");

let dialogTitleSeq = 0;

function setAttr(el, name, value) {
  if (!el) return;
  if (typeof el.setAttribute === "function") el.setAttribute(name, value);
  else el[name] = value;
}

function removeAttr(el, name) {
  if (!el) return;
  if (typeof el.removeAttribute === "function") el.removeAttribute(name);
  else delete el[name];
}

function textOf(el) {
  if (!el) return "";
  return String(typeof el.textContent === "string" ? el.textContent : el.text || "").trim();
}

function setTitleId(heading) {
  if (!heading) return "";
  if (!heading.id) {
    dialogTitleSeq += 1;
    heading.id = `qt-dialog-title-${dialogTitleSeq}`;
  }
  return heading.id;
}

function explicitLabel(modal) {
  const value = typeof modal.qtDialogLabel === "function" ? modal.qtDialogLabel() : modal.qtDialogLabel;
  return String(value || "").trim();
}

/**
 * Names an open dialog from its visible heading. Returns the name it applied,
 * or "" when the modal has no container or no name is available.
 */
function describeDialog(modal, fallback) {
  if (!modal) return "";
  const container = modal.modalEl || modal.containerEl;
  const content = modal.contentEl;
  if (!container || !content) return "";
  const heading =
    typeof content.querySelector === "function"
      ? content.querySelector("h1, h2, h3, h4, [data-qt-dialog-title]")
      : null;
  const titleEl = modal.titleEl;
  const titleText = textOf(titleEl);
  let name = textOf(heading) || titleText;

  if (heading) {
    setAttr(container, "aria-labelledby", setTitleId(heading));
    removeAttr(container, "aria-label");
  } else if (titleText && titleEl) {
    setAttr(container, "aria-labelledby", setTitleId(titleEl));
    removeAttr(container, "aria-label");
  } else {
    name = name || explicitLabel(modal) || String(fallback || "").trim();
    if (!name && typeof content.getAttribute === "function") {
      name = String(content.getAttribute("aria-label") || "").trim();
    }
    if (name) {
      setAttr(container, "aria-label", name);
      removeAttr(container, "aria-labelledby");
    }
  }

  if (!name) return "";
  // One shared UI root for the plugin's interaction primitives; Obsidian's
  // modal container has no plugin-specific class of its own.
  if (typeof container.addClass === "function") container.addClass("qt-ui");
  else if (container.classList) container.classList.add("qt-ui");
  setAttr(container, "role", "dialog");
  setAttr(container, "aria-modal", "true");
  return name;
}

/** A Modal whose container is named after it renders. */
class QtModal extends Modal {
  open() {
    const result = super.open();
    describeDialog(this);
    return result;
  }
}

/**
 * Fuzzy pickers have no heading of their own; each subclass supplies a short
 * purpose name through `qtDialogLabel()`.
 */
class QtFuzzySuggestModal extends FuzzySuggestModal {
  open() {
    const result = super.open();
    describeDialog(this, "Choose an item");
    return result;
  }
}

module.exports = { QtFuzzySuggestModal, QtModal, describeDialog };
