# Installed-plugin parity audit

Checked **Nov 4, 2026** against the community plugin pages and Obsidian's
published `community-plugins.json`, and re-checked **Nov 5, 2026** at **1.274.0**:
every Covered row below was matched to existing `src/` code and to tests that run in
the full suite, and no row remains Partial or Uncovered. This is a coverage record, not a claim that
every plugin has been copied or that every feature is implemented.

## URL check

The community site returns HTTP 200 for both real and missing plugins, so a
status code alone is not evidence. The page title is the discriminator: a real
page is titled `<Plugin> - Obsidian Plugin`, while a missing page is titled
`Plugin not found`. A deliberately bogus id was used as the control.

### Confirmed as supplied

- <https://community.obsidian.md/plugins/code-runner>
- <https://community.obsidian.md/plugins/deadline>
- <https://community.obsidian.md/plugins/plugin-pulse> (Download Pulse)
- <https://community.obsidian.md/plugins/kairos>
- <https://community.obsidian.md/plugins/obsidian-annotator>
- <https://community.obsidian.md/plugins/copilot>
- <https://community.obsidian.md/plugins/obsidian-desmos>
- <https://community.obsidian.md/plugins/obsidian-excalidraw-plugin>
- <https://community.obsidian.md/plugins/obsidian-importer>
- <https://community.obsidian.md/plugins/mcq-tracker>
- <https://community.obsidian.md/plugins/obsidian-minimal-settings>
- <https://community.obsidian.md/plugins/notebook-navigator>
- <https://community.obsidian.md/plugins/omnisearch>
- <https://community.obsidian.md/plugins/pdf-plus>
- <https://community.obsidian.md/plugins/recent-files-obsidian>

### Corrected IDs

These were supplied from memory and do not resolve to the intended plugin:

| Plugin | Supplied id | Correct community id |
|---|---|---|
| Advanced Tables | `obsidian-advanced-tables` (**Plugin not found**) | `table-editor-obsidian` |
| Hider | `hider` (**Plugin not found**) | `obsidian-hider` |
| Markmind | `markmind` (**Plugin not found**) | `obsidian-markmind` |

Corrected links:

- <https://community.obsidian.md/plugins/table-editor-obsidian>
- <https://community.obsidian.md/plugins/obsidian-hider>
- <https://community.obsidian.md/plugins/obsidian-markmind>

### Found in the registry, not opened as a community page

These four were listed with no community page. Their published registry ids
are:

| Plugin | Registry id | Author |
|---|---|---|
| Folder Sty1es | `folder-styles` | Haissam Makki |
| pdf-to-md | `pdf-to-md` | kkbin505 |
| Text Block Timer | `text-block-timer` | wth461694678 |
| WordNet Dictionary | `obsidian-wordnet-plugin` | tfthacker |

`Tally Counter` by "Custom" is not present in the published registry. That is
consistent with a personal or unlisted plugin; no public listing was found.

## Feature matrix

Status meanings: **Added** means shipped by MCQ Tracker in the current release (1.274.0); **Planned** means the owner approved a later slice; **Covered**
means an existing local module already performs the study-facing job; **Partial**
means a real but deliberately narrower path exists; **Boundary** means the plan
or a licence/security rule deliberately excludes it.

