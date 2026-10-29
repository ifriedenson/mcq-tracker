"use strict";
const { Notice } = require("obsidian");
const { ApiClient, apiTurns, friendlyApiError } = require("./api-client");
const { str } = require("./util");
const { friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { TUTOR_COMMANDS, TUTOR_ROLES, normalizeTutorRole, tutorRole } = require("./tutor-presets");
const { buildCurrentNoteContext } = require("./note-context");

class ChatPanel {
  /**
   * opts: { title, sourcePath, getSessionId, setSessionId, getRole, setRole, buildContext(mode), quick: [{label,prompt}], onSaveNote(text) }
   */
  constructor(view, root, opts) {
    this.view = view;
    this.root = root;
    this.opts = opts;
    this.busy = false;
    this.turns = [];
    this.pending = "";
    this.error = "";
    this.sig = "";
    this.includeNote = false;
    this.includeSelection = false;
    this.currentNoteContext = "";
    this.build();
    if (this.view.plugin.backend() === "api") {
      this.turns = apiTurns(this.apiHistory());
      this.draw();
    } else if (this.ai.enabled && opts.getSessionId() && this.serverReady()) this.refresh();
  }

  get ai() {
    return this.view.plugin.settings.ai;
  }

  serverReady() {
    return this.view.plugin.backend() === "api" || !this.ai.managed || this.view.plugin.manager.isRunning();
  }

  apiHistory() {
    if (this.opts.getApiHistory) return this.opts.getApiHistory();
    return (this._h = this._h || []);
  }

  build() {
    const root = this.root;
    root.empty();
    if (!this.ai.enabled) {
      root.createDiv({
        cls: "qt-hint",
        text: "OpenCode is turned off. Enable it in Settings > MCQ Tracker > OpenCode (AI).",
      });
      return;
    }

    const top = root.createDiv({ cls: "qt-row qt-small-row" });
    if (this.view.plugin.backend() !== "api") {
      const modeSel = top.createEl("select", { cls: "qt-select" });
      modeSel.createEl("option", { value: "tutor", text: "Tutor (no file edits)" });
      modeSel.createEl("option", { value: "agent", text: "Agent (can edit files)" });
      modeSel.value = this.ai.mode;
      modeSel.addEventListener("change", () => {
        this.ai.mode = modeSel.value;
        this.view.plugin.save();
        this.updateHint();
      });
    }
    const role = top.createEl("select", { cls: "qt-select", attr: { "aria-label": "Tutor role", title: "Tutor role" } });
    for (const item of TUTOR_ROLES) role.createEl("option", { value: item.id, text: item.label });
    role.value = this.currentRole();
    role.addEventListener("change", () => this.setRole(role.value));
    const nc = top.createEl("button", { text: "New chat" });
    nc.addEventListener("click", () => {
      if (this.busy) return;
      this.opts.setSessionId("");
      this.apiHistory().length = 0;
      this.turns = [];
      this.pending = "";
      this.error = "";
      this.sig = "";
      this.includeNote = false;
      this.includeSelection = false;
      this.currentNoteContext = "";
      this.paintContext();
      this.draw();
    });
    this.hint = root.createDiv({ cls: "qt-hint" });
    this.updateHint();
    this.renderContextToggles(root);

    if (this.opts.quick && this.opts.quick.length) {
      const chips = root.createDiv({ cls: "qt-chips" });
      for (const q of this.opts.quick) {
        const c = chips.createEl("button", { text: q.label, cls: "qt-chip" });
        c.addEventListener("click", () => this.send(q.prompt));
      }
    }

    this.transcript = root.createDiv({ cls: "qt-chat" });
    this.status = root.createDiv({ cls: "qt-hint" });

    const row = root.createDiv({ cls: "qt-row" });
    this.input = row.createEl("textarea", {
      cls: "qt-chat-input",
      attr: { rows: "2", placeholder: "Ask a question... (Ctrl/Cmd+Enter to send)" },
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.send(this.input.value);
      }
    });
    this.sendBtn = row.createEl("button", { text: "Send", cls: "mod-cta" });
    this.sendBtn.addEventListener("click", () => this.send(this.input.value));
    this.stopBtn = row.createEl("button", { text: "Stop" });
    this.stopBtn.addClass("qt-hidden");
    this.stopBtn.addEventListener("click", async () => {
      const sid = this.opts.getSessionId();
      if (!sid) return;
      try {
        await this.view.plugin.openCode().abort(sid);
      } catch (e) {
        /* ignore */
      }
    });
    const commandRow = root.createDiv({ cls: "qt-row qt-small-row qt-tutor-commands" });
    const command = commandRow.createEl("select", { cls: "qt-select", attr: { "aria-label": "Insert a tutor command", title: "Insert a tutor command" } });
    command.createEl("option", { value: "", text: "Tutor commands..." });
    for (const item of TUTOR_COMMANDS) command.createEl("option", { value: item.id, text: `/${item.id} — ${item.label}` });
    command.addEventListener("change", () => {
      const chosen = TUTOR_COMMANDS.find((item) => item.id === command.value);
      if (chosen) {
        this.input.value = `/${chosen.id} `;
        this.input.focus();
      }
      command.value = "";
    });
    this.draw();
  }

  currentRole() {
    return normalizeTutorRole(this.opts.getRole ? this.opts.getRole() : "private");
  }

  setRole(id) {
    const next = normalizeTutorRole(id);
    if (this.opts.setRole) this.opts.setRole(next);
    this.updateHint();
  }

  updateHint() {
    if (!this.hint) return;
    const role = tutorRole(this.currentRole());
    const suffix = ` Role: ${role.label}. Commands: ${TUTOR_COMMANDS.map((c) => `/${c.id}`).join(", ")}.`;
    if (this.view.plugin.backend() === "api") {
      this.hint.setText("Direct API chat: it can see this question, but has no access to your files." + suffix);
      return;
    }
    this.hint.setText(
      (this.ai.mode === "agent"
        ? "Agent mode: OpenCode may read and edit files in its working folder. Edits that need approval in your OpenCode permissions will wait until you press Stop."
        : "Tutor mode: file-editing tools are switched off for this chat.") + suffix
    );
  }

  /** Per-chat context switches. Nothing is read or sent while both are off. */
  renderContextToggles(root) {
    if (!this.opts.readNoteContext) return;
    const wrap = root.createDiv({ cls: "qt-chips qt-chat-context" });
    this.noteChip = wrap.createEl("button", { cls: "qt-chip", text: "Include current note" });
    this.selectionChip = wrap.createEl("button", { cls: "qt-chip", text: "Include selection" });
    this.noteChip.addEventListener("click", () => {
      this.includeNote = !this.includeNote;
      this.currentNoteContext = "";
      this.paintContext();
    });
    this.selectionChip.addEventListener("click", () => {
      this.includeSelection = !this.includeSelection;
      this.currentNoteContext = "";
      this.paintContext();
    });
    root.createDiv({
      cls: "qt-hint",
      text: "Off by default. Note text and selected text are sent only while their switch is on, and notes are treated as untrusted data.",
    });
    this.paintContext();
  }

  paintContext() {
    if (this.noteChip) this.noteChip.toggleClass("is-selected", this.includeNote);
    if (this.selectionChip) this.selectionChip.toggleClass("is-selected", this.includeSelection);
  }

  async prepareContext() {
    if (!this.opts.readNoteContext || (!this.includeNote && !this.includeSelection)) {
      this.currentNoteContext = "";
      return "";
    }
    let raw = null;
    try {
      raw = await this.opts.readNoteContext();
    } catch (e) {
      this.currentNoteContext = "";
      if (this.status) this.status.setText("Could not read the current note.");
      return "";
    }
    this.currentNoteContext = buildCurrentNoteContext(raw, {
      note: this.includeNote,
      selection: this.includeSelection,
    });
    if (!this.currentNoteContext && this.status) {
      this.status.setText(this.includeSelection && !this.includeNote ? "Select some text in a note first." : "Open a note first.");
    }
    return this.currentNoteContext;
  }

  setBusy(b) {
    this.busy = b;
    if (!this.sendBtn) return;
    this.sendBtn.disabled = b;
    this.stopBtn.toggleClass("qt-hidden", !(b && this.view.plugin.backend() !== "api"));
    this.status.setText(b ? "Working..." : "");
  }

  async send(text) {
    text = str(text).trim();
    if (!text || this.busy || !this.ai.enabled) return;
    const currentNote = await this.prepareContext();
    if (this.view.plugin.backend() === "api") return this.sendApi(text, currentNote);
    const plugin = this.view.plugin;
    const ai = this.ai;
    const guard = ai.mode === "agent" && typeof plugin.snapshotProtectedState === "function" ? plugin.snapshotProtectedState() : null;
    this.error = "";
    this.input.value = "";
    this.pending = text;
    this.setBusy(true);
    this.draw();
    let sid = this.opts.getSessionId();
    let timer = null;
    try {
      // First use: offers to download OpenCode, then starts it in the background.
      if (ai.managed) await plugin.ensureOpenCode((m) => this.status.setText(m));
      const oc = plugin.openCode();
      if (sid) {
        try {
          await oc.messages(sid);
        } catch (e) {
          sid = ""; // the old session is gone (fresh install or server data cleared)
          this.opts.setSessionId("");
          this.turns = [];
        }
      }
      if (ai.managed) await this.checkProvider(oc);
      if (!sid) {
        const s = await oc.createSession(this.opts.title || "MCQ Tracker");
        sid = s && s.id;
        if (!sid) throw new Error("OpenCode did not return a session id.");
        this.opts.setSessionId(sid);
      }
      this.status.setText("OpenCode is working...");
      const body = {
        parts: [{ type: "text", text }],
        system: this.opts.buildContext(ai.mode, currentNote),
      };
      const model = modelFromString(ai.model);
      if (model) body.model = model;
      if (str(ai.agent).trim()) body.agent = ai.agent.trim();
      if (ai.mode === "tutor") body.tools = { edit: false, write: false, patch: false, bash: false };
      // The POST blocks until the reply is done, so poll the transcript meanwhile for live progress.
      const mySid = sid;
      timer = activeWindow.setInterval(() => this.refresh(mySid), 1500);
      await oc.send(sid, body);
    } catch (e) {
      this.error = friendlyError(e, plugin.openCode().base());
    } finally {
      if (timer) activeWindow.clearInterval(timer);
      if (guard && typeof plugin.restoreProtectedState === "function") {
        try {
          const restored = await plugin.restoreProtectedState(guard);
          if (restored.length) {
            new Notice(`Restored protected review state in ${restored.length} note${restored.length === 1 ? "" : "s"}.`, 6000);
          }
        } catch (e) {
          new Notice("Could not verify protected review state after the agent reply.", 7000);
        }
      }
      this.setBusy(false);
      if (sid) await this.refresh(sid);
      else this.draw();
    }
  }

  async sendApi(text, currentNote) {
    this.error = "";
    this.input.value = "";
    this.pending = text;
    this.setBusy(true);
    this.draw();
    const hist = this.apiHistory();
    try {
      const reply = await new ApiClient(this.ai).chat(
        this.opts.buildContext("tutor", currentNote),
        hist.concat([{ role: "user", content: text }])
      );
      hist.push({ role: "user", content: text }, { role: "assistant", content: reply });
      this.pending = "";
    } catch (e) {
      this.error = friendlyApiError(e);
      this.pending = "";
      this.input.value = text; // keep it so you can retry
    } finally {
      this.setBusy(false);
      this.turns = apiTurns(hist);
      this.draw();
    }
  }

  async checkProvider(oc) {
    let n = null;
    try {
      const cp = await oc.providers();
      if (cp && Array.isArray(cp.providers)) n = cp.providers.length;
    } catch (e) {
      return; // endpoint differs on this OpenCode version: let the request itself report problems
    }
    if (n === 0) {
      throw new Error(
        "OpenCode has no AI provider connected yet. Open Settings > MCQ Tracker > OpenCode (AI), choose a provider and paste an API key."
      );
    }
  }

  async refresh(sid) {
    sid = sid || this.opts.getSessionId();
    if (!sid || !this.serverReady()) return;
    try {
      const msgs = await this.view.plugin.openCode().messages(sid);
      this.turns = partsToTurns(msgs);
      const last = [...this.turns].reverse().find((t) => t.role === "user");
      if (this.pending && last && last.texts.join("\n").trim() === this.pending) this.pending = "";
      this.draw();
    } catch (e) {
      if (!this.busy) {
        this.error = friendlyError(e, this.view.plugin.openCode().base());
        this.draw();
      }
    }
  }

  draw() {
    if (!this.transcript) return;
    const sig = JSON.stringify([this.turns, this.pending, this.error, this.busy]);
    if (sig === this.sig) return;
    this.sig = sig;
    const box = this.transcript;
    box.empty();
    for (const t of this.turns) {
      const b = box.createDiv({ cls: `qt-msg is-${t.role}` });
      for (const text of t.texts) this.view.md(text, b.createDiv({ cls: "qt-msg-text" }), this.opts.sourcePath || "");
      for (const line of t.tools) b.createDiv({ cls: "qt-tool", text: line });
      if (t.role === "assistant" && t.texts.length && this.opts.onSaveNote && !this.busy) {
        const sv = b.createEl("button", { text: "Add to My Notes", cls: "qt-save-note" });
        sv.addEventListener("click", () => this.opts.onSaveNote(t.texts.join("\n\n")));
      }
    }
    if (this.pending) {
      box.createDiv({ cls: "qt-msg is-user" }).createDiv({ cls: "qt-msg-text", text: this.pending });
    }
    if (this.error) box.createDiv({ cls: "qt-error", text: this.error });
    box.scrollTop = box.scrollHeight;
  }
}

module.exports = {
  ChatPanel,
};
