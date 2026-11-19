# Embedded PDF++ (removed in 1.307.29)

MCQ Tracker no longer embeds PDF++. The subsystem (the unmodified upstream
production bundle, its stylesheet, the host and settings adapter) was removed
to bring `main.js` under Obsidian Sync's 5 MB per-file limit; the bundle is now
about 4.3 MB.

PDF work stays in the plugin's own surfaces: the continuous reader, quote and
ink annotation, annotation sidecars and the sidebar, searchable annotation
index and digest export, rectangle/selection deep links (`[[file.pdf#page=3…]]`,
opened by **PDF: open a copied deep link**), and the page/form editor on the
vendored pdf-lib (rotate, reorder, insert, duplicate, delete, merge, extract,
split, live forms, links, bookmarks, 20-step undo).

History: 1.277.0 embedded the MIT PDF++ 0.40.31 bundle
(upstream: https://github.com/RyotaUshio/obsidian-pdf-plus) as a hosted child
component with its settings rendered inside **Settings → App & documents**.
That integration, its notices entry and its settings page were deleted in
1.307.29. This file remains as a pointer so old links land somewhere true.
