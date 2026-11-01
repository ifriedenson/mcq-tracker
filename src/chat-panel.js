"use strict";
const { Notice } = require("obsidian");
const { apiTurns, friendlyApiError } = require("./api-client");
const { str } = require("./util");
const { friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { TUTOR_COMMANDS, TUTOR_ROLES, normalizeTutorRole, tutorRole } = require("./tutor-presets");
const { buildCurrentNoteContext } = require("./note-context");
const { thinkFirstLabel, thinkFirstRemainingMs } = require("./think-first");
const { AgentEditReviewModal } = require("./agent-edit-review-modal");
const { AiToolReviewModal } = require("./ai-tool-review-modal");
const { toolProtocol } = require("./ai-tools");

function toolsForMode(mode, agentShell) {
  if (mode === "tutor") return { edit: false, write: false, patch: false, bash: false };
  if (mode === "agent" && agentShell !== true) return { bash: false };
  return null;
}

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

  /** One countdown per chat session; New chat starts a fresh one. */
  startThinkFirst() {
    this.stopThinkFirstTicker();
    this.thinkFirstStartedAt = this.ai.thinkFirst === true ? Date.now() : 0;
    this.thinkFirstStatus = false;
    if (this.status && !this.busy) this.status.setText("");
    this.refreshThinkFirst();
    if (this.ai.thinkFirst === true && this.thinkFirstRemaining() > 0) {
      this.thinkFirstTicker = activeWindow.setInterval(() => this.refreshThinkFirst(), 250);
      if (this.view && typeof this.view.registerInterval === "function") this.view.registerInterval(this.thinkFirstTicker);
    }
  }

  stopThinkFirstTicker() {
    if (!this.thinkFirstTicker) return;
    activeWindow.clearInterval(this.thinkFirstTicker);
    this.thinkFirstTicker = 0;
  }

  thinkFirstRemaining(now) {
    if (this.ai.thinkFirst !== true) return 0;
    const current = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if (!this.thinkFirstStartedAt) this.thinkFirstStartedAt = current;
    return thinkFirstRemainingMs(this.thinkFirstStartedAt, this.ai.thinkFirstSeconds, current);
  }

  thinkFirstText(now) {
    const remaining = this.thinkFirstRemaining(now);
    return remaining > 0 ? thinkFirstLabel(remaining) : "";
  }

  refreshThinkFirst(now) {
    if (!this.thinkFirstNote) return;
    const remaining = this.thinkFirstRemaining(now);
    const waiting = this.ai.thinkFirst === true && remaining > 0;
    this.thinkFirstNote.toggleClass("qt-hidden", !waiting);
    this.thinkFirstNote.setText(waiting ? thinkFirstLabel(remaining) : "");
    if (this.sendBtn) this.sendBtn.disabled = this.busy || waiting;
    if (waiting) {
      this.thinkFirstStatus = true;
      if (this.status && !this.busy) this.status.setText(`Think first: ${Math.ceil(remaining / 1000)}s remaining.`);
      return;
    }
    if (this.thinkFirstStatus && this.status && !this.busy) this.status.setText("");
    this.thinkFirstStatus = false;
    this.stopThinkFirstTicker();
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
    const modeSel = top.createEl("select", { cls: "qt-select" });
    modeSel.createEl("option", { value: "tutor", text: "Tutor (no file edits)" });
    modeSel.createEl("option", {
      value: "agent",
      text: this.view.plugin.backend() === "api" ? "Agent (allow-listed notes)" : "Agent (can edit files)",
    });
    modeSel.value = this.ai.mode;
    modeSel.addEventListener("change", () => {
      this.ai.mode = modeSel.value;
      this.view.plugin.save();
      this.updateHint();
    });
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
      this.startThinkFirst();
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
    this.thinkFirstNote = root.createDiv({ cls: "qt-hint qt-think-first qt-hidden", text: "" });

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
    this.startThinkFirst();
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
      this.hint.setText(
        (this.ai.mode === "agent"
          ? "Direct API agent: it can propose new practice questions, cards and one safe body-section edit. Nothing is written until you review and apply the proposals."
          : "Direct API tutor: it can see this question, but has no access to your files.") + suffix
      );
      return;
    }
    this.hint.setText(
      (this.ai.mode === "agent"
        ? this.ai.reviewAgentEdits === false
          ? "Agent mode: OpenCode may read and edit files immediately. Edit review is turned off in settings. Shell commands are off unless you enable them."
          : "Agent mode: OpenCode can read the vault. Edits to your question, card and deck notes, plus the current note, are paused for your review before they are applied. Other files and shell commands are not covered by that review. Shell commands are off unless you enable them."
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
    this.stopBtn.toggleClass("qt-hidden", !(b && this.view.plugin.backend() !== "api"));
    this.sendBtn.disabled = b || this.thinkFirstRemaining() > 0;
    this.status.setText(b ? "Working..." : "");
  }

  async send(text) {
    text = str(text).trim();
    if (!text || this.busy || !this.ai.enabled) return;
    if (this.thinkFirstRemaining() > 0) {
      this.refreshThinkFirst();
      return;
    }
    const currentNote = await this.prepareContext();
    if (this.view.plugin.backend() === "api") return this.sendApi(text, currentNote);
    const plugin = this.view.plugin;
    const ai = this.ai;
    const reviewAgent = ai.mode === "agent" && ai.reviewAgentEdits !== false;
    let baseline = null;
    if (reviewAgent && typeof plugin.captureAgentBaseline === "function") {
      const active = plugin.app && plugin.app.workspace && plugin.app.workspace.getActiveFile ? plugin.app.workspace.getActiveFile() : null;
      try {
        baseline = await plugin.captureAgentBaseline([this.opts.sourcePath, active && active.path]);
      } catch (e) {
        this.error = `Could not prepare the agent edit review, so nothing was sent. ${str(e && e.message ? e.message : e)}`;
        this.draw();
        return;
      }
    }
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
      const tools = toolsForMode(ai.mode, ai.agentShell);
      if (tools) body.tools = tools;
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
      let staged = [];
      if (baseline && typeof plugin.stageAgentEdits === "function") {
        try {
          staged = await plugin.stageAgentEdits(baseline);
        } catch (e) {
          this.error = `Could not stage the agent's edits: ${str(e && e.message ? e.message : e)}`;
          new Notice(this.error, 10000);
        }
      }
      this.setBusy(false);
      if (sid) await this.refresh(sid);
      else this.draw();
      if (staged.length) {
        new AgentEditReviewModal(this.view.app, plugin, staged).open();
        if (this.status) {
          this.status.setText(
            `Agent changes to ${staged.length} note${staged.length === 1 ? "" : "s"} are paused. Review them before applying.`
          );
        }
      }
    }
  }

  async sendApi(text, currentNote) {
    this.error = "";
    this.input.value = "";
    this.pending = text;
    this.setBusy(true);
    this.draw();
    const hist = this.apiHistory();
    const agent = this.ai.mode === "agent";
    let proposals = [];
    try {
      const system = [this.opts.buildContext(agent ? "agent" : "tutor", currentNote), agent ? toolProtocol() : ""]
        .filter(Boolean)
        .join("\n\n");
      const reply = await this.view.plugin.aiChat(system, hist.concat([{ role: "user", content: text }]), { feature: "chat" });
      hist.push({ role: "user", content: text }, { role: "assistant", content: reply });
      this.pending = "";
      if (agent && typeof this.view.plugin.parseByokToolProposals === "function") {
        const parsed = this.view.plugin.parseByokToolProposals(reply);
        proposals = parsed.proposals;
        if (parsed.errors.length) new Notice(`Some AI actions were ignored: ${parsed.errors.join(" ")}`, 8000);
      }
    } catch (e) {
      this.error = friendlyApiError(e);
      this.pending = "";
      this.input.value = text; // keep it so you can retry
    } finally {
      this.setBusy(false);
      this.turns = apiTurns(hist);
      this.draw();
      if (proposals.length) new AiToolReviewModal(this.view.app, this.view.plugin, proposals).open();
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

ChatPanel.toolsForMode = toolsForMode;

module.exports = {
  ChatPanel,
  toolsForMode,
};
