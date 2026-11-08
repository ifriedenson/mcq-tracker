"use strict";
/*
 * The PDF++ page inside MCQ Tracker's own settings navigation.
 *
 * PDF++ is a hosted child plugin, so its options live in a settings tab that
 * the vendor bundle registers itself. That tab used to sit beside MCQ Tracker's
 * settings as a second top-level plugin tab. This page owns the on/off switch
 * and renders the vendor tab's own controls inside MCQ Tracker's settings, so
 * both are found in one place. When the vendor tab cannot be mounted (the host
 * is off, the standalone PDF++ plugin is running, or this Obsidian build hides
 * plugin tabs) the page says so and offers the tab directly instead of failing.
 */
const { Setting } = require("obsidian");
const { EMBEDDED_ID, EMBEDDED_VERSION } = require("./pdf-plus");

function heading(containerEl, title, description) {
  containerEl.createEl("h2", { text: title });
  containerEl.createEl("p", { cls: "setting-item-description", text: description });
}

/** The settings tab the embedded PDF++ host captured, if it has started. */
function pdfPlusSettingsTab(plugin) {
  const hosted = plugin && plugin.pdfPlus && plugin.pdfPlus.settingTab;
  if (hosted) return hosted;
  // Older builds registered the tab with Obsidian. Read it if one is still in
  // the app registry, but new hosts never add that separate top-level tab.
  const setting = plugin && plugin.app && plugin.app.setting;
  const tabs = setting && Array.isArray(setting.pluginTabs) ? setting.pluginTabs : [];
  return (
    tabs.find((tab) => tab && tab.plugin && tab.plugin.manifest && tab.plugin.manifest.id === EMBEDDED_ID) ||
    tabs.find((tab) => tab && tab.id === EMBEDDED_ID) ||
    null
  );
}

function statusText(plugin) {
  if (!plugin.pdfPlusEnabled()) return "Off. Turn it on to run PDF++ inside MCQ Tracker.";
  if (plugin.pdfPlusError) return plugin.pdfPlusError;
  if (plugin.pdfPlusPaused) return `Paused while an MCQ Tracker PDF reader or editor is open. Bundled version ${EMBEDDED_VERSION}.`;
  if (plugin.pdfPlus) return `Running. Bundled version ${EMBEDDED_VERSION}, with its settings saved inside MCQ Tracker's data.json.`;
  return `On, but not started yet. It starts with the workspace.`;
}

/**
 * PDF++'s scrollToSetting scrolls its own .vertical-tab-content. When the tab
 * is mounted inside MCQ Tracker's settings page, that element grows to the
 * full content height and has no scroll range; the real scroller is Obsidian's
 * outer settings pane. Scroll the addressed control into that pane so the
 * vendor's Customize... and obsidian://pdf-plus links land on the right row.
 */
function bindEmbeddedScroll(embedded) {
  if (!embedded || typeof embedded.scrollToSetting !== "function") return;
  if (embedded._qtScrollIntoView) return;
  const vendorScrollToSetting = embedded.scrollToSetting;
  embedded.scrollToSetting = function (setting, options) {
    const target = setting && setting.settingEl;
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({
        block: "start",
        inline: "nearest",
        behavior: (options && options.behavior) || "smooth",
      });
      return;
    }
    return vendorScrollToSetting.call(this, setting, options);
  };
  embedded._qtScrollIntoView = true;
}

/**
 * Renders the page. PDF++'s host captures its vendor settings tab instead of
 * registering a second top-level plugin tab; this page mounts that tab's own
 * controls so PDF++ is configured in one place with every MCQ Tracker option.
 */
function renderPdfPlusSettings(containerEl, plugin, redisplay) {
  if (plugin) plugin._pdfPlusSettingsView = null;
  heading(
    containerEl,
    "PDF++",
    "The full MIT-licensed PDF++ 0.40.31 native viewer is built into MCQ Tracker — no separate plugin or download. Backlink highlights, callouts, colour palettes, outline and page-label tools, the page composer, embeds, external-app sync and Vim keys are all configured below with the rest of the plugin."
  );

  new Setting(containerEl)
    .setName("Run the embedded PDF++ tools")
    .setDesc(
      "PDF++ is included with MCQ Tracker. Off keeps every PDF++ setting and all of your PDF annotations; it only stops the native-viewer integration. If you also enabled the standalone PDF++ plugin, disable it so the two copies never decorate the same file."
    )
    .addToggle((t) =>
      t.setValue(plugin.pdfPlusEnabled()).onChange(async (v) => {
        await plugin.setPdfPlusEnabled(v);
        redisplay();
      })
    );

  const status = new Setting(containerEl).setName("Status").setDesc(statusText(plugin));
  if (plugin.pdfPlusEnabled()) {
    status.addButton((b) =>
      b.setButtonText("Start PDF++").onClick(async () => {
        await plugin.startPdfPlus();
        redisplay();
      })
    );
  }

  if (plugin.pdfPlusError) {
    containerEl.createEl("p", { cls: "qt-settings-warning", text: plugin.pdfPlusError });
  }

  if (!plugin.pdfPlusEnabled()) {
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "PDF++'s own options appear here once the integration is on.",
    });
    return;
  }

  const hostTab = pdfPlusSettingsTab(plugin);
  if (!hostTab || typeof hostTab.display !== "function") {
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "PDF++'s options are not available yet. Use Start PDF++ above, or reopen this page once the integration is running.",
    });
    return;
  }

  const mount = containerEl.createDiv({ cls: "qt-pdf-plus-settings" });
  const warn = (error) => {
    if (plugin) plugin._pdfPlusSettingsView = null;
    mount.empty();
    containerEl.createEl("p", {
      cls: "qt-settings-warning",
      text: `PDF++'s settings could not be drawn here: ${String((error && error.message) || error)}. Reopen this page or check the running state above.`,
    });
  };
  try {
    // The vendor tab renders into elements it creates in its constructor
    // (`headerContainerEl`, `contentEl`), so moving the shared tab's container
    // would leave our mount empty and draw into its hidden tab. A second
    // instance owns its own elements while sharing the hosted plugin's saved
    // settings; the real tab stays untouched for the button above.
    const VendorTab = hostTab.constructor;
    if (typeof VendorTab !== "function") throw new Error("the PDF++ settings tab cannot be copied");
    const embedded = new VendorTab(hostTab.plugin);
    if (!embedded || !embedded.containerEl) throw new Error("the PDF++ settings tab has no container");
    if (typeof embedded.containerEl.addClass === "function") embedded.containerEl.addClass("qt-pdf-plus-embedded");
    plugin._pdfPlusSettingsView = embedded;
    bindEmbeddedScroll(embedded);
    mount.appendChild(embedded.containerEl);
    const drawing = embedded.display();
    if (drawing && typeof drawing.catch === "function") drawing.catch(warn);
  } catch (error) {
    warn(error);
  }
}

module.exports = { renderPdfPlusSettings, pdfPlusSettingsTab };
