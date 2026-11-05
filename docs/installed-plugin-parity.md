# Installed-plugin parity audit

Checked **Nov 4, 2026** against the community plugin pages and Obsidian's
published `community-plugins.json`. This is a coverage record, not a claim that
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

Status meanings: **Added** means shipped by MCQ Tracker in the current release (1.240.0); **Planned** means the owner approved a later slice; **Covered**
means an existing local module already performs the study-facing job; **Partial**
means a real but deliberately narrower path exists; **Boundary** means the plan
or a licence/security rule deliberately excludes it.

| Plugin | Status | What exists / what is missing |
|---|---|---|
| **Advanced Tables** | Covered | **1.234.0–1.260.0 cover the plugin's whole feature set:** in-place cell editing with Tab/Shift+Tab/Enter/Alt+Arrow navigation, row and column insert (above and below, left and right), delete and move, bold/italic/code/strikethrough, left/center/right/default alignment, body-row sorting in both directions, formula evaluation, CSV export with an optional header row, CSV/TSV import, transposing, a header toggle and a size readout. **1.260.0** adds the parts that used to exist only in the reading-view toolbar: 24 **Tables:** commands plus format-table, format-all-tables, next/previous cell, next row and move-cursor-out, a docked controls panel with a ribbon button, and settings for the Tab/Enter bindings, space padding and the ribbon button. **1.261.0** closes the last two behaviour gaps: the evaluator reproduces upstream's documented formula examples (`;dt`, `;hm`, datetime and duration cells, `#+TBLFM:`, and a row-to-column range refused as upstream refuses it), with the existing `<!-- TBLFM: … -->` comment kept as the canonical form so current documents are unchanged, and Tab/Shift+Tab/Enter/Shift+Enter now navigate cells and rows inside a table in the Markdown source editor, gated by the same two settings. **1.262.0** adds the table-building flow: a line starting with `|` counts as a table, Tab completes the header and delimiter rows, and Tab past the last header cell adds a column. Merged cells remain out of scope pending the owner's choice. |
| **Annotator** | Partial | PDF annotation index, PDF reader, ink, text marks, tags, annotation sidecar and the PDF editor cover PDF study. EPUB annotation is not an MCQ feature. |
| **Code Runner** | Boundary | The plan's §11 security gate prohibits in-plugin code execution; no sandbox or language allow-list has been approved. No runner, Pyodide, shell or language runtime was added. |
| **Copilot** | Boundary / Covered workflow | Copilot is AGPL-3.0, so its code cannot be copied into this MIT plugin. The original Study agent already provides note-grounded chat, local retrieval, provider selection, write review and undo. |
| **Deadline** | Covered | Calendar, Pomodoro, assignments, task list, due dates, study plan and local reminders already exist as separate local modules. |
| **Desmos** | Boundary / Covered idea | Desmos is GPL-3.0 and its code was not copied. The local Reference Graph covers regression, sliders, polar, parametric, implicit and 3D graphing. |
| **Download Pulse** | Boundary | Developer download/rank/competitor analytics is not study state and has no relationship to questions, cards or grades. |
| **Excalidraw** | Boundary | The plan records a hand-drawn canvas engine as a separate product and rejects adopting it. Existing STEM diagrams and the Study Map are not a replacement for Excalidraw files. |
| **Folder Sty1es** | Boundary | Per-folder icons, colours and text styles are navigation/theme presentation. The plan keeps this as reference only. |
| **Hider** | Boundary | Hiding Obsidian chrome is a host UI preference. The plugin already has a distraction-free practice mode but does not hide arbitrary UI elements. |
| **Importer** | Partial | Local PDF, PowerPoint, Word, text, CSV, Anki/Quizlet/QuizPort and card-archive imports exist. Airtable, Notion, Evernote, Apple Notes, OneNote, Google Keep, Bear, Roam and similar service importers are not bundled. |
| **Kairos** | Covered idea | Local Time blocks (Day, Week, Grid, Backlog, Routines, Projects, Timeline) shipped in 1.210.1–1.210.2. Kairos is 0BSD; no Kairos code, styles or copy was reused. |
| **Markmind** | Partial | `study-map` builds a local outline and key-term map. It is not a full mind-map/outline editor and has no Markmind file compatibility. |
| **MCQ Tracker** | This plugin | Current release is 1.240.0. |
| **Minimal Theme Settings** | Boundary | Changing a theme's colours, fonts and feature switches is theme integration, not study state. The plan keeps it as reference only. |
| **Notebook Navigator** | Boundary | Replacing Obsidian's file explorer with a two-pane folder/tag navigator is a navigation product. The plan records it as a UI surface not to adopt. |
| **Omnisearch** | Covered | The local `vault-search` block searches note text and cites path/line. It is intentionally not an OCR or fuzzy full-text index. |
| **pdf-to-md** | Partial | OCR runs locally for page images and sends only chosen pages to the configured Direct AI provider with explicit consent; PDF import and Markdown output exist. There is no dedicated handwritten-LaTeX/Qwen conversion pipeline. |
| **PDF++** | Partial / Covered | PDF page links, annotation sidecars, quote/ink marks, the annotation sidebar, search/export and the page/form editor exist. Rectangle/selection deep links are not implemented. |
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
4. **Importer depth:** cloud importer clients remain a data/dependency
   decision, not a small block addition. WordNet is now handled by a local
   full-data import instead of a bundled database.

