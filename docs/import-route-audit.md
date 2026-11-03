# Flashcard import route audit

**Date:** November 3, 2026
**Baseline:** 1.213.0
**Scope:** every card import route exposed by the plugin.

## Evidence

- `tests/import-routes-audit.test.js` drives the import dialog's preview
  function and then the same handler used by the Import button. It asserts that
  preview writes nothing, then checks the written card count, front, back and
  `import_key` prefix.
- `tests/import-pdf-route-audit.test.js` drives Quizlet PDF extraction through
  the real PDF text/extraction path with a mocked PDF.js page provider, then the
  real card writer.
- Existing end-to-end suites cover portable archives, study bundles, clipboard
  quiz import and mocked AnkiConnect push/pull/conflict behaviour.

## Demonstrated card routes

| Route | Input used | End-to-end evidence | Result |
| --- | --- | --- | --- |
| Spaced Repetition folder | tagged `#flashcards/Spanish` note with inline cards | `import-routes-audit` | Works |
| Mochi Markdown folder | `hola --- hello` card file | `import-routes-audit` | Works |
| LearnKit note/folder | `Q`/`A`/`G` pipe block | `import-routes-audit` | Works |
| CrowdAnki JSON | nested deck with a basic note | `import-routes-audit` | Works |
| Anki text | header + tab-separated basic note | `import-routes-audit` | Works |
| Anki package (`.apkg`) | repository `anki-basic.apkg` fixture | `import-routes-audit`, `apkg.test.js` | Works; multi-card fix shipped in 1.211.1 |
| Quizlet text | tab-separated term/definition pairs | `import-routes-audit` | Works |
| Quizlet PDF | printed term/definition pages | `import-pdf-route-audit.test.js` (PDF.js mocked) | Works |
| Moodle GIFT | multiple-choice GIFT question | `import-routes-audit` | Works |
| Moodle XML | multiple-choice question | `import-routes-audit` | Works |
| QTI XML | QTI 2.1 item | `import-routes-audit` | Works |
| QTI ZIP | zipped QTI 1.2 XML | `import-routes-audit` | Works |
| FlashQuiz | `@mc` block with a checked option | `import-routes-audit` | Works |
| QuizPort JSON | object with `questions` and index answer | `import-routes-audit` | Works |
| Markdown checkbox quiz | heading + checked choice | `import-routes-audit` | Works |
| Kahoot CSV | four choices and numeric key | `import-routes-audit` | Works |
| Blooket CSV | answer-text key | `import-routes-audit` | Works |
| Gimkit CSV | correct + incorrect columns | `import-routes-audit` | Works |
| Generic CSV/TSV | header mapping, deck and course | `import-routes-audit` | Works |
| Markdown table | Front/Back/Deck table | `import-routes-audit` | Works |
| PDF/Markdown AI card fallback | Markdown source, no local cards, mocked provider | `import-routes-audit` | Works; writes only after preview |
| Portable card archive | exported card note archive | `card-archive.test.js` | Works; skip and overwrite paths covered |
| Study bundle | exported question/card bundle | `study-bundle-import.test.js` | Works; conflicts and invalid bundles covered |

## Demonstrated non-card or service-backed routes

| Route | Evidence | Result |
| --- | --- | --- |
| AnkiConnect push | `anki-connect.test.js` with mocked HTTP | Works |
| AnkiConnect pull/sync/conflict | `anki-connect.test.js` with mocked HTTP | Works |
| Clipboard quiz import | `note-quiz-clipboard.test.js` | Works; writes question notes, not flashcards |
| AI question file import | `import-source.test.js` covers reading; AI writing is provider-backed | Not exercised in this card audit; it creates question notes, not cards |

## Not available here

- A live Anki collection through AnkiConnect. The route is exercised with mocked
  AnkiConnect responses.
- Live Quizlet or Mochi accounts. Their supported import routes are file/export
  based, not network APIs; those exports are covered above.
- A manual click-through inside Obsidian. The tests call the same preview and
  import handlers the dialog buttons call, but do not render the modal UI.

## Defects found

One card-import defect was found in this audit: `.apkg` packages kept only the
first card row per Anki note. That was fixed and released as **1.211.1**. Every
other route above passed without changes, so no version was bumped for them.