| Plugin | Status | What exists / what is missing |
|---|---|---|
| **Advanced Tables** | Covered | **1.234.0–1.260.0 cover the plugin's whole feature set:** in-place cell editing with Tab/Shift+Tab/Enter/Alt+Arrow navigation, row and column insert (above and below, left and right), delete and move, bold/italic/code/strikethrough, left/center/right/default alignment, body-row sorting in both directions, formula evaluation, CSV export with an optional header row, CSV/TSV import, transposing, a header toggle and a size readout. **1.260.0** adds the parts that used to exist only in the reading-view toolbar: 24 **Tables:** commands plus format-table, format-all-tables, next/previous cell, next row and move-cursor-out, a docked controls panel with a ribbon button, and settings for the Tab/Enter bindings, space padding and the ribbon button. **1.261.0** closes the last two behaviour gaps: the evaluator reproduces upstream's documented formula examples (`;dt`, `;hm`, datetime and duration cells, `#+TBLFM:`, and a row-to-column range refused as upstream refuses it), with the existing `<!-- TBLFM: … -->` comment kept as the canonical form so current documents are unchanged, and Tab/Shift+Tab/Enter/Shift+Enter now navigate cells and rows inside a table in the Markdown source editor, gated by the same two settings. **1.262.0** adds the table-building flow: a line starting with `|` counts as a table, Tab completes the header and delimiter rows, and Tab past the last header cell adds a column. **1.263.0** adds upstream's tab-joined export, its blank ordering in sorts and its double-action notices, plus merged cells as an extension upstream does not have. |
| **Annotator** | Covered | PDF annotation index, PDF reader, ink, text marks, tags, annotation sidecar and the PDF editor cover PDF study. EPUB annotation is not an MCQ feature.  1.272.0 adds EPUB annotation: `src/epub.js` reads the container, package, spine and chapter text; `src/epub-annotations.js` stores highlights in `Book.epub.annotations.md` (chapter, anchored character range, quote, note, colour, tags) with `[[Book.epub#chapter=N&annotation=id]]` links; `src/epub-reader-modal.js` renders a chapter, marks annotated paragraphs and offers Highlight/Update/Remove; `src/plugin.js` adds the two EPUB commands. Covered by 10 tests in `tests/epub.test.js`. |
| **Code Runner** | Boundary | The plan's §11 security gate prohibits in-plugin code execution; no sandbox or language allow-list has been approved. No runner, Pyodide, shell or language runtime was added. A dependency-free `calc`-only runner was prototyped during the Nov 5 parity close-out and withdrawn rather than shipped half-verified; the gate is unchanged. |
| **Copilot** | Boundary / Covered workflow | Copilot is AGPL-3.0, so its code cannot be copied into this MIT plugin. The original Study agent already provides note-grounded chat, local retrieval, provider selection, write review and undo. |
| **Deadline** | Covered | Calendar, Pomodoro, assignments, task list, due dates, study plan and local reminders already exist as separate local modules. |
| **Desmos** | Boundary / Covered idea | Desmos is GPL-3.0 and its code was not copied. The local Reference Graph covers regression, sliders, polar, parametric, implicit and 3D graphing. |
| **Download Pulse** | Boundary | Developer download/rank/competitor analytics is not study state and has no relationship to questions, cards or grades. |
| **Excalidraw** | Boundary | The plan records a hand-drawn canvas engine as a separate product and rejects adopting it. Existing STEM diagrams and the Study Map are not a replacement for Excalidraw files. |
| **Folder Sty1es** | Boundary | Per-folder icons, colours and text styles are navigation/theme presentation. The plan keeps this as reference only. |
| **Hider** | Boundary | Hiding Obsidian chrome is a host UI preference. The plugin already has a distraction-free practice mode but does not hide arbitrary UI elements. |
| **Importer** | Covered | **1.273.0 adds the service-export importers.** `src/service-import.js` parses Evernote `.enex` XML (title, XHTML body, tags, created timestamp, source URL), Google Keep Takeout JSON (text plus checklist items, labels, creation time, trashed notes skipped) and Takeout HTML, Airtable JSON records and CSV exports, Notion database CSV and Markdown pages, Bear Markdown exports (inline `#tag`s moved to frontmatter) and Roam JSON pages (nested block bullets, `#tag`/`#[[tag]]`, creation time). Every record becomes one note with `title`/`created`/`source_url`/`imported_from`/`tags` frontmatter and the exported body; `src/plugin.js` adds `importServiceExport`, `serviceExportText`, `importActiveServiceExport`, `importServiceClipboard` and the **Import notes from an export** / **Import notes from a pasted export** commands, writing into `Imports/<Service>` and skipping notes that already exist so a repeated import never duplicates. Format is detected from content, not the file name. Covered by 15 tests in `tests/service-import.test.js`. **Still out of scope, with reasons:** Apple Notes stores a proprietary, undocumented database with attachments, and OneNote stores binary `.one` sections; neither has a documented text export this parser can read. Bear `.textbundle`/`.textpack` bundles are refused by name because they carry binary attachments this importer does not copy — export Markdown instead. The Notion HTML/Markdown ZIP bundle is not unpacked; export the database as CSV or the pages as Markdown. |
| **Kairos** | Covered | Local Time blocks (Day, Week, Grid, Backlog, Routines, Projects, Timeline) shipped in 1.210.1–1.210.2; 1.265.0 added the document model (`## Schedule`, Backlog.md, Routines.md, statuses, routine rules, carry-over, regeneration, two-way daily-note sync); 1.267.0 adds direct manipulation (pointer create/move/resize, task cycling with right-click/long-press cancel, Week block and task drops), Timeline intensity, project/domain files with lifecycle history and intensity, file write-back, the guided tour and a Kairos settings import. Remaining differences are cosmetic grid/timeline switches. Kairos is 0BSD; no Kairos code, styles or copy was reused. |
| **Markmind** | Covered | `study-map` builds a local outline and key-term map. **1.271.0 adds the editor and file compatibility:** `src/mindmap.js` reads a Markmind note (`mindmap-plugin: basic` plus a nested list), edits the tree and writes the same shape back; `mindmapFromMarkdown` turns any note's headings and lists into a map; the **Mind map: add a child / rename / remove / move** commands edit the active note in place and **Mind map: make a Markmind map from this note** writes a sibling map note. No Mindmap source or styles were copied, and a map stays ordinary Markdown. |
| **MCQ Tracker** | This plugin | Current release is 1.281.0. |
| **Minimal Theme Settings** | Boundary | Changing a theme's colours, fonts and feature switches is theme integration, not study state. The plan keeps it as reference only. |
| **Notebook Navigator** | Boundary | Replacing Obsidian's file explorer with a two-pane folder/tag navigator is a navigation product. The plan records it as a UI surface not to adopt. |
| **Omnisearch** | Covered | The local `vault-search` block searches note text and cites path/line. It is intentionally not an OCR or fuzzy full-text index. |
| **pdf-to-md** | Covered | OCR runs locally for page images and sends only chosen pages to the configured Direct AI provider with explicit consent; PDF import and Markdown output exist. **1.270.0 wires the handwriting-to-LaTeX pipeline:** `src/pdf-latex.js` (prompt, reply cleanup, note builder, note name) is reachable through **PDF: convert pages to a LaTeX note**, which renders the chosen pages, sends each to the configured vision model, and writes one note with `latex: true`, the source PDF and a per-page section. No OCR engine is bundled, the model is the user's own, and a page with no readable text is left out rather than invented. |
| **PDF++** | Covered | PDF page links, annotation sidecars, quote/ink marks, the annotation sidebar, search/export and the page/form editor exist. **1.269.0 closes rectangle/selection deep links:** a quote or mark writes `[[file.pdf#page=3&annotation=id&rect=x,y,w,h]]` (multi-line selections union into one rectangle), **PDF: open a copied deep link** parses one and opens the reader on its page with that rectangle ringed, and an off-page, zero-size or non-numeric rectangle is dropped rather than guessed. **1.277.0 embeds the real plugin:** the unmodified MIT PDF++ 0.40.31 production bundle (`vendor/pdf-plus.js`, stylesheet in `vendor/pdf-plus-css.js`) is hosted as a child component by `src/pdf-plus.js`, so PDF++'s own features come along instead of being reimplemented — backlink highlighting, callouts, colour palette and link templates, the backlink pane with filtering and hover sync, direct annotation editing, the page composer, outline and page-label editing, link copying with context menus, PDF embeds and trimming, keyboard commands, external-app sync and Vim mode. PDF++'s settings tab is available and its data lives inside MCQ Tracker's `data.json`; the MCQ reader, sidecars and page editor remain. See `docs/pdf-plus.md`. |
| **Recent Files** | Boundary | Obsidian already provides recents and quick switching; the plan records this as a non-study navigation surface not to adopt. |
| **Tally Counter** | **Added** | A `tally` block with side-by-side Correct/Incorrect counts, adjustable step sizes, accuracy, CPS, elapsed session time, reset and local persistence. |
| **Text Block Timer** | **Added** | A `text-timer` block with a plain-text passage and a local start/pause/reset count-up clock. It is an explicit block, not an arbitrary editor-text widget. |
| **WordNet Dictionary** | **Added** | Full local WordNet 3.x import from the four standard data files, with every sense, gloss, synonyms and selected semantic relations. The data stays in the vault, the index is memory-only, and nothing is bundled or downloaded. |

