# Security inventory — every network, credential, dynamic-code, HTML, write and parse path

Recorded Nov 5, 2026, from the shipped `src/` tree. `tests/security-inventory.test.js` re-derives
each list below and fails when a file starts or stops matching it, so this document is enforced
rather than descriptive. `scripts/check-no-dynamic-code.js` runs in `npm run check` over all
**297** source files.

## 1. Network transport

Four files call a transport directly. Everything else receives one.

| File | Call | Destination | Safeguard |
| --- | --- | --- | --- |
| `src/api-client.js` | `requestUrl` (chat, `listModels`), `fetch` (`streamChat` SSE) | The user's own AI provider base URL | `safeApiBase` (HTTPS, or HTTP only on loopback; no URL userinfo); key sent only in `Authorization`/`x-api-key`; no retry that could double-spend |
| `src/opencode-client.js` | `requestUrl` (`req`), `fetch` (`/event` SSE) | Local OpenCode server | `safeApiBase` on the base URL; Basic auth built from the per-run password |
| `src/opencode-manager.js` | `requestUrl` | `https://api.github.com/repos/…/releases` (constant repo) | Constant URL, GitHub JSON only, major-version allow-list before install |
| `src/plugin.js` | `requestUrl` ×2 (calendar file/URL sources, sync) | A calendar `.ics` feed the user names | `safeCalendarFeedUrl` before every call; 2 MB response cap via `calendarText` |

`src/couchdb-sync.js` makes no direct call: `CouchDbClient` takes an injected `request` and the
plugin supplies `requestUrl`. Its address is normalised with `safeApiBase`, the database name is
`encodeURIComponent`-encoded, and only the fields in `SYNC_FIELDS` (scheduling and review state,
never note text) are sent. The CouchDB password is a secret-storage value.

No other file in `src/` names `requestUrl` or `fetch`.

## 2. Credentials and secrets

- `src/secret-keys.js` — API keys and the CouchDB password live in Obsidian Secret Storage when the
  app provides `getSecret`/`setSecret`; older apps fall back to `data.json`, which is documented as
  plain text. `migratePasswordSecret` moves a legacy value into secret storage.
- `src/api-client.js` — the key is read from settings, sent only in a request header, never logged,
  never interpolated into a user-visible message. Error text is truncated to 300 characters and
  never includes headers.
- `src/opencode-manager.js` — a fresh 16-byte random password per start, passed to the child process
  through `OPENCODE_SERVER_PASSWORD` and bound to `--hostname 127.0.0.1`.
- `src/url-safety.js` — refuses credentials embedded in a URL and refuses plain HTTP to a
  non-loopback host, so a key cannot travel in clear text off the machine.
- No hard-coded credential exists in `src/`, `docs/` or `README.md`; the security test scans for
  common token shapes (`sk-…`, `ghp_…`, `AKIA…`, PEM private keys).

## 3. Dynamic code

None. `scripts/check-no-dynamic-code.js` tokenizes comments, strings, template literals and regex literals before matching, deciding from the previous significant token whether a `/` opens a regex or divides, so a quote, a backtick or `//` inside a regex can no longer open a string or comment frame and hide the code after it. Regex bodies stay counted as code, so a sink spelled inside one is still reported. It reports `eval`, `Function`, a `setTimeout`/`setInterval` given a string, and a dynamic `require` or `import`; `tests/dynamic-code-lint.test.js` proves the tokenizer on fixtures that place a sink after a regex holding a backtick or a quote, and asserts that `src/plugin.js` is scanned in full — including both `requestUrl` calls — and that no source file collapses to a fraction of itself.

## 4. Dynamic HTML sinks

Six assignments to `.innerHTML` in the shipped source, all with a checked right-hand side:

