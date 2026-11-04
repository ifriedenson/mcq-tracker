"use strict";
const { ItemView, Notice } = require("obsidian");
const { VIEW_TYPE_WEB_BROWSER } = require("./constants");
const webBrowser = require("./web-browser");

/*
 * The Web browser view. It embeds each tab in a sandboxed frame inside
 * Obsidian, with tabs, an address/search bar, per-tab back and forward,
 * bookmarks, history and zoom. It never proxies, injects or reads a page;
 * sites that refuse to be embedded fall back to Open in browser.
 */
class WebBrowserView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.state = null;
    this.query = "";
    this.showHistory = false;
  }

  getViewType() {
    return VIEW_TYPE_WEB_BROWSER;
  }

  getDisplayText() {
    return "Web browser";
  }

  getIcon() {
    return "globe";
  }

  async onOpen() {
    this.contentEl.addClass("qt-root");
    this.state = webBrowser.createBrowserState(this.plugin.webBrowserSettings());
    this.render();
  }

  activeTab() {
    return webBrowser.browserLayout(this.state);
  }

  persist() {
    if (!this.state) return;
    void this.plugin.updateWebBrowser({
      bookmarks: this.state.bookmarks,
      history: this.state.history,
    });
  }

  apply(result, options) {
    const opts = options || {};
    if (!result || result.ok === false) {
      if (result && result.message) new Notice(result.message);
      if (result && result.state) this.state = result.state;
      this.render();
      return false;
    }
    this.state = result.state;
    if (opts.persist !== false) this.persist();
    this.render();
    return true;
  }

  go(address) {
    const layout = webBrowser.browserLayout(this.state);
    const tab = this.state.tabs.find((item) => item.id === this.state.activeId);
    if (!tab) return;
    this.apply(webBrowser.navigate(this.state, tab.id, address));
  }

  async openAddress(address) {
    if (address) {
      this.go(address);
      return;
    }
    this.render();
  }

  newTab(address, isPrivate) {
    const result = webBrowser.openTab(this.state, address, { private: isPrivate === true });
    if (result.ok === false && result.message) new Notice(result.message);
    if (result.state) this.state = result.state;
    this.persist();
    this.render();
  }

  closeTab(id) {
    this.apply(webBrowser.closeTab(this.state, id), { persist: false });
  }

  activate(id) {
    this.apply(webBrowser.activateTab(this.state, id), { persist: false });
  }

  back() {
    const tab = this.state && this.state.tabs.find((item) => item.id === this.state.activeId);
    if (tab) this.apply(webBrowser.goBack(this.state, tab.id), { persist: false });
  }

  forward() {
    const tab = this.state && this.state.tabs.find((item) => item.id === this.state.activeId);
    if (tab) this.apply(webBrowser.goForward(this.state, tab.id), { persist: false });
  }

  home() {
    if (this.state) this.go(this.state.home);
  }

  zoom(delta) {
    const tab = this.state && this.state.tabs.find((item) => item.id === this.state.activeId);
    if (!tab) return;
    this.apply(webBrowser.setZoom(this.state, tab.id, delta), { persist: false });
  }

  bookmark() {
    const tab = this.state && this.state.tabs.find((item) => item.id === this.state.activeId);
    if (!tab || !tab.url) return;
    this.apply(webBrowser.toggleBookmark(this.state, tab.url, tab.title), { persist: true });
  }

  openExternal() {
    const tab = this.state && this.state.tabs.find((item) => item.id === this.state.activeId);
    if (!tab || !tab.url) return;
    if (typeof window !== "undefined" && typeof window.open === "function") {
      window.open(tab.url, "_blank", "noopener");
    } else {
      new Notice("Open the address in your normal browser.");
    }
  }

  clearHistory() {
    this.apply(webBrowser.clearHistory(this.state), { persist: true });
  }

  render() {
    const el = this.contentEl;
    el.empty();
    const root = el.createDiv({ cls: "qt-wrap qt-web-browser" });

    if (!this.plugin.webBrowserEnabled()) {
      const card = root.createDiv({ cls: "qt-web-browser-empty" });
      card.createEl("h3", { text: "Web browser is off" });
      card.createDiv({
        cls: "qt-web-browser-meta",
        text: "Turn on Web browser in Settings, Global, Modules to open pages inside Obsidian.",
      });
      card.createEl("button", { text: "Open settings", cls: "mod-cta" }).addEventListener("click", () => this.plugin.openSettings());
      return;
    }

    const layout = webBrowser.browserLayout(this.state);

    const toolbar = root.createDiv({ cls: "qt-web-browser-toolbar" });
    const nav = toolbar.createDiv({ cls: "qt-web-browser-nav" });
    const button = (parent, label, text, handler) => {
      const el = parent.createEl("button", { cls: "qt-web-browser-button", text, attr: { "aria-label": label, title: label } });
      el.addEventListener("click", handler);
      return el;
    };
    const back = button(nav, "Back", "←", () => this.back());
    back.disabled = !layout.canBack;
    const forward = button(nav, "Forward", "→", () => this.forward());
    forward.disabled = !layout.canForward;
    button(nav, "Reload this page", "⟳", () => this.render());
    button(nav, "Home", "⌂", () => this.home());

    const form = toolbar.createDiv({ cls: "qt-web-browser-address-row" });
    const address = form.createEl("input", {
      type: "text",
      cls: "qt-input qt-web-browser-address",
      attr: { "aria-label": "Address or search", placeholder: "Search or type a web address", value: layout.address },
    });
    address.value = layout.address;
    const submit = () => this.go(address.value);
    address.addEventListener("keydown", (event) => {
      if (!event || event.key !== "Enter") return;
      if (typeof event.preventDefault === "function") event.preventDefault();
      submit();
    });
    button(form, "Go", "Go", submit);
    const star = button(form, "Bookmark this page", layout.bookmarked ? "★" : "☆", () => this.bookmark());
    star.disabled = !layout.canBookmark;
    button(form, "New tab", "+", () => this.newTab(""));
    button(form, "Private tab", "🕶", () => this.newTab("", true));

    const tools = toolbar.createDiv({ cls: "qt-web-browser-tools" });
    const zoomLabel = tools.createSpan({ cls: "qt-web-browser-zoom", text: `${layout.zoom}%` });
    zoomLabel.setAttr("aria-live", "polite");
    button(tools, "Zoom out", "−", () => this.zoom(-webBrowser.ZOOM_STEP));
    button(tools, "Zoom in", "+", () => this.zoom(webBrowser.ZOOM_STEP));
    button(tools, "Open in browser", "↗", () => this.openExternal());
    button(tools, "History", "History", () => {
      this.showHistory = !this.showHistory;
      this.render();
    });

    const strip = root.createDiv({ cls: "qt-web-browser-tabs", attr: { role: "tablist", "aria-label": "Browser tabs" } });
    for (const tab of layout.tabs) {
      const item = strip.createDiv({ cls: "qt-web-browser-tab" + (tab.active ? " is-active" : "") });
      const select = item.createEl("button", {
        cls: "qt-web-browser-tab-label",
        text: tab.label,
        attr: { role: "tab", "aria-selected": tab.active ? "true" : "false" },
      });
      select.addEventListener("click", () => this.activate(tab.id));
      const close = item.createEl("button", {
        cls: "qt-web-browser-tab-close",
        text: "×",
        attr: { "aria-label": `Close ${tab.label}`, title: "Close tab" },
      });
      close.addEventListener("click", () => this.closeTab(tab.id));
    }

    if (layout.bookmarks.length) {
      const bar = root.createDiv({ cls: "qt-web-browser-bookmarks", attr: { "aria-label": "Bookmarks" } });
      for (const mark of layout.bookmarks) {
        const chip = bar.createEl("button", { cls: "qt-web-browser-bookmark", text: mark.label, title: mark.url });
        chip.addEventListener("click", () => this.go(mark.url));
      }
    }

    const stage = root.createDiv({ cls: "qt-web-browser-stage" });
    if (layout.frame) {
      const frame = stage.createEl("iframe", {
        cls: "qt-web-browser-frame",
        attr: {
          src: layout.frame.url,
          sandbox: layout.frame.sandbox,
          referrerpolicy: "no-referrer",
          title: layout.tabs.find((tab) => tab.active)?.label || "Web page",
        },
      });
      if (layout.frame.zoom !== 100) {
        frame.style.transform = `scale(${layout.frame.zoom / 100})`;
        frame.style.transformOrigin = "top left";
        frame.style.width = `${10000 / layout.frame.zoom}%`;
        frame.style.height = `${10000 / layout.frame.zoom}%`;
      }
    } else {
      const blank = stage.createDiv({ cls: "qt-web-browser-blank" });
      blank.createEl("h3", { text: "New tab" });
      blank.createDiv({ cls: "qt-web-browser-meta", text: `Search with ${webBrowser.searchEngineLabel(this.state.search)}, or type an address above.` });
      const hint = blank.createDiv({ cls: "qt-web-browser-hint", text: layout.hint });
      hint.setAttr("role", "note");
    }

    if (layout.private) {
      root.createDiv({
        cls: "qt-web-browser-private-note",
        text: "Private tab: this tab's visits are not added to your history.",
      });
    }
    if (layout.frame) {
      const hint = root.createDiv({ cls: "qt-web-browser-hint", text: layout.hint });
      hint.setAttr("role", "note");
    }

    if (this.showHistory) {
      const panel = root.createDiv({ cls: "qt-web-browser-history" });
      const head = panel.createDiv({ cls: "qt-web-browser-history-head" });
      head.createEl("h3", { text: "History" });
      if (layout.history.length) {
        head.createEl("button", { cls: "qt-link", text: "Clear history" }).addEventListener("click", () => this.clearHistory());
      }
      if (!layout.history.length) {
        panel.createDiv({ cls: "qt-web-browser-meta", text: "No pages yet." });
      }
      for (const row of layout.history) {
        const item = panel.createDiv({ cls: "qt-web-browser-history-row" });
        item.createEl("button", { cls: "qt-link", text: row.label, title: row.url }).addEventListener("click", () => this.go(row.url));
        item.createSpan({ cls: "qt-web-browser-history-host", text: row.host });
      }
    }
  }
}

module.exports = { WebBrowserView };
