# Embedded PDF++

MCQ Tracker embeds the complete, unmodified **PDF++ 0.40.31** production bundle.
PDF++ is MIT licensed; its copyright and third-party notices are in `NOTICES.md`.

- Upstream: https://github.com/RyotaUshio/obsidian-pdf-plus
- Embedded bundle: `vendor/pdf-plus.js`
- Embedded stylesheet: `vendor/pdf-plus-css.js` (injected only while the host is active)
- Host: `src/pdf-plus.js`
- Toggle and options: **Settings → App & documents → PDF++** (and **Settings → App & documents → Modules and global options** links to it)

## Why this is a host, not a rewrite

PDF++ is a 24,600-line TypeScript integration with Obsidian’s native PDF viewer,
its patched internals, PDF.js, outline/page-label/embed handling, external-app
sync and a Vim implementation. Reimplementing that in this plugin’s plain-JS
reader would be incomplete and fragile. The upstream class is loaded at runtime
and managed as a child component, so its full feature set stays available.

The host gives PDF++:

- a private manifest (`mcq-tracker-pdf-plus`) so it cannot collide with an
  installed `pdf-plus` plugin;
- `loadData`/`saveData` backed by MCQ Tracker’s `settings.pdfPlus.data` rather
  than a second `data.json`;
- the same enable/disable and unload lifecycle as the rest of this plugin.

PDF++'s vendor settings tab is captured by the host instead of being added to
Obsidian's settings sidebar as a second top-level plugin tab. Its controls are
rendered inside **App & documents → PDF++**. PDF++'s commands and ribbon icons
are part of the host and disappear when the toggle is turned off. Nothing is
downloaded or installed separately: the bundle is already in `main.js`.

### Obsidian 1.15 Page Preview compatibility

Obsidian 1.15 no longer gives the core Page Preview instance an `overrides` map.
PDF++ 0.40.31 reads `internalPlugins.plugins["page-preview"].instance.overrides`
before falling back to `workspace.hoverLinkSources`, so drawing PDF++'s
settings controls throws `Cannot read properties of undefined (reading 'pdf-plus')`.
The host wraps only that plugin method: when `overrides` exists PDF++'s own
answer is used unchanged, and when it does not the host applies PDF++'s own
hover-source fallback (`hoverLinkSources[id].defaultMod`) without the throw.
This fixes the embedded page and any vendor tab instantiated for it; no PDF
feature or setting is changed.

### Where the embedded options are drawn

A vendor settings tab creates its `headerContainerEl` and `contentEl` in its
constructor, so reparenting a tab would leave a page mount empty. The host
captures the vendor tab object instead of registering it with Obsidian, and the
PDF++ page mounts a **second instance** of the vendor tab class with the same
hosted plugin, giving it its own container and calling `display()`. The captured
original remains available to the host, and its `openSettingTab()` is routed to
MCQ's PDF++ page, so PDF++'s **Customize...** links and `obsidian://pdf-plus`
protocol links open this page and scroll the visible embedded controls. There is
no **Open PDF++ settings tab** button and no second sidebar entry.

Obsidian's settings modal also supplies its own `.vertical-tab-content` gutter.
Inside the MCQ page that outer gutter plus PDF++'s content padding left vendor
rows only 259 px wide (92 px in the narrow picker state), clipping labels. Two
selectors scoped to `.qt-pdf-plus-embedded` remove the outer padding and keep a
16 px inner gutter; the selector includes the settings modal, so it beats
Obsidian's more specific rule without a forced declaration. Rows now measure
387 px in the 419 px page and 252 px narrow. No
vendor stylesheet, control or setting is changed.

## Coverage

The embedded bundle is the upstream implementation, not a feature subset:
backlink highlighting, callouts, colour palette and link templates, backlink
pane filtering and hover sync, direct PDF annotation editing, PDF page composer,
outline and page-label editing, internal-link history and previews, link copying
and context menus, PDF embeds and trimming, keyboard commands, external-app
sync, and Vim mode. The upstream README documents the individual switches.