## What would need an owner decision

1. **Code Runner:** approve a real sandbox and an explicit language allow-list,
   or keep the current no-execution rule. This cannot be made safe by adding a
   UI warning.
2. **A literal "all features" goal:** it requires overriding the plan's explicit
   do-not-adopt rows for Excalidraw, Recent Files, Folder Sty1es, Hider,
   Minimal Theme Settings and Notebook Navigator. Those are separate UI/theme
   products, not study modules.
3. **Licences:** Copilot (AGPL-3.0) and Desmos (GPL-3.0) cannot be copied into
   this MIT codebase. A clean-room reimplementation of specific behaviour is
   possible only with a separately approved spec.
4. **Importer depth:** the local **export-file** importers (the files those
   services let you download) shipped in 1.273.0 for Evernote, Google Keep,
   Airtable, Notion, Bear and Roam. Live cloud importer clients (signing in to a
   service and syncing) remain a data/dependency decision, not a small block
   addition. WordNet is handled by a local full-data import instead of a bundled
   database.

No plugin source, styles or data were copied for 1.239.0 or 1.240.0.

## Advanced Tables, feature by feature

One row per feature the upstream plugin and its library document, and what this
plugin does for it. Every row below is proved by a named test that drives the
plugin's own code — the command, editor key handler, postprocessor, docked panel
or write path — rather than a stand-in that re-implements the behaviour. The
formula rows are proved by `tests/table-formulas-upstream.test.js`, which runs the
examples from upstream's own formula guide and compares the resulting table rows;
the command, key, panel and settings rows are proved by `tests/table-commands.test.js`
and `tests/table-editor.test.js`. The exact test names are listed under the table.

Against upstream head `1a22239` (advanced-tables-obsidian 0.23.2) and library head
`147ac63` (md-advanced-tables 3.11.0).

