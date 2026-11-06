# Plan decision sheet — answered Nov 6, 2026

`plan.md` (v1.278.0) now has **98 checked roadmap rows, 3 `[~]` partial rows
and 0 unchecked rows**. The three partials are owner manual passes that are being
run now. PDF→FRQ import shipped as a text-layer preview-then-create command;
four former gates remain closed by decision: TTS/audio, pronunciation, the FRQ
accuracy claim and pilot thresholds.

The plan's **§B** table lists the three open passes; **§C** lists what was
decided against. Nothing below needs another product decision before an agent
can work, except the three passes that need a real window or device.

---

## 1. Math/chemistry rendering audit — `plan.md` row under **§5.16.1**

**Decision:** the owner is running the checklist now. The row stays `[~]` until
the result is pasted into this file or chat; no visual pass is claimed yet.

Run `docs/math-rendering-audit.md` once: paste its samples into a scratch note,
compare against the goldens it names, and report pass/fail per item. Closes §11
E1 when the result arrives. No code follows.

## 2. Mobile audit on real devices — `plan.md` row under **§5.19**

**Decision:** the owner is testing one iOS and one Android device now, following
`docs/mobile-layout.md` (touch targets, day rail, keyboard dismissal, safe
areas). The row stays `[~]` until both results are pasted. Closes §11 E2 when
they arrive. Mobile practice already ships; no claim is made before the result.

## 3. README screenshots — `plan.md` row under **§10b**

**Decision:** the owner is capturing the four screenshots now (practice session,
review dock, study dashboard, PDF reader). The row stays `[~]` until the images
are supplied; filenames, folder, captions and README wiring follow. Closes the
§10b growth refresh when the images arrive.

## 4. Optional TTS / audio-only commute — **decided**

**Decision:** keep device speech only. Provider TTS, commute playback and mobile
audio work are declined. Device-voice Read aloud with sentence highlighting
stays as shipped. Closes §11 E5; no key, cost or privacy surface is added.

## 5. Pronunciation feedback — **decided**

**Decision:** decline it. Language practice keeps typed answers and OS
dictation; no audio capture or speech scoring is added. Closes §11 E5.

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
