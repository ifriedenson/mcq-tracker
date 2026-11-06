# Plan decision sheet

`plan.md` (v1.277.0) has **93 checked roadmap rows, 7 `[~]` partial rows and 0
unchecked rows**. The seven are listed here and again in the plan's **§B** table;
every one is waiting on a single input from the owner — a visual or device pass,
a provider decision, or a calibration fixture. Nothing here needs new code before
you answer, and the ideas already decided against are in the plan's **§C**.

Answer in place (edit this file) or in chat. Each section names the plan row it
belongs to, the one decision, the options with a recommended default, and what
closes once you choose. Option **A** is always the do-nothing-cost default, so
"all A" is a valid answer that closes the plan without new dependencies.

Closed in this pass: three OCR rows that were waiting on a licence review the
plan had already answered (§11 E3). See [Closed in this pass](#closed-in-this-pass).

---

## 1. Math/chemistry rendering audit — `plan.md` row under **§5.16.1**

**Decision:** who runs the visual pass in a real Obsidian window, and what counts as a pass.

The renderer audit, golden tests, chemistry fallback and STEM blocks all shipped
in 1.80.0 and 1.33.0-era work. What has never happened is looking at them in a
running Obsidian window.

- **A (recommended). You run the checklist once.** ~15 minutes: open
  `docs/math-rendering-audit.md`, paste its samples into a scratch note, compare
  against the goldens it names, report pass/fail per item. Closes the row with a
  recorded result.
- **B. A named tester runs it** and the result is pasted here. Same evidence, one
  more person; needs the name recorded for accountability.
- **C. Record "no visual claim" permanently** and close the row as declined. The
  plugin keeps shipping; the README stops implying a visual pass.

**Unblocks:** the row and §11 E1. No code follows in any option.

## 2. Mobile audit on real devices — `plan.md` row under **§5.19**

**Decision:** which hardware the mobile claim rests on.

`docs/mobile-layout.md` describes what to check; no iPhone or Android device has
ever run the plugin in this environment.

- **A (recommended). One iOS and one Android device**, following that doc's list
  (touch targets, day rail, keyboard dismissal, safe areas). Closes §11 E2.
- **B. One platform only** — close the tested platform, keep the row open with
  "Android unverified" written down, so nothing overclaims.
- **C. Decline a mobile claim** and close the row as unsupported.

**Unblocks:** the row and the E2 gate; mobile practice already ships.

## 3. README screenshots — `plan.md` row under **§10b**

**Decision:** do the screenshots happen, or does the README drop that promise?

README, docs and `samples/sample-vault` are done. Four screenshots are the only
piece of the growth refresh outstanding, and they need a real window.

- **A (recommended). You capture four** — practice session, review dock, study
  dashboard, PDF reader — at any window size; I supply filenames, folder and
  captions, and wire them into the README in a follow-up release.
- **B. Drop screenshots from scope** and close the row; the README stays text-first.
- **C. Leave it open** as the one known cosmetic gap.

**Unblocks:** the row and the §10b growth refresh.

## 4. Optional TTS / audio-only commute — `plan.md` row under **§5.22.4**

**Decision:** provider speech, or device speech only (the current §11 decision 2 / E5).

Device voices already work; what is missing is a provider voice, commute playback
and mobile audio validation.

- **A (recommended). Keep device speech only** and close the row as decided. No
  key, no cost, no new privacy surface.
- **B. Approve a provider TTS** (name + key + expected cost). I would add one
  adapter behind the existing BYOK service and the offline queue, plus an
  audio-only commute mode; mobile audio still needs your device test first.
- **C. A bundled offline engine** — rejected by §11 decision 2 on size, licence
  and mobile packaging grounds; reviving it reopens that decision.

**Unblocks:** the audio commute mode and §11 E5, if you pick B.

## 5. Pronunciation feedback — `plan.md` row under **§5.22.4**

**Decision:** does scored pronunciation ship at all?

Needs audio capture plus a speech-scoring service, then real-device validation.

- **A (recommended). Decline it** and close the row; language practice keeps
  typed answers and device dictation.
- **B. Cloud speech scoring** (provider + key + cost + retention policy). Real
  work: capture, scoring, per-phoneme feedback, and a mobile test before any claim.
- **C. Local heuristic scoring** on a recording, with no accuracy claim, labelled
  "self-check". Cheapest honest version; still needs microphone testing.

**Unblocks:** §11 E5 and the language-learner slice, if you pick B or C.

## 6. AP FRQ accuracy claim — `plan.md` row under **§5.20**

**Decision:** do we ever claim grader accuracy, and against what fixtures?

The rubric grader, partial credit, second pass, score history and study-plan feed
all shipped in 1.97.0–1.101.0 for six courses. `docs/ap-frq-grader-spec.md` is the
evaluation plan; no human-scored fixture set exists.

- **A (recommended). Keep the explicit no-accuracy-claim** and close the row as
  scope-complete. The grader stays labelled as an aid.
- **B. You supply human-scored FRQs** (a realistic minimum is 30 per course across
  the six approved courses, with official rubrics and a human total score). I then
  build the fixture loader, run calibration and record agreement per criterion.
- **C. Calibrate two courses only** and claim accuracy for those, naming them.

**Unblocks:** the accuracy claim and §11 E6.

## 7. Pilot go/no-go thresholds — the Phase 2b row in **§7**

**Decision:** the numeric bar the pilot is judged against (same gate as 6, different question).

- **A (recommended). No thresholds; keep the pilot label** and close the row. The
  pilot stays "approved and shipped", never "validated".
- **B. Adopt defaults I recommend:** mean absolute total-score error ≤ 1.0 point on
  the 0–6 FRQ scale, ≥ 80% of criterion scores within ±1, and no course below the
  bar; measured on the fixtures from question 6. Then a pass/fail is recordable.
- **C. You set different numbers** — paste them and they replace B.

**Unblocks:** the pilot verdict and §11 E6; requires 6 = B or C.

---

## Adjacent owner questions (plan already carries them)

Not `[~]` rows, but they gate future work and can be answered in the same sitting.
Each is a §11 decision item with its recommended default already written there.

| ID | Question | Recommended | What it unlocks |
|---|---|---|---|
| O1 | Keep the name "MCQ Tracker" or rename the display (ID unchanged)? | A: keep name and ID, let the description carry breadth | Store listing, docs, brand |
| O2 | Original AP/SAT sample packs, or link-only guidance? | A: no bundled content, link-only guidance | Onboarding packs |
| O4 | Read-only tutor on phones, full agent desktop-only? | A: tutor-only mobile | Any mobile AI work |
| O5 | FRQs on phones: dictated text only, or skipped? | A: voice-dictated text only | Mobile FRQ surface |
| O9 | Compatibility promise for note formats? | A: indefinite, with migrations | Removal of any breaking change |
| O10 | Maintain a BRAT beta channel? | A: yes, beta before stable | Rollout of risky features |
| O11 | What signal justifies a standalone mobile app? | A: wait for a measured demand/retention signal | §10c track |
| O12 | Who signs off `NOTICES.md` and copied-file review? | A: the owner signs each entry | Any third-party code reuse |
| D5 | Hold Course / uni-calendar interop needs one sample note per plugin | A: stay on ICS | Read-only property mapping |
| E11 | Community-directory relisting needs the dashboard review errors | A: leave the listing absent until then | Relisting |

## Closed in this pass

Three rows stopped saying "the bundled OCR engine remains (licence review)",
because §11 **E3** resolved that question on Nov 1, 2026: keep the opt-in BYOK
vision path, state that no bundled engine exists, and leave offline image-only
scans unsupported. The same §3.9.6 blocked row also carried PDF form filling,
which **E4** reversed on Nov 4, 2026 and 1.218.0 shipped.

| Plan row | Why it closes |
|---|---|
| AI summary and key terms for course notes (**§5.13**) | Shipped in 1.44.0; the only stated gap was the bundled engine, declined by E3 |
| Paper scanner: photos to one PDF (**§5.13.1**) | Shipped in 1.46.0; same gap, same decision |
| OCR for image-only scans (**§5.13.1**) | BYOK vision path, editable per-page text and the OCR note shipped; E3 makes "no bundled engine" the answer, not a gap |

No code changed for these: the decision was already recorded, only the plan's
wording still treated it as pending.
