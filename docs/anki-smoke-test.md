# AnkiConnect real-UI smoke test

This checklist covers the parts of the Anki bridge that automated tests cannot
prove: Obsidian's rendered Markdown, Anki's media cache, and a real AnkiConnect
HTTP endpoint. Run it on a desktop vault before calling an Anki release verified.

Use a **copy of a real vault** or a small test vault. The preview is read-only,
but **Apply** writes note properties and sends cards to Anki. Make a vault backup
or use Git first.

## Setup

1. Install and open Anki desktop.
2. Install the AnkiConnect add-on (code `2055492159`) and restart Anki.
3. In Obsidian, enable **Cards** and then **Settings → Cards → Decks →
   Enable AnkiConnect sync**.
4. Confirm the address is reachable (default `http://127.0.0.1:8765`).
5. Create two card notes in different decks: one unlinked and one already
   linked to an Anki note. Keep a third card outside the current deck/course
   filter for the vault-wide check.

## Vault-wide push

1. Select a deck/course filter that excludes at least one card.
2. Run **Cards: push the whole vault to Anki (AnkiConnect)**. Confirm the
   preview lists every vault card, not only the filtered cards.
3. Check that an unlinked card is shown as **Create** and a linked card is shown
   as **Update**. There should be no duplicate create for the linked card.
4. Apply. In Anki, confirm:
   - the unlinked card was created once;
   - the linked note was updated in place, keeping its note ID and scheduling;
   - the filtered-out card is present because the command is vault-wide.
5. Re-run the same push. The unlinked card should now be a linked update and no
   second Anki note should appear.

## Source backlinks

1. Add `source_note`, `source_page` (for example `12-14`) and `source_heading`
   (for example `## Cell & theory`) to a card, and enable **Source backlink in
   Anki**.
2. Push the card, open the note in Anki, and click the **Source note** link.
3. Confirm Obsidian opens the source note and the heading/page context is
   correct. Test a vault name or filename containing `&`, spaces and non-ASCII
   characters.
4. Confirm the backlink is not duplicated after a second push or a two-way sync.

## Markdown tables

1. Put a pipe table in a card with a bold header, inline code and an escaped
   pipe, for example:

   ```markdown
   | **Term** | Meaning |
   | --- | --- |
   | ATP | Energy \| work |
   | `cAMP` | *Second messenger* |
   ```

2. Push and inspect the Anki field. The table should render as an HTML table
   with bold/code/italic formatting intact and a literal `|` inside the cell.
3. Run a two-way preview. The table must not appear as an unexplained local
   change or conflict only because the local Markdown and Anki HTML differ.
4. Pull an edited table from Anki and confirm the local card remains readable.

## Media conflicts and failures

1. Put two different images with the same basename in two folders, for example
   `Media/A/diagram.png` and `Media/B/diagram.png`.
2. Reference both from cards and push. The result must warn about a **media
   filename conflict** and name both paths; only one file is uploaded.
3. Rename one file, push again, and confirm both images now render in Anki.
4. Reference a missing image and push. The warning should say the text was sent
   without the media and Anki should show a missing-media placeholder rather
   than a broken custom protocol link.
5. Temporarily stop Anki or block the media endpoint, then push. The card text
   should still be sent and the result should show a media upload warning.
6. Restore Anki and re-push. The media upload should recover without creating a
   duplicate card.

## Finish

1. Run a normal **Cards: sync with Anki (AnkiConnect)** preview and apply it.
2. Open each changed card in Anki and confirm the schedule, deck, tags and text
   all look correct.
3. Record the AnkiConnect version, Anki version and Obsidian version used.
4. If a check fails, capture the preview warnings, the Anki field HTML and the
   browser/network error, and leave the release unpublished until it is fixed.
