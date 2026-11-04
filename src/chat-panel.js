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
const { chatMarkdown } = require("./chat-history");

function toolsForMode(mode, agentShell) {
  if (mode === "tutor") return { edit: false, write: false, patch: false, bash: false };
  if (mode === "agent" && agentShell !== true) return { bash: false };
  return null;
}

class ChatPanel {
  /**
   * opts: { title, sourcePath, getSessionId, setSessionId, getRole, setRole, buildContext(mode), beforeSend(text), quick: [{label,prompt,run}], onSaveNote(text), saveNoteLabel, onSaveChat(markdown), getApiHistory(), saveApiHistory(history), copyText(text) }
   */
  constructor(view, root, opts) {
    this.view = view;
    this.root = root;
    this.opts = opts;
    this.busy = false;
    this.apiCancelToken = 0;
    this.turns = [];
    this.pending = "";
    this.error = "";
    this.sig = "";
    this.streamText = "";
    this.streamingController = null;
    this.keepPartial = "";
    this.lastSent = "";
    this.cancelled = false;
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
    nc.addEventListener("click", () => this.newChat());
    if (this.opts.onSaveChat) {
      const save = top.createEl("button", { text: "Save chat" });
      save.addEventListener("click", () => this.saveChat());
    }
    this.hint = root.createDiv({ cls: "qt-hint" });
    this.updateHint();
    this.renderContextToggles(root);
    this.renderLibrary(root);

    if (this.opts.quick && this.opts.quick.length) {
      const chips = root.createDiv({ cls: "qt-chips" });
      for (const q of this.opts.quick) {
        const c = chips.createEl("button", { text: q.label, cls: "qt-chip" });
        c.addEventListener("click", () => {
          if (this.busy) return;
          if (typeof q.run === "function") q.run.call(this);
          else this.send(q.prompt);
        });
      }
    }

    this.transcript = root.createDiv({ cls: "qt-chat" });
    this.status = root.createDiv({ cls: "qt-hint" });
    this.thinkFirstNote = root.createDiv({ cls: "qt-hint qt-think-first qt-hidden", text: "" });

    const row = root.createDiv({ cls: "qt-row" });
    this.input = row.createEl("textarea", {
      cls: "qt-chat-input",
      attr: { rows: "2", placeholder: "Ask a question... (Enter to send, Shift+Enter for a new line)" },
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.busy) {
        e.preventDefault();
        this.stop();
        return;
      }
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      this.send(this.input.value);
    });
    this.sendBtn = row.createEl("button", { text: "Send", cls: "mod-cta" });
    this.sendBtn.addEventListener("click", () => this.send(this.input.value));
    this.stopBtn = row.createEl("button", { text: "Stop" });
    this.stopBtn.addClass("qt-hidden");
    this.stopBtn.addEventListener("click", () => this.stop());
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
    this.stopBtn.toggleClass("qt-hidden", !b);
    this.sendBtn.disabled = b || this.thinkFirstRemaining() > 0;
    this.status.setText(b ? "Working..." : "");
  }

  /** Stop a Direct API reply mid-stream; the partial reply is kept once. */
  cancelApi() {
    const partial = this.streamText.trim();
    this.apiCancelToken = (this.apiCancelToken || 0) + 1;
    if (this.streamingController) {
      try {
        this.streamingController.abort();
      } catch (e) {
        /* already finished */
      }
    }
    this.streamingController = null;
    if (partial) {
      const hist = this.apiHistory();
      if (this.lastSent && (!hist.length || hist[hist.length - 1].role !== "user")) hist.push({ role: "user", content: this.lastSent });
      hist.push({ role: "assistant", content: partial });
      this.persistApiHistory();
      this.turns = apiTurns(hist);
    }
    this.streamText = "";
    this.keepPartial = "";
    this.pending = "";
    this.error = partial ? "" : "Stopped waiting for the reply.";
    this.setBusy(false);
    if (this.status) this.status.setText(partial ? "Stopped. The partial reply was kept." : "Stopped waiting for the reply.");
    this.draw();
  }

  /** The Stop button and Esc: cancel the current backend, keeping any partial reply. */
  async stop() {
    if (this.view.plugin.backend() === "api") {
      this.cancelApi();
      return;
    }
    this.cancelled = true;
    this.keepPartial = this.streamText.trim();
    this.streamText = "";
    if (this.streamingController) {
      try {
        this.streamingController.abort();
      } catch (e) {
        /* already finished */
      }
    }
    this.streamingController = null;
    const sid = this.opts.getSessionId();
    if (sid) {
      try {
        await this.view.plugin.openCode().abort(sid);
      } catch (e) {
        /* the server may already have finished */
      }
    }
    this.setBusy(false);
    if (this.status) this.status.setText("Stopped.");
    this.draw();
  }

  newChat() {
    if (this.busy) return;
    if (typeof this.opts.onNewChat === "function") {
      this.opts.onNewChat();
      return;
    }
    this.opts.setSessionId("");
    this.apiHistory().length = 0;
    this.persistApiHistory();
    this.loadConversation([]);
  }

  /** Replace the transcript without touching the stored history (the caller owns it). */
  loadConversation(messages) {
    this.turns = apiTurns(Array.isArray(messages) ? messages : []);
    this.pending = "";
    this.error = "";
    this.streamText = "";
    this.keepPartial = "";
    this.lastSent = "";
    this.sig = "";
    this.startThinkFirst();
    this.draw();
  }

  /** The in-panel conversation list; only the caller decides where conversations live. */
  renderLibrary(root) {
    if (typeof this.opts.getLibrary !== "function") return;
    this.libraryWrap = root.createDiv({ cls: "qt-chat-library" });
    this.libraryWrap.createDiv({ cls: "qt-hint", text: "Conversations (newest first)" });
    this.libraryList = this.libraryWrap.createDiv({ cls: "qt-chat-library-list" });
    const row = this.libraryWrap.createDiv({ cls: "qt-row qt-small-row" });
    this.libraryTitle = row.createEl("input", {
      type: "text",
      attr: { "aria-label": "Conversation title", placeholder: "Conversation title" },
    });
    const rename = row.createEl("button", { text: "Rename" });
    rename.addEventListener("click", () => this.renameActive());
    const remove = row.createEl("button", { text: "Delete" });
    remove.addEventListener("click", () => this.deleteActive());
    this.refreshLibrary();
  }

  refreshLibrary() {
    if (!this.libraryList) return;
    const rows = this.libraryRows();
    this.libraryList.empty?.();
    if (!rows.length) {
      this.libraryList.createDiv({ cls: "qt-hint", text: "No saved conversations yet." });
      return;
    }
    for (const row of rows) {
      const item = this.libraryList.createDiv({ cls: `qt-chat-library-row${row.active ? " is-active" : ""}` });
      const open = item.createEl("button", {
        cls: "qt-chat-library-open",
        text: `${row.title}${row.when ? ` — ${row.when}` : ""}`,
      });
      open.addEventListener("click", () => this.openLibraryRow(row));
    }
  }

  libraryRows() {
    try {
      const rows = typeof this.opts.getLibrary === "function" ? this.opts.getLibrary() : [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }

  activeLibraryRow() {
    return this.libraryRows().find((row) => row.active) || null;
  }

  openLibraryRow(row) {
    if (this.busy || !row || row.active) return;
    if (typeof this.opts.onResumeChat === "function") this.opts.onResumeChat(row.id);
    this.refreshLibrary();
  }

  renameActive() {
    const row = this.activeLibraryRow();
    const title = str(this.libraryTitle && this.libraryTitle.value).trim();
    if (!row || !title) {
      if (this.status) this.status.setText(row ? "Type a title first." : "Open a conversation first.");
      return;
    }
    if (typeof this.opts.onRenameChat === "function") this.opts.onRenameChat(row.id, title);
    if (this.libraryTitle) this.libraryTitle.value = "";
    this.refreshLibrary();
  }

  deleteActive() {
    const row = this.activeLibraryRow();
    if (!row) {
      if (this.status) this.status.setText("Open a conversation first.");
      return;
    }
    if (typeof this.opts.onDeleteChat === "function") this.opts.onDeleteChat(row.id);
    this.refreshLibrary();
  }

  /** Copy one reply (or a transcript) through the caller's clipboard, when it has one. */
  async copyText(text) {
    const value = str(text).trim();
    if (!value) return;
    try {
      if (typeof this.opts.copyText === "function") {
        await this.opts.copyText(value);
      } else {
        const nav = typeof navigator === "undefined" ? null : navigator;
        if (!nav || !nav.clipboard || typeof nav.clipboard.writeText !== "function") {
          throw new Error("Clipboard is not available here.");
        }
        await nav.clipboard.writeText(value);
      }
      if (this.status) this.status.setText("Copied to the clipboard.");
    } catch (e) {
      new Notice("Could not copy to the clipboard. Select the text and copy it instead.", 7000);
    }
  }

  persistApiHistory() {
    if (typeof this.opts.saveApiHistory !== "function") return;
    try {
      this.opts.saveApiHistory(this.apiHistory());
    } catch (e) {
      /* persistence is best effort; the conversation still works in memory */
    }
  }

  transcriptMarkdown() {
    return chatMarkdown(
      this.turns.concat(this.pending ? [{ role: "user", texts: [this.pending], tools: [] }] : []),
      { title: this.opts.title || "Study agent chat" }
    );
  }

  async saveChat() {
    if (typeof this.opts.onSaveChat !== "function") return;
    const text = this.transcriptMarkdown();
    if (!text) {
      if (this.status) this.status.setText("There is nothing to save yet.");
      return;
    }
    try {
      await this.opts.onSaveChat(text);
    } catch (e) {
      new Notice(str(e && e.message ? e.message : e) || "Could not save the chat.", 8000);
    }
  }

  /** Ask the same last question again without adding a second user turn. */
  async regenerate() {
    if (this.busy || !this.ai.enabled) return;
    const last = [...this.turns].reverse().find((turn) => turn.role === "user");
    const text = last ? last.texts.join("\n\n").trim() : "";
    if (!text) {
      if (this.status) this.status.setText("There is no question to regenerate yet.");
      return;
    }
    return this.resend(text);
  }

  async resend(text) {
    const value = str(text).trim();
    if (!value || this.busy) return;
    this.error = "";
    this.lastSent = value;
    if (this.view.plugin.backend() === "api") {
      const hist = this.apiHistory();
      while (hist.length && hist[hist.length - 1].role !== "user") hist.pop();
      this.turns = apiTurns(hist);
      this.persistApiHistory();
      return this.sendApi(value, "", true);
    }
    return this.send(value);
  }

  /** Retry the last question after a failure, without retyping it. */
  async retry() {
    if (this.busy || !this.lastSent) return;
    const text = this.lastSent;
    const last = this.turns[this.turns.length - 1];
    this.error = "";
    if (last && last.role === "assistant") return this.resend(text);
    return this.send(text);
  }

  /** Quick action: make sure the active note is sent, then ask about it. */
  async askAboutActiveNote(prompt) {
    if (this.busy || !this.ai.enabled) return;
    let raw = null;
    try {
      raw = this.opts.readNoteContext ? await this.opts.readNoteContext() : null;
    } catch (e) {
      raw = null;
    }
    if (!raw || !str(raw.path)) {
      if (this.status) this.status.setText("Open a note first.");
      return;
    }
    this.includeNote = true;
    this.includeSelection = false;
    this.paintContext();
    return this.send(prompt || "Explain the key ideas in this note and how they connect. Cite the note.");
  }

  async send(text) {
    text = str(text).trim();
    if (!text || this.busy || !this.ai.enabled) return;
    this.lastSent = text;
    this.streamText = "";
    this.keepPartial = "";
    this.cancelled = false;
    if (this.thinkFirstRemaining() > 0) {
      this.refreshThinkFirst();
      return;
    }
    if (this.opts.beforeSend) {
      try {
        await this.opts.beforeSend(text);
      } catch (e) {
        /* retrieval is best effort; the chat request still goes through */
      }
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
      this.streamText = "";
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      this.streamingController = controller;
      if (typeof oc.stream === "function") {
        await oc.stream(sid, body, {
          onDelta: (delta) => {
            if (this.streamingController !== controller) return;
            this.streamText += str(delta);
            this.draw();
          },
          signal: controller ? controller.signal : undefined,
        });
      } else {
        await oc.send(sid, body);
      }
    } catch (e) {
      const stopped = this.cancelled || (e && (e.name === "AbortError" || (this.streamingController && this.streamingController.signal && this.streamingController.signal.aborted)));
      if (stopped) this.keepPartial = this.streamText.trim();
      else this.error = friendlyError(e, plugin.openCode().base());
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
      this.streamingController = null;
      if (sid) await this.refresh(sid);
      else this.draw();
      this.streamText = "";
      this.keepPartial = "";
      this.draw();
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

  async sendApi(text, currentNote, resend) {
    this.error = "";
    this.input.value = "";
    this.pending = text;
    const token = (this.apiCancelToken = (this.apiCancelToken || 0) + 1);
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    this.streamingController = controller;
    this.streamText = "";
    this.setBusy(true);
    this.draw();
    const hist = this.apiHistory();
    const agent = this.ai.mode === "agent";
    const last = hist[hist.length - 1];
    const base = hist.concat(resend && last && last.role === "user" ? [] : [{ role: "user", content: text }]);
    let proposals = [];
    let partial = "";
    const onDelta = (delta) => {
      if (token !== this.apiCancelToken) return;
      const chunk = str(delta);
      if (!chunk) return;
      partial += chunk;
      this.streamText = partial;
      this.draw();
    };
    try {
      const system = [this.opts.buildContext(agent ? "agent" : "tutor", currentNote), agent ? toolProtocol() : ""]
        .filter(Boolean)
        .join("\n\n");
      const reply = await this.view.plugin.aiChat(system, base, {
        feature: "chat",
        onDelta,
        signal: controller ? controller.signal : undefined,
      });
      if (token !== this.apiCancelToken) return;
      const finalText = str(reply).trim() || partial.trim();
      if (!finalText) throw new Error("The provider returned an empty reply.");
      hist.push(...(resend ? [] : [{ role: "user", content: text }]), { role: "assistant", content: finalText });
      this.persistApiHistory();
      this.pending = "";
      this.streamText = "";
      if (agent && typeof this.view.plugin.parseByokToolProposals === "function") {
        const parsed = this.view.plugin.parseByokToolProposals(finalText);
        proposals = parsed.proposals;
        if (parsed.errors.length) new Notice(`Some AI actions were ignored: ${parsed.errors.join(" ")}`, 8000);
      }
    } catch (e) {
      if (token !== this.apiCancelToken) return;
      const stopped = e && (e.name === "AbortError" || (controller && controller.signal && controller.signal.aborted));
      const kept = partial.trim();
      if (kept) {
        if (!resend) hist.push({ role: "user", content: text });
        else if (!hist.length || hist[hist.length - 1].role !== "user") hist.push({ role: "user", content: text });
        hist.push({ role: "assistant", content: kept });
        this.persistApiHistory();
        this.turns = apiTurns(hist);
      }
      this.pending = "";
      this.streamText = "";
      this.error = stopped ? "" : friendlyApiError(e);
      if (stopped && this.status) this.status.setText(kept ? "Stopped. The partial reply was kept." : "Stopped.");
      if (!stopped && !kept) this.input.value = text;
    } finally {
      if (token === this.apiCancelToken) {
        this.streamingController = null;
        this.setBusy(false);
        this.turns = apiTurns(hist);
        this.draw();
        if (proposals.length) new AiToolReviewModal(this.view.app, this.view.plugin, proposals).open();
      }
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
      if (this.keepPartial && !this.turns.some((turn) => turn.role === "assistant" && turn.texts.join("\n").includes(this.keepPartial))) {
        this.turns.push({ role: "assistant", texts: [this.keepPartial], tools: [] });
      }
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
    const sig = JSON.stringify([this.turns, this.pending, this.error, this.busy, this.streamText]);
    if (sig === this.sig) return;
    this.sig = sig;
    const box = this.transcript;
    box.empty();
    for (const t of this.turns) {
      const b = box.createDiv({ cls: `qt-msg is-${t.role}` });
      for (const text of t.texts) this.view.md(text, b.createDiv({ cls: "qt-msg-text" }), this.opts.sourcePath || "");
      for (const line of t.tools) b.createDiv({ cls: "qt-tool", text: line });
      if (t.role === "assistant" && t.texts.length && !this.busy) {
        const actions = b.createDiv({ cls: "qt-msg-actions" });
        const copy = actions.createEl("button", { text: "Copy" });
        copy.addEventListener("click", () => this.copyText(t.texts.join("\n\n")));
        if (this.opts.onSaveNote) {
          const sv = actions.createEl("button", {
            text: this.opts.saveNoteLabel || "Add to My Notes",
            cls: "qt-save-note",
          });
          sv.addEventListener("click", () => this.opts.onSaveNote(t.texts.join("\n\n")));
        }
        if (t === [...this.turns].reverse().find((turn) => turn.role === "assistant")) {
          const again = actions.createEl("button", { text: "Regenerate" });
          again.addEventListener("click", () => this.regenerate());
        }
      }
    }
    if (this.pending) {
      box.createDiv({ cls: "qt-msg is-user" }).createDiv({ cls: "qt-msg-text", text: this.pending });
    }
    if (this.streamText) {
      const live = box.createDiv({ cls: "qt-msg is-assistant is-streaming" });
      this.view.md(this.streamText, live.createDiv({ cls: "qt-msg-text" }), this.opts.sourcePath || "");
    }
    if (this.error) {
      const boxed = box.createDiv({ cls: "qt-error", text: this.error });
      if (this.lastSent && !this.busy) {
        const retry = boxed.createEl("button", { text: "Retry" });
        retry.addEventListener("click", () => this.retry());
      }
    }
    box.scrollTop = box.scrollHeight;
  }
}

ChatPanel.toolsForMode = toolsForMode;

module.exports = {
  ChatPanel,
  toolsForMode,
};
