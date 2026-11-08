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

/** The settings tab the embedded PDF++ host registered, if this app exposes it. */
function pdfPlusSettingsTab(plugin) {
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
  if (plugin.pdfPlusPaused) return `Paused while an MCQ Tracker PDF reader or editor is open. Version ${EMBEDDED_VERSION}.`;
  if (plugin.pdfPlus) return `Running. Version ${EMBEDDED_VERSION}, with its settings saved inside MCQ Tracker's data.json.`;
  return `On, but not started yet. It starts with the workspace, or open it from the PDF++ button below.`;
}

/**
 * Renders the page. The vendor tab draws into a temporary container; its own
 * `containerEl` is restored immediately so its settings tab keeps working when
 * the user opens it from Obsidian's settings sidebar.
 */
function renderPdfPlusSettings(containerEl, plugin, redisplay) {
  heading(
    containerEl,
    "PDF++",
    "The full MIT-licensed PDF++ 0.40.31 native viewer, embedded in MCQ Tracker: backlink highlights, callouts, colour palettes, outline and page-label tools, the page composer, embeds, external-app sync and Vim keys. Its options are shown below, so they live with the rest of the plugin."
  );

  new Setting(containerEl)
    .setName("Run the embedded PDF++ tools")
    .setDesc(
      "Off keeps every PDF++ setting and all of your PDF annotations; it only stops the native-viewer integration. Turn the standalone PDF++ plugin off while this is on, so the two copies never decorate the same file."
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
  status.addButton((b) =>
    b.setButtonText("Open PDF++ settings tab").onClick(() => {
      if (typeof plugin.openPdfPlusSettingsTab === "function") plugin.openPdfPlusSettingsTab();
    })
  );

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
      text: "This Obsidian build keeps plugin settings tabs private, so PDF++'s options cannot be drawn inside this page. The button above opens the same PDF++ settings tab; everything else on this page still applies.",
    });
    return;
  }

  const mount = containerEl.createDiv({ cls: "qt-pdf-plus-settings" });
  const warn = (error) => {
    mount.empty();
    containerEl.createEl("p", {
      cls: "qt-settings-warning",
      text: `PDF++'s settings could not be drawn here: ${String((error && error.message) || error)}. Use the Open PDF++ settings tab button above.`,
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
    mount.appendChild(embedded.containerEl);
    const drawing = embedded.display();
    if (drawing && typeof drawing.catch === "function") drawing.catch(warn);
  } catch (error) {
    warn(error);
  }
}

module.exports = { renderPdfPlusSettings, pdfPlusSettingsTab };