| Location | Right-hand side | Why it is safe |
| --- | --- | --- |
| `src/plugin.js` (SMILES block) | `safeSvg(result.svg)` | `safeSvg` returns `""` for `<script`, `<foreignObject`, `<iframe`, `<object`, `<embed`, any `on*=` handler, `javascript:` or `data:text/html` |
| `src/reference-view.js` (SMILES preview) | `safeSvg(result.svg)` | Same guard |
| `src/plugin.js` ×4 (`chem`, `biology`, `biosequence`, `circuit`) | `result.html` from `src/stem-diagrams.js` | Every interpolated value passes `escapeHtml`; the test renders hostile input through all three renderers and asserts no `<script`, `<img` or event handler survives |

Everything else is built with Obsidian's `createEl`/`setText`, which cannot inject markup.

## 5. Filesystem writes

Thirteen files write to the vault: `src/agent-note.js`, `src/agent-view.js`, `src/calendar-notes.js`,
`src/course-notes.js`, `src/graph-3d-panel.js`, `src/import-modal.js`, `src/ocr-modal.js`,
`src/paper-scanner.js`, `src/pdf-annotation-modal.js`, `src/pdf-editor-modal.js`, `src/pdf-ink-modal.js`,
`src/plugin.js`, `src/reference-view.js`.

Two contracts keep them bounded:

- **PDF saves never touch the source.** `plugin.savePdfCopy` writes `name (edited).pdf` through
  `editedPathFor`, which strips leading slashes and every `\ / : * ? " < > |` from the base name,
  keeps the original folder, and picks a free path instead of overwriting. The original PDF, its
  hash and its `.annotations.md` sidecar are never opened for writing.
- **Note writes go through `vault.process`/`processFrontMatter`**, which Obsidian serialises, so two
  writes cannot interleave. Import and OCR paths create new notes rather than editing the source
  document.

`src/opencode-manager.js` is the only file that uses Node's `fs` and `child_process`, and only
through lazy `nodeReq(...)` lookups so a mobile build never loads them: it downloads and unpacks the
OpenCode binary into the plugin's own data directory, and spawns it loopback-bound with a random
password. This is the accepted desktop-only exception recorded in `plan.md`.

## 6. Untrusted-input parsers

Every one of these runs in-process on data the user opened, and a malformed input is a refusal, not
a crash path that writes:

| Input | Parser |
| --- | --- |
| PDF (reader, annotator, editor) | vendored `vendor/pdf-lib.js` 1.17.1 |
| Anki `.apkg` | the SQLite reader in `src/apkg*.js` plus the zip reader |
| Word / PowerPoint / OpenDocument / RTF / HTML import | `src/importer.js`, `src/documents.js` |
| CSV, QTI, Quizlet text/PDF, ICS | `src/importer.js`, `src/qti-archive.js`, `src/calendar-ics.js` |
| Note frontmatter | `parseYaml` through Obsidian, with per-field normalisers |
| WordNet data files | `src/wordnet.js` (bounded files, refused on collision) |
| SMILES / chemistry / biology / circuit | `src/smiles.js`, `src/stem-diagrams.js` |
| AI replies | parsed as JSON, shape-checked by `src/chat-stream.js`, `src/model-discovery.js`, never executed |

## 7. Residual risk (stated, not claimed away)

- pdf-lib, the zip and SQLite readers parse **untrusted files in-process**. A memory-safety or
  decompression bug in a dependency would run inside the plugin; the mitigation is that pdf-lib is
  the unmodified published 1.17.1 build, checked by SHA-256 in `npm run check`, and the zip/SQLite
  readers are small, bounded local code.
- Turning on an AI provider intentionally sends the selected notes, prompts or page images to that
  provider. That is the feature, not a leak; no provider is on by default, and local models exist.
- The OpenCode child process runs with the vault as its working directory and can write there. It is
  loopback-only, password-gated, desktop-only and user-installed.
- The optional Web browser renders third-party pages in sandboxed frames with
  `referrerpolicy="no-referrer"`; nothing is proxied, injected or read cross-origin, but framing is
  not a content filter.
- Third-party community plugins that read the same vault are outside this codebase and are not
  audited here.
