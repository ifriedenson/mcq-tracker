"use strict";
/*
 * Flagged answers: every note whose blind check disagreed with the stored
 * answer, with the question, both answers, who voted, and when. Open the
 * note, ask the checker again, accept the stored answer, or drop the note —
 * and re-check everything at once. Frontmatter vocabulary never changes.
 */
const { Notice } = require("obsidian");
const { QtModal } = require("./a11y");
const { str } = require("./util");
const { checkEta, findUncheckedNotes, storedCheckMedianMs } = require("./answer-check-queue");

function shortQuestion(text) {
  const clean = str(text).replace(/\s+/g, " ").trim();
  return clean.length > 140 ? clean.slice(0, 140) + "…" : clean;
}

class FlaggedAnswersModal extends QtModal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.ready = Promise.resolve();
    this.busy = false;
  }

  onOpen() {
    if (this.modalEl && typeof this.modalEl.addClass === "function") this.modalEl.addClass("qt-flagged-modal");
    this.ready = this.refresh();
  }

  async refresh() {
    const plugin = this.plugin;
    const flagged = await plugin.flaggedAnswers();
    let unchecked = 0;
    try {
      unchecked = (await findUncheckedNotes(plugin)).length;
    } catch (e) {
      unchecked = 0;
    }
    const median = storedCheckMedianMs(this.app);
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: `Flagged answers (${flagged.length})` });
    const pace = unchecked
      ? median > 0
        ? `${unchecked} unchecked note${unchecked === 1 ? "" : "s"}${checkEta(unchecked, median) ? ` · ${checkEta(unchecked, median)} at the last pace` : ""}.`
        : `${unchecked} unchecked note${unchecked === 1 ? "" : "s"} (no finished run to pace them yet).`
      : "Every other note has its verdict.";
    el.createDiv({ cls: "qt-hint", text: pace });
    this.statusEl = el.createDiv({ cls: "qt-hint", text: "" });
    const list = el.createDiv({ cls: "qt-flagged-list" });
    for (const entry of flagged) {
      const row = list.createDiv({ cls: "qt-flagged-row" });
      row.createDiv({ cls: "qt-flagged-q", text: shortQuestion(entry.question) || entry.path });
      row.createDiv({
        cls: "qt-flagged-vs",
        text: `The note says ${entry.stored || "?"}, the check chose ${entry.answer || "?"}${entry.voters ? ` · ${entry.voters}` : ""}${entry.date ? ` · ${entry.date}` : ""}.`,
      });
      const actions = row.createDiv({ cls: "qt-row qt-small-row" });
      const open = actions.createEl("button", { text: "Open note", cls: "qt-modal-btn" });
      open.addEventListener("click", () => this.openRow(entry.path));
      const recheck = actions.createEl("button", { text: "Re-check", cls: "qt-modal-btn" });
      recheck.addEventListener("click", () => {
        this.ready = this.recheckRow(entry.path);
      });
      const accept = actions.createEl("button", { text: "Accept stored", cls: "qt-modal-btn" });
      accept.addEventListener("click", () => {
        this.ready = this.acceptRow(entry.path);
      });
      const drop = actions.createEl("button", { text: "Drop", cls: "qt-modal-btn" });
      drop.addEventListener("click", () => {
        this.ready = this.dropRow(entry.path);
      });
    }
    if (!flagged.length) el.createDiv({ cls: "qt-hint", text: "Nothing is flagged: every checked answer matched." });
    const footer = el.createDiv({ cls: "qt-row" });
    const all = footer.createEl("button", { text: "Re-check all", cls: "mod-cta qt-grow" });
    all.disabled = !flagged.length || this.busy;
    all.addEventListener("click", () => {
      this.ready = this.recheckAllRows();
    });
    const close = footer.createEl("button", { text: "Close", cls: "qt-grow" });
    close.addEventListener("click", () => this.close());
  }

  status(message) {
    if (this.statusEl) this.statusEl.setText(message);
  }

  /**
   * The vault index re-reads a rewritten note asynchronously, so a refresh
   * straight after a row action can list the old verdict. Wait until the
   * index reports the verdict this action just wrote (or a short bound).
   */
  async settleVerdict(path, want) {
    const target = str(want).trim().toLowerCase();
    if (!target) return;
    const end = Date.now() + 6000;
    for (;;) {
      let seen = "";
      try {
        const file = this.app.vault.getAbstractFileByPath(str(path));
        const cache =
          file && this.app.metadataCache && typeof this.app.metadataCache.getFileCache === "function"
            ? this.app.metadataCache.getFileCache(file)
            : null;
        seen = str(cache && cache.frontmatter && cache.frontmatter.verification).trim().toLowerCase();
      } catch (e) {
        /* the index is still catching up */
      }
      if (seen === target || Date.now() > end) return;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  /** Same wait for a dropped note: refresh only once the path is gone. */
  async settleGone(path) {
    const end = Date.now() + 6000;
    for (;;) {
      let gone = false;
      try {
        gone = !this.app.vault.getAbstractFileByPath(str(path));
      } catch (e) {
        gone = false;
      }
      if (gone || Date.now() > end) return;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  openRow(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file && this.app.workspace && typeof this.app.workspace.getLeaf === "function") {
      this.app.workspace.getLeaf("tab").openFile(file);
    }
  }

  async acceptRow(path) {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.plugin.acceptFlaggedAnswer(path);
      await this.settleVerdict(path, "match");
      new Notice("The stored answer stands; the flag is cleared.");
    } catch (e) {
      new Notice(`Couldn't accept that answer: ${e && e.message ? e.message : e}`, 8000);
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  async dropRow(path) {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.plugin.dropFlaggedAnswer(path);
      await this.settleGone(path);
      new Notice("Moved the flagged note to the trash.");
    } catch (e) {
      new Notice(`Couldn't drop that note: ${e && e.message ? e.message : e}`, 8000);
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  async recheckRow(path) {
    if (this.busy) return;
    this.busy = true;
    try {
      this.status("Asking the checker again...");
      const result = await this.plugin.recheckFlaggedAnswer(path);
      await this.settleVerdict(path, result && result.status);
      new Notice(result && result.match ? "The checker agrees with the note now." : "Still flagged: the checker disagrees.");
    } catch (e) {
      new Notice(`Couldn't re-check that note: ${e && e.message ? e.message : e}`, 8000);
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  async recheckAllRows() {
    if (this.busy) return { checked: 0, matched: 0, mismatched: 0 };
    this.busy = true;
    let outcome = { checked: 0, matched: 0, mismatched: 0 };
    try {
      this.status("Re-checking every flagged answer...");
      outcome = await this.plugin.recheckAllFlagged((n, total) => this.status(`Re-checked ${n} of ${total}...`));
      for (const item of (outcome && outcome.results) || []) {
        if (item && item.status && item.status !== "error") await this.settleVerdict(item.path, item.status);
      }
      const left = await this.plugin.flaggedAnswers();
      new Notice(
        left.length ? `${outcome.matched} now match, ${left.length} still flagged.` : "Every flagged answer matches now.",
        8000
      );
    } catch (e) {
      new Notice(`Couldn't re-check: ${e && e.message ? e.message : e}`, 8000);
    } finally {
      this.busy = false;
      await this.refresh();
    }
    return outcome;
  }
}

module.exports = { FlaggedAnswersModal };