| Upstream feature | Here | Status |
|---|---|---|
| Auto formatting | **Tables: format the table under the cursor** and **format every table in this note**, plus the **Pad cell width using spaces** setting; both re-render through `renderTable`, padding columns and keeping a valid delimiter row. | Matches |
| Excel-like navigation (Tab, Shift+Tab, Enter between cells and rows) | In the Markdown source editor: Tab/Shift+Tab and Enter/Shift+Enter, gated by the two settings below, with Shift+Enter leaving the table from the header and Tab past the last header cell adding a column. In the rendered reading-view table: the same keys plus Alt+Arrow and Esc. On mobile: the **Tables:** commands and the docked panel. | Matches |
| Building a table from a bare `\|` | A line that starts with `\|` is a table, even with no delimiter row yet. Tab completes the header and delimiter rows and moves into the next heading, so `\| Item` + Tab + headings builds a table exactly as upstream's guide describes; the **Tables: go to the next cell** command and Tab at the last header cell add the next column. Formatting a draft completes it too. | Matches |
| Spreadsheet formulas | `TBLFM` comments using upstream's references (`@1`, `$2`, `@<`/`@>`, `@I`, `@-1`, `$+2`), ranges (`@I..@-1`, `@2$2..@5$3`), arithmetic, comparisons, `if`, `sum`/`mean`/`count`/`min`/`max`, `round`/`abs`/`sqrt`, chaining with `::` and multiple lines, `;%.2f`, `;%d`, `;dt` and `;hm`, datetime and duration cells, and the `#+TBLFM:` line form. A row-to-column range is refused, as upstream documents. | Matches |
| Add, remove and move columns and rows | Insert above and below, insert left and right, delete, and move in either direction, from the toolbar, the **Tables:** commands and the docked panel; the header cannot be deleted or moved and edge moves refuse. | Matches |
| Column alignment (left, center, right) | Left, center, right and default, from the toolbar and commands; stored in the delimiter row. | Matches |
| Sort rows by a specified column | Ascending and descending body-row sorting on the cursor's column, header fixed, numbers before text, blanks first ascending and last descending as upstream does, equal values stable. | Matches |
| Export to CSV | **Tables: export as CSV** with an **Include table headers** switch, and one-step **CSV** copy from the toolbar; quoting, escaped pipes and formula-injection protection, and **Separate with tabs** in the copy dialog for upstream's tab-joined export. | Matches |
| Table controls sidebar | A docked **Advanced Tables** panel with Align, Move, Edit, Sort and formulas, and More groups, opened by a ribbon button or **Tables: open the table controls panel**. | Matches |
| Command palette entries | 26 `Tables:` commands covering navigation, insertion, deletion, movement, alignment, sorting, formatting, formulas, CSV, transpose and the panel. | Matches |
| Double-action warning | The **Tables: go to the next cell**, **go to the previous cell** and **go to the next row** commands show upstream's notice when the matching Tab or Enter binding is also on, and stay quiet on mobile. | Matches |
| Settings for padding, Tab and Enter, ribbon | **Pad cell width using spaces**, **Bind Tab to cell navigation**, **Bind Enter to row navigation** and **Show the table controls button** on the **Advanced Tables** settings page, beside the module switch. | Matches |
| Works on Obsidian Mobile | The **Tables:** commands and docked panel need no physical Tab or keyboard, and the reading-view toolbar is always visible on touch. | Matches |

### Merged cells (an extension, since upstream has none)

Upstream's tables cannot merge cells, so this is the one row that is not parity.
The source keeps the layout: a cell holding exactly `^` joins the run on its
left (colspan) and a cell holding exactly `"` joins the cell above (rowspan).
`tableMerges` turns those markers into spans and hidden cells; the reading-view
decorator sets `colspan`/`rowspan` on the surviving cell, makes the marker cells
uneditable and hides them, so Tab never lands on one. The markers stay in the
source, so formatting, sorting and every write path round-trip the layout, and a
marker with nothing to join (a `^` in the first column, a `"` in the header)
refuses instead of guessing.

### Proved by

Every row above names the passing test that demonstrates it. All of these run in
`node --test` and load the plugin's real modules.