The MCQ Tracker PDF reader, sidecar annotations, annotation index and page/form
editor are separate and remain available; they are not replaced by this host.

## Verified boot, teardown and resume

`tests/pdf-plus-boot.test.js` starts the **real** `vendor/pdf-plus.js` through
`src/pdf-plus.js` against the headless Obsidian app in
`tests/helpers/pdf-plus-boot.js`: a tracked `Component`/`Plugin` lifecycle, a
DOM, app/workspace/vault/metadata registries, a mobile-style `Platform`, and a
`surface(app)` snapshot that records everything the subsystem owns (command ids,
setting tabs, stylesheet count, event refs, intervals, embed registration,
hover-link sources, view registrations and patch flags). Nine tests run:

1. **Boot, registration, teardown.** The vendored class is constructed and
   loaded, its child components, commands and its **PDF++** settings tab (id
   `mcq-tracker-pdf-plus`) reach the app registries, the embedded stylesheet is
   injected, workspace event refs are live, and PDF++ has patched
   `Workspace.prototype.openLinkText`, `Menu.prototype.showAtPosition`, the page
   preview `onLinkHover` and the `pdf` embed/reader creator in
   `app.embedRegistry`, and registered its hover-link sources. The snapshot shows
   no duplicate command ids. After `stop`, every one of those is reversed and the
   snapshot equals an empty surface. The same test records every external module
   the bundle requests while loading and fails if any Node-only built-in (`fs`,
   `path`, `child_process`, `crypto`, …) is touched, so mobile loading cannot
   break silently.
2. **Off means off.** With `settings.pdfPlus.enabled` false the host returns
   nothing, the vendored bundle is never even `require`d, and no stylesheet,
   command, settings tab, patch or hover-link source appears. Turning it on
   attaches the whole surface.
3. **One reader session.** `beginMcqPdfUi()` / `endMcqPdfUi()` stop the host
   completely and restart it. The restarted surface is compared field by field
   with a clean boot: same commands and no duplicates, one settings tab, one
   stylesheet, the same event-ref and interval counts, exactly one PDF++ embed
   registration, the same hover sources and view registrations, all three
   prototype patches active, and a **fresh wrapper object on every patched
   target** rather than the wrapper the previous host left behind. The restarted
   host is a new instance with the same child, command and cleanup counts.
4. **Overlapping surfaces.** Two claims keep the host down; closing one changes
   nothing; closing the last restarts it; a stray extra release cannot drive the
   depth below zero, stop a running host or restart it a second time.
5. **Enable/disable while open.** Disabling under an open reader keeps the host
   off after it closes. Re-enabling starts a clean host with no stale pause.
   Toggling the module on under an open reader does not start a second PDF UI;
   the surface close then starts it once.
6. **Repeated cycles.** Three pause/resume cycles leave the same refs, intervals,
   commands, patch targets and registrations as a single clean boot, and the
   final stop leaves nothing behind.
7. **Real modal wiring.** `PdfInkModal.onOpen`/`onClose` and
   `PdfEditorModal.onOpen`/`onClose` (page rendering stubbed) claim and release;
   the editor opened over the reader nests the claim; only the last close
   restarts the host; a repeated close does not unbalance the depth.
8. **Claim/release balance.** Both modals claim and release exactly once, and a
   modal without a plugin host does not throw.
9. **The duplicate detector has teeth.** A second host loaded on top of the first
   without teardown makes the snapshot report duplicate commands and two settings
   tabs — the condition every resume test must avoid — and unwinding both hosts
   restores the stock prototypes.

### What "restarted exactly once" is proved by, and its limits

- The surface snapshot has no duplicate or missing piece: commands and their ids,
  setting tabs, embed registrations, stylesheet, refs, intervals, hover sources
  and views all match a clean boot.
