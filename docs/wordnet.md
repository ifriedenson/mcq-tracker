# Offline WordNet

MCQ Tracker can search a full local WordNet database from the **Vocabulary** tab. The plugin does not bundle, download or host WordNet: you import the four standard data files from your own copy, and they stay in your vault. Lookups run entirely on your device.

## What it adds

- Every noun, verb, adjective and adverb synset in the imported database.
- The WordNet gloss, synonyms and selected semantic relations (hypernyms, hyponyms, antonyms and the related pointer types).
- Prefix suggestions when an exact word is not found.
- Optional, off by default. Nothing appears in the Vocabulary tab until **WordNet offline dictionary** is enabled.

The existing **Glossary from your notes** lookup is unchanged. WordNet is a separate source; it does not merge into notes, vocabulary words, cards, questions or schedules.

## Import WordNet

1. Get the WordNet 3.x database from Princeton's WordNet distribution. You need the four files:
   - `data.noun`
   - `data.verb`
   - `data.adj`
   - `data.adv`
2. In Obsidian, open **Settings → MCQ Tracker → Study tools → Vocabulary** and turn on **WordNet offline dictionary**.
3. Open the **Vocabulary** tab and expand **WordNet offline dictionary**.
4. Press **Import WordNet files** and select all four files.
5. The plugin checks that all four are present and readable, then writes them to the vault folder shown in the card (`WordNet` by default). The lookup is ready immediately.

If the target folder already contains a file with one of those names, the import is refused instead of overwriting it. Move or delete the old data, or change **WordNet data folder** under the Vocabulary settings, then import again.

**Load from folder** rebuilds the in-memory index from files already in the configured folder. Use it after restarting Obsidian, or after placing the files in the vault yourself. The parsed index is not stored in `data.json`; it is rebuilt from the files when you press the button.

## Safety and limits

- No network request, account, provider, telemetry or package dependency is used.
- Importing writes only the four chosen data files under the configured vault folder. It never edits a note or changes a question, card, vocabulary row, streak or schedule.
- A lookup is read-only.
- The importer requires all four files. A partial database is refused.
- The parser accepts the standard WordNet `data.*` format. It does not run a stemmer or lemmatizer, so an inflected form needs its own entry or a prefix that leads to one.
- The full database is several megabytes. Parsing is done in memory and may take a moment on a phone; the index is built only when you import or load it.
- WordNet is distributed under the WordNet License. The plugin does not redistribute the database; review the licence that comes with your copy before importing it.

## Source format

A synset line begins with its decimal offset and contains the part of speech, a hexadecimal word count, word/lex-id pairs, a pointer count, pointer quadruples and a gloss after `|`. The parser keeps the gloss, words, pointer targets and relation labels; it resolves pointers only after all files have been read, so a relation can point into another file.