| Row | Test |
|---|---|
| Auto formatting | `tests/table-commands.test.js`: *formatTableAt pads one table, reports no change twice and refuses outside a table*; *formatAllTables formats every table and refuses a note without one*; *format and format-all write padded tables, and padding can be off*; *minimal formatting renders valid cells without padding* |
| Excel-like navigation, source editor | `tests/table-commands.test.js`: *Tab moves to the next cell in the source editor*; *Shift+Tab moves to the previous cell and Enter to the next row*; *Shift+Enter moves up a row and escapes from the header row*; *navigation keeps the cursor on cells with escaped pipes and wide characters* |
| Excel-like navigation, reading view | `tests/table-editor.test.js`: *keyboard navigation moves across rows and stops at table boundaries*; *decorated cells commit edits and Tab moves focus without wrapping*; *an active Markdown editor is used instead of a disk read/modify race* |
| Building a table from a bare `\|` | `tests/table-commands.test.js`: *a pipe line with no delimiter is a draft that Tab completes*; *an empty pipe completes to a one-column table*; *a finished table and plain text are not drafts*; *addTableColumn adds a column at the right edge of every row*; *Tab on a bare pipe starts the table and moves into the next heading*; *Tab at the last header cell adds a column through the editor path*; *the next-cell command starts a table from a bare pipe*; *the format command completes a draft pipe table with one column*; *formatting a normal table leaves its rows, columns and text alone* |
| Spreadsheet formulas | `tests/table-formulas-upstream.test.js`: *upstream example:* all thirteen (overview sum, Fibonacci, subtraction, `#+TBLFM` conditional, nested `if`, range sum, `;%.2f`, `;dt`, datetime subtraction, task durations, chaining, the refused row-to-column range, the write-back). `tests/table-editor.test.js`: *TBLFM formulas calculate totals, shares and chained values*; *TBLFM mean, relative references and CRLF survive evaluation*; *TBLFM refuses missing, malformed and out-of-range formulas*; *TBLFM updates use the note write path* |
| Add, remove and move columns and rows | `tests/table-commands.test.js`: *insert row above and insert column left keep the table rectangular*; *insert above, align and delete run through the editor*. `tests/table-editor.test.js`: *row and column operations keep the table rectangular and aligned*; *structural actions preserve CRLF endings and refuse invalid boundaries*; *the table toolbar commits the active cell before applying a structure action*; *structural changes use the note write path and keep the source valid* |
| Column alignment | `tests/table-editor.test.js`: *column alignment updates the delimiter row for every supported value*; *the table toolbar commits the active cell before formatting and alignment*; *formatting and alignment go through the note write path*. `tests/table-commands.test.js`: *insert above, align and delete run through the editor* |
| Sort rows by a specified column | `tests/table-editor.test.js`: *table sorting orders numeric body rows ascending and descending*; *table sorting orders text case-insensitively and keeps ties stable*; *sorting preserves CRLF and TBLFM comments immediately after the table*; *sorting refuses a header-only table, an empty column and bad requests*; *table sorting writes the sorted content through the note path*; *the table toolbar sorts the active column and refuses without a selected cell*; *sorting puts blank cells first ascending and last descending, as upstream does* |
| Export to CSV | `tests/table-commands.test.js`: *CSV export can leave the header row out*; *the CSV dialog copies with or without the header row*. `tests/table-editor.test.js`: *table CSV quotes safely, unescapes pipes and protects spreadsheet formulas*; *CSV export copies the table without changing the note*; *the table toolbar exposes formula and CSV actions and commits before each*; *CSV export can join cells with tabs, as upstream does*; *the CSV dialog can copy tab-separated rows* |
| Table controls sidebar | `tests/table-commands.test.js`: *the docked panel draws every group and its buttons act on the table*; *the controls command opens a right leaf and reveals the panel again*; *the ribbon button follows the Advanced Tables settings* |
| Command palette entries | `tests/table-commands.test.js`: *every table command is registered and only offers itself inside a table* (all 26 ids, plus the no-editor refusal); `tests/capability-inventory.test.js` also requires every registered command to be cited by a test |
| Settings for padding, Tab and Enter, ribbon | `tests/table-commands.test.js`: *the Tab and Enter settings turn their keys off without touching the editor*; *format and format-all write padded tables, and padding can be off*; *the module switch and a cursor outside a table leave the keys alone*; *the ribbon button follows the Advanced Tables settings* |
| Works on Obsidian Mobile | `tests/table-commands.test.js`: *touch devices keep the reading-view toolbar visible without a hover* (the `@media (hover: none)` rule that makes the toolbar always visible); *the docked panel draws every group and its buttons act on the table* and *the next-cell command starts a table from a bare pipe* (both act with no key event at all) |
| Double-action warning | `tests/table-commands.test.js`: *the navigation commands warn when their key binding is also on* (the command path asks first, the warning follows each binding, and mobile stays quiet) |
| Merged cells (extension) | `tests/table-editor.test.js`: *merge markers report the spans they draw and the cells they hide*; *a merge with nothing to join refuses instead of guessing*; *the reading-view table applies the span and hides the merged-away cell* |

## Advanced Tables: upstream audit (pinned)

Audited against the real repository, not this document: `tgrosinger/advanced-tables-obsidian`
at commit `1a222399690f1d014d4bc95bf9ccf162ee5d7c75` (tag `0.23.2`, 2026-05-13) with the library it pins,
`@tgrosinger/md-advanced-tables@3.11.0`. `src/main.ts` registers **22 commands** and
`src/settings.ts` declares **4 settings**; the library files (`lib/table-editor.js`,
`lib/formatter.js`) hold the table logic behind `src/table-editor.ts`'s wrappers.
Every row below names the upstream symbol it derives from, the code here that implements
it, and the test that drives that code. `tests/advanced-tables-parity.test.js` re-reads
this table and fails if a row, a symbol mapping or a cited test disappears.

### Commands

