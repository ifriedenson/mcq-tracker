# Plan decision sheet — answered Nov 6, 2026

`plan.md` (v1.300.0) now has **98 checked roadmap rows, 3 `[~]` partial rows
and 0 unchecked rows**. The three owner manual passes are environment-blocked
(no Obsidian window, no X server/Xvfb, and no iOS or Android device), so they
are recorded as `[~]` partial rows in §7 and tracked with their blockers in §B;
no pass/fail result has been pasted into this sheet, so none is claimed
complete. Card answer
dictation shipped with an editable transcript; PDF→FRQ import remains a
text-layer preview-then-create command; four former gates remain closed by
decision: TTS/audio, pronunciation, the FRQ accuracy claim and pilot thresholds.

The plan's **§B** table lists the three open passes; **§C** lists what was
decided against. Nothing below needs another product decision before an agent
can work, except the three passes that need a real window or device.

---

## 1. Math/chemistry rendering audit — `plan.md` row under **§5.16.1**

**Decision:** no visual pass is claimed. The renderer audit, golden tests and
chemistry fallback are shipped, and the sample vault now includes the studyable
note `samples/sample-vault/Questions/math-audit.md`. This environment has no
real Obsidian window, so the visual check cannot be run or fabricated here.
Open the sample vault in Obsidian and run that note through **Practice → answer
→ review**, a **timed test**, **Cards**, and a **review chat** in light and dark
themes and a narrow phone-sized pane. Paste pass/fail per surface into this
sheet; §11 E1 closes only then.

## 2. Mobile audit on real devices — `plan.md` row under **§5.19**

**Decision:** no device result is claimed. The plugin now registers
`obsidian://mcq-tracker-quick?minutes=5` (and `count=10` / `course=Biology`
variants) through the real Quick Practice entry point, and the headless layout
and URI tests pass. No iOS or Android device is available in this environment,
so run `docs/mobile-layout.md` on one of each: touch targets, day rail, keyboard
dismissal, safe areas, app-switch pause/resume and the home-screen link. Paste
both results here; §11 E2 closes only then.

## 3. README screenshots — `plan.md` row under **§10b**

**Decision:** no screenshots are claimed. This environment cannot open a real
Obsidian window (no X server or Xvfb; `sudo` is blocked by `no_new_privs`), and
generated or mock images would misrepresent the plugin. Capture four real
window screenshots to `docs/images/practice.png` (question and choices),
`docs/images/review-dock.png` (the note review dock), `docs/images/today.png`
(due counts and Start 5 minutes) and `docs/images/pdf-reader.png` (PDF reader
with annotations). Add captions and README image links only after the files
exist; the §10b growth refresh closes then.

## 4. Optional TTS / audio-only commute — **decided**

**Decision:** keep device speech only. Provider TTS, commute playback and mobile
audio work are declined. Device-voice Read aloud with sentence highlighting
stays as shipped. Closes §11 E5; no key, cost or privacy surface is added.

## 5. Pronunciation feedback — **decided**

**Decision:** decline it. Language practice keeps typed answers, browser/OS
dictation and editable card-answer transcripts; no audio capture by the plugin
or speech scoring is added. Closes §11 E5.

## 6. AP FRQ accuracy claim — **decided**

**Decision:** keep the explicit no-accuracy-claim. The rubric grader stays
labelled an aid; no human-scored fixture set is built and no agreement number is
claimed. Closes §11 E6.

## 7. Pilot go/no-go thresholds — **decided**

**Decision:** no numeric threshold. The pilot stays "approved and shipped",
never "validated". Closes §11 E6.

## 8. PDF→FRQ import — **shipped**

**Decision:** shipped. The learner supplies a PDF containing free-response
prompts and the scoring rubric, reviews the split in a preview, creates ordinary
FRQ notes, types an answer, and the existing AI tutor grades against the rubric
extracted from that PDF. The grader stays an aid; no accuracy claim is made.

Shipped scope:

- Add a command that picks a vault PDF (**AP: import free-response questions
  from a PDF**) and exposes `importFrqPdf(file)` for other surfaces. Read the
  text layer through `readPdfPages` in `src/pdf.js`. The import is text-layer
  only: an image-only/scanned PDF is refused with a Notice and does not run
  OCR or a vision call.