No plugin source, styles or data were copied for 1.239.0 or 1.240.0.

## Advanced Tables, feature by feature

One row per feature the upstream plugin and its library document, and what this
plugin does for it. The formula rows are proved by
`tests/table-formulas-upstream.test.js`, which runs the examples from
upstream's own formula guide and compares the resulting table rows; the key rows
are proved by the source-editor tests in `tests/table-commands.test.js`.

| Upstream feature | Here | Status |
|---|---|---|
| Auto formatting | **Tables: format the table under the cursor** and **format every table in this note**, plus the **Pad cell width using spaces** setting; both re-render through `renderTable`, padding columns and keeping a valid delimiter row. | Matches |
| Excel-like navigation (Tab, Shift+Tab, Enter between cells and rows) | In the Markdown source editor: Tab/Shift+Tab and Enter/Shift+Enter, gated by the two settings below, with Shift+Enter leaving the table from the header and Tab past the last header cell adding a column. In the rendered reading-view table: the same keys plus Alt+Arrow and Esc. On mobile: the **Tables:** commands and the docked panel. | Matches |
| Building a table from a bare `\|` | A line that starts with `\|` is a table, even with no delimiter row yet. Tab completes the header and delimiter rows and moves into the next heading, so `\| Item` + Tab + headings builds a table exactly as upstream's guide describes; the **Tables: go to the next cell** command and Tab at the last header cell add the next column. Formatting a draft completes it too. | Matches |
| Spreadsheet formulas | `TBLFM` comments using upstream's references (`@1`, `$2`, `@<`/`@>`, `@I`, `@-1`, `$+2`), ranges (`@I..@-1`, `@2$2..@5$3`), arithmetic, comparisons, `if`, `sum`/`mean`/`count`/`min`/`max`, `round`/`abs`/`sqrt`, chaining with `::` and multiple lines, `;%.2f`, `;%d`, `;dt` and `;hm`, datetime and duration cells, and the `#+TBLFM:` line form. A row-to-column range is refused, as upstream documents. | Matches |
| Add, remove and move columns and rows | Insert above and below, insert left and right, delete, and move in either direction, from the toolbar, the **Tables:** commands and the docked panel; the header cannot be deleted or moved and edge moves refuse. | Matches |
| Column alignment (left, center, right) | Left, center, right and default, from the toolbar and commands; stored in the delimiter row. | Matches |
| Sort rows by a specified column | Ascending and descending body-row sorting on the cursor's column, header fixed, numbers before text, blanks last, equal values stable. | Matches |
| Export to CSV | **Tables: export as CSV** with an **Include table headers** switch, and one-step **CSV** copy from the toolbar; quoting, escaped pipes and formula-injection protection. | Matches |
| Table controls sidebar | A docked **Advanced Tables** panel with Align, Move, Edit, Sort and formulas, and More groups, opened by a ribbon button or **Tables: open the table controls panel**. | Matches |
| Command palette entries | 26 `Tables:` commands covering navigation, insertion, deletion, movement, alignment, sorting, formatting, formulas, CSV, transpose and the panel. | Matches |
| Settings for padding, Tab and Enter, ribbon | **Pad cell width using spaces**, **Bind Tab to cell navigation**, **Bind Enter to row navigation** and **Show the table controls button** on the **Advanced Tables** settings page, beside the module switch. | Matches |
| Works on Obsidian Mobile | The **Tables:** commands and docked panel need no physical Tab or keyboard, and the reading-view toolbar is always visible on touch. | Matches |
