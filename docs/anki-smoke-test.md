# AnkiConnect real-UI run sheet — owner run

The automated suite mocks every AnkiConnect request, so three things can only be
proven in a real window: Obsidian's rendered Markdown, Anki's media cache, and a
live AnkiConnect endpoint. This is the sheet for that run.

**Who runs it:** the plugin owner, on a desktop with Anki installed (decision
recorded in [plan-decisions.md](plan-decisions.md), §11 E7–E8).

**Time:** about 30–40 minutes. **Status:** a release with Anki changes stays
unpublished until every step here is a pass, or the failing step is understood
and written into the release note.

**Safety:** use a copy of a real vault or a small test vault. The preview is
read-only, but **Apply** writes note properties and sends cards to Anki. Commit
or back up the vault first.

Each step gives an **Expected** result. Record pass or fail immediately; do not
"try it again and see". A step that behaves differently is the finding.

## 1. Setup

- **S1.** Install and open Anki desktop.
  **Expected:** Anki opens normally, so an unrelated Anki problem is not later
  blamed on the bridge.
- **S2.** In Anki, install the AnkiConnect add-on (code `2055492159`), then
  restart Anki. Open `http://127.0.0.1:8765` in a browser.
  **Expected:** the page answers with the AnkiConnect version, for example
  `{"result": "AnkiConnect v.6", "error": null}`. Write that version down.
- **S3.** In Obsidian, enable **Cards**, then **Settings → Cards → Decks →
  Enable AnkiConnect sync**. Leave the address at `http://127.0.0.1:8765`.
  **Expected:** the setting persists after closing and reopening the tab.
- **S4.** Create three card notes: one in deck A (unlinked), one in deck B
  already linked to an Anki note, and one in a course the filter will exclude.
  **Expected:** all three exist in the vault and two of them already carry an
  Anki note id.
- **S5.** Run **Cards: test AnkiConnect** (or the connection test in the deck
  settings).
  **Expected:** a success notice naming the version; stopping Anki and testing
  again gives a readable failure, not a silent one.

## 2. Vault-wide push

- **V1.** Select a deck/course filter that excludes the third card.
  **Expected:** the card list shows only the filtered cards.
- **V2.** Run **Cards: push the whole vault to Anki (AnkiConnect)** and read the
  preview.
  **Expected:** the preview lists **every** vault card, including the excluded
  one, and says so.
- **V3.** Check the action column.
  **Expected:** the unlinked card reads **Create**, the already-linked card reads
  **Update**, and there is exactly one row per card — no duplicate create for the
  linked card.
- **V4.** Apply the push.
  **Expected:** in Anki, the unlinked card was created once, the linked note was
  updated **in place** (same note id, schedule unchanged), and the filtered-out
  card is present because the command is vault-wide.
- **V5.** Re-run the same push and apply it again.
  **Expected:** both cards are now updates, and Anki holds no second note for
  either.
- **V6.** Open one card's properties in Obsidian.
  **Expected:** each pushed note stores its Anki note id and deck, so the next
  push is an update rather than a create.

## 3. Source backlinks

- **B1.** Add `source_note`, `source_page` (for example `12-14`) and
  `source_heading` (for example `## Cell & theory`) to a card, and enable
  **Source backlink in Anki**.
  **Expected:** the setting is visible and persisted.
- **B2.** Push that card, open it in Anki, and click the **Source note** link.
  **Expected:** Obsidian opens the source note at the right page/heading.
- **B3.** Repeat with a vault whose name and a file whose name contain `&`,
  spaces and non-ASCII characters (for example `Café & Notes`).
  **Expected:** the link still opens the right note; nothing is truncated or
  HTML-escaped twice.
- **B4.** Push the same card again, then run a two-way sync preview.
  **Expected:** the backlink is not duplicated, and the preview reports no
  conflict caused only by the backlink.

## 4. Markdown tables

- **T1.** Put this table in a card body:

  ```markdown
  | **Term** | Meaning |
  | --- | --- |
  | ATP | Energy \| work |
  | `cAMP` | *Second messenger* |
  ```

- **T2.** Push it and inspect the field in Anki.
  **Expected:** an HTML table with the bold header, inline code and italics
  intact, and one literal `|` inside the ATP cell.
- **T3.** Run a two-way preview.
  **Expected:** the table is not reported as an unexplained local change or
  conflict merely because Markdown and Anki HTML differ.
- **T4.** Edit the table in Anki, pull it, and open the note in Obsidian.
  **Expected:** the local card stays readable, with the table still a table.

## 5. Media conflicts and failures

- **M1.** Put two different images with the same basename in two folders, for
  example `Media/A/diagram.png` and `Media/B/diagram.png`, and reference both
  from cards.
  **Expected:** both cards render the correct image in Obsidian before pushing.
- **M2.** Push both cards.
  **Expected:** a **media filename conflict** warning names both paths, and only
  one file is uploaded — no silent overwrite.
- **M3.** Rename one file, push again.
  **Expected:** both images now render in Anki.
- **M4.** Reference a missing image and push.
  **Expected:** the warning says the text was sent without the media, and Anki
  shows a missing-media placeholder rather than a broken custom-protocol link.
- **M5.** Stop Anki (or block the media endpoint), then push.
  **Expected:** the card text is still sent, and the result reports a media
  upload warning instead of failing the whole push.
- **M6.** Restore Anki and push again.
  **Expected:** the media upload recovers, and no duplicate card is created.

## 6. Two-way sync and finish

- **F1.** Run **Cards: sync with Anki (AnkiConnect)**, preview it, then apply.
  **Expected:** the preview lists only real differences, and Apply reports what
  it changed per card.
- **F2.** Open each changed card in Anki.
  **Expected:** schedule, deck, tags and field text are correct; nothing was
  rescheduled by a text-only change.
- **F3.** Edit a card in Anki and pull it.
  **Expected:** the local note keeps its own properties, and the changed field is
  the only local change.
- **F4.** Record the versions below.

## 7. Results

| Step | Result | Note |
|---|---|---|
| S1–S5 setup | pass / fail | |
| V1–V6 vault-wide push | pass / fail | |
| B1–B4 source backlinks | pass / fail | |
| T1–T4 markdown tables | pass / fail | |
| M1–M6 media | pass / fail | |
| F1–F3 two-way sync | pass / fail | |

## 8. Report template

```
Plugin version:      (manifest version tested)
Obsidian:            (e.g. 1.15.1)
Anki:                (Help → About)
AnkiConnect:         (version string from S2)
OS:                  (name + version)

S1-S5:   pass / fail   (notes)
V1-V6:   pass / fail   (notes)
B1-B4:   pass / fail   (notes)
T1-T4:   pass / fail   (notes)
M1-M6:   pass / fail   (notes)
F1-F3:   pass / fail   (notes)

Failures to fix before release: (step, what happened, the preview warning,
the Anki field HTML, and the network error if there is one)
```

If a step fails, leave the release unpublished until it is fixed, and paste the
failure into the next release note so the fix has a record.