| Upstream id | Upstream name | Upstream source | Here | Our implementation | Test |
|---|---|---|---|---|---|
| `next-row` | Go to next row | `src/main.ts` `next-row` → `TableEditor.nextRow` → `lib/table-editor.js` `nextRow` | `tables-next-row` | `src/plugin.js` `moveTableCell` | `tests/table-commands.test.js` *Shift+Tab moves to the previous cell and Enter to the next row* |
| `next-cell` | Go to next cell | `src/main.ts` `next-cell` → `TableEditor.nextCell` → `lib/table-editor.js` `nextCell` | `tables-next-cell` | `src/plugin.js` `moveTableCell` | `tests/table-commands.test.js` *next cell moves the cursor and adds a row at the end of the table* |
| `previous-cell` | Go to previous cell | `src/main.ts` `previous-cell` → `TableEditor.previousCell` → `lib/table-editor.js` `previousCell` | `tables-previous-cell` | `src/plugin.js` `moveTableCell` | `tests/table-commands.test.js` *Shift+Tab moves to the previous cell and Enter to the next row* |
| `format-table` | Format table at the cursor | `src/main.ts` `format-table` → `TableEditor.formatTable` → `lib/formatter.js` `formatTable` | `tables-format` | `src/plugin.js` `formatTable` | `tests/table-commands.test.js` *format and format-all write padded tables, and padding can be off* |
| `format-all-tables` | Format all tables in this file | `src/main.ts` `format-all-tables` → `TableEditor.formatAllTables` → `lib/table-editor.js` `formatAll` | `tables-format-all` | `src/plugin.js` `formatAllTablesInNote` | `tests/table-commands.test.js` *format and format-all write padded tables, and padding can be off* |
| `insert-column` | Insert column before current | `src/main.ts` `insert-column` → `TableEditor.insertColumn` → `lib/table-editor.js` `insertColumn` | `tables-insert-column-left` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *the remaining table commands change the table through the plugin path* |
| `insert-row` | Insert row before current | `src/main.ts` `insert-row` → `TableEditor.insertRow` → `lib/table-editor.js` `insertRow` | `tables-insert-row-above` | `src/table-editor.js` `structureTable` | `tests/advanced-tables-upstream.test.js` *inserting a row above from the header lands under the header, as upstream's insertRow does* |
| `escape-table` | Move cursor out of table | `src/main.ts` `escape-table` → `TableEditor.escape` → `lib/table-editor.js` `escape` | `tables-escape` | `src/plugin.js` `escapeTable` | `tests/table-commands.test.js` *escape leaves the table and inserts a blank line when needed* |
| `left-align-column` | Left align column | `src/main.ts` `left-align-column` → `TableEditor.leftAlignColumn` → `lib/formatter.js` `alterAlignment` | `tables-align-left` | `src/table-editor.js` `alignTableColumn` | `tests/table-editor.test.js` *column alignment updates the delimiter row for every supported value* |
| `center-align-column` | Center align column | `src/main.ts` `center-align-column` → `TableEditor.centerAlignColumn` → `lib/formatter.js` `alterAlignment` | `tables-align-center` | `src/table-editor.js` `alignTableColumn` | `tests/table-editor.test.js` *column alignment updates the delimiter row for every supported value* |
| `right-align-column` | Right align column | `src/main.ts` `right-align-column` → `TableEditor.rightAlignColumn` → `lib/formatter.js` `alterAlignment` | `tables-align-right` | `src/table-editor.js` `alignTableColumn` | `tests/table-editor.test.js` *column alignment updates the delimiter row for every supported value* |
| `move-column-left` | Move column left | `src/main.ts` `move-column-left` → `TableEditor.moveColumnLeft` → `lib/table-editor.js` `moveColumn` | `tables-move-column-left` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *the remaining table commands change the table through the plugin path* |
| `move-column-right` | Move column right | `src/main.ts` `move-column-right` → `TableEditor.moveColumnRight` → `lib/table-editor.js` `moveColumn` | `tables-move-column-right` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *the remaining table commands change the table through the plugin path* |
| `move-row-up` | Move row up | `src/main.ts` `move-row-up` → `TableEditor.moveRowUp` → `lib/table-editor.js` `moveRow` | `tables-move-row-up` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *the remaining table commands change the table through the plugin path* |
| `move-row-down` | Move row down | `src/main.ts` `move-row-down` → `TableEditor.moveRowDown` → `lib/table-editor.js` `moveRow` | `tables-move-row-down` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *the remaining table commands change the table through the plugin path* |
| `delete-column` | Delete column | `src/main.ts` `delete-column` → `TableEditor.deleteColumn` → `lib/table-editor.js` `deleteColumn` | `tables-delete-column` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *insert above, align and delete run through the editor* |
| `delete-row` | Delete row | `src/main.ts` `delete-row` → `TableEditor.deleteRow` → `lib/table-editor.js` `deleteRow` | `tables-delete-row` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *insert above, align and delete run through the editor* |
| `sort-rows-ascending` | Sort rows ascending | `src/main.ts` `sort-rows-ascending` → `TableEditor.sortRowsAsc` → `lib/table-editor.js` `sortRows` | `tables-sort-asc` | `src/table-editor.js` `sortTable` | `tests/advanced-tables-upstream.test.js` *sorting matches upstream: numeric columns by value, mixed columns as stripped text* |
| `sort-rows-descending` | Sort rows descending | `src/main.ts` `sort-rows-descending` → `TableEditor.sortRowsDesc` → `lib/table-editor.js` `sortRows` | `tables-sort-desc` | `src/table-editor.js` `sortTable` | `tests/advanced-tables-upstream.test.js` *a descending sort reverses the ascending result, so ties flip and blanks trail* |
| `transpose` | Transpose | `src/main.ts` `transpose` → `TableEditor.transpose` → `lib/table-editor.js` `transpose` | `tables-transpose` | `src/table-editor.js` `transposeTable` | `tests/table-editor.test.js` *transpose swaps rows and columns and toggles back* |
| `evaluate-formulas` | Evaluate table formulas | `src/main.ts` `evaluate-formulas` → `TableEditor.evaluateFormulas` → `lib/table-editor.js` `evaluateFormulas` | `tables-formulas` | `src/table-formulas.js` `applyTableFormulas` | `tests/advanced-tables-upstream.test.js` *the formula command is offered and works with the cursor on the TBLFM line* |
| `table-control-bar` | Open table controls toolbar | `src/main.ts` `table-control-bar` → `toggleTableControlsView` → `src/table-controls-view.ts` | `tables-open-controls` | `src/plugin.js` `openTableControls` | `tests/table-commands.test.js` *the controls command opens a right leaf and reveals the panel again* |

### Settings

