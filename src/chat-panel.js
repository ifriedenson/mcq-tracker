"use strict";
const { Notice } = require("obsidian");
const { apiTurns, friendlyApiError } = require("./api-client");
const { str } = require("./util");
const { friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { TUTOR_COMMANDS, TUTOR_ROLES, normalizeTutorRole, tutorRole } = require("./tutor-presets");
const { parseStudyCommand, applyStudyCommand } = require("./study-commands");
const { buildCurrentNoteContext } = require("./note-context");
const { thinkFirstLabel, thinkFirstRemainingMs } = require("./think-first");
const { AgentEditReviewModal } = require("./agent-edit-review-modal");
const { AiToolReviewModal } = require("./ai-tool-review-modal");
const { toolProtocol } = require("./ai-tools");
const { chatMarkdown } = require("./chat-history");
const chatBudget = require("./chat-budget");
const chatMentions = require("./chat-mentions");
const chatModels = require("./chat-models");
const chatBookmarks = require("./chat-bookmarks");
const chatCompact = require("./chat-compact");
const chatQueue = require("./chat-queue");

function budgetRefusal(budget) {
  return `Nothing was sent: the estimated ${chatBudget.formatTokenCount(budget.tokens)}-token context is over the local ${chatBudget.formatTokenCount(budget.limit)}-token chat budget. Remove a mention or shorten the message.`;
}

function toolsForMode(mode, agentShell) {
  if (mode === "tutor") return { edit: false, write: false, patch: false, bash: false };
  if (mode === "agent" && agentShell !== true) return { bash: false };
  return null;
}

class ChatPanel {
  /**
   * opts: { title, sourcePath, getSessionId, setSessionId, getRole, setRole, buildContext(mode), beforeSend(text), quick: [{label,prompt,run}], onSaveNote(text), saveNoteLabel, onSaveChat(markdown), getApiHistory(), saveApiHistory(history), copyText(text), getCommands() }
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
    this.includeMentions = false;
    this.currentNoteContext = "";
    this.previewContext = "";
    this.previewMissing = [];
    this.previewWarnings = [];
    this.mentionResult = null;
    this.mentionRange = null;
    this.lastMentionKey = "";
    this.previewSeq = 0;
    this.lastBudget = null;
    this.queue = chatQueue.normalizeQueue(opts.getQueue ? opts.getQueue() : []);
    this.bookmarks = chatBookmarks.normalizeBookmarks(opts.getBookmarks ? opts.getBookmarks() : []);
    this.turnEls = [];
    this.draining = false;
    this.libraryQuery = "";
    this.showArchived = false;
    this.build();
    if (this.view.plugin.backend() === "api") {
      this.turns = apiTurns(this.apiHistory());
      this.draw();
      if (this.queue.length) Promise.resolve().then(() => this.drainQueue());
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
    if (this.sendBtn) this.sendBtn.disabled = waiting;
    if (waiting) {
      this.thinkFirstStatus = true;
      if (this.status && !this.busy) this.status.setText(`Think first: ${Math.ceil(remaining / 1000)}s remaining.`);
      return;
    }
    if (this.thinkFirstStatus && this.status && !this.busy) this.status.setText("");
    this.thinkFirstStatus = false;
    this.stopThinkFirstTicker();
    if (this.queue.length && !this.busy && !this.draining) this.drainQueue();
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
    this.modelSelect = top.createEl("select", {
      cls: "qt-select",
      attr: { "aria-label": "Chat model", title: "Model for this chat" },
    });
    this.renderModelSelect();
    this.modelSelect.addEventListener("change", () => {
      this.setChatModel(chatModels.normalizeModel(this.modelSelect.value));
      this.refreshTokenFooter();
    });
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
    this.mentionPicker = root.createDiv({ cls: "qt-chat-mention-picker qt-hidden" });
    this.queueEl = root.createDiv({ cls: "qt-chat-queue qt-hidden" });
    this.renderQueue();

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
    this.atBtn = row.createEl("button", { text: "@", attr: { "aria-label": "Attach a note or folder", title: "Attach a note or folder" } });
    this.atBtn.addEventListener("click", () => {
      const prefix = this.input.value && !/\s$/.test(this.input.value) ? " " : "";
      this.input.value = `${this.input.value}${prefix}@`;
      this.mentionRange = { start: this.input.value.length - 1, end: this.input.value.length };
      this.openMentionPicker("");
    });
    this.input.addEventListener("input", () => {
      const before = chatMentions.mentionQueryAt(this.input.value, this.input.value.length);
      if (before) this.openMentionPicker(before.query, before.start, before.end);
      else this.closeMentionPicker();
      this.syncMentionChips();
      this.refreshTokenFooter();
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
    const savedCommands = this.studyCommands();
    if (savedCommands.length) {
      const savedRow = root.createDiv({ cls: "qt-row qt-small-row qt-study-commands" });
      const saved = savedRow.createEl("select", { cls: "qt-select", attr: { "aria-label": "Insert a study command", title: "Insert a study command" } });
      saved.createEl("option", { value: "", text: "Study commands..." });
      for (const item of savedCommands) saved.createEl("option", { value: item.id, text: `/${item.id} — ${item.name}` });
      saved.addEventListener("change", () => {
        const chosen = savedCommands.find((item) => item.id === saved.value);
        if (chosen) {
          this.input.value = `/${chosen.id} `;
          this.input.focus();
        }
        saved.value = "";
      });
    }
    this.budgetEl = root.createDiv({ cls: "qt-chat-budget" });
    this.syncMentionChips();
    this.refreshTokenFooter();
    this.refreshContextPreview();
    this.startThinkFirst();
    this.renderModelSelect();
    this.refreshTokenFooter();
    this.draw();
  }

  chatModel() {
    if (typeof this.opts.getModel === "function") return chatModels.normalizeModel(this.opts.getModel());
    return chatModels.normalizeModel(this.ai.studyChatModel);
  }

  setChatModel(value) {
    const model = chatModels.normalizeModel(value);
    if (typeof this.opts.setModel === "function") this.opts.setModel(model);
    else {
      this.ai.studyChatModel = model;
      this.view.plugin.save();
    }
  }

  queueItems() {
    return chatQueue.normalizeQueue(this.queue);
  }

  setQueue(next) {
    this.queue = chatQueue.normalizeQueue(next);
    if (typeof this.opts.saveQueue === "function") this.opts.saveQueue(this.queue.slice());
    this.renderQueue();
  }

  renderQueue() {
    if (!this.queueEl) return;
    const rows = this.queueItems();
    this.queueEl.empty();
    this.queueEl.toggleClass("qt-hidden", !rows.length);
    if (!rows.length) return;
    this.queueEl.createDiv({
      cls: "qt-chat-queue-title",
      text: `Queued ${rows.length} message${rows.length === 1 ? "" : "s"} — sends after the current reply.`,
    });
    rows.forEach((text, index) => {
      const item = this.queueEl.createDiv({ cls: "qt-chat-queue-item" });
      item.createDiv({
        cls: "qt-chat-queue-text",
        text: text.length > 220 ? `${text.slice(0, 217).trimEnd()}...` : text,
      });
      const cancel = item.createEl("button", {
        text: "Cancel",
        attr: { "aria-label": `Cancel queued message ${index + 1}` },
      });
      cancel.addEventListener("click", () => this.removeQueued(index));
    });
  }

  /** Queue a message while a reply is streaming; it is sent once the panel is idle. */
  enqueue(text) {
    const value = str(text).trim();
    if (!value || !this.ai.enabled) return false;
    if (this.queueItems().length >= chatQueue.MAX_QUEUE) {
      if (this.status) this.status.setText(`The queue is full (${chatQueue.MAX_QUEUE} messages). Cancel one or wait for the reply to finish.`);
      return false;
    }
    const next = chatQueue.enqueue(this.queue, value);
    if (next.length === this.queueItems().length) return false;
    this.setQueue(next);
    if (this.input) this.input.value = "";
    this.syncMentionChips();
    this.refreshTokenFooter();
    if (this.status) this.status.setText(`Queued. It will send after the current reply.`);
    if (!this.busy && !this.draining) this.drainQueue();
    return true;
  }

  removeQueued(index) {
    const before = this.queueItems();
    const next = chatQueue.removeAt(before, index);
    if (next.length === before.length) return false;
    this.setQueue(next);
    if (this.status) this.status.setText("Removed the queued message.");
    return true;
  }

  /**
   * Send queued messages in order, one at a time. The item leaves the visible
   * queue before its request starts; failures are reported and are not retried
   * behind the user's back.
   */
  drainQueue() {
    if (this.draining || this.busy || !this.ai.enabled) return;
    if (this.thinkFirstRemaining() > 0) return;
    const rows = this.queueItems();
    if (!rows.length) return;
    const text = rows[0];
    this.draining = true;
    this.setQueue(rows.slice(1));
    Promise.resolve()
      .then(() => this.send(text))
      .then((started) => {
        if (started === false) {
          const message = `Queued message could not be sent: ${this.error || "the composer refused it"}. It was not retried.`;
          this.error = message;
          if (this.status) this.status.setText(message);
          this.draw();
        }
      })
      .catch((e) => {
        this.error = `Queued message could not be sent: ${str(e && e.message ? e.message : e)}`;
        if (this.status) this.status.setText(this.error);
        this.draw();
      })
      .finally(() => {
        this.draining = false;
        if (!this.busy && this.queueItems().length) this.drainQueue();
      });
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

  /** Per-chat context switches. Nothing is read or sent while they are off. */
  renderContextToggles(root) {
    const wrap = root.createDiv({ cls: "qt-chips qt-chat-context" });
    if (this.opts.readNoteContext) {
      this.noteChip = wrap.createEl("button", { cls: "qt-chip", text: "Include current note" });
      this.selectionChip = wrap.createEl("button", { cls: "qt-chip", text: "Include selection" });
      this.noteChip.addEventListener("click", () => {
        this.includeNote = !this.includeNote;
        this.currentNoteContext = "";
        this.paintContext();
        this.refreshContextPreview();
      });
      this.selectionChip.addEventListener("click", () => {
        this.includeSelection = !this.includeSelection;
        this.currentNoteContext = "";
        this.paintContext();
        this.refreshContextPreview();
      });
    }
    this.mentionChip = wrap.createEl("button", { cls: "qt-chip", text: "Include mentioned notes" });
    this.mentionChip.addEventListener("click", () => {
      this.includeMentions = !this.includeMentions;
      this.paintContext();
      this.refreshContextPreview();
    });
    this.mentionChipsEl = root.createDiv({ cls: "qt-chat-mentions" });
    root.createDiv({
      cls: "qt-hint",
      text: "Off by default. Note text, selection and mentioned notes are sent only while their switch is on. Mentions are explicitly chosen with @ and are treated as untrusted data.",
    });
    this.paintContext();
  }

  paintContext() {
    if (this.noteChip) this.noteChip.toggleClass("is-selected", this.includeNote);
    if (this.selectionChip) this.selectionChip.toggleClass("is-selected", this.includeSelection);
    if (this.mentionChip) this.mentionChip.toggleClass("is-selected", this.includeMentions);
  }

  mentionTargets() {
    return chatMentions.parseMentionTokens(this.input ? this.input.value : "");
  }

  mentionKey() {
    return this.mentionTargets().map((target) => `${target.kind}:${target.path}`).join("|");
  }

  addMention(target) {
    if (!this.input || !target) return;
    const range = this.mentionRange && Number.isFinite(Number(this.mentionRange.start))
      ? this.mentionRange
      : { start: this.input.value.length, end: this.input.value.length };
    this.input.value = chatMentions.insertMentionToken(this.input.value, range.start, range.end, target);
    this.mentionRange = null;
    this.includeMentions = true;
    this.closeMentionPicker();
    this.paintContext();
    this.syncMentionChips();
    this.refreshContextPreview();
    if (this.input.focus) this.input.focus();
  }

  openMentionPicker(query, start, end) {
    if (!this.mentionPicker) return;
    this.mentionRange = {
      start: Number.isFinite(Number(start)) ? Number(start) : this.input.value.length,
      end: Number.isFinite(Number(end)) ? Number(end) : this.input.value.length,
    };
    this.mentionPicker.toggleClass("qt-hidden", false);
    this.mentionPicker.empty();
    this.mentionPicker.createDiv({
      cls: "qt-hint",
      text: "Choose a note or folder. Only the items you pick are attached; the Mentions switch stays visible above.",
    });
    const candidates = chatMentions.mentionCandidatesFromApp(this.view.app, query, 12);
    if (!candidates.length) {
      this.mentionPicker.createDiv({ cls: "qt-hint", text: "No matching notes or folders. Keep typing after @ to narrow the list." });
      return;
    }
    for (const candidate of candidates) {
      const button = this.mentionPicker.createEl("button", {
        text: `${candidate.kind === "folder" ? "Folder" : "Note"}: ${candidate.label}`,
        cls: "qt-chat-mention-option",
      });
      button.addEventListener("click", () => this.addMention(candidate));
    }
  }

  closeMentionPicker() {
    if (this.mentionPicker) this.mentionPicker.toggleClass("qt-hidden", true);
  }

  syncMentionChips() {
    if (!this.mentionChipsEl) return;
    const targets = this.mentionTargets();
    this.mentionChipsEl.empty();
    this.mentionChipsEl.toggleClass("qt-hidden", !targets.length);
    for (const target of targets) {
      const chip = this.mentionChipsEl.createEl("span", { cls: "qt-chat-mention" });
      chip.createEl("span", { text: `${target.kind === "folder" ? "Folder" : "Note"}: ${target.path}` });
      const remove = chip.createEl("button", { text: "×", attr: { "aria-label": `Remove mention ${target.path}` } });
      remove.addEventListener("click", () => {
        this.input.value = chatMentions.removeMentionToken(this.input.value, target);
        if (!this.mentionTargets().length) this.includeMentions = false;
        this.syncMentionChips();
        this.refreshContextPreview();
      });
    }
    this.paintContext();
    if (this.mentionKey() !== this.lastMentionKey) this.refreshContextPreview();
  }

  async refreshContextPreview() {
    const seq = ++this.previewSeq;
    let note = "";
    if (this.opts.readNoteContext && (this.includeNote || this.includeSelection)) {
      try {
        const raw = await this.opts.readNoteContext();
        note = buildCurrentNoteContext(raw, { note: this.includeNote, selection: this.includeSelection });
      } catch (e) {
        note = "";
      }
    }
    let result = chatMentions.emptyMentionResult();
    const targets = this.mentionTargets();
    if (targets.length && this.includeMentions) {
      try {
        result = await chatMentions.resolveMentionsFromApp(this.view.app, targets);
      } catch (e) {
        result = { ...chatMentions.emptyMentionResult(), missing: targets.map((target) => ({ ...target, reason: "could not be read" })) };
      }
    }
    if (seq !== this.previewSeq) return;
    this.lastMentionKey = targets.map((target) => `${target.kind}:${target.path}`).join("|");
    this.mentionResult = result;
    this.previewContext = [note, result.block].filter(Boolean).join("\n\n");
    this.previewMissing = result.missing;
    this.previewWarnings = result.warnings;
    this.paintContext();
    this.refreshTokenFooter();
  }

  modelPlan(text) {
    const draft = text === undefined ? str(this.input && this.input.value) : str(text);
    const backend = this.view.plugin.backend();
    const globalModel =
      typeof this.view.plugin.aiModelFor === "function"
        ? this.view.plugin.aiModelFor("chat")
        : str(this.ai.api && this.ai.api.model).trim() || str(this.ai.model).trim();
    return chatModels.resolveChatModel({
      chatModel: this.chatModel(),
      commandModel: this.commandModelFor(draft),
      globalModel,
      availableModels: backend === "api" && this.ai.api ? this.ai.api.models : [],
      backend,
    });
  }

  commandModelFor(text) {
    const id = chatModels.commandIdFromText(text);
    if (!id) return "";
    return chatModels.normalizeCommandModels(this.ai.commandModels)[id] || "";
  }

  chatModelChoices() {
    const backend = this.view.plugin.backend();
    const globalModel = typeof this.view.plugin.aiModelFor === "function" ? this.view.plugin.aiModelFor("chat") : "";
    return chatModels.modelChoices({
      globalModel,
      availableModels: backend === "api" && this.ai.api ? this.ai.api.models : [],
      ownModel: this.chatModel(),
    });
  }

  renderModelSelect() {
    if (!this.modelSelect) return;
    const select = this.modelSelect;
    const globalModel = typeof this.view.plugin.aiModelFor === "function" ? this.view.plugin.aiModelFor("chat") : "";
    select.empty();
    select.createEl("option", {
      value: "",
      text: globalModel ? `Chat default (${globalModel})` : "Chat default",
    });
    for (const model of this.chatModelChoices()) {
      select.createEl("option", { value: model, text: model });
    }
    select.value = this.chatModel();
  }

  historyText() {
    if (this.view.plugin.backend() === "api") return this.apiHistory().map((message) => message.content).join("\n");
    return this.turns.map((turn) => turn.texts.join("\n")).join("\n");
  }

  budgetFor(text, context) {
    return chatBudget.budgetState([
      { label: "message", text },
      { label: "context", text: context },
      { label: "history", text: this.historyText() },
    ], { limit: chatBudget.CONTEXT_BUDGET_TOKENS });
  }

  contextAttachmentLabels() {
    const labels = [];
    if (this.includeNote) labels.push("current note");
    if (this.includeSelection) labels.push("selection");
    for (const target of this.mentionTargets()) {
      labels.push(`${target.kind} ${target.path}${this.includeMentions ? "" : " (off)"}`);
    }
    const draft = str(this.input && this.input.value).trim();
    if (/^\/[a-z0-9][a-z0-9-]*\b/i.test(draft)) labels.push(draft.split(/\s/)[0]);
    const history = this.view.plugin.backend() === "api" ? this.apiHistory().length : this.turns.length;
    if (history) labels.push(`${history} history message${history === 1 ? "" : "s"}`);
    return labels.length ? labels.join(" · ") : "No extra context";
  }

  refreshTokenFooter() {
    if (!this.budgetEl) return;
    const draft = str(this.input && this.input.value);
    const budget = this.budgetFor(draft, this.previewContext);
    const plan = this.modelPlan(draft);
    this.lastBudget = budget;
    this.lastModelPlan = plan;
    this.budgetEl.empty();
    this.budgetEl.toggleClass("is-warn", budget.warn);
    this.budgetEl.toggleClass("is-over", budget.over);
    this.budgetEl.createDiv({
      cls: "qt-chat-budget-line qt-chat-model-line",
      text: `Model: ${chatModels.effectiveModelLabel(plan)} (${chatModels.modelSourceLabel(plan.source)})`,
    });
    for (const fallback of plan.fallbacks) {
      this.budgetEl.createDiv({
        cls: "qt-chat-budget-warning",
        text: `${fallback.source === "chat" ? "This chat's" : "That command's"} model ${fallback.requested} is unavailable (${fallback.reason}); using ${chatModels.effectiveModelLabel(plan)} instead.`,
      });
    }
    this.budgetEl.createDiv({
      cls: "qt-chat-budget-line",
      text: `${this.contextAttachmentLabels()} — ~${chatBudget.formatTokenCount(budget.tokens)} / ${chatBudget.formatTokenCount(budget.limit)} tokens`,
    });
    if (this.previewMissing.length) {
      this.budgetEl.createDiv({
        cls: "qt-chat-budget-error",
        text: `Not attached: ${this.previewMissing.map((item) => `${item.kind} ${item.path} (${item.reason})`).join(", ")}`,
      });
    }
    for (const warning of this.previewWarnings) {
      this.budgetEl.createDiv({ cls: "qt-chat-budget-warning", text: warning });
    }
    if (budget.over) {
      this.budgetEl.createDiv({
        cls: "qt-chat-budget-error",
        text: "Over the local chat budget. Remove an attachment or shorten the message; Send will be refused.",
      });
    } else if (budget.warn) {
      this.budgetEl.createDiv({
        cls: "qt-chat-budget-warning",
        text: "Approaching the local chat budget. The next long attachment may be refused.",
      });
    }
  }

  /**
   * Resolve the mentions written in the outgoing message and check the local
   * budget before any request. A missing target or an over-budget chat refuses
   * the whole send instead of quietly dropping context.
   */
  async prepareSendContext(message) {
    let mention = chatMentions.emptyMentionResult();
    const targets = chatMentions.parseMentionTokens(message);
    if (targets.length && this.includeMentions) {
      try {
        mention = await chatMentions.resolveMentionsFromApp(this.view.app, targets);
      } catch (e) {
        mention = {
          ...chatMentions.emptyMentionResult(),
          missing: targets.map((target) => ({ ...target, reason: "could not be read" })),
        };
      }
      this.mentionResult = mention;
      this.previewMissing = mention.missing;
      this.previewWarnings = mention.warnings;
      this.lastMentionKey = targets.map((target) => `${target.kind}:${target.path}`).join("|");
    }
    if (mention.missing.length) {
      const names = mention.missing
        .map((item) => `${item.kind === "folder" ? "folder" : "note"} ${item.path} (${item.reason})`)
        .join(", ");
      return {
        ok: false,
        context: "",
        mention,
        error: `Nothing was sent: ${names} is no longer available. Remove that mention or restore it, then try again.`,
      };
    }
    const note = this.opts.readNoteContext && (this.includeNote || this.includeSelection)
      ? await this.prepareContext()
      : "";
    const context = [note, mention.block].filter(Boolean).join("\n\n");
    const budget = this.budgetFor(message, context);
    this.lastBudget = budget;
    this.refreshTokenFooter();
    if (budget.over) return { ok: false, context, mention, budget, error: budgetRefusal(budget) };
    return { ok: true, context, mention, budget };
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
    this.sendBtn.disabled = this.thinkFirstRemaining() > 0;
    this.sendBtn.setText(b ? "Queue" : "Send");
    this.status.setText(b ? "Working... You can type a follow-up and queue it." : "");
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
    if (this.queueItems().length) this.drainQueue();
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
    if (this.queueItems().length) this.drainQueue();
  }

  newChat() {
    if (this.busy) return;
    if (typeof this.opts.onNewChat === "function") {
      this.opts.onNewChat();
      return;
    }
    this.opts.setSessionId("");
    this.setQueue([]);
    this.apiHistory().length = 0;
    this.persistApiHistory();
    this.loadConversation([]);
  }

  /** Replace the transcript without touching the stored history (the caller owns it). */
  loadConversation(messages) {
    this.refreshBookmarks();
    this.turns = apiTurns(Array.isArray(messages) ? messages : []);
    this.pending = "";
    this.error = "";
    this.streamText = "";
    this.keepPartial = "";
    this.lastSent = "";
    this.sig = "";
    this.startThinkFirst();
    this.renderModelSelect();
    this.refreshTokenFooter();
    this.draw();
  }

  /** The in-panel conversation list; only the caller decides where conversations live. */
  renderLibrary(root) {
    if (typeof this.opts.getLibrary !== "function") return;
    this.libraryWrap = root.createDiv({ cls: "qt-chat-library" });
    this.libraryWrap.createDiv({ cls: "qt-hint", text: "Conversations (pinned first, then newest)" });
    const searchRow = this.libraryWrap.createDiv({ cls: "qt-row qt-small-row" });
    this.librarySearch = searchRow.createEl("input", {
      type: "text",
      attr: { "aria-label": "Search conversations", placeholder: "Search conversations" },
    });
    this.librarySearch.addEventListener("input", () => {
      this.libraryQuery = str(this.librarySearch.value);
      this.refreshLibrary();
    });
    this.archivedToggle = searchRow.createEl("button", { cls: "qt-chip", text: "Show archived" });
    this.archivedToggle.addEventListener("click", () => {
      this.showArchived = !this.showArchived;
      this.archivedToggle.toggleClass("is-selected", this.showArchived);
      this.archivedToggle.setText(this.showArchived ? "Hide archived" : "Show archived");
      this.refreshLibrary();
    });
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
      this.libraryList.createDiv({
        cls: "qt-hint",
        text: str(this.libraryQuery).trim() ? "No conversation matches that search." : "No saved conversations yet.",
      });
      return;
    }
    for (const row of rows) {
      const item = this.libraryList.createDiv({
        cls: `qt-chat-library-row${row.active ? " is-active" : ""}${row.archived ? " is-archived" : ""}`,
      });
      const open = item.createEl("button", {
        cls: "qt-chat-library-open",
        text: `${row.pinned ? "Pinned · " : ""}${row.title}${row.when ? ` — ${row.when}` : ""}${row.model ? ` · ${row.model}` : ""}${row.archived ? " (archived)" : ""}`,
      });
      open.addEventListener("click", () => this.openLibraryRow(row));
      const actions = item.createDiv({ cls: "qt-row qt-small-row qt-chat-library-actions" });
      const pin = actions.createEl("button", { text: row.pinned ? "Unpin" : "Pin" });
      pin.addEventListener("click", () => this.pinLibraryRow(row));
      if (row.archived) {
        const restore = actions.createEl("button", { text: "Restore" });
        restore.addEventListener("click", () => this.restoreLibraryRow(row));
      } else {
        const archive = actions.createEl("button", { text: "Archive" });
        archive.addEventListener("click", () => this.archiveLibraryRow(row));
      }
    }
  }

  pinLibraryRow(row) {
    if (this.busy || !row || typeof this.opts.onPinChat !== "function") return;
    this.opts.onPinChat(row.id, !row.pinned);
    this.refreshLibrary();
  }

  archiveLibraryRow(row) {
    if (this.busy || !row || typeof this.opts.onArchiveChat !== "function") return;
    this.opts.onArchiveChat(row.id);
    this.refreshLibrary();
  }

  restoreLibraryRow(row) {
    if (this.busy || !row || typeof this.opts.onResumeChat !== "function") return;
    this.opts.onResumeChat(row.id);
    this.refreshLibrary();
  }

  libraryRows() {
    try {
      const rows = typeof this.opts.getLibrary === "function"
        ? this.opts.getLibrary({ query: this.libraryQuery, includeArchived: this.showArchived })
        : [];
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
    const modelPlan = this.modelPlan(value);
    if (this.view.plugin.backend() === "api") {
      const prepared = await this.prepareSendContext(value);
      if (!prepared.ok) {
        this.error = prepared.error;
        if (this.status) this.status.setText(prepared.error);
        this.draw();
        return;
      }
      const hist = this.apiHistory();
      while (hist.length && hist[hist.length - 1].role !== "user") hist.pop();
      this.turns = apiTurns(hist);
      this.persistApiHistory();
      return this.sendApi(value, prepared.context, true, modelPlan.model);
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

  studyCommands() {
    try {
      const rows = typeof this.opts.getCommands === "function" ? this.opts.getCommands() : [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }

  /** Expand /name before sending, using only the context switches this chat allows. */
  async resolveStudyCommand(text, parsed) {
    const command = parsed || parseStudyCommand(text, this.studyCommands());
    if (!command) return text;
    let raw = null;
    if (typeof this.opts.readNoteContext === "function") {
      try {
        raw = await this.opts.readNoteContext();
      } catch (e) {
        raw = null;
      }
    }
    return applyStudyCommand(command.command, {
      path: raw && raw.path,
      note: this.includeNote && raw ? raw.text : "",
      selection: this.includeSelection && raw ? raw.selection : "",
      extra: command.rest,
    }) || text;
  }

  /**
   * `/compact` folds older Direct API messages into one bounded local summary.
   * No provider call is made; OpenCode's server-side session is reported plainly.
   */
  async compactChat() {
    if (this.busy) return false;
    if (this.view.plugin.backend() !== "api") {
      const reason =
        "/compact folds the Direct API conversation stored in settings. OpenCode keeps its own server-side history, so there is nothing local to compact.";
      this.error = reason;
      if (this.status) this.status.setText(reason);
      this.draw();
      return false;
    }
    const result = chatCompact.compactMessages(this.apiHistory(), {
      limit: chatBudget.CONTEXT_BUDGET_TOKENS,
    });
    if (!result.ok) {
      this.error = "";
      if (this.status) this.status.setText(result.reason);
      return false;
    }
    if (typeof this.opts.saveApiHistory === "function") this.opts.saveApiHistory(result.messages);
    else {
      const history = this.apiHistory();
      history.length = 0;
      history.push(...result.messages);
    }
    this.turns = apiTurns(result.messages);
    this.lastSent = "";
    this.error = "";
    this.input.value = "";
    this.syncMentionChips();
    this.sig = "";
    this.draw();
    this.refreshTokenFooter();
    if (this.status) {
      this.status.setText(
        `Compacted ${result.removed} older message${result.removed === 1 ? "" : "s"} into a local summary. The last ${result.kept} messages are unchanged. About ${chatBudget.formatTokenCount(result.tokens)} tokens now.`
      );
    }
    return true;
  }

  /** Reload the owning tab's bookmark list after a resume or reload. */
  refreshBookmarks() {
    this.bookmarks = chatBookmarks.normalizeBookmarks(
      typeof this.opts.getBookmarks === "function" ? this.opts.getBookmarks() : []
    );
    return this.bookmarks;
  }

  /** Bookmark or unbookmark one displayed message, persisting through the tab. */
  toggleBookmark(index, turn) {
    const bookmark = chatBookmarks.makeBookmark(turn, index);
    if (!bookmark) return null;
    const wasSaved = chatBookmarks.isBookmarked(this.bookmarks, bookmark);
    this.bookmarks = chatBookmarks.toggleBookmark(this.bookmarks, bookmark);
    if (typeof this.opts.saveBookmarks === "function") this.opts.saveBookmarks(this.bookmarks.slice());
    if (this.status) this.status.setText(wasSaved ? "Bookmark removed." : "Bookmarked. Copy link to reopen this message later.");
    this.sig = "";
    this.draw();
    return this.bookmarks;
  }

  /** Persist a bookmark if needed, then copy its conversation/message URI. */
  async copyBookmarkLink(index, turn) {
    const bookmark = chatBookmarks.makeBookmark(turn, index);
    if (!bookmark) return false;
    if (!chatBookmarks.isBookmarked(this.bookmarks, bookmark)) {
      this.bookmarks = chatBookmarks.toggleBookmark(this.bookmarks, bookmark);
      if (typeof this.opts.saveBookmarks === "function") this.opts.saveBookmarks(this.bookmarks.slice());
      this.sig = "";
      this.draw();
    }
    const link = typeof this.opts.bookmarkLink === "function" ? this.opts.bookmarkLink(bookmark) : "";
    if (!link) {
      if (this.status) this.status.setText("This conversation cannot be linked yet.");
      return false;
    }
    await this.copyText(link);
    if (this.status) this.status.setText("Bookmark link copied. Paste it anywhere to jump back to this message.");
    return true;
  }

  /** Scroll to and briefly highlight one message (used when a bookmark link opens). */
  focusMessage(index) {
    const el = this.turnEls[index];
    if (!el) {
      if (this.status) this.status.setText("That message is no longer in this conversation.");
      return false;
    }
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
    if (typeof el.addClass === "function") el.addClass("is-bookmark-jump");
    if (typeof activeWindow !== "undefined" && activeWindow && typeof activeWindow.setTimeout === "function") {
      activeWindow.setTimeout(() => {
        try {
          if (el && typeof el.removeClass === "function") el.removeClass("is-bookmark-jump");
        } catch (e) {
          /* the panel may have been redrawn */
        }
      }, 3500);
    }
    return true;
  }

  async send(text) {
    text = str(text).trim();
    if (!text || !this.ai.enabled) return false;
    if (this.busy) return this.enqueue(text);
    if (/^\/compact\b/i.test(text)) return this.compactChat();

    const modelPlan = this.modelPlan(text);
    const command = parseStudyCommand(text, this.studyCommands());
    if (command) {
      text = await this.resolveStudyCommand(text, command);
      if (!text) return false;
    }

    const prepared = await this.prepareSendContext(text);
    if (!prepared.ok) {
      this.error = prepared.error;
      if (this.status) this.status.setText(prepared.error);
      this.draw();
      return false;
    }

    this.lastSent = text;
    this.streamText = "";
    this.keepPartial = "";
    this.cancelled = false;
    if (this.thinkFirstRemaining() > 0) {
      this.refreshThinkFirst();
      return false;
    }
    if (this.opts.beforeSend) {
      try {
        await this.opts.beforeSend(text);
      } catch (e) {
        /* retrieval is best effort; the chat request still goes through */
      }
    }
    const currentNote = prepared.context;
    if (this.view.plugin.backend() === "api") return this.sendApi(text, currentNote, false, modelPlan.model);
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
        return false;
      }
    }
    const guard = ai.mode === "agent" && typeof plugin.snapshotProtectedState === "function" ? plugin.snapshotProtectedState() : null;
    this.error = "";
    this.input.value = "";
    this.syncMentionChips();
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
      const model = modelFromString(modelPlan.model);
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
      if (this.queueItems().length) this.drainQueue();
    }
    return true;
  }

  async sendApi(text, currentNote, resend, model) {
    const budget = this.budgetFor(text, currentNote);
    if (budget.over) {
      this.error = budgetRefusal(budget);
      if (this.status) this.status.setText(this.error);
      this.refreshTokenFooter();
      this.draw();
      return false;
    }
    this.error = "";
    this.input.value = "";
    this.syncMentionChips();
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
    let stoppedNote = "";
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
        model: chatModels.normalizeModel(model || this.modelPlan(text).model),
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
      stoppedNote = stopped ? (kept ? "Stopped. The partial reply was kept." : "Stopped.") : "";
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
      if (!stopped && !kept) this.input.value = text;
    } finally {
      if (token === this.apiCancelToken) {
        this.streamingController = null;
        this.setBusy(false);
        if (stoppedNote && this.status) this.status.setText(stoppedNote);
        this.turns = apiTurns(hist);
        this.draw();
        if (proposals.length) new AiToolReviewModal(this.view.app, this.view.plugin, proposals).open();
      }
    }
    if (this.queueItems().length) this.drainQueue();
    return true;
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
    const sig = JSON.stringify([this.turns, this.pending, this.error, this.busy, this.streamText, this.bookmarks]);
    if (sig === this.sig) return;
    this.sig = sig;
    const box = this.transcript;
    box.empty();
    this.turnEls = [];
    const lastAssistant = [...this.turns].reverse().find((turn) => turn.role === "assistant");
    this.turns.forEach((t, index) => {
      const b = box.createDiv({ cls: `qt-msg is-${t.role}` });
      this.turnEls[index] = b;
      for (const text of t.texts) this.view.md(text, b.createDiv({ cls: "qt-msg-text" }), this.opts.sourcePath || "");
      for (const line of t.tools) b.createDiv({ cls: "qt-tool", text: line });
      const bookmark = chatBookmarks.makeBookmark(t, index);
      const assistantActions = t.role === "assistant" && t.texts.length && !this.busy;
      if (!bookmark && !assistantActions) return;
      const actions = b.createDiv({ cls: "qt-msg-actions" });
      if (bookmark) {
        const saved = chatBookmarks.isBookmarked(this.bookmarks, bookmark);
        const toggle = actions.createEl("button", {
          text: saved ? "Bookmarked" : "Bookmark",
          cls: `qt-msg-bookmark${saved ? " is-bookmarked" : ""}`,
          attr: { "aria-label": saved ? "Remove this message bookmark" : "Bookmark this message" },
        });
        toggle.addEventListener("click", () => this.toggleBookmark(index, t));
        if (saved) {
          const copy = actions.createEl("button", { text: "Copy link", cls: "qt-msg-bookmark-link" });
          copy.addEventListener("click", () => this.copyBookmarkLink(index, t));
        }
      }
      if (assistantActions) {
        const copy = actions.createEl("button", { text: "Copy" });
        copy.addEventListener("click", () => this.copyText(t.texts.join("\n\n")));
        if (this.opts.onSaveNote) {
          const sv = actions.createEl("button", {
            text: this.opts.saveNoteLabel || "Add to My Notes",
            cls: "qt-save-note",
          });
          sv.addEventListener("click", () => this.opts.onSaveNote(t.texts.join("\n\n")));
        }
        if (t === lastAssistant) {
          const again = actions.createEl("button", { text: "Regenerate" });
          again.addEventListener("click", () => this.regenerate());
        }
      }
    });
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
