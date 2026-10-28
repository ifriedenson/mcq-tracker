"use strict";

const { setIcon } = require("obsidian");

/** Opens a documentation or repository link from a settings button. */
function openExternal(url) {
  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank");
  }
}

/**
 * Renders one row of settings tabs. The caller owns which tab is active, so a
 * re-render (for example after saving a setting) keeps the user on the same page.
 */
function renderSettingsTabs(containerEl, tabs, activeId, onSelect, options) {
  const opts = options || {};
  const bar = containerEl.createDiv({ cls: opts.className || "qt-settings-tabs" });
  const tabClass = opts.tabClass || "qt-settings-tab";
  for (const tab of tabs) {
    const active = tab.id === activeId;
    const button = bar.createEl("button", { cls: `${tabClass}${active ? " is-active" : ""}` });
    button.setAttr("type", "button");
    button.setAttr("aria-pressed", active ? "true" : "false");
    if (tab.icon) {
      const icon = button.createSpan({ cls: "qt-settings-tab-icon" });
      setIcon(icon, tab.icon);
    }
    button.createSpan({ cls: "qt-settings-tab-label", text: tab.label });
    button.addEventListener("click", () => onSelect(tab.id));
  }
  return bar;
}

module.exports = {
  openExternal,
  renderSettingsTabs,
};