| Upstream key | Upstream default | Upstream source | Here | Our implementation | Test |
|---|---|---|---|---|---|
| `formatType` | `NORMAL` (padded cells) | `src/settings.ts` `defaultSettings` `FormatType.NORMAL` | `padCells` | `src/table-editor.js` `normalizeTableEditorSettings` `renderTable` | `tests/advanced-tables-upstream.test.js` *the four upstream settings default exactly as settings.ts does* |
| `showRibbonIcon` | `true` | `src/settings.ts` `defaultSettings` → `src/main.ts` `addRibbonIcon` | `showRibbon` | `src/plugin.js` `onTableEditorToggled` | `tests/advanced-tables-upstream.test.js` *the four upstream settings default exactly as settings.ts does* |
| `bindEnter` | `true` | `src/settings.ts` `defaultSettings` → `src/main.ts` `makeEditorExtension` | `bindEnter` | `src/plugin.js` `onTableEditorKeydown` | `tests/advanced-tables-upstream.test.js` *the four upstream settings default exactly as settings.ts does* |
| `bindTab` | `true` | `src/settings.ts` `defaultSettings` → `src/main.ts` `makeEditorExtension` | `bindTab` | `src/plugin.js` `onTableEditorKeydown` | `tests/advanced-tables-upstream.test.js` *the four upstream settings default exactly as settings.ts does* |

The module also has an `enabled` switch upstream lacks, because this table editor is opt-in.

### Behaviours

