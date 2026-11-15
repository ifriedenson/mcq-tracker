"use strict";
/*
 * A hub is one Obsidian leaf that hosts several existing views as tabs. It
 * does not reimplement any of them: each tab is the real view class, mounted
 * into a pane element with its own `contentEl`, so state, events, timers and
 * rendering stay exactly as they were. Hiding a tab only toggles a class; the
 * child is never destroyed, so switching back is instant.
 */
const { ItemView } = require("obsidian");

class QtHubView extends ItemView {
  constructor(leaf, plugin, spec) {
    super(leaf);
    this.plugin = plugin;
    this.spec = spec;
    this.tabs = [];
    this.panes = {};
    this.tabButtons = {};
    this.activeTab = "";
  }

  getViewType() {
    return this.spec.type;
  }

  getDisplayText() {
    return this.spec.title;
  }

  getIcon() {
    return this.spec.icon;
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.contentEl.addClass("qt-hub-root");
    this.renderHub();
  }

  async onClose() {
    for (const pane of Object.values(this.panes)) {
      try {
        if (pane.view && typeof pane.view.onClose === "function") await pane.view.onClose();
      } catch (error) {
        // A child that cannot close must not stop the hub from closing.
      }
    }
    this.panes = {};
    this.tabButtons = {};
  }

  /** Which tabs this hub would show right now. */
  enabledTabs() {
    return (this.spec.tabs || []).filter((tab) => {
      try {
        return typeof tab.enabled === "function" ? !!tab.enabled(this.plugin) : true;
      } catch (error) {
        return false;
      }
    });
  }

  /** The whole frame: the tab bar plus one pane per enabled tab. */
  renderHub() {
    const el = this.contentEl;
    el.empty();
    const tabs = this.enabledTabs();
    this.tabs = tabs;
    if (!this.activeTab || !tabs.some((tab) => tab.id === this.activeTab)) this.activeTab = tabs.length ? tabs[0].id : "";
    const root = el.createDiv({ cls: "qt-wrap qt-hub" });
    if (!tabs.length) {
      root.createDiv({ cls: "qt-hub-empty", text: `${this.spec.title} has no sections turned on. Turn them on in Settings, Global, Modules.` });
      return;
    }
    const bar = root.createDiv({ cls: "qt-hub-tabs", attr: { role: "tablist", "aria-label": `${this.spec.title} sections` } });
    this.tabButtons = {};
    for (const tab of tabs) {
      const active = tab.id === this.activeTab;
      const button = bar.createEl("button", {
        cls: "qt-hub-tab" + (active ? " is-active" : ""),
        text: tab.label,
        attr: { role: "tab", "aria-selected": active ? "true" : "false", title: `${tab.label} inside ${this.spec.title}` },
      });
      button.addEventListener("click", () => this.showHubTab(tab.id));
      this.tabButtons[tab.id] = button;
    }
    const body = root.createDiv({ cls: "qt-hub-body" });
    this.panes = {};
    for (const tab of tabs) {
      const pane = body.createDiv({ cls: "qt-hub-pane" + (tab.id === this.activeTab ? " is-active" : "") });
      pane.setAttr("role", "tabpanel");
      pane.setAttr("aria-label", tab.label);
      const entry = { tab, el: pane, view: null, error: null };
      this.panes[tab.id] = entry;
      this.mountPane(entry);
    }
  }

  /** Creates the real view the first time its pane is needed. */
  mountPane(entry) {
    if (!entry || entry.view) return entry ? entry.view : null;
    let view = null;
    try {
      view = entry.tab.create(this.leaf, this.plugin);
    } catch (error) {
      entry.error = error;
    }
    if (!view) {
      entry.el.createDiv({ cls: "qt-hub-error", text: `This ${entry.tab.label} section could not open.` });
      return null;
    }
    entry.view = view;
    if (!view.app) view.app = this.app || (this.leaf && this.leaf.app) || this.plugin.app;
    view.contentEl = entry.el;
    if (typeof view.onOpen === "function") {
      try {
        view.onOpen();
      } catch (error) {
        entry.error = error;
      }
    }
    return view;
  }

  /** Show one tab; mounting and refreshing it if this is the first visit. */
  showHubTab(id) {
    if (id && !this.tabs.some((tab) => tab.id === id)) return null;
    const wanted = id || this.activeTab;
    this.activeTab = wanted;
    for (const tab of this.tabs) {
      const entry = this.panes[tab.id];
      const on = tab.id === wanted;
      if (entry && entry.el) {
        if (on) entry.el.addClass("is-active");
        else entry.el.removeClass("is-active");
      }
      const button = this.tabButtons[tab.id];
      if (button) {
        if (on) button.addClass("is-active");
        else button.removeClass("is-active");
        if (typeof button.setAttr === "function") button.setAttr("aria-selected", on ? "true" : "false");
      }
    }
    const entry = this.panes[wanted];
    const view = this.mountPane(entry);
    if (view && typeof view.render === "function") view.render();
    return view;
  }

  /** The mounted child for a tab, for callers that need its own API. */
  childView(id) {
    const entry = this.panes[id];
    return entry ? entry.view : null;
  }

  /**
   * Refresh every mounted pane. A hub has no content of its own, so its own
   * `render()` must never rebuild the frame: that would throw away child state.
   */
  render() {
    if (!this.tabs.length) return this.renderHub();
    for (const entry of Object.values(this.panes)) {
      const view = entry.view;
      if (!view || typeof view.render !== "function") continue;
      try {
        view.render();
      } catch (error) {
        entry.error = error;
      }
    }
    return null;
  }
}

module.exports = { QtHubView };
