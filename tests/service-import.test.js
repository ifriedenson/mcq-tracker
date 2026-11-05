"use strict";
/*
 * End-to-end tests for the service-export importers: real-format fixtures for
 * Evernote, Google Keep, Airtable, Notion, Bear and Roam, the note shape each
 * becomes, refusals that write nothing, and the vault flow that reads the export,
 * writes one note per record and re-reads what it wrote.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { T } = load();
const serviceImport = T.serviceImport;
const { Plugin: QT } = load();

const ENEX = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export3.dtd">
<en-export export-date="20260205T120000Z" application="Evernote" version="10.60">
<note><title>Cell membranes</title><content><![CDATA[<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note><div>Water crosses a membrane by osmosis.</div><div><br/></div><div>ATP drives active transport &amp; pumps.</div></en-note>]]></content>
<created>20260201T101500Z</created><updated>20260202T090000Z</updated>
<tag>biology</tag><tag>exam prep</tag>
<note-attributes><source-url>https://example.com/membranes</source-url></note-attributes></note>
<note><title>Enzymes</title><content><![CDATA[<en-note><div>Enzymes lower activation energy.</div><ul><li>Catalase</li><li>Amylase</li></ul></en-note>]]></content>
<created>20260203T080000Z</created><tag>biology</tag></note>
</en-export>`;

const KEEP = JSON.stringify([
  {
    title: "Membranes",
    textContent: "Water crosses a membrane by osmosis.",
    listContent: [
      { text: "osmosis", isChecked: true },
      { text: "diffusion", isChecked: false },
    ],
    labels: [{ name: "biology" }, { name: "exam" }],
    createdTimestampUsec: 1770000000000000,
    isTrashed: false,
    isArchived: false,
  },
  { title: "", textContent: "A quick thought\nwith a second line.", labels: [], createdTimestampUsec: 1770100000000000, isTrashed: false },
  { title: "Deleted note", textContent: "gone", isTrashed: true },
]);

const KEEP_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Membranes</title></head><body>
<h1 class="title">Membranes</h1>
<div class="content"><div>Water crosses a membrane by osmosis.</div><div>ATP drives pumps.</div></div>
<ul class="labels"><li>biology</li><li>exam</li></ul>
</body></html>`;

const AIRTABLE_JSON = JSON.stringify({
  records: [
    {
      id: "rec1",
      createdTime: "2026-02-01T10:15:00.000Z",
      fields: { Name: "Osmosis", Notes: "Water moves down its gradient.", Tags: "biology, transport", Status: "Done" },
    },
    { id: "rec2", createdTime: "2026-02-02T00:00:00.000Z", fields: { Name: "Diffusion", Notes: "Particles spread out.", Tags: ["biology"] } },
  ],
});

const DATABASE_CSV = `Name,Tags,Created,Notes,Status\r\n"Osmosis, part 1","biology, transport",2026-02-01,"Water moves\ndown its gradient.","In progress"\r\nDiffusion,biology,2026-02-02,Particles spread out,Done\r\n`;

const NOTION_MD = `# Cell membranes

Tags: biology, exam

Water crosses a membrane by osmosis.

## Details

ATP drives active transport.
`;

const BEAR_MD = `# Cell membranes #biology #exam/prep

Water crosses a membrane by osmosis.

# ATP powers active transport.
`;

const ROAM = JSON.stringify([
  {
    title: "Cell membranes",
    "create-time": 1770000000000,
    children: [
      { string: "Water crosses by osmosis", children: [{ string: "down the gradient", children: [] }] },
      { string: "ATP drives pumps #biology", children: [] },
    ],
  },
  { title: "Enzymes", "create-time": 1770100000000, children: [{ string: "Lower activation energy", children: [] }] },
]);

function fakeApp(files) {
  const map = new Map(Object.entries(files || {}));
  return {
    map,
    folders: new Set(),
    vault: {
      getAbstractFileByPath: (path) => (map.has(path) ? { path } : null),
      cachedRead: async (file) => map.get(file.path),
      read: async (file) => map.get(file.path),
      createFolder: async (path) => {
        map.set(path, "");
        return { path };
      },
      create: async (path, text) => {
        if (map.has(path)) throw new Error(`${path} already exists`);
        map.set(path, text);
        return { path };
      },
      modify: async (file, text) => {
        map.set(file.path, text);
        return { path: file.path };
      },
    },
    workspace: { getActiveFile: () => null },
  };
}

test("evernote: .enex notes keep their titles, bodies, tags and created dates", () => {
  const parsed = serviceImport.parseServiceExport(ENEX, { kind: "evernote", filename: "notes.enex" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 2);
  const [first, second] = parsed.records;
  assert.equal(first.title, "Cell membranes");
  assert.equal(first.body, "Water crosses a membrane by osmosis.\n\nATP drives active transport & pumps.");
  assert.deepEqual(first.tags, ["biology", "exam-prep"]);
  assert.equal(first.created, "2026-02-01T10:15:00Z");
  assert.equal(first.url, "https://example.com/membranes");
  assert.equal(second.title, "Enzymes");
  assert.match(second.body, /Catalase/);
  assert.match(second.body, /- Amylase|Amylase/, "list items survive as text");
  assert.deepEqual(second.tags, ["biology"]);
});

test("evernote: a file that is not an export, and an export with no notes, refuse", () => {
  const wrong = serviceImport.parseServiceExport("<html><body>hello</body></html>", { kind: "evernote", filename: "x.enex" });
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /not an Evernote/);
  const empty = serviceImport.parseServiceExport('<?xml version="1.0"?><en-export version="10"></en-export>', { kind: "evernote" });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /no notes/);
});

test("google keep: JSON notes become checklists, labels and dates", () => {
  const parsed = serviceImport.parseServiceExport(KEEP, { kind: "keep", filename: "Keep.json" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 2, "a trashed note is skipped");
  assert.equal(parsed.skipped, 1);
  const [note, thought] = parsed.records;
  assert.equal(note.title, "Membranes");
  assert.equal(note.body, "Water crosses a membrane by osmosis.\n\n- [x] osmosis\n- [ ] diffusion");
  assert.deepEqual(note.tags, ["biology", "exam"]);
  assert.match(note.created, /^2026-02-0[12]T/);
  assert.equal(thought.title, "A quick thought");
  assert.match(thought.body, /with a second line/);
});

test("google keep: the Takeout HTML page imports title, content and labels", () => {
  const parsed = serviceImport.parseServiceExport(KEEP_HTML, { kind: "keep", filename: "Membranes.html" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].title, "Membranes");
  assert.equal(parsed.records[0].body, "Water crosses a membrane by osmosis.\n\nATP drives pumps.");
  assert.deepEqual(parsed.records[0].tags, ["biology", "exam"]);
});

test("airtable: JSON records and CSV rows both become one note per record", () => {
  const json = serviceImport.parseServiceExport(AIRTABLE_JSON, { kind: "airtable", filename: "export.json" });
  assert.equal(json.ok, true);
  assert.equal(json.records.length, 2);
  assert.equal(json.records[0].title, "Osmosis");
  assert.deepEqual(json.records[0].tags, ["biology", "transport"]);
  assert.equal(json.records[0].created, "2026-02-01T10:15:00Z");
  assert.match(json.records[0].body, /## Notes\nWater moves down its gradient\./);
  assert.match(json.records[0].body, /## Status\nDone/);

  const csv = serviceImport.parseServiceExport(DATABASE_CSV, { kind: "airtable", filename: "export.csv" });
  assert.equal(csv.ok, true);
  assert.equal(csv.records.length, 2);
  assert.equal(csv.records[0].title, "Osmosis, part 1", "a quoted comma stays in the title");
  assert.match(csv.records[0].body, /Water moves\ndown its gradient\./, "a quoted newline stays in the cell");
  assert.deepEqual(csv.records[0].tags, ["biology", "transport"]);
  assert.equal(csv.records[0].created, "2026-02-01");
});

test("notion: a Markdown page and a database CSV both import", () => {
  const page = serviceImport.parseServiceExport(NOTION_MD, { kind: "notion", filename: "Cell membranes.md" });
  assert.equal(page.ok, true);
  assert.equal(page.records[0].title, "Cell membranes");
  assert.deepEqual(page.records[0].tags, ["biology", "exam"]);
  assert.match(page.records[0].body, /ATP drives active transport\./);
  assert.ok(!/Tags:/.test(page.records[0].body), "the Tags line becomes frontmatter, not body");

  const csv = serviceImport.parseServiceExport(DATABASE_CSV, { kind: "notion", filename: "Tasks.csv" });
  assert.equal(csv.ok, true);
  assert.equal(csv.records.length, 2);
  assert.equal(csv.records[0].title, "Osmosis, part 1");
});

test("bear: the Markdown export's title and inline tags are split correctly", () => {
  const parsed = serviceImport.parseServiceExport(BEAR_MD, { kind: "bear", filename: "Cell membranes.md" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records[0].title, "Cell membranes");
  assert.deepEqual(parsed.records[0].tags, ["biology", "exam/prep"]);
  assert.match(parsed.records[0].body, /^Water crosses a membrane by osmosis\./);
  assert.match(parsed.records[0].body, /# ATP powers active transport\./, "a later heading stays in the body");
  assert.ok(!/#biology/.test(parsed.records[0].body), "tag tokens are removed from the body");
});

test("bear: a .textpack bundle is refused precisely instead of being faked", () => {
  const detected = serviceImport.detectServiceExport("PK\u0003\u0004binary", "Notes.textpack");
  assert.equal(detected.ok, false);
  assert.match(detected.error, /textbundle|textpack/);
  assert.match(detected.error, /Markdown/);
});

test("roam: pages become nested bullets with tags and creation times", () => {
  const parsed = serviceImport.parseServiceExport(ROAM, { kind: "roam", filename: "roam.json" });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 2);
  const [page] = parsed.records;
  assert.equal(page.title, "Cell membranes");
  assert.equal(page.body, "- Water crosses by osmosis\n  - down the gradient\n- ATP drives pumps #biology");
  assert.deepEqual(page.tags, ["biology"]);
  assert.match(page.created, /^2026-02-0[12]T/);
});

test("detection: the content decides even when the file name is wrong", () => {
  for (const [text, filename, kind] of [
    [ENEX, "notes.txt", "evernote"],
    [KEEP, "keep.txt", "keep"],
    [ROAM, "pages.txt", "roam"],
    [AIRTABLE_JSON, "airtable.txt", "airtable"],
    [DATABASE_CSV, "table.txt", "database"],
    [BEAR_MD, "note.txt", "bear"],
    [NOTION_MD, "page.md", "notion"],
  ]) {
    const detected = serviceImport.detectServiceExport(text, filename);
    assert.equal(detected.ok, true, filename);
    assert.equal(detected.kind, kind, filename);
  }
  const unknown = serviceImport.detectServiceExport("just some words", "notes.txt");
  assert.equal(unknown.ok, false);
  assert.match(unknown.error, /not one of the supported formats/);
});

test("notes: the Markdown shape carries frontmatter, title and body", () => {
  const markdown = serviceImport.recordMarkdown({
    title: 'Membranes: "water"',
    body: "Water crosses by osmosis.",
    tags: ["biology", "exam"],
    created: "2026-02-01T10:15:00Z",
    service: "Evernote",
    url: "https://example.com/membranes",
  });
  assert.match(markdown, /^---\ntitle: "Membranes: \\"water\\""\n/);
  assert.match(markdown, /created: "2026-02-01T10:15:00Z"/);
  assert.match(markdown, /source_url: "https:\/\/example\.com\/membranes"/);
  assert.match(markdown, /imported_from: "Evernote"/);
  assert.match(markdown, /tags:\n {2}- biology\n {2}- exam\n/);
  assert.match(markdown, /---\n\n# Membranes: "water"\n\nWater crosses by osmosis\.\n$/);
  assert.equal(serviceImport.noteFileName('a/b:c*?"<>|#[]'), "a b c.md");
  const taken = new Set(["Inbox/Note.md", "Inbox/Note (2).md"]);
  assert.equal(serviceImport.uniqueNotePath("Inbox", "Note", taken), "Inbox/Note (3).md");
});

test("refusals: empty and malformed exports return a reason and no records", () => {
  for (const [text, options] of [
    ["", { kind: "evernote" }],
    ["   ", { kind: "keep" }],
    ["{not json", { kind: "keep" }],
    ["{not json", { kind: "roam" }],
    ["{not json", { kind: "airtable" }],
    ["Name,Tags\n", { kind: "notion", filename: "x.csv" }],
    ["no title here", { kind: "bear" }],
  ]) {
    const parsed = serviceImport.parseServiceExport(text, options);
    assert.equal(parsed.ok, false, JSON.stringify(options));
    assert.equal(parsed.records.length, 0);
    assert.ok(parsed.error && parsed.error.length > 10, `a clear reason for ${JSON.stringify(options)}`);
  }
});

test("plugin: an export in the vault becomes notes, and reopening finds them unchanged", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({ "Exports/notes.enex": ENEX });
  plugin.settings = { mcqEnabled: true };

  const result = await plugin.importServiceExport({ path: "Exports/notes.enex" }, { folder: "Imports/Evernote" });
  assert.equal(result.service, "Evernote");
  assert.equal(result.written.length, 2);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.written, ["Imports/Evernote/Cell membranes.md", "Imports/Evernote/Enzymes.md"]);
  const note = plugin.app.map.get("Imports/Evernote/Cell membranes.md");
  assert.match(note, /^---\ntitle: "Cell membranes"/);
  assert.match(note, /tags:\n {2}- biology\n {2}- exam-prep/);
  assert.match(note, /Water crosses a membrane by osmosis\./);

  const again = await plugin.importServiceExport({ path: "Exports/notes.enex" }, { folder: "Imports/Evernote" });
  assert.equal(again.written.length, 0, "a repeated import does not duplicate notes");
  assert.equal(again.skipped, 2);

  const kept = await plugin.importServiceExport({ text: KEEP, filename: "Keep.json" });
  assert.equal(kept.folder, "Imports/Google Keep", "the folder follows the detected service");
  assert.equal(kept.written.length, 2);
  assert.ok(plugin.app.map.has("Imports/Google Keep/Membranes.md"));
});

test("plugin: a missing file, an unsupported export and a bundle are refused without a write", async () => {
  const plugin = Object.create(QT.prototype);
  plugin.app = fakeApp({ "Exports/unknown.txt": "just some words", "Exports/bear.textpack": "PK\u0003\u0004" });
  plugin.settings = { mcqEnabled: true };
  await assert.rejects(plugin.importServiceExport({ path: "Exports/gone.enex" }), /There is no Exports\/gone\.enex/);
  await assert.rejects(plugin.importServiceExport({ path: "Exports/unknown.txt" }), /not one of the supported formats/);
  await assert.rejects(plugin.importServiceExport({ path: "Exports/bear.textpack" }), /textbundle|textpack/);
  const written = [...plugin.app.map.keys()].filter((path) => path.startsWith("Imports/"));
  assert.deepEqual(written, [], "nothing was imported");
});

test("plugin: the two importer commands are registered and their methods exist", async () => {
  const { makeApp } = require("./helpers/fake");
  const plugin = new QT(makeApp([]));
  await plugin.onload();
  const ids = plugin.commands.map((command) => command.id);
  assert.ok(ids.includes("import-service-export"), "import-service-export is registered");
  assert.ok(ids.includes("import-service-clipboard"), "import-service-clipboard is registered");
  for (const name of ["importActiveServiceExport", "importServiceClipboard", "importServiceExport", "serviceExportText"]) {
    assert.equal(typeof plugin[name], "function", `${name} exists`);
  }
});
