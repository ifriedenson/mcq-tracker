"use strict";
const { Modal, Notice, Platform, Setting, TFile, normalizePath } = require("obsidian");
const { FolderSuggest } = require("./modals");
const { ensureFolder, localDate, sleep, str } = require("./util");
const { chunkPages, readPdfPages, slugId } = require("./pdf");
const { DOCUMENT_EXTENSIONS, documentBaseName, documentKind, documentLabel, extensionOf, readDocumentPages } = require("./documents");
const { AGENT_SYSTEM, agentPrompt, aiFlags, answerKeyText, buildReportMarkdown, carryPassages, ensureProviders, extractNotesChunk, finalizeNote, groupIssues, mergeNotes, modelFromMessages, noteIssues, parseNote } = require("./importer");
const { friendlyError, modelFromString, partsToTurns } = require("./opencode-client");
const { findDuplicateIds, indexOfficialIds, officialIdOf } = require("./filters");
const { friendlyApiError } = require("./api-client");

class PdfImportModal extends Modal {
  constructor(app, plugin, options) {
    super(app);
    this.plugin = plugin;
    const init = options || {};
    this.file = init.file || null; // a File chosen from the device
    this.vaultDoc = init.vaultDoc || ""; // or a supported document path inside the vault
    this.stop = false;
    this.closed = false;
    this.items = [];
    this.warnings = [];
    this.folderTouched = false;
    const st = plugin.settings;
    this.meta = Object.assign(
      { test: "", course: "", section: "", domain: "", skill: "", unit: "", difficulty: "", prefix: "", start: "1", pages: "" },
      st.importDefaults || {}
    );
    this.opts = Object.assign({ capture: true, pagePics: false }, st.importOptions || {});
    this.parent = st.importFolder || st.questionFolder || "Questions";
    this.folder = "";
    this.method = this.agentAvailable() ? "agent" : "api";
  }

  agentAvailable() {
    return Platform.isDesktopApp && this.plugin.backend() === "opencode";
  }

  onOpen() {
    this.modalEl.addClass("qt-import-modal");
    this.showSetup();
  }

  onClose() {
    this.closed = true;
    this.contentEl.empty();
    this.plugin.refreshEmptyViews(); // the first-run screen goes away once the new notes are indexed
  }

  status(msg) {
    if (this.statusEl) this.statusEl.setText(msg);
  }

  modelLabel() {
    const api = this.plugin.settings.ai.api || {};
    return `${api.model || "your AI model"}${api.provider ? ` (${api.provider})` : ""}`;
  }

  autoFolder(name) {
    return normalizePath(`${this.parent}/${name}`);
  }

