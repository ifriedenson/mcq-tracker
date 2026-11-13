"use strict";
const { Notice } = require("obsidian");
const { apiTurns, friendlyApiError } = require("./api-client");
const { errorDetail, str } = require("./util");
const { friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { TUTOR_COMMANDS, TUTOR_ROLES, normalizeTutorRole, tutorRole } = require("./tutor-presets");
const { parseStudyCommand, applyStudyCommand } = require("./study-commands");
const { buildCurrentNoteContext } = require("./note-context");
const { thinkFirstLabel, thinkFirstRemainingMs } = require("./think-first");
const { AgentEditReviewModal } = require("./agent-edit-review-modal");
const { AiToolReviewModal } = require("./ai-tool-review-modal");
const { toolProtocol, proposalPreview } = require("./ai-tools");
const { summarize: summarizeEdits } = require("./agent-edit-review");
const { chatMarkdown } = require("./chat-history");
const chatBudget = require("./chat-budget");
const chatMentions = require("./chat-mentions");
const chatModels = require("./chat-models");
const chatBookmarks = require("./chat-bookmarks");
const chatCompact = require("./chat-compact");
const chatQueue = require("./chat-queue");
const chatPricing = require("./chat-pricing");
const chatMemory = require("./chat-memory");
const chatPlan = require("./chat-plan");
const chatPdf = require("./chat-pdf");
const { PdfAttachModal } = require("./chat-pdf-modal");

const SUGGESTION_ROTATE_MS = 7000;
const DEFAULT_SUGGESTIONS = [
  {
    label: "Explain this note",
    title: "Explain this note",
    detail: "A plain-language walkthrough of the note you have open, with one worked example.",
    prompt: "Explain the note I have open in plain language, with one worked example.",
  },
  {
    label: "Quiz me on it",
    title: "Quiz me on it",
    detail: "One question at a time, using the note or course you are studying.",
    prompt: "Quiz me on the note I have open. Ask one question at a time and wait for my answer.",
  },
  {
    label: "Plan my next hour",
    title: "Plan my next hour",
    detail: "A short study plan built from what is due and what you want to finish.",
    prompt: "Plan the next hour of study from what is due.",
  },
];
const TOOL_TITLES = {
  read: "Read file",
  list: "Listed files",
  glob: "Searched files",
  grep: "Searched notes",
  edit: "Edited file",
  write: "Wrote file",
  patch: "Patched file",
  bash: "Ran command",
  webfetch: "Fetched page",
  todowrite: "Updated plan",
  todoread: "Read plan",
  task: "Started task",
};
const PROPOSAL_TOOL_LABELS = {
  create_question: "New practice question",
  create_card: "New flashcard",
  update_section: "Section edit",
};
const PROPOSAL_STATUS_LABELS = {
  pending: "Awaiting review",
  applied: "Applied",
  partial: "Partly applied",
  declined: "Discarded",
};
const PROPOSAL_FILE_LABELS = {
  added: "New note",
  modified: "Changed",
  deleted: "Deleted",
};

/** Provider errors whose fix is a setting, not another identical request. */
function errorNeedsSettings(error) {
  const text = str(error);
  return (
    /\bsettings?\b/i.test(text) ||
    /rejected the API key|can't use this model/i.test(text) ||
    /no AI provider connected/i.test(text)
  );
}

function budgetRefusal(budget) {
  return `Nothing was sent: the estimated ${chatBudget.formatTokenCount(budget.tokens)}-token context is over the local ${chatBudget.formatTokenCount(budget.limit)}-token chat budget. Remove a mention or PDF attachment, or shorten the message.`;
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
    // Escape must leave full-screen mode wherever focus sits in the pane, not
    // only while the draft textarea owns it. The input handler stops a busy
    // reply first; this handler skips events it already prevented.
    if (root && typeof root.addEventListener === "function") {
      root.addEventListener("keydown", (event) => this.handleRootKeydown(event));
    }
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
    this.includeSkills = false;
    this.includeMemory = false;
    this.skills = [];
    this.skillBlock = "";
    this.skillWarnings = [];
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
    this.plan = chatPlan.normalizePlan(opts.getPlan ? opts.getPlan() : null);
    this.pdfs = chatPdf.normalizeAttachments(opts.getPdfs ? opts.getPdfs() : []);
    this.pdfCache = new Map();
    this.pdfBusy = false;
    this.planRunToken = 0;
    this.planStep = null;
    this.planRequest = null;
    this.planReviewModal = null;
    this.turnEls = [];
    this.draining = false;
    this.libraryQuery = "";
    this.libraryOpen = false;
    this.libraryProject = "";
    this.showArchived = false;
    this.suggestionIndex = 0;
    this.suggestionTimer = 0;
    this.emptyDeck = null;
    this.suggestionDots = null;
    this.proposalCard = null;
    this.fullscreen = false;
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
    // A rebuild replaces every element, so the old draw signature no longer
    // describes this tree; without this the transcript would stay blank.
    this.sig = "";
    root.addClass("qt-agent-panel");
    if (!this.ai.enabled) {
      const off = root.createDiv({ cls: "qt-hint qt-agent-off" });
      off.createDiv({
        text: "AI is turned off. Turn it on in Settings → Study agent → AI and the assistant.",
      });
      if (typeof this.view.plugin.openSettings === "function") {
        off.createEl("button", { text: "Open settings", cls: "mod-cta" }).addEventListener("click", () => this.view.plugin.openSettings("mcq-ai"));
      }
      return;
    }

    this.planEl = root.createDiv({ cls: "qt-chat-plan" });
    this.renderPlan();

    // Copilot puts the transcript first. The view leaf already owns the title,
    // so the chat pane does not draw a second branded header above it.
    this.transcript = root.createDiv({ cls: "qt-chat qt-agent-thread" });
    this.status = root.createDiv({ cls: "qt-hint qt-agent-status" });
    this.thinkFirstNote = root.createDiv({ cls: "qt-hint qt-think-first qt-hidden", text: "" });
    this.mentionPicker = root.createDiv({ cls: "qt-chat-mention-picker qt-hidden" });
    this.queueEl = root.createDiv({ cls: "qt-chat-queue qt-hidden" });
    this.renderQueue();

    // ChatControls, below the messages and above the composer: mode on the
    // left; context usage and the conversation/settings actions on the right.
    const controls = root.createDiv({ cls: "qt-agent-controls" });
    const modes = controls.createDiv({ cls: "qt-agent-control-modes" });
    const modeSel = modes.createEl("select", {
      cls: "qt-select qt-agent-mode",
      attr: { "aria-label": "Mode", title: "Tutor or agent" },
    });
    modeSel.createEl("option", { value: "tutor", text: "Tutor" });
    modeSel.createEl("option", {
      value: "agent",
      text: "Agent",
      attr: { title: this.view.plugin.backend() === "api" ? "Agent (notes)" : "Agent (files)" },
    });
    modeSel.value = this.ai.mode;
    modeSel.addEventListener("change", () => {
      this.ai.mode = modeSel.value;
      this.view.plugin.save();
      this.updateHint();
    });
    const role = modes.createEl("select", {
      cls: "qt-select qt-agent-role",
      attr: { "aria-label": "Tutor role", title: "Tutor role" },
    });
    // The full role names are in the option titles and Settings. A short
    // selected label keeps the persona visible in a 320 px leaf instead of
    // clipping "Private tutc" behind the select arrow.
    for (const item of TUTOR_ROLES) {
      role.createEl("option", {
        value: item.id,
        text: item.label.replace(/ (tutor|partner)$/, ""),
        attr: { title: item.label },
      });
    }
    role.value = this.currentRole();
    role.addEventListener("change", () => this.setRole(role.value));

    const controlActions = controls.createDiv({ cls: "qt-agent-control-actions" });
    this.tokenGauge = controlActions.createDiv({
      cls: "qt-chat-token-gauge qt-hidden",
      attr: { role: "img", "aria-label": "Conversation context usage", "aria-hidden": "true" },
    });
    this.tokenGaugeRing = this.tokenGauge.createDiv({ cls: "qt-chat-token-ring" });
    this.tokenGaugeRing.createDiv({ cls: "qt-chat-token-hole" });
    this.tokenGaugeLabel = this.tokenGauge.createSpan({ cls: "qt-chat-token-label" });

    const controlButton = (label, glyph, cls) => {
      const button = controlActions.createEl("button", {
        text: label,
        cls: `qt-agent-iconbtn ${cls || ""}`.trim(),
        attr: { "aria-label": label, title: label, "data-glyph": glyph },
      });
      return button;
    };
    const nc = controlButton("New chat", "+");
    nc.addEventListener("click", () => this.newChat());
    const chats = controlButton("Chats", "☰", "qt-agent-history");
    chats.setAttr("aria-expanded", "false");
    chats.setAttr("aria-controls", "qt-agent-library");
    this.libraryButton = chats;
    chats.addEventListener("click", () => this.toggleLibrary());
    if (typeof this.view.plugin.openSettings === "function") {
      const settings = controlButton("Settings", "⚙");
      settings.addEventListener("click", () => this.view.plugin.openSettings());
    }
    if (this.opts.onSaveChat) {
      const save = controlButton("Save chat", "↓");
      save.addEventListener("click", () => this.saveChat());
    }
    this.fullscreenBtn = controlButton("Expand", "⤢", "qt-agent-expand");
    this.fullscreenBtn.setAttr("aria-pressed", "false");
    this.fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());

    this.renderLibrary(root);

    // The long safety explanation stays available, but not as a wall of text
    // above every chat. Copilot keeps this kind of detail behind a control.
    const note = root.createDiv({ cls: "qt-agent-mode-note" });
    const noteDetails = note.createEl("details");
    noteDetails.createEl("summary", { text: "How replies work" });
    this.hint = noteDetails.createDiv({ cls: "qt-hint qt-agent-hintbar" });
    noteDetails.createDiv({
      cls: "qt-hint qt-agent-context-note",
      text: "Context is off by default. Note text, the selection and mentions are sent only while their chip is on. Agent proposals use the review window; nothing is saved without approval.",
    });
    this.updateHint();

    // Composer: Copilot's bordered input card, with context chips above the
    // editor and one 28px row of context/model controls below it.
    const composer = root.createDiv({ cls: "qt-agent-composer" });
    this.composerEl = composer;
    composer.createDiv({ cls: "qt-agent-composer-grip", attr: { "aria-hidden": "true" } });
    this.renderContextToggles(composer);
    const row = composer.createDiv({ cls: "qt-agent-inputrow" });
    this.input = row.createEl("textarea", {
      cls: "qt-chat-input qt-agent-input",
      attr: {
        rows: "2",
        placeholder: "Type a question · @ mentions · / commands",
        title: "Enter to send · Shift+Enter for a new line",
        "aria-label": "Message the Study agent",
      },
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.mentionPicker && !this.mentionPicker.hasClass("qt-hidden")) {
          e.preventDefault();
          this.closeMentionPicker();
          return;
        }
        if (this.busy) {
          e.preventDefault();
          this.stop();
          return;
        }
        if (this.fullscreen) {
          e.preventDefault();
          this.toggleFullscreen(false);
          return;
        }
      }
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      this.send(this.input.value);
    });
    this.input.addEventListener("input", () => {
      const before = chatMentions.mentionQueryAt(this.input.value, this.input.value.length);
      if (before) this.openMentionPicker(before.query, before.start, before.end);
      else this.closeMentionPicker();
      this.syncMentionChips();
      this.refreshTokenFooter();
    });

    const toolbar = composer.createDiv({ cls: "qt-agent-toolbar" });
    const tools = toolbar.createDiv({ cls: "qt-agent-composer-tools" });
    this.atBtn = tools.createEl("button", {
      cls: "qt-agent-tool qt-agent-iconbtn",
      text: "Add context",
      attr: { "aria-label": "Add context", title: "Attach a note or folder", "data-glyph": "+" },
    });
    this.atBtn.addEventListener("click", () => {
      const prefix = this.input.value && !/\s$/.test(this.input.value) ? " " : "";
      this.input.value = `${this.input.value}${prefix}@`;
      this.mentionRange = { start: this.input.value.length - 1, end: this.input.value.length };
      this.openMentionPicker("");
    });
    this.pdfBtn = tools.createEl("button", {
      cls: "qt-agent-tool qt-agent-iconbtn",
      text: "Attach PDF",
      attr: { "aria-label": "Attach a PDF", title: "Attach a PDF", "data-glyph": "PDF" },
    });
    this.pdfBtn.addEventListener("click", () => this.attachPdf());
    const command = tools.createEl("select", {
      cls: "qt-select qt-agent-command",
      attr: { "aria-label": "Insert a tutor command", title: "Insert a tutor command" },
    });
    command.createEl("option", { value: "", text: "Commands" });
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
      const saved = tools.createEl("select", {
        cls: "qt-select qt-agent-saved-command",
        attr: { "aria-label": "Insert a study command", title: "Insert a study command" },
      });
      saved.createEl("option", { value: "", text: "Study" });
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
    this.modelSelect = tools.createEl("select", {
      cls: "qt-select qt-agent-model",
      attr: { "aria-label": "Chat model", title: "Model for this chat" },
    });
    this.renderModelSelect();
    this.modelSelect.addEventListener("change", () => {
      this.setChatModel(chatModels.normalizeModel(this.modelSelect.value));
      this.refreshTokenFooter();
    });

    const submit = toolbar.createDiv({ cls: "qt-agent-submit" });
    const sendGroup = submit.createDiv({ cls: "qt-agent-send" });
    this.stopBtn = sendGroup.createEl("button", {
      text: "Stop",
      cls: "qt-agent-send-btn qt-agent-stop-btn qt-hidden",
      attr: { "aria-label": "Stop generating", title: "Stop generating", "data-glyph": "■" },
    });
    this.stopBtn.addEventListener("click", () => this.stop());
    this.sendBtn = sendGroup.createEl("button", {
      text: "Send",
      cls: "mod-cta qt-agent-send-btn",
      attr: { "aria-label": "Send message", title: "Send message", "data-glyph": "↑" },
    });
    this.sendBtn.addEventListener("click", () => this.send(this.input.value));

    const usage = composer.createEl("details", { cls: "qt-agent-usage" });
    usage.createEl("summary", { text: "Usage and context" });
    this.budgetEl = usage.createDiv({ cls: "qt-chat-budget qt-agent-budget" });
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
    // The command list lives in the toolbar dropdown; repeating it here made
    // the hint bar four lines tall in a narrow sidebar.
    const suffix = ` Role: ${role.label}.`;
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
    const wrap = root.createDiv({ cls: "qt-chips qt-chat-context", attr: { "aria-label": "Context sent with the next message" } });
    const chip = (short, full) => {
      const button = wrap.createEl("button", {
        cls: "qt-chip qt-agent-context-chip",
        text: short,
        attr: { title: full, "aria-label": full, "aria-pressed": "false" },
      });
      // Keep the full switch name for screen readers and the existing DOM
      // checks while the visible control stays as short as Copilot's badges.
      button.createSpan({ cls: "qt-sr-only", text: full });
      return button;
    };
    if (this.opts.readNoteContext) {
      this.noteChip = chip("Note", "Include current note");
      this.selectionChip = chip("Selection", "Include selection");
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
    this.mentionChip = chip("Mentions", "Include mentioned notes");
    this.mentionChip.addEventListener("click", () => {
      this.includeMentions = !this.includeMentions;
      this.paintContext();
      this.refreshContextPreview();
    });
    if (typeof this.opts.loadSkills === "function") {
      this.skillChip = chip("Skills", "Include skills");
      this.skillChip.addEventListener("click", async () => {
        this.includeSkills = !this.includeSkills;
        if (this.includeSkills) await this.refreshSkills();
        else {
          this.skills = [];
          this.skillBlock = "";
          this.skillWarnings = [];
        }
        this.paintContext();
        this.refreshTokenFooter();
      });
    }
    this.memoryChip = chip("Memory", "Include memory");
    this.memoryChip.addEventListener("click", () => {
      this.includeMemory = !this.includeMemory;
      this.paintContext();
      this.refreshTokenFooter();
    });
    this.mentionChipsEl = root.createDiv({ cls: "qt-chat-mentions" });
    this.pdfChipsEl = root.createDiv({ cls: "qt-chat-pdfs" });
    this.renderPdfChips();
    this.paintContext();
  }

  paintContext() {
    const paint = (chip, on) => {
      if (!chip) return;
      chip.toggleClass("is-selected", on);
      chip.setAttr("aria-pressed", on ? "true" : "false");
    };
    paint(this.noteChip, this.includeNote);
    paint(this.selectionChip, this.includeSelection);
    paint(this.mentionChip, this.includeMentions);
    paint(this.skillChip, this.includeSkills);
    paint(this.memoryChip, this.includeMemory);
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

  /** Load the enabled skill notes on demand; an absent folder simply yields nothing. */
  async refreshSkills() {
    if (!this.includeSkills || typeof this.opts.loadSkills !== "function") {
      this.skills = [];
      this.skillBlock = "";
      this.skillWarnings = [];
      return { skills: [], block: "", warnings: [] };
    }
    try {
      const result = await this.opts.loadSkills();
      this.skills = Array.isArray(result && result.skills) ? result.skills : [];
      this.skillBlock = str(result && result.block);
      this.skillWarnings = Array.isArray(result && result.warnings) ? result.warnings : [];
      return { skills: this.skills, block: this.skillBlock, warnings: this.skillWarnings };
    } catch (e) {
      this.skills = [];
      this.skillBlock = "";
      this.skillWarnings = [];
      return { skills: [], block: "", warnings: [] };
    }
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
      text: "Chat default",
      attr: { title: globalModel ? `Chat default (${globalModel})` : "Chat default" },
    });
    for (const model of this.chatModelChoices()) {
      select.createEl("option", { value: model, text: model });
    }
    select.value = this.chatModel();
    select.setAttr("title", globalModel ? `Model for this chat · default ${globalModel}` : "Model for this chat");
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
      { label: "skills", text: this.includeSkills ? this.skillBlock : "" },
      { label: "memory", text: this.includeMemory ? chatMemory.factBlock(this.ai.chatMemory) : "" },
      ...(str(context).includes(chatPdf.PDF_MARKER)
        ? []
        : [{ label: "pdfs", text: "x".repeat(chatPdf.totalChars(this.pdfs)) }]),
    ], { limit: chatBudget.CONTEXT_BUDGET_TOKENS });
  }

  contextAttachmentLabels() {
    const labels = [];
    if (this.includeNote) labels.push("current note");
    if (this.includeSelection) labels.push("selection");
    if (this.includeSkills) labels.push(this.skills.length ? `${this.skills.length} skill${this.skills.length === 1 ? "" : "s"}` : "skills (none)");
    if (this.includeMemory) {
      const facts = chatMemory.normalizeFacts(this.ai.chatMemory);
      labels.push(facts.length ? `${facts.length} memor${facts.length === 1 ? "y fact" : "y facts"}` : "memory (none)");
    }
    for (const target of this.mentionTargets()) {
      labels.push(`${target.kind} ${target.path}${this.includeMentions ? "" : " (off)"}`);
    }
    for (const pdf of this.pdfs) labels.push(`PDF ${chatPdf.describeAttachment(pdf)}`);
    const draft = str(this.input && this.input.value).trim();
    if (/^\/[a-z0-9][a-z0-9-]*\b/i.test(draft)) labels.push(draft.split(/\s/)[0]);
    const history = this.view.plugin.backend() === "api" ? this.apiHistory().length : this.turns.length;
    if (history) labels.push(`${history} history message${history === 1 ? "" : "s"}`);
    return labels.length ? labels.join(" · ") : "No extra context";
  }

  historyCount() {
    return this.view.plugin.backend() === "api" ? this.apiHistory().length : this.turns.length;
  }

  /**
   * Draw the compact context gauge from the exact same budget object the footer
   * already uses. It is absent until the chat has a message or a draft, and it
   * silently hides again when budget data is missing or unusable.
   */
  renderTokenGauge(budget, draft) {
    if (!this.tokenGauge) return false;
    const limit = Number(budget && budget.limit);
    const tokens = Number(budget && budget.tokens);
    const hasUsage = this.historyCount() > 0 || !!str(draft).trim();
    const show = !!budget && Number.isFinite(limit) && limit > 0 && Number.isFinite(tokens) && tokens >= 0 && hasUsage;
    this.tokenGauge.toggleClass("qt-hidden", !show);
    this.tokenGauge.setAttr("aria-hidden", show ? "false" : "true");
    if (!show) {
      this.lastGauge = null;
      return false;
    }
    const ratio = Math.max(0, Math.min(1, Number(budget.ratio) || tokens / limit));
    const percent = Math.round(ratio * 100);
    this.lastGauge = { tokens, limit, ratio, percent };
    this.tokenGauge.toggleClass("is-warn", budget.warn === true);
    this.tokenGauge.toggleClass("is-over", budget.over === true);
    this.tokenGauge.setAttr("aria-label", `Context usage: about ${chatBudget.formatTokenCount(tokens)} of ${chatBudget.formatTokenCount(limit)} tokens, ${percent} percent`);
    this.tokenGauge.style.setProperty("--qt-budget-percent", `${percent}%`);
    if (this.tokenGaugeLabel) {
      this.tokenGaugeLabel.setText(`${percent}% · ~${chatBudget.formatTokenCount(tokens)} / ${chatBudget.formatTokenCount(limit)} tokens`);
    }
    return true;
  }

  refreshTokenFooter() {
    if (!this.budgetEl) return;
    const draft = str(this.input && this.input.value);
    const budget = this.budgetFor(draft, this.previewContext);
    const plan = this.modelPlan(draft);
    this.lastBudget = budget;
    this.lastModelPlan = plan;
    this.renderTokenGauge(budget, draft);
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
    const cost = chatPricing.estimateCost(
      this.ai.pricing,
      plan.model,
      budget.tokens,
      this.ai.limits && this.ai.limits.maxTokens
    );
    if (cost.ok) {
      this.budgetEl.createDiv({
        cls: "qt-chat-budget-line qt-chat-cost-line",
        text: `Estimated cost: ${chatPricing.formatUsd(cost.total)} (${chatPricing.formatUsd(cost.inputCost)} input + up to ${chatPricing.formatUsd(cost.outputCost)} reply at local prices)`,
      });
    }
    const history = typeof this.opts.getApiHistory === "function" ? this.opts.getApiHistory() : [];
    const baseTokens = budget.parts
      .filter((part) => part.label !== "message" && part.label !== "history")
      .reduce((sum, part) => sum + part.tokens, 0);
    const conversation = chatPricing.estimateConversationCost(this.ai.pricing, plan.model, history, { baseTokens });
    if (conversation.ok) {
      this.budgetEl.createDiv({
        cls: "qt-chat-budget-line qt-chat-cost-total",
        text: `Conversation estimate: ${chatPricing.formatUsd(conversation.total)} across ${conversation.turns} repl${conversation.turns === 1 ? "y" : "ies"} (local prices; an estimate, not an invoice)`,
      });
    }
    if (this.includeSkills) {
      const names = this.skills.map((skill) => skill.name).filter(Boolean).join(", ");
      this.budgetEl.createDiv({
        cls: "qt-chat-budget-line qt-chat-skills-line",
        text: names ? `Skills: ${names}` : "Skills: none found in the configured folder.",
      });
      for (const warning of this.skillWarnings) {
        this.budgetEl.createDiv({ cls: "qt-chat-budget-warning", text: warning });
      }
    }
    if (this.includeMemory) {
      const facts = chatMemory.normalizeFacts(this.ai.chatMemory);
      const row = this.budgetEl.createDiv({ cls: "qt-row qt-small-row qt-chat-memory-line" });
      row.createSpan({
        text: facts.length
          ? `Memory: ${facts.length} saved fact${facts.length === 1 ? "" : "s"} on this device.`
          : "Memory: no saved facts yet.",
      });
      const manage = row.createEl("button", { text: "Manage" });
      manage.addEventListener("click", () => {
        if (typeof this.opts.onOpenMemory === "function") this.opts.onOpenMemory();
      });
    }
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
    if (this.includeSkills) await this.refreshSkills();
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
    const pdf = this.pdfs.length ? await this.resolvePdfBlock() : { ok: true, block: "" };
    if (!pdf.ok) return { ok: false, context: "", mention, error: pdf.error };
    const context = [note, mention.block, pdf.block].filter(Boolean).join("\n\n");
    const budget = this.budgetFor(message, context);
    this.lastBudget = budget;
    this.refreshTokenFooter();
    if (budget.over) return { ok: false, context, mention, budget, error: budgetRefusal(budget) };
    return { ok: true, context, mention, budget };
  }

  /** The PDFs a picker can offer: vault files only, path-sorted, bounded by the picker. */
  listPdfs() {
    const vault = this.view && this.view.app ? this.view.app.vault : null;
    const files = vault && typeof vault.getFiles === "function" ? vault.getFiles() : [];
    return files
      .filter((file) => /\.pdf$/i.test(str(file && (file.path || file.name))))
      .map((file) => ({ path: str(file.path), name: str(file.name || file.basename || file.path) }))
      .filter((file) => file.path)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Open the vault picker; the panel owns reading so a failed read changes nothing. */
  attachPdf() {
    if (this.busy || this.pdfBusy || !this.ai.enabled) return false;
    if (typeof this.opts.readPdf !== "function") {
      if (this.status) this.status.setText("PDF attachment is unavailable in this view. Nothing was attached.");
      return false;
    }
    if (this.pdfs.length >= chatPdf.MAX_PDFS) {
      if (this.status) this.status.setText(`At most ${chatPdf.MAX_PDFS} PDFs can be attached to one chat. Remove one first.`);
      return false;
    }
    const files = this.listPdfs();
    if (!files.length) {
      new Notice("No PDFs found in this vault. Add one first, then attach it in the Study agent.");
      return false;
    }
    const modal = new PdfAttachModal(this.view.app, files, (choice) => this.addPdf(choice));
    modal.open();
    return true;
  }

  /** Read one PDF locally, then store only its path, pages and bounded size. */
  async addPdf(choice) {
    if (this.pdfs.length >= chatPdf.MAX_PDFS) {
      return { ok: false, error: `At most ${chatPdf.MAX_PDFS} PDFs can be attached to one chat. Remove one first.` };
    }
    const specError = chatPdf.pageSpecError(choice && choice.pages);
    if (specError) return { ok: false, error: specError };
    const attachment = chatPdf.normalizeAttachment(choice);
    if (!attachment) return { ok: false, error: "Choose a PDF from the vault." };
    if (this.pdfs.some((item) => item.path === attachment.path)) {
      return { ok: false, error: "That PDF is already attached. Remove it first to change the pages." };
    }
    if (typeof this.opts.readPdf !== "function") {
      return { ok: false, error: "PDF attachment is unavailable in this view." };
    }
    this.pdfBusy = true;
    if (this.status) this.status.setText(`Reading ${attachment.path}...`);
    try {
      const result = await this.opts.readPdf(attachment, (message) => {
        if (this.status) this.status.setText(str(message) || "Reading the PDF...");
      });
      const built = chatPdf.buildBlock(attachment, result && result.pages, { maxChars: chatPdf.MAX_CHARS });
      if (!built.ok) {
        return {
          ok: false,
          error: `${attachment.path} has no extractable text layer. OCR it first, then attach the resulting note.`,
        };
      }
      const next = {
        ...attachment,
        chars: built.chars,
        totalPages: Math.max(0, Number(result && result.total) || 0),
        truncated: built.truncated,
      };
      const total = this.pdfs.reduce((sum, item) => sum + item.chars, 0) + next.chars;
      if (total > chatPdf.MAX_TOTAL_CHARS) {
        return {
          ok: false,
          error: `Those PDFs would add more than ${chatPdf.MAX_TOTAL_CHARS} characters to this chat. Remove one or choose fewer pages.`,
        };
      }
      this.pdfCache.set(chatPdf.key(next), result);
      this.setPdfs([...this.pdfs, next]);
      if (this.status) {
        this.status.setText(`Attached ${chatPdf.describeAttachment(next)}. Its text is sent only when you press Send.`);
      }
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: `Could not read ${attachment.path}: ${str(e && e.message ? e.message : e) || "unknown error"}.`,
      };
    } finally {
      this.pdfBusy = false;
      this.refreshTokenFooter();
    }
  }

  removePdf(target) {
    const id = typeof target === "string" ? target : chatPdf.key(target);
    const next = this.pdfs.filter((item) => chatPdf.key(item) !== id);
    if (next.length === this.pdfs.length) return false;
    this.setPdfs(next);
    if (this.status) this.status.setText("Removed the PDF attachment. Its text is no longer sent.");
    return true;
  }

  setPdfs(next) {
    this.pdfs = chatPdf.normalizeAttachments(next);
    const keep = new Set(this.pdfs.map((item) => chatPdf.key(item)));
    for (const id of this.pdfCache.keys()) {
      if (!keep.has(id)) this.pdfCache.delete(id);
    }
    if (typeof this.opts.savePdfs === "function") this.opts.savePdfs(this.pdfs.slice());
    this.renderPdfChips();
    this.refreshTokenFooter();
  }

  renderPdfChips() {
    if (!this.pdfChipsEl) return;
    this.pdfChipsEl.empty();
    this.pdfChipsEl.toggleClass("qt-hidden", !this.pdfs.length);
    for (const attachment of this.pdfs) {
      const chip = this.pdfChipsEl.createEl("span", { cls: "qt-chat-pdf" });
      chip.createEl("span", { text: `PDF: ${chatPdf.describeAttachment(attachment)}` });
      const remove = chip.createEl("button", {
        text: "×",
        attr: { "aria-label": `Remove PDF ${attachment.path}` },
      });
      remove.addEventListener("click", () => this.removePdf(attachment));
    }
  }

  /**
   * Read every attached PDF and turn it into one labelled context block. A
   * missing, unreadable or text-free PDF refuses the whole send rather than
   * dropping the attachment behind the learner's back.
   */
  async resolvePdfBlock() {
    if (!this.pdfs.length) return { ok: true, block: "" };
    if (typeof this.opts.readPdf !== "function") {
      return { ok: false, error: "Nothing was sent: PDF attachment is unavailable in this view." };
    }
    const blocks = [];
    let remaining = chatPdf.MAX_TOTAL_CHARS;
    let used = 0;
    for (const attachment of this.pdfs) {
      if (remaining <= 200 && blocks.length) {
        blocks.push(`[${attachment.path} was omitted because the local attachment limit was reached.]`);
        break;
      }
      const id = chatPdf.key(attachment);
      let result = this.pdfCache.get(id);
      if (!result) {
        try {
          result = await this.opts.readPdf(attachment, (message) => {
            if (this.status) this.status.setText(str(message) || "Reading the PDF...");
          });
        } catch (e) {
          return {
            ok: false,
            error: `Nothing was sent: ${attachment.path} could not be read (${str(e && e.message ? e.message : e) || "unknown error"}). Remove it or restore the file, then try again.`,
          };
        }
        this.pdfCache.set(id, result);
      }
      const built = chatPdf.buildBlock(attachment, result && result.pages, {
        maxChars: Math.max(1, Math.min(chatPdf.MAX_CHARS, remaining)),
      });
      if (!built.ok) {
        return {
          ok: false,
          error: `Nothing was sent: ${attachment.path} has no extractable text layer. Remove it or OCR it first.`,
        };
      }
      blocks.push(built.text);
      used += built.chars;
      remaining -= built.chars;
      if (remaining <= 0) break;
    }
    if (used > 0 && remaining < 0) {
      blocks.push("[Some PDF text was omitted to stay inside the local attachment limit.]");
    }
    return { ok: true, block: blocks.join("\n\n") };
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
    // Copilot swaps the single accent button between Send and Stop. Enter in
    // the composer still queues a follow-up while a reply is running.
    this.stopBtn.toggleClass("qt-hidden", !b);
    this.sendBtn.toggleClass("qt-hidden", b);
    this.sendBtn.disabled = this.thinkFirstRemaining() > 0;
    this.status.setText(b ? "Working... You can type a follow-up and queue it." : "");
  }

  /** Stop a Direct API reply mid-stream; the partial reply is kept once. */
  cancelApi() {
    const wasPlan = Boolean(this.planRunToken || this.planStep || this.planRequest || (this.plan && this.plan.status === "running"));
    this.settlePlanRequest({ kind: "aborted" });
    this.settlePlanStep({ kind: "aborted" });
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
    if (!wasPlan && this.queueItems().length) this.drainQueue();
  }

  /** The Stop button and Esc: cancel the current backend, keeping any partial reply. */
  async stop() {
    const wasPlan = Boolean(this.planRunToken || this.planStep || this.planRequest || (this.plan && this.plan.status === "running"));
    this.settlePlanRequest({ kind: "aborted" });
    this.settlePlanStep({ kind: "aborted" });
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
    if (!wasPlan && this.queueItems().length) this.drainQueue();
  }

  newChat() {
    if (this.busy) return;
    if (typeof this.opts.onNewChat === "function") {
      this.opts.onNewChat();
      return;
    }
    this.opts.setSessionId("");
    this.setQueue([]);
    this.setPlan(null);
    this.setPdfs([]);
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
    this.proposalCard = null;
    this.suggestionIndex = 0;
    this.startThinkFirst();
    this.renderModelSelect();
    this.refreshTokenFooter();
    this.draw();
  }

  /** The in-panel conversation list; only the caller decides where conversations live. */
  renderLibrary(root) {
    if (typeof this.opts.getLibrary !== "function") return;
    this.libraryWrap = root.createDiv({ cls: "qt-chat-library qt-agent-library qt-hidden", attr: { id: "qt-agent-library" } });
    this.libraryEl = this.libraryWrap;
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
    const projectRow = this.libraryWrap.createDiv({ cls: "qt-row qt-small-row qt-chat-library-project" });
    projectRow.createSpan({ text: "This chat:" });
    this.projectAssign = projectRow.createEl("select", {
      cls: "dropdown",
      attr: { "aria-label": "Project for this chat" },
    });
    this.projectAssign.addEventListener("change", () => this.applyProjectSelection());
    projectRow.createSpan({ text: "Filter:" });
    this.projectSelect = projectRow.createEl("select", {
      cls: "dropdown",
      attr: { "aria-label": "Filter conversations by project" },
    });
    this.projectSelect.addEventListener("change", () => {
      this.libraryProject = str(this.projectSelect.value);
      this.refreshLibrary();
    });
    this.projectRemove = projectRow.createEl("button", { text: "Remove project" });
    this.projectRemove.addEventListener("click", () => this.removeLibraryProject());
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

  /** The saved-conversation list is a drawer, closed by default like a chat app. */
  toggleLibrary() {
    this.libraryOpen = !this.libraryOpen;
    if (this.libraryEl) this.libraryEl.toggleClass("qt-hidden", !this.libraryOpen);
    if (this.libraryButton) {
      this.libraryButton.setAttr("aria-expanded", this.libraryOpen ? "true" : "false");
      this.libraryButton.toggleClass("is-selected", this.libraryOpen);
    }
  }

  refreshLibrary() {
    if (!this.libraryList) return;
    this.refreshProjectOptions();
    const rows = this.libraryRows();
    this.libraryList.empty?.();
    if (!rows.length) {
      this.libraryList.createDiv({
        cls: "qt-hint",
        text: str(this.libraryQuery).trim()
          ? "No conversation matches that search."
          : this.libraryProject
            ? "No conversation in this project yet."
            : "No saved conversations yet.",
      });
      return;
    }
    for (const row of rows) {
      const item = this.libraryList.createDiv({
        cls: `qt-chat-library-row${row.active ? " is-active" : ""}${row.archived ? " is-archived" : ""}`,
      });
      const open = item.createEl("button", {
        cls: "qt-chat-library-open",
        text: `${row.pinned ? "Pinned · " : ""}${row.title}${row.projectName ? ` · ${row.projectName}` : ""}${row.when ? ` — ${row.when}` : ""}${row.model ? ` · ${row.model}` : ""}${row.archived ? " (archived)" : ""}`,
      });
      open.addEventListener("click", () => this.openLibraryRow(row));
      const actions = item.createDiv({ cls: "qt-row qt-small-row qt-chat-library-actions" });
      const pin = actions.createEl("button", { text: row.pinned ? "Unpin" : "Pin" });
      pin.addEventListener("click", () => this.pinLibraryRow(row));
      const exportButton = actions.createEl("button", { text: "Export" });
      exportButton.addEventListener("click", () => this.exportLibraryRow(row));
      if (row.archived) {
        const restore = actions.createEl("button", { text: "Restore" });
        restore.addEventListener("click", () => this.restoreLibraryRow(row));
      } else {
        const archive = actions.createEl("button", { text: "Archive" });
        archive.addEventListener("click", () => this.archiveLibraryRow(row));
      }
    }
  }

  /** Project pickers come from the caller; an absent list leaves them empty. */
  refreshProjectOptions() {
    const projects = typeof this.opts.getProjects === "function" ? this.opts.getProjects() : [];
    const rows = Array.isArray(projects) ? projects : [];
    const fill = (select, options, selected) => {
      if (!select) return;
      select.empty?.();
      for (const [value, text] of options) {
        const option = select.createEl("option", { text, value });
        option.value = value;
      }
      select.value = selected;
    };
    if (this.projectAssign) {
      const current = typeof this.opts.getProject === "function" ? str(this.opts.getProject()) : "";
      const selected = rows.some((project) => str(project.id) === current) ? current : "";
      fill(
        this.projectAssign,
        [["", "No project"]]
          .concat(rows.map((project) => [str(project.id), str(project.name)]))
          .concat([["__new", "New project..."]]),
        selected
      );
    }
    if (this.projectSelect) {
      const known =
        this.libraryProject === "" ||
        this.libraryProject === "none" ||
        rows.some((project) => str(project.id) === this.libraryProject);
      if (!known) this.libraryProject = "";
      fill(
        this.projectSelect,
        [["", "All projects"], ["none", "Unassigned"]].concat(rows.map((project) => [str(project.id), str(project.name)])),
        this.libraryProject
      );
    }
    if (this.projectRemove && typeof this.projectRemove.toggleClass === "function") {
      const current = typeof this.opts.getProject === "function" ? str(this.opts.getProject()) : "";
      this.projectRemove.toggleClass("qt-hidden", !current);
    }
  }

  applyProjectSelection() {
    if (!this.projectAssign) return;
    const value = str(this.projectAssign.value);
    if (value === "__new") {
      if (typeof this.opts.onNewProject === "function") this.opts.onNewProject();
      else this.refreshProjectOptions();
      return;
    }
    if (typeof this.opts.setProject === "function") this.opts.setProject(value);
  }

  removeLibraryProject() {
    const current = typeof this.opts.getProject === "function" ? str(this.opts.getProject()) : "";
    if (!current || typeof this.opts.onRemoveProject !== "function") return;
    this.opts.onRemoveProject(current);
    this.refreshLibrary();
  }

  async exportLibraryRow(row) {
    if (this.busy || !row || typeof this.opts.onExportChat !== "function") return;
    try {
      await this.opts.onExportChat(row.id);
    } catch (e) {
      if (this.status) this.status.setText("That conversation could not be exported.");
    }
    this.refreshLibrary();
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
        ? this.opts.getLibrary({ query: this.libraryQuery, includeArchived: this.showArchived, project: this.libraryProject })
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
      new Notice(`Could not save the chat: ${errorDetail(e)}. The transcript is still here; try Save chat again.`, 9000);
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
    this.proposalCard = null;
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
    let stepOutcome = null;
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
        system: this.opts.buildContext(ai.mode, currentNote, this.includeSkills ? this.skillBlock : "", this.includeMemory ? chatMemory.factBlock(this.ai.chatMemory) : ""),
      };
      const model = modelFromString(modelPlan.model);
      if (model) body.model = model;
      if (str(ai.agent).trim()) body.agent = ai.agent.trim();
      const tools = toolsForMode(this.planRequest ? "tutor" : ai.mode, ai.agentShell);
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
      stepOutcome = { kind: stopped ? "aborted" : "error", message: this.error || "The step request failed." };
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
        if (this.planRequest) {
          this.setProposalCard({ kind: "edits", status: "declined", changes: staged });
          this.settlePlanRequest({ kind: "reply", text: "" });
          this.settlePlanStep({ kind: "refused", message: "The plan request tried to change a note; nothing was applied." });
        } else {
          this.setProposalCard({ kind: "edits", status: "pending", changes: staged });
          const modal = new AgentEditReviewModal(this.view.app, plugin, staged, (result) => {
            const applied = result && Array.isArray(result.applied) ? result.applied.length : 0;
            const conflicts = result && Array.isArray(result.conflicts) ? result.conflicts : [];
            this.finishProposalCard(applied ? (conflicts.length ? "partial" : "applied") : "declined");
            this.settlePlanStep(applied ? { kind: "applied", errors: conflicts } : { kind: "declined" });
          });
          if (this.planStep) this.planReviewModal = modal;
          modal.open();
        }
        if (this.status) {
          this.status.setText(
            `Agent changes to ${staged.length} note${staged.length === 1 ? "" : "s"} are paused. Review them before applying.`
          );
        }
      } else {
        this.settlePlanStep(stepOutcome || { kind: "reply" });
        if (this.planRequest) {
          const last = [...this.turns].reverse().find((turn) => turn.role === "assistant");
          this.settlePlanRequest(
            stepOutcome && stepOutcome.kind !== "reply"
              ? stepOutcome
              : { kind: "reply", text: last ? last.texts.join("\n") : "" }
          );
        }
      }
      if (!this.planStep && this.queueItems().length) this.drainQueue();
    }
    return true;
  }

  /** Persist and repaint the plan; the caller owns where the plan lives. */
  setPlan(plan) {
    this.plan = chatPlan.normalizePlan(plan);
    if (typeof this.opts.savePlan === "function") this.opts.savePlan(this.plan);
    this.renderPlan();
    return this.plan;
  }

  planStatus(text) {
    if (this.status && text) this.status.setText(text);
  }

  /** The inline plan, rendered only from stored state so it survives a redraw. */
  renderPlan() {
    if (!this.planEl) return;
    this.planEl.empty();
    const plan = this.plan;
    this.planEl.toggleClass("qt-hidden", !plan);
    if (!plan) return;
    const head = this.planEl.createDiv({ cls: "qt-row qt-small-row qt-chat-plan-head" });
    head.createSpan({ cls: "qt-chat-plan-title", text: "Plan" });
    if (plan.goal) head.createSpan({ cls: "qt-hint", text: chatMemory.redactSecrets(plan.goal) });
    head.createSpan({ cls: "qt-hint", text: chatPlan.progressText(plan) });
    const list = this.planEl.createEl("ol", { cls: "qt-chat-plan-steps" });
    plan.steps.forEach((step, index) => {
      const row = list.createEl("li", { cls: `qt-chat-plan-step is-${step.status}` });
      row.createSpan({ cls: "qt-chat-plan-text", text: chatMemory.redactSecrets(step.text) });
      row.createSpan({ cls: "qt-chat-plan-status", text: chatPlan.stepStatusLabel(step.status) });
      if (step.note) row.createSpan({ cls: "qt-hint qt-chat-plan-note", text: chatMemory.redactSecrets(step.note) });
      const actions = row.createDiv({ cls: "qt-row qt-small-row" });
      const locked = plan.status === "running" || step.status === "running" || step.status === "done";
      const approve = actions.createEl("button", { text: step.status === "approved" ? "Approved" : "Approve" });
      approve.disabled = locked;
      approve.addEventListener("click", () => this.approvePlanStep(index));
      const skip = actions.createEl("button", { text: step.status === "skipped" ? "Skipped" : "Skip" });
      skip.disabled = locked;
      skip.addEventListener("click", () => this.skipPlanStep(index));
    });
    const actions = this.planEl.createDiv({ cls: "qt-row qt-small-row qt-chat-plan-actions" });
    const run = actions.createEl("button", {
      text: plan.status === "running" ? "Running..." : "Run approved",
      cls: "mod-cta",
    });
    run.disabled = plan.status === "running" || !chatPlan.approvedIndexes(plan).length;
    run.addEventListener("click", () => this.runApprovedPlan());
    if (plan.status === "running") {
      const stop = actions.createEl("button", { text: "Stop plan" });
      stop.addEventListener("click", () => this.stopPlan());
    }
    const clear = actions.createEl("button", { text: "Clear plan" });
    clear.disabled = plan.status === "running";
    clear.addEventListener("click", () => this.clearPlan());
    const message = chatPlan.stopMessage(plan);
    if (message) {
      this.planEl.createDiv({
        cls: `qt-hint qt-chat-plan-message${plan.stopReason ? " is-stopped" : ""}`,
        text: message,
      });
    }
  }

  approvePlanStep(index) {
    if (!this.plan || this.plan.status === "running") return false;
    const next = chatPlan.approveStep(this.plan, index);
    if (!next) return false;
    this.setPlan(next);
    this.planStatus("Step approved. Run approved steps when you are ready.");
    return true;
  }

  skipPlanStep(index) {
    if (!this.plan || this.plan.status === "running") return false;
    const next = chatPlan.skipStep(this.plan, index);
    if (!next) return false;
    this.setPlan(next);
    this.planStatus("Step skipped. Nothing runs for it.");
    return true;
  }

  clearPlan() {
    if (!this.plan || this.plan.status === "running") return false;
    this.setPlan(null);
    this.planStatus("Plan cleared.");
    return true;
  }

  /**
   * Ask for a numbered plan through the existing chat path. The request is
   * abortable, nothing is written and no step runs until it is approved.
   */
  async startPlan(goal) {
    if (!this.ai.enabled) {
      this.planStatus("Turn on AI features before asking for a plan.");
      return false;
    }
    if (this.busy || this.planRequest || this.planRunToken) {
      this.planStatus("Wait for the current reply or plan run to finish.");
      return false;
    }
    const prompt = chatPlan.planPrompt(goal);
    if (!prompt) {
      this.planStatus("Type a goal first.");
      return false;
    }
    const previous = this.plan;
    let resolve;
    const done = new Promise((r) => {
      resolve = r;
    });
    this.planRequest = { resolve };
    let sent;
    try {
      sent = await this.send(prompt);
    } catch (e) {
      this.settlePlanRequest({ kind: "error", message: str(e && e.message ? e.message : e) || "The plan request failed." });
      sent = true;
    }
    if (sent === false) this.settlePlanRequest({ kind: "refused", message: this.error || "The request was not sent." });
    const outcome = await done;
    if (outcome.kind !== "reply") {
      this.setPlan(previous);
      this.planStatus(
        outcome.kind === "aborted"
          ? chatPlan.reasonText("aborted")
          : outcome.kind === "refused"
            ? outcome.message || chatPlan.reasonText("refused")
            : outcome.kind === "error"
              ? outcome.message || chatPlan.reasonText("error")
              : chatPlan.reasonText("empty")
      );
      return false;
    }
    const parsed = chatPlan.parsePlan(outcome.text);
    if (!parsed.ok) {
      this.setPlan(previous);
      this.planStatus(chatPlan.reasonText(parsed.reason));
      return false;
    }
    const next = chatPlan.createPlan(goal, parsed.steps, Date.now());
    if (!next) {
      this.setPlan(previous);
      this.planStatus(chatPlan.reasonText("empty"));
      return false;
    }
    this.setPlan(next);
    this.planStatus(
      `Plan ready: ${next.steps.length} step${next.steps.length === 1 ? "" : "s"}. Approve the steps you want, then Run approved.`
    );
    return true;
  }

  /** Run approved steps in order; each step still goes through the normal send path. */
  async runApprovedPlan() {
    if (!this.plan || this.plan.status === "running" || this.planRunToken) return false;
    if (this.busy) {
      this.planStatus("Wait for the current reply to finish before running the plan.");
      return false;
    }
    const approved = chatPlan.approvedIndexes(this.plan);
    if (!approved.length) {
      this.planStatus("Approve at least one step first. Nothing was run.");
      return false;
    }
    const token = (this.planRunToken = (this.planRunToken || 0) + 1);
    this.setPlan(chatPlan.startPlan(this.plan));
    let stopped = null;
    try {
      for (const index of approved) {
        if (this.planRunToken !== token) {
          stopped = { reason: "aborted", index };
          break;
        }
        if (this.busy) {
          stopped = { reason: "error", index, message: "Another reply was still running, so this step was not sent." };
          break;
        }
        const step = this.plan && this.plan.steps[index];
        if (!step || step.status !== "approved") continue;
        this.setPlan(chatPlan.markStep(this.plan, index, "running"));
        const outcome = await this.runPlanStep(chatPlan.stepPrompt(this.plan, index));
        if (this.planRunToken !== token) {
          if (this.plan && this.plan.steps[index]) this.setPlan(chatPlan.markStep(this.plan, index, "approved"));
          stopped = { reason: "aborted", index };
          break;
        }
        if (outcome.kind === "reply" || outcome.kind === "applied") {
          if (outcome.errors && outcome.errors.length) {
            this.setPlan(chatPlan.markStep(this.plan, index, "failed", outcome.errors[0]));
            stopped = { reason: "error", index, message: outcome.errors[0] };
            break;
          }
          this.setPlan(chatPlan.markStep(this.plan, index, "done"));
          continue;
        }
        if (outcome.kind === "partial") {
          const note = `Applied ${outcome.applied} proposed action${outcome.applied === 1 ? "" : "s"}; ${outcome.declined} declined.`;
          this.setPlan(chatPlan.markStep(this.plan, index, "failed", note));
          stopped = { reason: "partial", index, message: note };
          break;
        }
        if (outcome.kind === "declined") {
          this.setPlan(chatPlan.markStep(this.plan, index, "declined", "The proposed writes were not applied."));
          stopped = { reason: "declined", index };
          break;
        }
        if (outcome.kind === "aborted") {
          this.setPlan(chatPlan.markStep(this.plan, index, "approved"));
          stopped = { reason: "aborted", index };
          break;
        }
        if (outcome.kind === "refused") {
          this.setPlan(chatPlan.markStep(this.plan, index, "approved", outcome.message || ""));
          stopped = { reason: "refused", index, message: outcome.message || "" };
          break;
        }
        this.setPlan(chatPlan.markStep(this.plan, index, "failed", outcome.message || ""));
        stopped = { reason: "error", index, message: outcome.message || "" };
        break;
      }
    } finally {
      this.planRunToken = 0;
      this.planStep = null;
      this.planReviewModal = null;
    }
    const final = stopped
      ? chatPlan.pausePlan(this.plan, stopped.reason, stopped.index)
      : chatPlan.finishPlan(this.plan, "not-approved");
    this.setPlan(final);
    const message = stopped && stopped.message ? `${chatPlan.stopMessage(final)} ${stopped.message}`.trim() : chatPlan.stopMessage(final);
    this.planStatus(message);
    if (this.queueItems().length) this.drainQueue();
    return !stopped;
  }

  async runPlanStep(prompt) {
    const text = str(prompt).trim();
    if (!text) return { kind: "refused", message: "That step had no text, so nothing was sent." };
    let resolve;
    const done = new Promise((r) => {
      resolve = r;
    });
    this.planStep = { resolve, token: this.planRunToken };
    let sent;
    try {
      sent = await this.send(text);
    } catch (e) {
      this.settlePlanStep({ kind: "error", message: str(e && e.message ? e.message : e) || "The step request failed." });
      return done;
    }
    if (sent === false) this.settlePlanStep({ kind: "refused", message: this.error || "The step could not be sent." });
    return done;
  }

  settlePlanRequest(outcome) {
    const pending = this.planRequest;
    if (!pending) return false;
    this.planRequest = null;
    pending.resolve(outcome || { kind: "aborted" });
    return true;
  }

  settlePlanStep(outcome) {
    const pending = this.planStep;
    if (!pending) return false;
    this.planStep = null;
    pending.resolve(outcome || { kind: "aborted" });
    return true;
  }

  /** Stop the whole plan: no later step starts and an open review is discarded. */
  stopPlan() {
    const active = Boolean(this.plan && this.plan.status === "running") || Boolean(this.planRequest);
    if (!active) {
      this.planStatus("No plan is running.");
      return false;
    }
    this.planRunToken = 0;
    if (this.planReviewModal) {
      const modal = this.planReviewModal;
      this.planReviewModal = null;
      try {
        modal.close();
      } catch (e) {
        /* the review window may already be gone */
      }
    }
    this.settlePlanStep({ kind: "aborted" });
    this.settlePlanRequest({ kind: "aborted" });
    if (this.busy) this.cancelApi();
    const plan = this.plan;
    if (plan && plan.status === "running") {
      const index = plan.steps.findIndex((step) => step.status === "running");
      const next = index >= 0 ? chatPlan.markStep(plan, index, "approved") : plan;
      this.setPlan(chatPlan.pausePlan(next, "aborted", index));
    }
    this.planStatus("Plan stopped. No later step was run.");
    return true;
  }

  async sendApi(text, currentNote, resend, model) {
    this.proposalCard = null;
    const planning = Boolean(this.planRequest);
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
    let stepOutcome = null;
    let planningReply = "";
    const onDelta = (delta) => {
      if (token !== this.apiCancelToken) return;
      const chunk = str(delta);
      if (!chunk) return;
      partial += chunk;
      this.streamText = partial;
      this.draw();
    };
    try {
      const system = [
        this.opts.buildContext(agent ? "agent" : "tutor", currentNote, this.includeSkills ? this.skillBlock : "", this.includeMemory ? chatMemory.factBlock(this.ai.chatMemory) : ""),
        agent ? toolProtocol() : "",
      ]
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
      if (planning) planningReply = finalText;
      hist.push(...(resend ? [] : [{ role: "user", content: text }]), { role: "assistant", content: finalText });
      this.persistApiHistory();
      this.pending = "";
      this.streamText = "";
      if (agent && !planning && typeof this.view.plugin.parseByokToolProposals === "function") {
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
      stepOutcome = { kind: stopped ? "aborted" : "error", message: this.error || "The step request failed." };
      if (planning) this.settlePlanRequest(stepOutcome);
      if (!stopped && !kept) this.input.value = text;
    } finally {
      const current = token === this.apiCancelToken;
      if (current) {
        this.streamingController = null;
        this.setBusy(false);
        if (stoppedNote && this.status) this.status.setText(stoppedNote);
        this.turns = apiTurns(hist);
        this.refreshTokenFooter();
        this.draw();
      }
      if (proposals.length && current) {
        const total = proposals.length;
        let finished = false;
        this.setProposalCard({ kind: "tools", status: "pending", proposals: proposals.slice() });
        const modal = new AiToolReviewModal(this.view.app, this.view.plugin, proposals, {
          onDone: (result) => {
            if (finished) return;
            finished = true;
            if (this.planReviewModal === modal) this.planReviewModal = null;
            const applied = Math.max(0, Number(result && result.applied) || 0);
            const declined = Math.max(0, total - applied);
            this.finishProposalCard(applied ? (declined ? "partial" : "applied") : "declined");
            this.settlePlanStep({
              kind: applied ? (declined ? "partial" : "applied") : "declined",
              applied,
              declined,
              errors: (result && result.errors) || [],
            });
          },
        });
        if (this.planStep) this.planReviewModal = modal;
        modal.open();
      } else {
        this.settlePlanStep(stepOutcome || { kind: "reply" });
      }
      if (planning) {
        this.settlePlanRequest(
          planningReply
            ? { kind: "reply", text: planningReply }
            : stepOutcome || { kind: "error", message: "The plan request returned no text." }
        );
      }
    }
    if (!this.planStep && this.queueItems().length) this.drainQueue();
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
        "OpenCode has no AI provider connected yet. Open Settings > Study agent > AI and the assistant, choose a provider and paste an API key."
      );
    }
  }

  async refresh(sid) {
    sid = sid || this.opts.getSessionId();
    if (!sid || !this.serverReady()) return;
    try {
      const msgs = await this.view.plugin.openCode().messages(sid);
      this.turns = partsToTurns(msgs);
      this.refreshTokenFooter();
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

  /** Put text back in the composer after a rewind without sending it. */
  prefillComposer(text) {
    const value = str(text);
    if (!this.input || !value) return false;
    this.input.value = value;
    if (this.input.focus) this.input.focus();
    this.syncMentionChips();
    this.refreshTokenFooter();
    return true;
  }

  /** Escape returns from full screen when focus is on any control in the pane. */
  handleRootKeydown(event) {
    if (!event || event.key !== "Escape" || event.defaultPrevented || !this.fullscreen) return;
    if (this.busy) return;
    if (typeof event.preventDefault === "function") event.preventDefault();
    this.toggleFullscreen(false);
  }

  /** Phone-width full-screen mode is a visual class; the callback clears its Escape state. */
  toggleFullscreen(force) {
    const next = typeof force === "boolean" ? force : !this.fullscreen;
    this.fullscreen = next;
    if (this.root && typeof this.root.toggleClass === "function") this.root.toggleClass("qt-agent-fullscreen", next);
    if (this.fullscreenBtn) {
      this.fullscreenBtn.setText(next ? "Exit full screen" : "Expand");
      this.fullscreenBtn.setAttr("aria-pressed", next ? "true" : "false");
      this.fullscreenBtn.setAttr("aria-label", next ? "Exit full-screen chat" : "Open the chat full screen");
      this.fullscreenBtn.setAttr("data-glyph", next ? "⤡" : "⤢");
    }
    if (this.status && !this.busy) {
      this.status.setText(next ? "Full-screen chat. Press Escape or Exit to return." : "");
    }
    return next;
  }

  /** Starter actions are the caller's quick prompts when present, with study defaults behind them. */
  suggestionItems() {
    const quick = Array.isArray(this.opts.quick) ? this.opts.quick : [];
    return DEFAULT_SUGGESTIONS.map((fallback, index) => {
      const item = quick[index];
      if (!item) return { ...fallback };
      const label = str(item.label).trim() || fallback.label;
      return {
        label,
        title: label,
        detail: str(item.detail).trim() || fallback.detail,
        prompt: item.prompt !== undefined ? item.prompt : fallback.prompt,
        run: typeof item.run === "function" ? item.run : null,
      };
    });
  }

  startSuggestionRotation() {
    if (this.suggestionTimer || !this.emptyDeck || this.busy) return;
    this.suggestionTimer = activeWindow.setInterval(() => {
      if (!this.emptyDeck || this.busy) return;
      if (!this.transcript || !this.transcript.classList || !this.transcript.classList.contains("is-empty")) return;
      this.showSuggestion(this.suggestionIndex + 1);
    }, SUGGESTION_ROTATE_MS);
    if (this.suggestionTimer && typeof this.suggestionTimer.unref === "function") this.suggestionTimer.unref();
    if (this.view && typeof this.view.registerInterval === "function") this.view.registerInterval(this.suggestionTimer);
  }

  stopSuggestionRotation() {
    if (!this.suggestionTimer) return;
    activeWindow.clearInterval(this.suggestionTimer);
    this.suggestionTimer = 0;
  }

  showSuggestion(index) {
    const items = this.suggestionItems();
    if (!items.length) return null;
    const next = ((Number(index) || 0) % items.length + items.length) % items.length;
    this.suggestionIndex = next;
    this.paintSuggestionDeck();
    return items[next];
  }

  activateSuggestion(item) {
    if (!item || this.busy) return false;
    if (typeof item.run === "function") {
      item.run.call(this);
      return true;
    }
    if (item.prompt) {
      this.send(item.prompt);
      return true;
    }
    return false;
  }

  /** Stack three cards; only the front card is clickable, and the dots choose a card directly. */
  paintSuggestionDeck() {
    if (!this.emptyDeck) return;
    const items = this.suggestionItems();
    this.emptyDeck.empty();
    if (this.suggestionDots) this.suggestionDots.empty();
    if (!items.length) return;
    const active = ((Number(this.suggestionIndex) || 0) % items.length + items.length) % items.length;
    this.suggestionIndex = active;
    items.forEach((item, index) => {
      const offset = (index - active + items.length) % items.length;
      const position = offset === 0 ? "active" : offset === 1 ? "next" : "far";
      const card = this.emptyDeck.createEl("button", {
        cls: `qt-agent-suggestion-card is-${position}`,
        attr: { type: "button", "aria-hidden": offset === 0 ? "false" : "true", tabindex: offset === 0 ? "0" : "-1" },
      });
      card.createSpan({ cls: "qt-agent-suggestion-eyebrow", text: "Suggested action" });
      card.createSpan({ cls: "qt-agent-suggestion-title", text: item.title });
      card.createSpan({ cls: "qt-agent-suggestion-detail", text: item.detail });
      if (offset === 0) card.addEventListener("click", () => this.activateSuggestion(item));
      if (this.suggestionDots) {
        const dot = this.suggestionDots.createEl("button", {
          cls: `qt-agent-suggestion-dot${offset === 0 ? " is-active" : ""}`,
          attr: {
            type: "button",
            "aria-label": `Show suggestion ${index + 1} of ${items.length}: ${item.label}`,
            "aria-pressed": offset === 0 ? "true" : "false",
          },
        });
        dot.addEventListener("click", () => this.showSuggestion(index));
      }
    });
  }

  renderEmptyState(box) {
    const intro = box.createDiv({ cls: "qt-agent-empty" });
    const head = intro.createDiv({ cls: "qt-agent-empty-head" });
    head.createDiv({ cls: "qt-agent-empty-mark", text: "✦", attr: { "aria-hidden": "true" } });
    head.createDiv({ cls: "qt-agent-empty-title", text: "How can I help you study?" });
    intro.createDiv({
      cls: "qt-agent-empty-text",
      text: "Ask about the note you have open, generate practice from a course note, or plan a session. Nothing is sent until you choose a card.",
    });
    const shell = intro.createDiv({ cls: "qt-agent-suggestion-shell" });
    this.emptyDeck = shell.createDiv({
      cls: "qt-agent-suggestion-deck",
      attr: { role: "group", "aria-label": "Suggested study actions" },
    });
    this.suggestionDots = shell.createDiv({ cls: "qt-agent-suggestion-dots", attr: { role: "group", "aria-label": "Suggestion choices" } });
    // Rotating under the pointer or the keyboard would move the card being read
    // and drop focus; pause while the deck is in use and resume when it is not.
    const pauseRotation = () => this.stopSuggestionRotation();
    const resumeRotation = () => {
      if (this.emptyDeck && this.transcript && this.transcript.classList && this.transcript.classList.contains("is-empty")) {
        this.startSuggestionRotation();
      }
    };
    shell.addEventListener("mouseenter", pauseRotation);
    shell.addEventListener("mouseleave", resumeRotation);
    shell.addEventListener("focusin", pauseRotation);
    shell.addEventListener("focusout", (event) => {
      if (!shell.contains(event.relatedTarget)) resumeRotation();
    });
    this.paintSuggestionDeck();
    this.startSuggestionRotation();
  }

  /** OpenCode tool parts become compact status cards instead of monospace lines. */
  renderToolCard(parent, line) {
    const raw = str(line).trim();
    if (!raw) return;
    const parts = raw.split(" · ");
    const name = (parts[0] || "tool").trim();
    const state = (parts[1] || "").trim().toLowerCase();
    const detail = parts.slice(2).join(" · ").trim();
    const failed = /error|fail|abort|cancel/.test(state);
    const running = /run|pend|work|progress/.test(state);
    const kind = failed ? "is-error" : running ? "is-running" : "is-done";
    const label = failed ? "Failed" : running ? "Running" : state ? "Done" : "Used";
    const card = parent.createDiv({ cls: `qt-agent-tool-card ${kind}`, attr: { role: "status" } });
    card.createSpan({
      cls: "qt-agent-tool-card-icon",
      text: failed ? "!" : running ? "…" : "✓",
      attr: { "aria-hidden": "true" },
    });
    const copy = card.createDiv({ cls: "qt-agent-tool-card-copy" });
    copy.createSpan({
      cls: "qt-agent-tool-card-title",
      text: TOOL_TITLES[name] || name.replace(/^./, (char) => char.toUpperCase()) || "Tool",
    });
    if (detail) copy.createSpan({ cls: "qt-agent-tool-card-detail", text: detail });
    card.createSpan({ cls: "qt-agent-tool-card-state", text: label });
  }

  /** A compact review card stays in the transcript after the modal closes, carrying the diff. */
  renderProposalCard(parent) {
    const proposal = this.proposalCard;
    if (!proposal) return;
    const status = PROPOSAL_STATUS_LABELS[proposal.status] ? proposal.status : "pending";
    const card = parent.createDiv({ cls: `qt-agent-proposal is-${status}`, attr: { role: "status" } });
    const head = card.createDiv({ cls: "qt-agent-proposal-head" });
    head.createSpan({
      cls: "qt-agent-proposal-mark",
      text: status === "pending" ? "…" : status === "applied" ? "✓" : status === "declined" ? "×" : "!",
      attr: { "aria-hidden": "true" },
    });
    const titles = head.createDiv({ cls: "qt-agent-proposal-titles" });
    titles.createDiv({ cls: "qt-agent-proposal-title", text: proposal.kind === "tools" ? "Proposed study actions" : "Proposed note edits" });
    if (proposal.kind === "tools") {
      const items = Array.isArray(proposal.proposals) ? proposal.proposals : [];
      titles.createDiv({
        cls: "qt-agent-proposal-detail",
        text: `${items.length} action${items.length === 1 ? "" : "s"} ready for review.`,
      });
      for (const item of items.slice(0, 4)) {
        const row = card.createDiv({ cls: "qt-agent-proposal-file" });
        row.createSpan({ cls: "qt-agent-proposal-path", text: PROPOSAL_TOOL_LABELS[item.tool] || str(item.tool) || "Action" });
        const preview = proposalPreview(item).split("\n").filter(Boolean)[0] || "";
        if (preview) row.createSpan({ cls: "qt-agent-proposal-file-state", text: preview });
      }
      if (items.length > 4) {
        card.createDiv({ cls: "qt-agent-proposal-note", text: `And ${items.length - 4} more action${items.length - 4 === 1 ? "" : "s"}.` });
      }
    } else {
      const changes = Array.isArray(proposal.changes) ? proposal.changes : [];
      const summary = summarizeEdits(changes);
      titles.createDiv({
        cls: "qt-agent-proposal-detail",
        text: `${summary.total} note${summary.total === 1 ? "" : "s"} changed: ${summary.added} added, ${summary.modified} modified, ${summary.deleted} deleted.`,
      });
      for (const change of changes.slice(0, 4)) {
        const diff = change && change.diff ? change.diff : { lines: [], added: 0, removed: 0 };
        const row = card.createDiv({ cls: "qt-agent-proposal-file" });
        row.createSpan({ cls: "qt-agent-proposal-path", text: str(change.path) || "Note" });
        row.createSpan({ cls: "qt-agent-proposal-file-state", text: PROPOSAL_FILE_LABELS[change.status] || "Changed" });
        row.createSpan({ cls: "qt-agent-proposal-count", text: `+${Number(diff.added) || 0} -${Number(diff.removed) || 0}` });
        const lines = Array.isArray(diff.lines) ? diff.lines.slice(0, 6) : [];
        if (lines.length) {
          const preview = card.createDiv({ cls: "qt-agent-proposal-diff", attr: { "aria-label": `Diff preview for ${change.path}` } });
          for (const line of lines) {
            const kind = line && line.kind === "add" ? "add" : line && line.kind === "del" ? "del" : "context";
            const marker = kind === "add" ? "+" : kind === "del" ? "-" : " ";
            preview.createDiv({ cls: `qt-agent-proposal-line is-${kind}`, text: `${marker}${str(line && line.text)}` });
          }
        }
      }
      if (changes.length > 4) {
        card.createDiv({ cls: "qt-agent-proposal-note", text: `And ${changes.length - 4} more note${changes.length - 4 === 1 ? "" : "s"}.` });
      }
    }
    head.createSpan({ cls: `qt-agent-proposal-status is-${status}`, text: PROPOSAL_STATUS_LABELS[status] });
    card.createDiv({
      cls: "qt-agent-proposal-note",
      text:
        status === "pending"
          ? "Nothing is written until you apply the review window."
          : status === "applied"
            ? "Applied through the existing review guard."
            : status === "partial"
              ? "Some changes were skipped or could not be applied."
              : "Discarded. Your notes are unchanged.",
    });
  }

  setProposalCard(card) {
    this.proposalCard = card && typeof card === "object" ? card : null;
    this.sig = "";
    this.draw();
    return this.proposalCard;
  }

  finishProposalCard(status) {
    if (!this.proposalCard) return false;
    this.proposalCard.status = ["applied", "partial", "declined"].includes(status) ? status : "declined";
    this.sig = "";
    this.draw();
    return true;
  }

  /** A compact icon action that keeps its full name as text for tooltips and tests. */
  actionButton(parent, label, glyph, className, onClick) {
    const button = parent.createEl("button", {
      text: label,
      cls: `qt-agent-action ${className || ""}`.trim(),
      attr: { "aria-label": label, title: label, "data-glyph": glyph },
    });
    if (typeof onClick === "function") button.addEventListener("click", onClick);
    return button;
  }

  /** OpenCode reasoning parts become the same collapsed activity block Copilot uses. */
  renderReasoning(parent, steps) {
    const rows = (Array.isArray(steps) ? steps : []).map((step) => str(step).trim()).filter(Boolean).slice(0, 12);
    if (!rows.length) return;
    const details = parent.createEl("details", { cls: "qt-agent-reasoning" });
    const summary = details.createEl("summary", { cls: "qt-agent-reasoning-summary" });
    summary.createSpan({ cls: "qt-agent-reasoning-mark", text: "✧", attr: { "aria-hidden": "true" } });
    summary.createSpan({ text: "Thought for a while" });
    const list = details.createEl("ul", { cls: "qt-agent-reasoning-steps" });
    for (const row of rows) list.createEl("li", { text: chatMemory.redactSecrets(row) });
  }

  /** Unique vault links in an assistant reply become a compact sources block. */
  citationPaths(texts) {
    const paths = [];
    const seen = new Set();
    const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
    for (const text of Array.isArray(texts) ? texts : []) {
      for (const match of str(text).matchAll(re)) {
        const path = str(match[1]).trim();
        if (!path || seen.has(path)) continue;
        if (match.index > 0 && str(text)[match.index - 1] === "!") continue;
        seen.add(path);
        paths.push(path);
      }
    }
    return paths.slice(0, 8);
  }

  renderSources(parent, paths) {
    if (!paths.length) return;
    const details = parent.createEl("details", { cls: "qt-agent-sources" });
    details.createEl("summary", { text: `Sources (${paths.length})` });
    const list = details.createEl("ul", { cls: "qt-agent-sources-list" });
    for (const path of paths) {
      const item = list.createEl("li");
      const link = item.createEl("a", {
        cls: "qt-agent-source",
        text: path,
        attr: { href: "#", title: `Open ${path}` },
      });
      link.addEventListener("click", (event) => {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        try {
          this.view.app.workspace.openLinkText(path, this.opts.sourcePath || "", false);
        } catch (e) {
          /* the note may have moved; the citation remains readable */
        }
      });
    }
  }

  draw() {
    if (!this.transcript) return;
    const sig = JSON.stringify([this.turns, this.pending, this.error, this.busy, this.streamText, this.bookmarks, this.proposalCard, this.ai.mode]);
    if (sig === this.sig) return;
    this.sig = sig;
    const box = this.transcript;
    box.empty();
    this.turnEls = [];
    const empty = !this.turns.length && !this.pending && !this.streamText && !this.error;
    box.toggleClass("is-empty", empty);
    // The stacked cards in the empty state replace the old row of chips.
    if (this.quickEl) this.quickEl.toggleClass("qt-hidden", true);
    const lastAssistant = [...this.turns].reverse().find((turn) => turn.role === "assistant");
    let lastAssistantStack = null;
    let userSeen = -1;

    // Copilot's row: a full-width padded card. Only the user card has a
    // border and hover fill; assistant replies sit directly on the pane.
    const turnRow = (role) => {
      const row = box.createDiv({ cls: `qt-agent-turn is-${role}` });
      const card = row.createDiv({ cls: `qt-agent-message is-${role}` });
      const body = card.createDiv({ cls: "qt-agent-message-body" });
      const message = body.createDiv({ cls: `qt-msg is-${role}` });
      return { card, body, message };
    };

    this.turns.forEach((t, index) => {
      if (t.role === "user") userSeen += 1;
      const { body, message } = turnRow(t.role);
      if (t.role === "assistant") lastAssistantStack = body;
      this.turnEls[index] = message;
      if (t.role === "assistant") this.renderReasoning(message, t.reasoning);
      for (const text of t.texts) {
        const textEl = message.createDiv({ cls: "qt-msg-text markdown-rendered" });
        this.view.md(text, textEl, this.opts.sourcePath || "");
      }
      if (t.role === "assistant") this.renderSources(message, this.citationPaths(t.texts));
      for (const line of t.tools) this.renderToolCard(message, line);
      const bookmark = chatBookmarks.makeBookmark(t, index);
      const assistantActions = t.role === "assistant" && t.texts.length && !this.busy;
      const branchable =
        t.role === "user" &&
        !this.busy &&
        typeof this.opts.onRewindTurn === "function" &&
        typeof this.opts.onForkTurn === "function" &&
        !(typeof this.opts.canBranch === "function" && !this.opts.canBranch());
      if (!bookmark && !assistantActions && !branchable) return;
      const actions = message.createDiv({ cls: "qt-msg-actions qt-agent-message-actions" });
      if (bookmark) {
        const saved = chatBookmarks.isBookmarked(this.bookmarks, bookmark);
        this.actionButton(
          actions,
          saved ? "Bookmarked" : "Bookmark",
          saved ? "⚑" : "⚐",
          `qt-msg-bookmark${saved ? " is-bookmarked" : ""}`,
          () => this.toggleBookmark(index, t)
        );
        if (saved) {
          this.actionButton(actions, "Copy link", "⛓", "qt-msg-bookmark-link", () => this.copyBookmarkLink(index, t));
        }
      }
      if (branchable) {
        const turn = userSeen;
        this.actionButton(actions, "Rewind", "↺", "", () => this.opts.onRewindTurn(turn));
        this.actionButton(actions, "Fork", "⑂", "", () => this.opts.onForkTurn(turn));
      }
      if (assistantActions) {
        this.actionButton(actions, "Copy", "⧉", "", () => this.copyText(t.texts.join("\n\n")));
        if (this.opts.onSaveNote) {
          this.actionButton(actions, this.opts.saveNoteLabel || "Add to My Notes", "↧", "qt-save-note", () => this.opts.onSaveNote(t.texts.join("\n\n")));
        }
        if (t === lastAssistant) {
          this.actionButton(actions, "Regenerate", "↻", "", () => this.regenerate());
        }
      }
    });
    if (this.pending) {
      const { message } = turnRow("user");
      message.addClass("is-pending");
      message.createDiv({ cls: "qt-msg-text", text: this.pending });
    }
    if (this.streamText) {
      const { message } = turnRow("assistant");
      message.addClass("is-streaming");
      const liveText = message.createDiv({ cls: "qt-msg-text markdown-rendered" });
      this.view.md(this.streamText, liveText, this.opts.sourcePath || "");
      liveText.createSpan({ cls: "qt-agent-caret", attr: { "aria-hidden": "true" } });
    } else if (this.busy) {
      const { message } = turnRow("assistant");
      message.addClass("is-typing");
      const typing = message.createDiv({ cls: "qt-agent-thinking", attr: { role: "status", "aria-live": "polite", "aria-label": "The study agent is thinking" } });
      typing.createSpan({ cls: "qt-agent-thinking-label", text: "Thinking" });
      for (let i = 0; i < 3; i++) typing.createSpan({ cls: "qt-agent-dot" });
    }
    if (this.error) {
      const boxed = box.createDiv({
        cls: "qt-error qt-agent-error",
        attr: { role: "alert", "aria-live": "assertive" },
      });
      const head = boxed.createDiv({ cls: "qt-agent-error-head" });
      head.createDiv({ cls: "qt-agent-error-mark", text: "!", attr: { "aria-hidden": "true" } });
      head.createDiv({
        cls: "qt-agent-error-title",
        text: this.busy ? "Reply interrupted" : "That reply did not finish",
      });
      boxed.createDiv({ cls: "qt-agent-error-text", text: this.error });
      const canRetry = this.lastSent && !this.busy;
      const needsSettings = errorNeedsSettings(this.error) && typeof this.view.plugin.openSettings === "function";
      if (canRetry || needsSettings) {
        const actions = boxed.createDiv({ cls: "qt-agent-error-actions" });
        if (canRetry) {
          const retry = actions.createEl("button", {
            text: "Retry",
            cls: "qt-agent-error-retry",
            attr: { "aria-label": "Retry the last message" },
          });
          retry.addEventListener("click", () => this.retry());
        }
        if (needsSettings) {
          const settings = actions.createEl("button", {
            text: "Open settings",
            cls: "qt-agent-error-settings",
            attr: { "aria-label": "Open AI settings" },
          });
          settings.addEventListener("click", () => this.view.plugin.openSettings("mcq-ai"));
        }
      }
    }
    if (this.proposalCard) this.renderProposalCard(lastAssistantStack || box);
    if (empty) {
      this.renderEmptyState(box);
    } else {
      this.emptyDeck = null;
      this.suggestionDots = null;
      this.stopSuggestionRotation();
    }
    box.scrollTop = box.scrollHeight;
  }

}

ChatPanel.toolsForMode = toolsForMode;

module.exports = {
  ChatPanel,
  toolsForMode,
};
