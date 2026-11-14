t = open("src/import-modal.js").read()

# 1. A stop during the write still journals what the file managed first.
old = """    this.status(`Created ${result.made} of ${chosen.length}...`);
        if (this.unattended && result.made % 10 === 0) await sleep(0);"""
assert t.count(old) == 0, "check pacing context"
old = """      if (this.isStopError(e)) {
        if (this.batchMode) {
          this.recordBatchResult({ made: 0, skipped: ["Stopped before this file finished"] }, this.folder);
          await this.finishBatch("stopped");"""
assert t.count(old) == 1, "write stop"
t = t.replace(old, """      if (this.isStopError(e)) {
        if (this.batchMode) {
          if (this.unattended) {
            this.unattendedArtifacts = this.artifacts ? { files: [...this.artifacts.files], folders: [...this.artifacts.folders] } : { files: [], folders: [] };
            this.snapshotUnattendedFile({ made: 0, skipped: ["Stopped before this file finished"], stopped: true, paths: [] }, this.folder);
          }
          this.recordBatchResult({ made: 0, skipped: ["Stopped before this file finished"] }, this.folder);
          await this.finishBatch("stopped");""")

old = """      await this.cleanupArtifacts();
      if (this.isStopError(e)) {
        if (this.batchMode) {
          this.recordBatchResult({ made: 0, skipped: ["Stopped before this file finished"] }, this.folder);
          await this.finishBatch("stopped");
        } else if (!this.closed) {
          await this.finishSingleStop("Stopped before this file finished");
        }"""
assert t.count(old) == 1, "notes stop"
t = t.replace(old, """      await this.cleanupArtifacts();
      if (this.isStopError(e)) {
        if (this.batchMode) {
          if (this.unattended) {
            this.unattendedArtifacts = this.artifacts ? { files: [...this.artifacts.files], folders: [...this.artifacts.folders] } : { files: [], folders: [] };
            this.snapshotUnattendedFile({ made: 0, skipped: ["Stopped before this file finished"], stopped: true, paths: [] }, this.folder);
          }
          this.recordBatchResult({ made: 0, skipped: ["Stopped before this file finished"] }, this.folder);
          await this.finishBatch("stopped");
        } else if (!this.closed) {
          await this.finishSingleStop("Stopped before this file finished");
        }""")

# 2. A completed write is marked as written; anything else may need the file again.
old = """    this.plugin.recordOvernightFile(run, key, {
      status: result && result.error ? "error" : "done","""
assert t.count(old) == 1, "written mark"
t = t.replace(old, """    const status = result && result.error ? "error" : result && result.stopped ? "stopped" : "done";
    this.plugin.recordOvernightFile(run, key, {
      status,
      written: status === "done",""")

# 3. A queue with nothing left to write but checks pending goes straight to
# the checks phase on a quiet screen with a live Stop button.
old = """    if (!this.files.length) {
      new Notice("Overnight import: no files to import.");
      if (run) this.plugin.storeOvernightRunState(run, "error");
      this.close();
      return;
    }"""
assert t.count(old) == 1, "checks-only"
t = t.replace(old, """    if (!this.files.length) {
      if (run && this.plugin.overnightChecksPending(run)) return this.startUnattendedChecks();
      new Notice("Overnight import: no files to import.");
      if (run) this.plugin.storeOvernightRunState(run, "error");
      this.close();
      return;
    }""")

old = """  /** The next file, or the checks phase when the queue is written. */"""
assert t.count(old) == 1, "checks screen"
t = t.replace(old, """  /** The checks phase without a write queue: a quiet screen, a live Stop button. */
  startUnattendedChecks() {
    const el = this.contentEl;
    el.empty();
    this.headerEl = el.createEl("h3", { text: "Checking answers" });
    this.statusEl = el.createDiv({ cls: "qt-hint", text: "Starting..." });
    this.lastStatus = "Starting...";
    const stop = el.createEl("button", { text: "Stop", cls: "qt-modal-btn" });
    stop.addEventListener("click", () => this.requestStop(this.plugin, "discard"));
    this.stopBtns = [stop];
    return this.plugin.finishUnattended(this, "resumed");
  }

  /** The next file, or the checks phase when the queue is written. */""")

open("src/import-modal.js", "w").write(t)
print("modal: stopped snapshots + checks-only screen")
