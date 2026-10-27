"use strict";
const { ApiClient, apiTurns, friendlyApiError } = require("./api-client");
const { str } = require("./util");
const { friendlyError, modelFromString, partsToTurns } = require("./opencode-client");

class ChatPanel {
  /**
   * opts: { title, sourcePath, getSessionId, setSessionId, buildContext(mode), quick: [{label,prompt}], onSaveNote(text) }
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
    const nc = top.createEl("button", { text: "New chat" });
    nc.addEventListener("click", () => {
      if (this.busy) return;
      this.opts.setSessionId("");
      this.apiHistory().length = 0;
      this.turns = [];
      this.pending = "";
      this.error = "";
      this.sig = "";
      this.draw();
    });
    this.hint = root.createDiv({ cls: "qt-hint" });
    this.updateHint();

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
    this.draw();
  }

  updateHint() {
    if (!this.hint) return;
    if (this.view.plugin.backend() === "api") {
      this.hint.setText("Direct API chat: it can see this question, but has no access to your files.");
      return;
    }
    this.hint.setText(
      this.ai.mode === "agent"
        ? "Agent mode: OpenCode may read and edit files in its working folder. Edits that need approval in your OpenCode permissions will wait until you press Stop."
        : "Tutor mode: file-editing tools are switched off for this chat."
    );
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
    if (this.view.plugin.backend() === "api") return this.sendApi(text);
    const plugin = this.view.plugin;
    const ai = this.ai;
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
        system: this.opts.buildContext(ai.mode),
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
      this.setBusy(false);
      if (sid) await this.refresh(sid);
      else this.draw();
    }
  }

  async sendApi(text) {
    this.error = "";
    this.input.value = "";
    this.pending = text;
    this.setBusy(true);
    this.draw();
    const hist = this.apiHistory();
    try {
      const reply = await new ApiClient(this.ai).chat(this.opts.buildContext("tutor"), hist.concat([{ role: "user", content: text }]));
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
