# AP free-response practice and grading

This guide covers the FRQ pilot shipped in 1.97.0. It is practice feedback, not a College Board score, and the plugin bundles no AP prompts, rubrics or sample responses.

## Supported courses

The pilot is limited to the six courses the owner approved on 2026-10-29:

| Course | Preset question types |
| --- | --- |
| AP World History: Modern | DBQ (7), LEQ (6), SAQ (3) |
| AP U.S. History | DBQ (7), LEQ (6), SAQ (3) |
| AP Chemistry | Long response (10), short response (4) |
| AP Calculus AB | Free response (9) |
| AP Calculus BC | Free response (9) |
| AP Statistics | Free response (10) |

The score calculator has profiles for all six plus AP Biology and AP English Language and Composition. A preset is an editable starting point written for this project; it is not an official rubric. Paste the rubric you were given and change the points and descriptions until they match.

## Create a prompt

Run **AP: create a free-response note**, or open the grader and press **New FRQ note**. Fill in the course, question type, title and prompt; optionally add a stimulus and a sample answer. The rubric box starts with the course preset and accepts any of these line forms:

```md
- [2] Evidence: uses at least four documents.
- 1 point: Context — places the argument in a broader context.
- Thesis (1 point)
```

A Markdown table with a points column also works:

```md
| Criterion | Points | Description |
| --- | ---: | --- |
| Thesis | 1 | States a defensible claim. |
| Evidence | 2 | Uses the documents and outside evidence. |
```

Rows without a point value are kept at one point and the grader shows a warning. The note is saved under `AP FRQs/<course>/` with `type: ap_frq`, `ap_course`, `max_points` and `rubric_source` (`user` or `official`).

You can also mark an existing note by hand:

```md
---
type: ap_frq
ap_course: ap-chemistry
max_points: 10
---

## Question
...

## Rubric
- [3] Chemical principles: ...
- [4] Calculation: ...
- [2] Explanation: ...
- [1] Units and significant figures: ...

## Sample Answer
...
```

## Grade an attempt

Open **AP: open free-response practice and grader**, pick the prompt, and type the answer. Then choose one route:

- **Self-grade** works offline and needs no AI. Set the points for each criterion; each input is capped at that criterion's maximum.
- **AI grade** uses the Direct AI or OpenCode backend configured under Settings, AI. It sends the prompt, rubric, optional sample answer and your typed answer under the `frqGrading` feature. The reply must cover every rubric criterion, must quote the words that earned each point and cannot exceed a maximum. A low-confidence criterion, or a point awarded without a quote, flags the attempt for review. **Second pass** runs another independent pass and lists every criterion where the two passes disagree; it never averages them. Resolve the score you trust before saving.
- **Rubric source** records whether the rubric is yours or a pasted official/teacher-supplied rubric (`rubric_source: official | user`). The plugin still bundles no AP rubric.
- **Save attempt** writes a note under `AP FRQ attempts/` and updates the prompt note with `frq_last_score`, `frq_last_max`, `frq_last_percent`, `frq_criteria_missed`, `frq_graded_by`, `frq_graded_on`, `frq_attempts`, `frq_review_interval` and `frq_next_review`. The modal lists recent attempts for the selected prompt.

The total maps to a practice band: below 50% `again`, below 70% `hard`, below 85% `good`, otherwise `easy`. The band is a study signal, not an AP score prediction. It also sets the next review: below 60% returns in one day, 60–79% in three, 80–89% in seven and 90%+ in fourteen, and any missed rubric criterion caps the wait at three days. Due prompts appear in **Today** and in the next exam's study plan with a **Practice FRQ** button. **Insights → Weak spots** lists the rubric criteria marked short across saved attempts, with the course and miss count, and each row opens the prompt where it was missed.

## Privacy and trust

Self-grading makes no network request. AI grading is off until AI features are enabled, sends only the fields listed above, and goes through the same request caps and per-feature model setting as the other AI tools. The learner answer is treated as untrusted data in the grader prompt, so instructions inside an answer cannot change the rubric. The saved attempt note contains the answer; delete it if you do not want that text in the vault. No AP Classroom content is fetched, scraped or stored.

## What is not implemented yet

- Human-scored agreement against released sample responses, the human-human baseline and the go/no-go thresholds in [ap-frq-grader-spec.md](ap-frq-grader-spec.md). There is no claim of reader-level accuracy.
- Photo-of-handwriting grading.
- A full rubric category taxonomy. Missed criteria already schedule the prompt and appear in Today, the exam study plan and Insights.
- Per-course review of rubric fidelity beyond the editable presets.
- World-language writing, AP Seminar/Research performance tasks and AP courses outside the six pilot subjects.