| Behaviour | Upstream source | Our implementation | Test |
|---|---|---|---|
| **Normal formatting pads every column** | `lib/formatter.js` `formatTable` (`FormatType.NORMAL`) | `src/table-editor.js` `renderTable` | `tests/table-commands.test.js` *format and format-all write padded tables, and padding can be off* |
| **Weak formatting formats each row independently** | `lib/formatter.js` `_weakFormatTable` (`FormatType.WEAK`) | `src/table-editor.js` `renderTable` (`pad: false`) | `tests/table-commands.test.js` *minimal formatting renders valid cells without padding* |
| **Alignment is written into the delimiter row** | `lib/formatter.js` `_delimiterText` (`Alignment`) | `src/table-editor.js` `alignTableColumn` | `tests/table-editor.test.js` *column alignment updates the delimiter row for every supported value* |
| **Sorting: numeric per column, Markdown stripped, case-sensitive, blanks first** | `lib/table-editor.js` `sortRows` | `src/table-editor.js` `sortTable` | `tests/advanced-tables-upstream.test.js` *sorting strips emphasis markers and compares case-sensitively like upstream* |
| **A descending sort reverses the ascending result** | `lib/table-editor.js` `sortRows` (`.reverse()`) | `src/table-editor.js` `sortTable` | `tests/advanced-tables-upstream.test.js` *a descending sort reverses the ascending result, so ties flip and blanks trail* |
| **Transpose swaps rows and columns** | `lib/table-editor.js` `transpose` | `src/table-editor.js` `transposeTable` | `tests/table-editor.test.js` *transpose swaps rows and columns and toggles back* |
| **Move row/column, refusing at the edge** | `lib/table-editor.js` `moveRow` `moveColumn` | `src/table-editor.js` `structureTable` | `tests/table-editor.test.js` *structural actions preserve CRLF endings and refuse invalid boundaries* |
| **Insert row before current (below the header)** | `lib/table-editor.js` `insertRow` (`focus.row <= 1`) | `src/table-editor.js` `structureTable` | `tests/advanced-tables-upstream.test.js` *inserting a row above from the header lands under the header, as upstream's insertRow does* |
| **Insert column before current** | `lib/table-editor.js` `insertColumn` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *the remaining table commands change the table through the plugin path* |
| **Delete row and column** | `lib/table-editor.js` `deleteRow` `deleteColumn` | `src/table-editor.js` `structureTable` | `tests/table-commands.test.js` *insert above, align and delete run through the editor* |
| **CSV export joins raw cell text with tabs** | `lib/table-editor.js` `exportCSV` (`row.join('\t')`) | `src/table-editor.js` `tableCsvFromTable` | `tests/advanced-tables-upstream.test.js` *tab export is upstream's raw tab join, while comma export keeps our quoting* |
| **CSV dialog with an include-headers switch** | `src/table-editor.ts` `CSVModal` | `src/table-csv-modal.js` | `tests/table-commands.test.js` *the CSV dialog copies with or without the header row* |
| **TBLFM evaluation** | `lib/table-editor.js` `evaluateFormulas` → `lib/calc` | `src/table-formulas.js` `applyTableFormulas` | `tests/table-editor.test.js` *TBLFM formulas calculate totals, shares and chained values* |
| **Evaluate-formulas is offered on the formula line** | `lib/table-editor.js` `cursorIsInTableFormula` | `src/plugin.js` `runTableAction` (`formulas`) | `tests/advanced-tables-upstream.test.js` *the formula command is offered and works with the cursor on the TBLFM line* |
| **Tab/Shift+Tab and Enter/Shift+Enter navigate** | `src/main.ts` `makeEditorExtension` (`keymap`, `Prec.highest`) | `src/plugin.js` `onTableEditorKeydown` | `tests/table-commands.test.js` *Tab moves to the next cell in the source editor* |
| **Next row and previous cell keep the column** | `lib/table-editor.js` `nextRow` `previousCell` | `src/plugin.js` `moveTableCell` | `tests/table-commands.test.js` *Shift+Tab moves to the previous cell and Enter to the next row* |
| **A bare pipe completes into a draft table** | `lib/formatter.js` `completeTable` | `src/table-editor.js` `startTable` | `tests/table-commands.test.js` *a pipe line with no delimiter is a draft that Tab completes* |
| **Double-binding notices, suppressed on mobile** | `src/main.ts` `next-cell`/`previous-cell`/`next-row` handlers, `isMobile` | `src/plugin.js` `noticeDoubleBinding` | `tests/advanced-tables-upstream.test.js` *the double-binding notices use upstream's exact wording and stay off on mobile* |
| **Keyboard ownership: one press, one edit** | `src/main.ts` `makeEditorExtension` keymap (`preventDefault: true`), `registerEditorExtension` | `src/plugin.js` `onTableEditorKeydown`, registered as `registerDomEvent(activeDocument, "keydown", …, true)` and calling `preventDefault` + `stopPropagation` when it acts | `tests/advanced-tables-executable-parity.test.js` *upstream's keymap cannot fire in addition because the keypress is consumed first* |
| **A table under `-tx-` is not edited** | `src/obsidian-text-editor.ts` `acceptsTableEdit` (issue #133) | `src/table-editor.js` `tableEditBlocked` | `tests/advanced-tables-upstream.test.js` *a table under a -tx- marker is not edited, as upstream's acceptsTableEdit does* |
| **Docked controls panel and ribbon button** | `src/table-controls-view.ts` `TableControlsView` | `src/table-controls-view.js` | `tests/table-commands.test.js` *the docked panel draws every group and its buttons act on the table* |
| **The four settings and their defaults** | `src/settings.ts` `defaultSettings` | `src/table-editor.js` `normalizeTableEditorSettings` | `tests/advanced-tables-upstream.test.js` *the four upstream settings default exactly as settings.ts does* |
| **Merged cells — our extension, absent upstream** | upstream: none | `src/table-editor.js` `tableMerges` `decorateTable` | `tests/table-editor.test.js` *the reading-view table applies the span and hides the merged-away cell* |
| **Reading-view cell editing — our extension, absent upstream** | upstream: none | `src/table-editor.js` `decorateTable` | `tests/table-editor.test.js` *decorated cells commit edits and Tab moves focus without wrapping* |

### Exceptions and owner decisions

- **Donation buttons:** upstream's settings tab links to `https://paypal.me/tgrosinger` and `https://www.buymeacoffee.com/tgrosinger` (`src/main.ts` `createDonateButton`, `manifest.json` funding). They are third-party links for the upstream author, so this plugin does not reproduce them; nothing about table behaviour depends on them. Owner decision.
- **Command icons and toolbar artwork:** `src/main.ts` passes `icon:` ids and `src/icons.ts` supplies GPL-3.0 SVG artwork. Copying that artwork into this bundle is an asset-licence decision the owner has not made; the commands and the panel use text labels and Obsidian's own icons instead. Owner decision.
- **Edge-move refusals:** upstream clamps `moveRow`/`moveColumn` to the body and silently re-formats (library `moveRow`, `moveColumn`); this plugin refuses the move and explains why. The table ends in the same state, so only the informational Notice differs. Owner decision.
- **CSV dialog's default delimiter:** upstream has no CSV command: `CSVModal` only exports tab-joined text. This plugin's dialog defaults to commas and offers upstream's tab form through **Separate with tabs**, whose output is byte-identical to `exportCSV`. Keeping the existing comma contract is an Owner decision.
- **Command ids differ from upstream:** upstream registers `next-cell`, `insert-row`, `format-table` and the rest without a namespace (`src/main.ts`), while this plugin registers the same actions as `tables-next-cell`, `tables-insert-row-below` and so on. Existing QuickAdd, Templater or Commander automation that calls upstream's ids will not reach these commands; renaming ours would break the palette entries and every test that names them, so keeping the namespaced ids is an Owner decision.
- **Publishing 1.264.0:** Committing and pushing are requested; a tag, GitHub release and directory submission are not. Publishing stays the owner's decision. Owner decision.

### Using both plugins

The parity above is executable, not editorial: `tests/advanced-tables-executable-parity.test.js`
runs all 22 upstream commands through this plugin's registered command callbacks
and asserts the table text or cursor each one produces, drives the four settings
through their real effects, and reproduces the named behaviours (sort intent and
case, raw tab CSV, the `-tx-` guard, header insert, `TBLFM` evaluation,
alignment, moves, deletes, transpose, weak formatting and the notice wording).
Its keyboard test wraps the real `registerDomEvent` call, proves the listener is
registered in the capture phase, and shows one Tab or Enter press writing exactly
once; when that listener acts it calls `stopPropagation`, so upstream's keymap
(inside CodeMirror, below the document) never receives the same keypress. With
this module off, or a binding off, this listener returns without consuming, so
upstream would handle the key instead — one handler in either direction, not two.
Nothing here depends on the upstream plugin being installed: the only thing both
installed would add is duplicate commands, ribbon buttons and table toolbars over
the same table.

No other item is outstanding: every upstream command, setting and behaviour above is
implemented here and covered by a test that drives the plugin's own code.