- Teardown restores the **stock** prototype functions and embed creator. If
  layers had stacked across a pause/resume cycle, the restored function would be
  a PDF++ wrapper instead, and that identity check fails.
- Each resume must install a fresh wrapper on every patched target, so a reused
  or stale patch is caught.
- The tests cannot introspect the internals of the vendor's opaque wrapper
  functions; the proof is the absence of duplicates, the stock restoration and
  wrapper freshness, not a depth counter inside PDF++.
- The harness has no real PDF leaf, so this proves load, UI registration,
  teardown and resume — not what PDF++ draws inside Obsidian's native viewer.
  That still needs a real desktop/mobile run.

## When MCQ Tracker's own PDF view is open

MCQ Tracker must never show two PDF UIs over the same file. PDF++ decorates and
patches Obsidian's **native** PDF view; the MCQ reader (`PdfInkModal`) and the
page/form editor (`PdfEditorModal`) draw their own canvas overlays instead. So
while any MCQ PDF surface is open, the embedded PDF++ host is **stopped** — its
commands, settings tab, patches, embed creator and hover sources all go away —
and it is started again when the last one closes:

- Each modal calls `claimPdfPlus` on `onOpen` and `releasePdfPlus` on `onClose`,
  which call `plugin.beginMcqPdfUi()` / `plugin.endMcqPdfUi()`. A modal never
  claims twice or releases a claim it does not hold.
- Opens are counted on the plugin (`pdfPlusUiDepth`), so the editor opened on
  top of the reader keeps the host down until both are closed, and the host
  restarts exactly once, when the depth returns to zero.
- `pdfPlusPaused` blocks `startPdfPlus()` (and `setPdfPlusEnabled(true)`) while
  paused, so a settings toggle cannot bring a second PDF UI back under an open
  reader.
- Start and stop are serialized on one queue, so a reader that opens and closes
  in the same tick cannot overlap PDF++'s patch and unpatch.
- Turning the module off while a reader is open keeps it off after the reader
  closes; turning it back on starts a clean host with no stale pause.

### Limits of the pause policy

- The whole host is stopped, not just its decoration. While a reader or editor
  is open, the **PDF++** settings tab, its commands, ribbon icons, embed creator
  and hover-link sources are absent. They come back when the last MCQ PDF
  surface closes.
- A settings toggle made while a surface is open is applied when that surface
  closes; it never starts a second PDF UI underneath.
- Pause is driven by MCQ's own reader and page/form editor modals. It does not
  pause for Obsidian's native PDF leaf, and it cannot stop a user from opening
  the same PDF natively before or after those modals.
- PDF++'s settings survive through `settings.pdfPlus.data`, but state that only
  lives inside a running host (for example an open PDF++ sidebar) is rebuilt
  after a resume, because the host is a new instance.
- Each resume pays PDF++'s boot cost (patching, component and command
  registration), and a very fast open/close pair still completes both
  transitions in order rather than cancelling them.

## Boundaries and maintenance

- The bundle is desktop and mobile capable, but PDF++ features that use
  `child_process` or the OS default application are necessarily desktop-only.
- If the standalone **PDF++** plugin is enabled, the embedded copy refuses to
  start and explains why rather than double-patching the native viewer. Disable
  the standalone plugin; MCQ Tracker then supplies the same feature set.
- PDF++’s link-copy templates use JavaScript expressions, so that upstream
  feature is a deliberate dynamic-evaluation surface. It is not used by MCQ
  Tracker’s own code and is not covered by the plugin’s no-dynamic-code lint,
  which scans `src/` only.
- The upstream bundle is pinned at 0.40.31. To update it, replace
  `vendor/pdf-plus.js` and regenerate `vendor/pdf-plus-css.js` from the matching
  upstream release, then update `EMBEDDED_VERSION`, notices, this page and the
  manifest table. Do not hand-edit either generated asset.
