"use strict";
// Directory build: there is no OpenCode support here. This stands in for the real manager so the
// rest of the plugin runs unchanged, but it starts nothing, downloads nothing and uses no Node.js APIs.

const OPENCODE_REPO = "";
const PROVIDERS = [];

const unavailable = () => new Error("The OpenCode agent isn't part of this version of the plugin. Use the Direct API backend instead.");

class OpenCodeManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.ai = plugin.settings.ai;
    this.conn = null;
    this.setupRun = null;
    this.setupBusy = false;
    this.setupError = "";
    this.foundPath = "";
  }
  isRunning() {
    return false;
  }
  stop() {}
  async ensure() {
    throw unavailable();
  }
  async describe() {
    return "Not included in this version.";
  }
  async install() {
    throw unavailable();
  }
  async autoSetup() {}
  async hasExisting() {
    return "";
  }
}

module.exports = {
  OpenCodeManager,
  OPENCODE_REPO,
  PROVIDERS,
  candidateAssetNames: undefined,
  chooseRelease: undefined,
  downloadFile: undefined,
  extractArchive: undefined,
  findBinaryIn: undefined,
  mergeAuth: undefined,
  platformTriple: undefined,
};