  showSetup() {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Import questions from a file" });

    const docs = this.app.vault.getFiles().filter((f) => documentKind(f.path || f.name));
    const picked = new Setting(el).setName("File").setDesc(this.file ? this.file.name : this.vaultDoc || "No file chosen");
    const setName = (name) => {
      if (!this.folderTouched) {
        this.folder = this.autoFolder(documentBaseName(name));
        if (this.folderText) this.folderText.setValue(this.folder);
      }
    };
    const input = createEl("input", { type: "file", attr: { accept: DOCUMENT_EXTENSIONS.map((e) => "." + e).join(",") } });
    input.hidden = true;
    input.addEventListener("change", () => {
      this.file = input.files && input.files[0] ? input.files[0] : null;
      if (this.file) {
        this.vaultDoc = "";
        picked.setDesc(this.file.name);
        setName(this.file.name);
      }
    });
    picked.addButton((b) => b.setButtonText("Choose file...").onClick(() => input.click()));
    if (docs.length) {
      new Setting(el).setName("...or a file in your vault").addDropdown((d) => {
        d.addOption("", "Choose...");
        for (const f of docs) d.addOption(f.path, f.path);
        d.setValue(this.vaultDoc).onChange((v) => {
          this.vaultDoc = v;
          if (v) {
            this.file = null;
            picked.setDesc("No file chosen");
            setName(v);
          }
        });
      });
    }

    new Setting(el)
      .setName("Create the notes in a new folder")
      .setDesc("It must not exist yet, or be empty. It's created for you.")
      .addText((t) => {
        this.folderText = t;
        new FolderSuggest(this.app, t.inputEl);
        t.setPlaceholder("Example: Questions/SAT Practice Test 1").setValue(this.folder).onChange((v) => {
          this.folder = v;
          this.folderTouched = true;
        });
      });
    if (!this.folderTouched && (this.file || this.vaultDoc)) {
      const sourceName = this.file ? this.file.name : this.vaultDoc;
      this.folder = this.autoFolder(documentBaseName(sourceName));
      if (this.folderText) this.folderText.setValue(this.folder);
    }

    const agentOk = this.agentAvailable();
    new Setting(el)
      .setName("Who writes the notes")
      .setDesc(
        agentOk
          ? "The OpenCode agent reads the file and writes the note files itself. Direct AI sends the text to your provider and the plugin writes the files after you review them."
          : "Direct AI sends the file's text to your provider, and the plugin writes the files after you review them. To let the OpenCode agent write the files itself, switch the AI backend to OpenCode in settings (desktop only)."
      )
      .addDropdown((d) => {
        if (agentOk) d.addOption("agent", "OpenCode agent (writes the files itself)");
        d.addOption("api", "Direct AI (you review first)");
        d.setValue(this.method).onChange((v) => (this.method = v));
      });

    new Setting(el)
      .setName("Capture figures and pictures (PDF only)")
      .setDesc("Draws each PDF page, cuts out charts, diagrams and images, saves them in an images folder next to the notes, and shows them in the questions that use them. Other formats are imported as text.")
      .addToggle((t) => t.setValue(this.opts.capture).onChange((v) => (this.opts.capture = v)));
    new Setting(el)
      .setName("Also save a picture of every page")
      .setDesc("A backup for when a figure isn't cut out cleanly. Uses more space.")
      .addToggle((t) => t.setValue(this.opts.pagePics).onChange((v) => (this.opts.pagePics = v)));

    const fields = [
      ["test", "Test", "Example: SAT, AP World History"],
      ["course", "Course", ""],
      ["section", "Section", ""],
      ["domain", "Domain", ""],
      ["unit", "Unit", "Example: 3"],
      ["difficulty", "Difficulty", "easy, medium or hard"],
      ["skill", "Skill (optional)", "Blank lets the file's own labels through"],
    ];
    el.createEl("h4", { text: "Properties added to every note (all optional)" });
    el.createEl("p", {
      cls: "qt-hint",
      text: "Leave a box blank and the AI reads that property from the file wherever it is shown, for each question (for example the Test, Domain, Skill and Difficulty in a question's table, and its Question ID). Whatever you type here is used for every note instead of what the file says.",
    });
    for (const [key, label, ph] of fields) {
      new Setting(el).setName(label).addText((t) => t.setPlaceholder(ph).setValue(this.meta[key]).onChange((v) => (this.meta[key] = v.trim())));
    }
    new Setting(el)
      .setName("Question id prefix")
      .setDesc("Ids look like PREFIX-Q01. Blank uses the file's name.")
      .addText((t) => t.setValue(this.meta.prefix).onChange((v) => (this.meta.prefix = v.trim())));
    new Setting(el)
      .setName("Pages or slides (optional)")
      .setDesc("Blank means every page or slide. Example: 1-12 or 2,4,6-8. Try a few first to check the result and the cost.")
      .addText((t) => t.setValue(this.meta.pages).onChange((v) => (this.meta.pages = v.trim())));

    el.createEl("p", {
      cls: "qt-hint",
      text:
        "Where the file doesn't show an answer or explanation, the AI writes one and says so at the top of that note, with the model name and today's date. AI answers can be wrong, so check them. " +
        "The file's text is sent to your AI provider, which may charge for long files. A copy of the original file is saved in the new folder with the notes.",
    });

    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Cancel", cls: "qt-grow" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Start import", cls: "mod-cta qt-grow" }).addEventListener("click", () => this.start());
  }

  async readSource() {
    if (this.file) {
      const name = this.file.name;
      return { buf: await this.file.arrayBuffer(), name: documentBaseName(name), ext: extensionOf(name), kind: documentKind(name), device: true };
    }
    if (this.vaultDoc) {
      const f = this.app.vault.getAbstractFileByPath(this.vaultDoc);
      if (!(f instanceof TFile)) throw new Error("I couldn't find that file in your vault.");
      const path = f.path || f.name;
      return { buf: await this.app.vault.readBinary(f), name: f.basename, ext: extensionOf(path), kind: documentKind(path), device: false, path: f.path };
    }
    throw new Error("Choose a file first.");
  }

  async start() {
    const p = this.plugin;
    if (!p.settings.ai.enabled) {
      new Notice("Turn on AI features in the plugin settings first.");
      return;
    }
    if (!this.file && !this.vaultDoc) {
      new Notice("Choose a file first.");
      return;
    }
    const folderPath = normalizePath(str(this.folder).trim());
    if (!folderPath || folderPath === "/") {
      new Notice("Type a name for the new folder.");
      return;
    }
    const existing = this.app.vault.getFolderByPath(folderPath);
    if (existing && existing.children.length) {
      new Notice("That folder already has files in it. Choose a new folder name.");
      return;
    }
    this.target = folderPath;
    p.settings.importFolder = folderPath.includes("/") ? folderPath.slice(0, folderPath.lastIndexOf("/")) : "";
    p.settings.importDefaults = Object.assign({}, this.meta, { prefix: "", pages: "" });
    p.settings.importOptions = Object.assign({}, this.opts);
    await p.save();

    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Importing" });
    this.statusEl = el.createDiv({ cls: "qt-hint", text: "Starting..." });
    this.activityEl = el.createDiv({ cls: "qt-tool" });
    this.stopBtn = el.createEl("button", { text: "Stop", cls: "qt-modal-btn" });
    this.stopBtn.addEventListener("click", () => {
      this.stop = true;
      this.stopBtn.disabled = true;
      this.status("Stopping...");
      if (this.sid) p.openCode().abort(this.sid).catch(() => {});
    });
    this.stop = false;
    this.sid = "";
    this.warnings = [];
    try {
      const src = await this.readSource();
      if (!src.kind) throw new Error(`This plugin can't read ${src.ext ? `.${src.ext}` : "that kind of"} files.`);
      this.source = src.name;
      const vault = this.app.vault;
      const folder = await ensureFolder(this.app, this.target);
      const prefix = slugId(this.meta.prefix || src.name);
      // keep a copy of the original file with the notes
      this.status("Copying the file into the folder...");
      const sourcePath = normalizePath(`${folder}/${src.name.replace(/[\\/:*?"<>|]/g, "-")}.${src.ext}`);
      await vault.createBinary(sourcePath, src.buf);
      const imagesDir = `${folder}/images`;
      if (this.opts.capture && src.kind !== "pdf") {
        this.warnings.push("Pictures are only captured from PDFs, so this import uses the text of the file.");
      }
      const cap = this.opts.capture && src.kind === "pdf"
        ? {
            prefix,
            scale: 2,
            pages: this.opts.pagePics,
            save: async (name, data) => {
              await ensureFolder(this.app, imagesDir);
              const path = normalizePath(`${imagesDir}/${name}`);
              await vault.createBinary(path, data);
              return path;
            },
          }
        : null;
      const read = src.kind === "pdf"
        ? await readPdfPages(src.buf, this.meta.pages, (m) => !this.closed && this.status(m), cap)
        : await readDocumentPages(src.buf, `${src.name}.${src.ext}`, this.meta.pages, (m) => !this.closed && this.status(m));
      const pages = read.pages;
      this.warnings.push(...read.warnings.slice(0, 5));
      const chars = pages.reduce((n, pg) => n + pg.text.trim().length, 0);
      if (chars < 40 * pages.length) {
        throw new Error(
          src.kind === "pdf"
            ? "This PDF has almost no readable text, so it is probably scanned images. Scanned PDFs aren't supported yet. Run it through text recognition (OCR) first, for example by opening it in Google Drive or Adobe, then try again."
            : `This ${documentLabel(`${src.name}.${src.ext}`)} file has almost no readable text. If it is a scanned document, run it through text recognition (OCR) first, then try again.`
        );
      }
      this.ctx = { folder, prefix, sourcePath, imagesDir, sourceName: src.name, kind: src.kind, figCount: read.figCount };
      if (this.method === "agent") await this.runAgent(pages);
      else await this.runApi(pages);
    } catch (e) {
      if (this.closed) return;
      this.showError(e && e.message ? e.message : String(e));
    }
  }

  /* ---- method 1: the OpenCode agent writes the files itself */

  async runAgent(pages) {
    const p = this.plugin;
    const vault = this.app.vault;
    const { folder, prefix, sourcePath, imagesDir, sourceName, kind } = this.ctx;
    const textPath = `${folder}/_import-text.txt`;
    await vault.create(textPath, pages.map((pg) => `--- Page ${pg.n} ---\n${pg.text.trim()}`).join("\n\n"));

    this.status("Starting OpenCode...");
    await p.ensureOpenCode((m) => !this.closed && this.status(m));
    const oc = p.openCode();
    await ensureProviders(oc);
    const s = await oc.createSession(`Import ${sourceName}`);
    this.sid = s && s.id;
    if (!this.sid) throw new Error("OpenCode did not return a session id.");
    const ai = p.settings.ai;
    const body = {
      parts: [{ type: "text", text: agentPrompt({ name: sourceName, textPath, docPath: sourcePath, imagesDir, folder, prefix, meta: this.meta, kind }) }],
      system: AGENT_SYSTEM,
    };
    const model = modelFromString(ai.model);
    if (model) body.model = model;
    if (str(ai.agent).trim()) body.agent = ai.agent.trim();

    const mySid = this.sid;
    const timer = activeWindow.setInterval(() => this.pollAgent(mySid, folder), 1500);
    let msgs = null;
    try {
      await oc.send(mySid, body);
    } catch (e) {
      if (!this.stop) throw new Error(friendlyError(e, oc.base()));
    } finally {
      activeWindow.clearInterval(timer);
    }
    try {
      msgs = await oc.messages(mySid);
    } catch (e) {
      /* the model name is only for the label */
    }
    this.status("Checking the notes...");
    await sleep(1500);
    const model2 = str(ai.model).trim() || modelFromMessages(msgs) || "the AI model set up in OpenCode";
    const result = await this.finishAgentNotes(folder, sourceName, {
      model: model2,
      date: localDate(),
      sourcePath,
      sourceKind: kind,
    });
    try {
      await this.app.vault.adapter.remove(textPath);
    } catch (e) {
      /* leave it */
    }
    await this.pruneImages(folder, result);
    result.issues = await this.auditNotes(folder);
    if (!this.closed) this.showAgentDone(result, folder);
  }

  /** Removes cut-out pictures that no note uses, so the images folder only holds what's needed. */
  async pruneImages(folder, result) {
    const adapter = this.app.vault.adapter;
    let listing;
    try {
      listing = await adapter.list(`${folder}/images`);
    } catch (e) {
      return;
    }
    const files = (listing && listing.files) || [];
    if (!files.length) return;
    let all = "";
    for (const n of await this.listNotes(folder)) all += await adapter.read(n);
    let kept = 0;
    for (const f of files) {
      const base = f.replace(/^.*\//, "");
      const isPage = /-p\d+\.png$/i.test(base);
      if ((isPage && this.opts.pagePics) || all.includes(base)) {
        kept++;
        continue;
      }
      try {
        await adapter.remove(f);
      } catch (e) {
        /* leave it */
      }
    }
    result.images = kept;
  }

  async listNotes(folder) {
    const listing = await this.app.vault.adapter.list(folder);
    return (listing.files || []).filter((f) => /\.md$/i.test(f) && !/\/_[^/]*$/.test(f)).sort();
  }

  async pollAgent(sid, folder) {
    if (this.closed) return;
    try {
      const msgs = await this.plugin.openCode().messages(sid);
      const lines = partsToTurns(msgs).flatMap((t) => t.tools).slice(-6);
      const n = (await this.listNotes(folder)).length;
      this.status(`The agent is working... ${n} note${n === 1 ? "" : "s"} written so far.`);
      if (this.activityEl) this.activityEl.setText(lines.join("\n"));
    } catch (e) {
      /* keep waiting */
    }
  }

  async finishAgentNotes(folder, source, stamp) {
    const files = await this.listNotes(folder);
    const meta = Object.assign({}, this.meta, { source });
    const result = { made: 0, ai: 0, noAnswer: 0, skipped: [], images: 0, ids: [], dupes: [], issues: [] };
    for (const path of files) {
      const text = await this.app.vault.adapter.read(path);
      const parsed = parseNote(text);
      const base = path.replace(/^.*\//, "").replace(/\.md$/i, "");
      if (!str(parsed.sec.question).trim()) {
        result.skipped.push(`${base}: no "## Question" section`);
        continue;
      }
      const f = this.app.vault.getAbstractFileByPath(path);
      const pre = aiFlags(parsed.fm, parsed.sec);
      let verification = null;
      if (pre.aiAnswer && parsed.sec.choices.length && typeof this.plugin.verifyDraftQuestions === "function") {
        const draft = { question: parsed.sec.question, choices: parsed.sec.choices, answer: str(parsed.fm.answer) };
        await this.plugin.verifyDraftQuestions([draft]);
        verification = draft.verification;
        if (verification && verification.drop) {
          if (f instanceof TFile) await this.app.vault.delete(f);
          else await this.app.vault.adapter.remove(path);
          result.skipped.push(`${base}: answer check failed`);
          continue;
        }
      }
      const out = finalizeNote(text, meta, base, { ...stamp, verification });
      if (f instanceof TFile) await this.app.vault.modify(f, out);
      else await this.app.vault.adapter.write(path, out);
      const fin = parseNote(out);
      const fl = aiFlags(fin.fm, fin.sec);
      if (fl.aiAnswer || fl.aiExp) result.ai++;
      if (!fl.hasAnswer) result.noAnswer++;
      result.made++;
      const oid = officialIdOf(fin.fm);
      if (oid) result.ids.push({ path, id: oid });
    }
    // the same official question id as a note you already had (or repeated in this file)
    result.dupes = findDuplicateIds(result.ids, indexOfficialIds(this.plugin.getQuestions(), folder));
    return result;
  }

  /** What looks wrong in the notes of this import: no answer, no choices, a missing figure. */
  async auditNotes(folder) {
    const adapter = this.app.vault.adapter;
    const exists = async (link) => {
      if (this.app.metadataCache.getFirstLinkpathDest(link, `${folder}/x.md`)) return true;
      try {
        return await adapter.exists(normalizePath(link));
      } catch (e) {
        return false;
      }
    };
    const issues = [];
    for (const path of await this.listNotes(folder)) {
      let text;
      try {
        text = await adapter.read(path);
      } catch (e) {
        continue;
      }
      const problems = await noteIssues(text, exists);
      if (problems.length) issues.push({ path, problems });
    }
    return issues;
  }

  showAgentDone(r, folder) {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: r.made ? `Created ${r.made} note${r.made === 1 ? "" : "s"}` : "No notes were created" });
    el.createEl("p", { text: `Saved in ${folder}, together with a copy of the original file${r.images ? ` and ${r.images} picture${r.images === 1 ? "" : "s"} cut from it (in the images folder)` : ""}.` });
    if (r.ai) {
      el.createEl("p", {
        cls: "qt-hint",
        text: `${r.ai} ${r.ai === 1 ? "has" : "have"} an answer or explanation written by the AI. ${r.ai === 1 ? "It's" : "They're"} marked at the top of the note with the model and date. Please check ${r.ai === 1 ? "it" : "them"}.`,
      });
    }
    if (r.noAnswer) el.createEl("p", { cls: "qt-hint", text: `${r.noAnswer} ${r.noAnswer === 1 ? "has" : "have"} no answer, so you'll grade ${r.noAnswer === 1 ? "it" : "those"} yourself.` });
    for (const s of r.skipped) el.createDiv({ cls: "qt-error", text: `Skipped ${s}` });
    this.renderDupes(el, r, folder);
    this.renderIssues(el, r, folder);
    if (!r.made && !(r.dupes && r.dupes.length)) {
      el.createEl("p", {
        cls: "qt-hint",
        text: "If the agent was waiting to be allowed to create files, allow file edits for this vault in your OpenCode permissions and try again.",
      });
    }
    this.doneButtons(el, folder, r.made);
  }

  /** Questions whose official id is already in your vault: skipped (review method) or listed so you can remove them (agent method). */
  renderDupes(el, r, folder) {
    const dupes = r.dupes || [];
    if (!dupes.length) return;
    const skipped = dupes.filter((d) => d.skipped);
    const made = dupes.filter((d) => !d.skipped);
    const open = (path) => {
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof TFile) this.app.workspace.getLeaf("tab").openFile(f);
    };
    if (skipped.length) {
      el.createEl("h4", { text: `Skipped ${skipped.length} already in your vault` });
      el.createDiv({ cls: "qt-hint", text: "These have the same question ID as a note you already have, so no new note was made." });
      for (const d of skipped.slice(0, 20)) {
        const row = el.createDiv({ cls: "qt-issue" });
        row.createSpan({ text: `${d.id} is already in ` });
        row.createEl("a", { text: d.other.replace(/^.*\//, ""), cls: "qt-link" }).addEventListener("click", () => open(d.other));
      }
    }
    if (made.length) {
      el.createEl("h4", { text: `${made.length} repeat${made.length === 1 ? "s" : ""} a question you already have` });
      el.createDiv({ cls: "qt-hint", text: "These new notes have the same question ID as another note. Keep them or move them to the trash." });
      for (const d of made.slice(0, 20)) {
        const row = el.createDiv({ cls: "qt-issue" });
        row.createEl("a", { text: d.path.replace(/^.*\//, ""), cls: "qt-link" }).addEventListener("click", () => open(d.path));
        row.createSpan({ text: ` has the same ID (${d.id}) as ` });
        row.createEl("a", { text: d.other.replace(/^.*\//, ""), cls: "qt-link" }).addEventListener("click", () => open(d.other));
      }
      const rm = el.createEl("button", { text: `Move the ${made.length} repeat${made.length === 1 ? "" : "s"} to the trash` });
      rm.addEventListener("click", async () => {
        rm.disabled = true;
        let gone = 0;
        for (const d of made) {
          const f = this.app.vault.getAbstractFileByPath(d.path);
          if (!(f instanceof TFile)) continue;
          try {
            await this.app.fileManager.trashFile(f);
            gone++;
          } catch (e) {
            /* leave it */
          }
        }
        const goneSet = new Set(made.map((d) => d.path));
        r.made = Math.max(0, r.made - gone);
        r.dupes = dupes.filter((d) => !goneSet.has(d.path));
        r.issues = (r.issues || []).filter((i) => !goneSet.has(i.path));
        new Notice(`Moved ${gone} note${gone === 1 ? "" : "s"} to the trash.`);
        this.showAgentDone(r, folder);
      });
    }
  }

  /** Notes that need a look: no answer, no answer choices, a missing figure. */
  renderIssues(el, r, folder) {
    const issues = r.issues || [];
    if (!issues.length) return;
    el.createEl("h4", { text: `Needs a look (${issues.length} note${issues.length === 1 ? "" : "s"})` });
    const groups = groupIssues(issues);
    for (const [problem, paths] of Object.entries(groups)) {
      el.createDiv({ cls: "qt-label", text: `${problem} (${paths.length})` });
      const list = el.createDiv({ cls: "qt-issue-list" });
      for (const path of paths.slice(0, 30)) {
        const a = list.createEl("a", { text: path.replace(/^.*\//, "").replace(/\.md$/i, ""), cls: "qt-link" });
        a.addEventListener("click", () => {
          const f = this.app.vault.getAbstractFileByPath(path);
          if (f instanceof TFile) this.app.workspace.getLeaf("tab").openFile(f);
        });
      }
      if (paths.length > 30) list.createSpan({ cls: "qt-hint", text: `and ${paths.length - 30} more (see the saved list)` });
    }
    const save = el.createEl("button", { text: "Save this list as a note" });
    save.addEventListener("click", async () => {
      const path = normalizePath(`${folder}/_import-report.md`);
      const md = buildReportMarkdown(folder, issues, (r.dupes || []).filter((d) => !d.skipped), localDate());
      try {
        const old = this.app.vault.getAbstractFileByPath(path);
        let f;
        if (old instanceof TFile) {
          await this.app.vault.modify(old, md);
          f = old;
        } else f = await this.app.vault.create(path, md);
        this.app.workspace.getLeaf("tab").openFile(f);
      } catch (e) {
        new Notice(`Couldn't save the list: ${e && e.message ? e.message : e}`);
      }
    });
  }

  /* ---- method 2: the AI returns the notes and you review them first */

  async runApi(pages) {
    const p = this.plugin;
    const chunks = chunkPages(pages, 9000, 5);
    const keyText = answerKeyText(pages);
    const client = { chat: (system, messages, opts) => p.aiChat(system, messages, { ...(opts || {}), feature: "generation" }) };
    const blocks = [];
    let carry = [];
    let failures = 0;
    for (let i = 0; i < chunks.length && !this.stop && !this.closed; i++) {
      const ch = chunks[i];
      this.status(`Asking the AI to read pages ${ch[0].n}-${ch[ch.length - 1].n} (batch ${i + 1} of ${chunks.length}). ${mergeNotes(blocks).length} questions found so far.`);
      try {
        blocks.push(...(await extractNotesChunk(client, ch, keyText, carry)));
        carry = carryPassages(blocks);
        failures = 0;
      } catch (e) {
        this.warnings.push(`Pages ${ch[0].n}-${ch[ch.length - 1].n}: ${friendlyApiError(e)}`);
        if (++failures >= 2) break;
      }
    }
    if (this.closed) return;
    this.items = mergeNotes(blocks);
    await this.verifyAiAnswers();
    if (this.closed) return;
    this.showReview();
  }

  /** Blind-check answers the AI wrote before the review list is shown. */
  async verifyAiAnswers() {
    if (!this.plugin.settings.ai.enabled || typeof this.plugin.verifyDraftQuestions !== "function") return;
    const candidates = this.items.filter((q) => {
      const f = aiFlags(q.fm, q.sec);
      return f.aiAnswer && q.sec.choices.length > 0;
    });
    if (!candidates.length) return;
    this.status(`Checking ${candidates.length} AI-written answer${candidates.length === 1 ? "" : "s"} without showing the key...`);
    const drafts = candidates.map((q) => ({ question: q.sec.question, choices: q.sec.choices, answer: str(q.fm.answer) }));
    await this.plugin.verifyDraftQuestions(drafts);
    candidates.forEach((q, i) => {
      q.verification = drafts[i].verification;
      if (q.verification && q.verification.drop) q.include = false;
    });
  }

  showError(msg) {
    const el = this.contentEl;
    el.empty();
    el.createEl("h3", { text: "Couldn't import" });
    el.createDiv({ cls: "qt-error", text: msg });
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Back", cls: "qt-grow" }).addEventListener("click", () => this.showSetup());
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
  }

  showReview() {
    const el = this.contentEl;
    el.empty();
    const items = this.items;
    el.createEl("h3", { text: items.length ? `Found ${items.length} question${items.length === 1 ? "" : "s"}` : "No questions found" });
    for (const w of this.warnings) el.createDiv({ cls: "qt-error", text: w });
    if (!items.length) {
      el.createEl("p", { cls: "qt-hint", text: "Try a smaller page range, or check that the file contains questions with readable text." });
      el.createEl("button", { text: "Back", cls: "qt-modal-btn" }).addEventListener("click", () => this.showSetup());
      return;
    }
    el.createEl("p", {
      cls: "qt-hint",
      text: "Check these against the original file. Answers the AI wrote itself are marked, and will be labelled at the top of the note. Untick anything you don't want.",
    });
    const tools = el.createDiv({ cls: "qt-row qt-small-row" });
    const list = el.createDiv({ cls: "qt-imp-list" });
    const create = el.createEl("button", { cls: "mod-cta qt-modal-btn" });
    const checks = [];
    const count = () => {
      const n = items.filter((q) => q.include).length;
      create.setText(`Create ${n} note${n === 1 ? "" : "s"}`);
      create.disabled = n === 0;
    };
    items.forEach((q) => {
      const row = list.createDiv({ cls: "qt-imp-row" });
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = q.include;
      cb.addEventListener("change", () => {
        q.include = cb.checked;
        count();
      });
      checks.push(cb);
      const body = row.createDiv({ cls: "qt-imp-body" });
      const text = str(q.sec.question).replace(/\s+/g, " ");
      const num = q.fm.number !== undefined && q.fm.number !== null && q.fm.number !== "" ? `${q.fm.number}. ` : "";
      body.createDiv({ cls: "qt-imp-title", text: `${num}${text.length > 130 ? text.slice(0, 130) + "..." : text}` });
      const f = aiFlags(q.fm, q.sec);
      const tags = [q.sec.choices.length ? `${q.sec.choices.length} choices` : "no answer choices"];
      tags.push(!f.hasAnswer ? "no answer" : f.aiAnswer ? `answer ${str(q.fm.answer)} (written by AI)` : `answer ${str(q.fm.answer)} (from the file)`);
      if (f.aiExp) tags.push("explanation written by AI");
      const v = q.verification;
      if (v) tags.push(v.status === "match" ? "answer checked" : v.status === "mismatch" ? `answer check failed: AI chose ${v.answer}` : "answer check did not finish");
      if (str(q.sec.stimulus).trim()) tags.push("has passage");
      if (/!\[\[/.test(q.text)) tags.push("has picture");
      if (/\[Figure not captured\]/i.test(q.sec.stimulus)) tags.push("figure missing");
      body.createDiv({ cls: "qt-imp-tags", text: tags.join(" · ") });
    });
    const setAll = (v) => {
      items.forEach((q) => (q.include = v));
      checks.forEach((c) => (c.checked = v));
      count();
    };
    tools.createEl("button", { text: "Select all" }).addEventListener("click", () => setAll(true));
    tools.createEl("button", { text: "Select none" }).addEventListener("click", () => setAll(false));
    tools.createEl("button", { text: "Back" }).addEventListener("click", () => this.showSetup());
    count();
    create.addEventListener("click", () => this.createNotes());
  }

  async createNotes() {
    const el = this.contentEl;
    const chosen = this.items.filter((q) => q.include);
    el.empty();
    el.createEl("h3", { text: "Creating notes" });
    this.statusEl = el.createDiv({ cls: "qt-hint", text: "Working..." });
    try {
      const { folder, prefix, sourcePath, kind } = this.ctx;
      const nums = chosen.map((q) => q.fm.number);
      const useNums = nums.every((n) => Number.isFinite(Number(n)) && n !== null && n !== "" && n !== undefined) && new Set(nums.map(Number)).size === nums.length;
      const stimIds = new Map();
      const meta = Object.assign({}, this.meta, { source: this.source });
      const stamp = { model: this.modelLabel(), date: localDate(), sourcePath, sourceKind: kind };
      const result = { made: 0, ai: 0, noAnswer: 0, skipped: [], images: 0, ids: [], dupes: [], issues: [] };
      const existingIds = indexOfficialIds(this.plugin.getQuestions(), folder);
      const seenIds = new Map();
      for (let i = 0; i < chosen.length; i++) {
        const q = chosen[i];
        if (q.verification && q.verification.drop) {
          result.skipped.push(`${q.fm.number || i + 1}: answer check failed`);
          continue;
        }
        const oid = officialIdOf(q.fm);
        const other = oid && (existingIds.get(oid) || seenIds.get(oid));
        if (other) {
          result.dupes.push({ path: "", id: oid, other, skipped: true });
          continue;
        }
        const n = useNums ? Number(q.fm.number) : (parseInt(this.meta.start, 10) || 1) + i;
        const qid = `${prefix}-Q${String(n).padStart(2, "0")}`;
        let stimId = "";
        const stim = str(q.sec.stimulus).trim();
        if (stim) {
          const key = stim.toLowerCase().replace(/\s+/g, " ");
          if (!stimIds.has(key)) stimIds.set(key, `${prefix}-S${String(stimIds.size + 1).padStart(2, "0")}`);
          stimId = stimIds.get(key);
        }
        let path = normalizePath(`${folder}/${qid}.md`);
        for (let k = 2; this.app.vault.getAbstractFileByPath(path); k++) path = normalizePath(`${folder}/${qid}-${k}.md`);
        const out = finalizeNote(q.text, meta, qid, { ...stamp, stimId, verification: q.verification });
        await this.app.vault.create(path, out);
        if (oid) seenIds.set(oid, path);
        const fin = parseNote(out);
        const fl = aiFlags(fin.fm, fin.sec);
        if (fl.aiAnswer || fl.aiExp) result.ai++;
        if (!fl.hasAnswer) result.noAnswer++;
        result.made++;
        this.status(`Created ${result.made} of ${chosen.length}...`);
      }
      await this.pruneImages(folder, result);
      result.issues = await this.auditNotes(folder);
      this.showAgentDone(result, folder);
    } catch (e) {
      this.showError(`Some notes may have been created before this stopped. ${e && e.message ? e.message : e}`);
    }
  }

  doneButtons(el, folder, made) {
    const row = el.createDiv({ cls: "qt-row" });
    row.createEl("button", { text: "Close", cls: "qt-grow" }).addEventListener("click", () => this.close());
    if (!folder || !made) {
      row.createEl("button", { text: "Practice now", cls: "mod-cta qt-grow" }).addEventListener("click", () => {
        this.close();
        this.plugin.activateView();
      });
      return;
    }
    const btn = row.createEl("button", { text: `Practice all ${made} note${made === 1 ? "" : "s"} in this folder`, cls: "mod-cta qt-grow" });
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.setText("Opening...");
      await this.plugin.practiceFolder(folder, made);
      this.close();
    });
  }
}

module.exports = {
  PdfImportModal,
};