- Implementation anchors: `splitFrqItems` in `src/frq-import.js` for the split,
  `buildFrqNote` in `src/frq.js` and `createFrqNote` in `src/plugin.js` for the
  note, and the existing FRQ grader for scoring.
- Split the document into up to 60 candidate items from question numbering and
  "question"/"free response"/"FRQ", "scoring guidelines"/"rubric"/"answer key"/
  "points possible" headings, with a first-criterion fallback. Each item keeps
  its prompt, rubric text, parsed criteria and points, source page/pages and
  warnings; all text before the rubric (including a stimulus) belongs to the
  prompt. An unrecognized rubric stays visible as invalid and is never replaced
  with a preset.
- Show a preview before writing: title, prompt, rubric text, page, course and
  question type. The learner can edit the text, untick/drop an item, or cancel.
  Drawing the preview writes nothing. On create, every selected item is parsed
  and checked through `buildFrqNote` before the first write, so one invalid item
  blocks the whole batch; name collisions use the existing unique-path helper.
- Create ordinary FRQ notes through the existing note builder/parser under the
  AP FRQs folder, so history, second pass, scheduler feed and the AI grader keep
  working unchanged. Imported rubrics are marked `rubric_source: user`; no new
  note schema.
- Grade typed or OS-dictated answers through the existing rubric grader; no new
  AI feature ID, provider or model allow-list entry.
- Tests: `tests/frq-import.test.js` covers extraction/splitting, bullet and
  table rubrics, missing rubric, empty text layer, a heading-less document,
  preview-before-write, course selection, dropping an item, invalid-item refusal,
  the picker/command and grading an imported note. No network.
- Limits: no bundled exam content, no accuracy claim, no OCR/vision fallback in
  this import, no PDF upload or stored copy, and no new dependency or note schema.

---

## Adjacent owner questions — answered

| ID | Question | Decision |
|---|---|---|
| O1 | Keep the name "MCQ Tracker" or rename? | Keep the name and plugin ID; the description carries the breadth |
| O2 | Original AP/SAT sample packs, or link-only? | No bundled content; link-only guidance |
| O4 | Tutor-only mobile, or full agent? | Tutor-only on phones; full OpenCode agent stays desktop-only |
| O5 | FRQs on phones: dictated only, or skipped? | Typed or dictated answer text; no mobile rubric redesign |
| O9 | Compatibility promise for note formats? | Indefinite, with explicit migrations |
| O10 | Maintain a BRAT beta channel? | Stable releases only; no beta track |
| O11 | What justifies a standalone mobile app? | Wait for a measured demand/retention signal; PWA test first if needed |
| O12 | Who signs off `NOTICES.md` and copied-file review? | Agent drafts each entry; owner reviews the batch before release |
| D5 | Hold Course / uni-calendar interop needs a sample note | Stay on ICS; no sample note supplied, no property mapping |
| E11 | Community-directory relisting needs dashboard errors | Leave the listing absent until the errors are supplied |
| O13 | Similarity/licence scan before distribution | Local scan run Nov 6, 2026: `jscpd` found 32 internal clones (426 lines, 0.62% of 291 files); `license-checker` reports one UNLICENSED package (the project root, which has no SPDX field); vendored pdf-lib and PDF++ are MIT. No external-code corpus or hosted service was available, so no external-copying result is claimed. |

## Closed in this pass

| Plan row | Decision |
|---|---|
| Optional TTS/audio commute (§5.22.4) | Device speech only; provider TTS and commute playback declined |
| Pronunciation feedback (§5.22.4) | Declined; no audio capture or scoring |
| AP FRQ accuracy claim (§5.20) | No accuracy claim; grader stays an aid |
| Pilot go/no-go thresholds (§7 Phase 2b) | No numeric bar; shipped is not validated |

The three OCR rows remain closed for the reasons recorded in the previous sheet:
§11 E3 keeps the BYOK vision path and §11 E4 reversed the PDF-form gate. These
gate decisions did not change code. The PDF→FRQ import shipped separately in
§5.20.5; no implementation row remains open.
