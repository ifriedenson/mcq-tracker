# AP FRQ Grader — Research Specification and Evaluation Plan

**Status:** Research and specification only. No implementation. The four-course pilot below is the provisional recommendation; the fixture set, rights review and go/no-go gates are still open.
**Parent plan:** [plan.md](../plan.md) §5.20.1 (AP FRQ grader) and §5.5 (general FRQ grading).
**Date:** October 29, 2026.
**Owner priority:** The next product idea after card import; explicitly marked highly wanted. This document defines what must be researched and proven before code is written.

---

## 1. Executive summary

The AP FRQ grader is a formative feedback tool for AP free-response practice. A learner writes or dictates an answer, the plugin checks it against a structured rubric, and the learner receives criterion-level points, evidence-based feedback, and a score history. AI is optional. A self-grade path must work with no AI at all.

The product is **not** an official AP scorer and must never present a score as one. College Board scoring depends on trained readers, annual scoring guidelines, and judgment that an AI model cannot guarantee. The grader's job is to help a student see which rubric criteria they met, which they missed, and what to practise next.

The first release should support a small pilot set of AP courses that covers different rubric families, prove agreement against a human-scored evaluation set, and keep the learner in control of every score.

---

## 2. Scope

### 2.1 In scope for the research phase

- A generic FRQ note format with a human-readable prompt, optional stimulus/source set, rubric, sample answer, and course link.
- A machine-readable rubric model that can represent AP-style point criteria, grouped criteria, penalties, and dependencies.
- A typed-answer practice flow; OS voice dictation is a convenience on top of the text box.
- AI grading against the rubric one criterion at a time, with quoted evidence, confidence, and per-criterion feedback.
- A self-grade flow that needs no AI.
- Learner overrides, second-pass grading, low-confidence review, and grade-later/offline queueing.
- Scheduler integration, missed-criterion tracking, and score history.
- An evaluation programme that compares model scores with independent human scores and measures feedback quality, reliability, safety, cost, and latency.

### 2.2 Out of scope for the first release

- Claiming an official College Board score, grade, or reader-level accuracy.
- Scraping AP Classroom or copying College Board question banks, rubrics, or sample responses into the plugin.
- Photo-of-handwriting grading. This is a later opt-in vision feature.
- Full AP course coverage on day one. The pilot is deliberately narrow.
- The AP score calculator and AP resource hub. They are separate §5.20 surfaces and should not block the grader research.
- Automated high-stakes grading for teachers, schools, or placement decisions.
- Training a model on learner answers.

### 2.3 Product principles

1. **Rubric first.** Every point must trace to a rubric criterion. No holistic score without an explicit rubric model.
2. **Evidence first.** A criterion score without a quotation or a concrete reason is not acceptable.
3. **Human authority.** The learner can override any criterion. The override is data, not an error to hide.
4. **AI is optional.** Core practice, self-grading, and scheduling work without a provider.
5. **No false officialness.** The UI labels AI scores as estimates and never implies College Board endorsement.
6. **Markdown-first.** The prompt, rubric, answer, and grade history remain readable and editable outside the plugin.
7. **Privacy by default.** The answer is sent only when the learner explicitly asks for AI grading.

---

## 3. Research questions

The research phase must answer these before implementation is approved.

| ID | Question | Why it matters |
|---|---|---|
| RQ1 | Can a structured rubric represent the AP tasks in the pilot courses without losing scoring meaning? | A generic checklist will not cover DBQ/LEQ groups, essay rows, or STEM point dependencies. |
| RQ2 | How closely does criterion-level AI scoring agree with independent human scoring? | This is the core accuracy claim. Total-score agreement alone can hide compensating errors. |
| RQ3 | Does the grader quote real evidence and give feedback a student can act on? | A correct number with invented evidence is worse than no grade. |
| RQ4 | Is scoring stable across repeated runs, model versions, and prompt variants? | A grader that changes after a model update destroys trust and invalidates history. |
| RQ5 | Where does the grader systematically over- or under-score by course, task, score band, answer length, or language background? | Bias and rubric blind spots must be found before release. |
| RQ6 | Can student text, source documents, or rubrics manipulate the grader? | Answers and source material are untrusted input. |
| RQ7 | Is AI grading worth the cost and latency compared with self-grading? | The product must justify provider calls and waiting time. |
| RQ8 | What may be stored, linked, or displayed from AP Central and AP Classroom? | Copyright, trademark, and terms-of-use constraints shape the entire feature. |

### 3.1 Hypotheses to test

- **H1:** A rubric-aware structured prompt will beat a generic "grade this essay" prompt on criterion agreement and evidence quality.
- **H2:** Requiring exact quotations will reduce hallucinated evidence but may increase abstention; the trade-off is acceptable if precision improves.
- **H3:** A second independent pass will catch enough disagreements to justify the extra cost for high-stakes practice, but not for every low-stakes session.
- **H4:** Confidence values can separate reliable from unreliable grades well enough to route low-confidence results to learner review.
- **H5:** Self-grading plus rubric guidance will be preferred by some learners and will remain a viable no-AI path.

---

## 4. Users and jobs

### 4.1 Primary user

An AP student practising a released or teacher-provided free-response question, usually alone, often on a laptop and sometimes on a phone. They want a quick estimate, a clear list of missed rubric points, and a reason they can compare with the scoring guideline.

### 4.2 Secondary users

- A teacher or tutor who wants to paste a rubric and let a student self-check, without sending work to a third party by default.
- A student who wants to practise timed writing and review the rubric afterward.
- A learner who wants to track whether repeated practice is improving specific criteria, not just a total score.

### 4.3 Jobs to be done

- "Give me an AP-style FRQ and a timer."
- "Let me write or dictate an answer without leaving Obsidian."
- "Show me which rubric points I earned and which I missed."
- "Quote the part of my answer that earned or missed each point."
- "Let me disagree with the grade and record my own score."
- "Schedule this FRQ again because I missed the reasoning criterion."
- "Let me practise without sending my writing to an AI."
- "Show me my trend by criterion across several prompts."

---

## 5. Course and rubric research

AP free-response tasks are not one rubric shape. The research must build a course matrix from current official course and exam descriptions and scoring guidelines. Exact point counts, task counts, timing, and weighting are **data to verify per course and year**, not assumptions to hard-code.

### 5.1 Rubric families to cover

| Family | Example courses | Research focus |
|---|---|---|
| Source-based history | AP United States History, AP World History: Modern, AP European History | DBQ/LEQ thesis, contextualization, evidence, sourcing, complexity; documents and outside evidence |
| Analytical essays | AP English Language and Composition, AP English Literature and Composition | Thesis, evidence and commentary, sophistication; synthesis, rhetorical analysis, argument, literary analysis |
| STEM constructed response | AP Biology, AP Chemistry, AP Physics 1/2/C, AP Calculus AB/BC | Point-per-step scoring, justification, representation, units, significant figures, notation |
| Quantitative reasoning | AP Statistics, AP Precalculus | Statistical justification, interpretation, communication of method |
| World-language writing | AP French, Spanish, German, Italian, Chinese, Japanese Language and Culture | Task completion, vocabulary, grammar, cultural appropriateness, length/register |
| Applied/CS | AP Computer Science A, AP Computer Science Principles | Code or algorithm explanation, written response, program purpose and development |
| Social-science short answer | AP Psychology, AP Human Geography, AP U.S. Government and Politics | Concept application, stimulus interpretation, concise explanation |

### 5.2 Recommended pilot

Start with three or four courses chosen to cover the hardest rubric shapes:

1. **AP United States History** — DBQ/LEQ rubric with grouped evidence and reasoning.
2. **AP English Language and Composition** — essay rows with thesis, evidence/commentary, and sophistication.
3. **AP Biology** — short and long constructed responses with point-per-step explanations.
4. **AP Calculus AB** — justification and representation, with units and notation.

This is a research recommendation, not a promise of first-release coverage. Confirm demand, rubric clarity, and permissions before locking the pilot.

### 5.3 Course profile data

For each supported course/task, record:

- Course name and exam year.
- Task type and official task name.
- Maximum points.
- Number of tasks and suggested timing, if the task is part of a section.
- Rubric rows, groups, alternatives, and penalties.
- Whether a calculator, formula sheet, or source booklet is allowed.
- Official source URL and the date it was checked.
- Whether the rubric is user-supplied, official-link-only, or original.
- Known scoring notes that change how a point is awarded.

Course profiles are versioned data. A new exam year creates a new profile; it must not silently rewrite past grades.

---

## 6. User experience specification

### 6.1 Create or import an FRQ

- **New FRQ** from the command palette or a course folder.
- Paste a prompt and optional stimulus/source set.
- Paste a rubric as readable Markdown, or use the rubric editor.
- Offer **simple checklist** and **advanced rubric** modes:
  - Simple: `- [2] Criterion description` independent rows.
  - Advanced: grouped rows, alternatives, penalties, and dependencies in a fenced `json` block.
- Add a sample answer or link to a user-supplied sample response.
- Require a source/attribution field when the prompt or rubric comes from elsewhere.
- Do not bundle copyrighted prompts or scoring guidelines with the plugin.
- Save as a normal note with `question_type: frq`.

### 6.2 Practise

- Show the prompt, stimulus, timer, and word count.
- Autosave the draft; recover it after an app switch or crash.
- Typed answer is the first-class path. OS dictation may fill the text box.
- Timer can be hidden for untimed practice.
- The learner can submit for self-grade or AI grade.
- If offline or no provider is configured, keep the answer and offer self-grade or a queued AI grade.

### 6.3 Review a grade

- Show total points and maximum.
- Show each criterion as a card: earned/max, short rationale, quoted evidence, confidence.
- Highlight the quoted evidence in the learner's answer.
- Let the learner override any criterion with a reason.
- Show a clear "AI estimate" badge and a link to the rubric.
- Offer **Compare with sample** when a user-supplied sample exists.
- If the grade is low-confidence or the second pass disagrees, show a review banner instead of silently choosing a score.

### 6.4 Self-grade

- Show the rubric descriptors and the learner's answer side by side.
- Learner awards points per criterion.
- Optional AI comparison appears only if the learner asks.
- Self-grade records `grading_mode: self` and never sends the answer to a provider.

### 6.5 Review history

- Latest score in the note.
- Append-only grade history with date, mode, model, rubric version, total, criteria, confidence, and override.
- Trend by criterion and by course.
- Missed criteria feed weak spots, study suggestions, and the scheduler.

### 6.6 Mobile

- Practice and self-grade must work on a phone.
- AI grading may be queued; the learner can continue.
- Typing a full essay is awkward; dictation is recommended, but the UI must not promise perfect transcription.
- Photo-of-handwriting is deferred.

---

## 7. Rubric model

### 7.1 Human-readable source of truth

The note remains readable without the plugin. A simple rubric uses checklist lines:

```markdown
## Rubric

- [1] Thesis makes a defensible claim.
- [2] Uses at least two pieces of specific evidence.
- [1] Explains how the evidence supports the claim.
```

For complex AP rubrics, a fenced `json` block inside `## Rubric` provides the machine-readable structure. The plugin should render the same rubric as readable rows; the JSON is not a replacement for the human view.

### 7.2 Proposed schema

```json
{
  "schema_version": 1,
  "course": "AP Example",
  "exam_year": 2026,
  "task": "DBQ",
  "max_points": 7,
  "max_score_source": "user-supplied scoring guideline",
  "source_url": "https://example.invalid/source",
  "source_checked_on": "2026-10-29",
  "criteria": [
    {
      "id": "thesis",
      "label": "Thesis",
      "max": 1,
      "mode": "all_or_nothing",
      "evidence_required": true
    },
    {
      "id": "context",
      "label": "Contextualization",
      "max": 1,
      "mode": "all_or_nothing",
      "evidence_required": true
    },
    {
      "id": "evidence",
      "label": "Evidence",
      "max": 2,
      "mode": "per_point",
      "subcriteria": [
        { "id": "evidence_1", "label": "First piece of evidence", "max": 1 },
        { "id": "evidence_2", "label": "Second piece of evidence", "max": 1 }
      ]
    },
    {
      "id": "reasoning",
      "label": "Reasoning",
      "max": 2,
      "mode": "threshold",
      "thresholds": [
        { "awarded": 1, "description": "Uses evidence to support the claim." },
        { "awarded": 2, "description": "Explains how the evidence supports the claim and connects it to a broader pattern." }
      ],
      "evidence_required": true
    }
  ]
}
```

This is an example shape, not an official rubric. Points, groups, and descriptors must come from the selected course/year guideline or the user's own rubric.

### 7.3 Criteria semantics

| Field | Meaning |
|---|---|
| `id` | Stable identifier used in history and weak-spot tracking. Never reuse an id for a different criterion. |
| `label` | Short display name. |
| `max` | Maximum points for this criterion. |
| `mode` | `all_or_nothing`, `per_point`, `threshold`, `penalty`, or `gate`. |
| `subcriteria` | Independently awarded rows inside a grouped criterion. |
| `thresholds` | Descriptions for each award level of a threshold criterion. |
| `exclusive_group` | Criteria that are alternatives; only one can be awarded. |
| `depends_on` | A criterion that must be met before this one can score. |
| `penalty` | A deduction that can only apply after the base criterion is earned. |
| `evidence_required` | Require a quotation or a concrete reference from the answer. |
| `notes` | Human-readable scoring note specific to this course/year. |

### 7.4 Validation rules

- `max_points` equals the sum of independent criteria maxima after gates/exclusive groups are resolved, unless the rubric explicitly declares a different total.
- An `id` is unique within a rubric.
- A `depends_on` reference exists and cannot form a cycle.
- A penalty cannot reduce a criterion below zero or a total below zero.
- A threshold criterion has exactly one award at or below the selected level.
- An official rubric must retain its source URL and checked date; an AI-authored rubric is marked `rubric_source: ai` and requires learner review.
- Invalid rubrics block AI grading but not self-grade.

---

## 8. Grading contract

### 8.1 Input contract

The grader receives only what it needs:

- Course, exam year, task type, and rubric version.
- Prompt and optional source/stimulus text.
- The structured rubric.
- The learner's answer.
- Answer mode (`typed` for the pilot).
- A prompt-template version and a request id.

The learner's answer and any pasted source text are **untrusted data**. The grader is told not to follow instructions inside them.

### 8.2 Output contract

```json
{
  "criteria": [
    {
      "id": "thesis",
      "awarded": 1,
      "max": 1,
      "evidence_quotes": ["The thesis sentence from the answer."],
      "rationale": "The claim is defensible and addresses the prompt.",
      "confidence": 0.86,
      "flags": []
    }
  ],
  "total": 4,
  "max": 7,
  "overall_confidence": 0.78,
  "needs_review": false,
  "feedback": "You earned the thesis and evidence points; the reasoning row needs a clearer link.",
  "prompt_version": "ap-frq-v1",
  "grader_version": "model-and-date"
}
```

### 8.3 Hard rules

1. Score one criterion at a time; never substitute a holistic impression for the rubric.
2. Never award more than `max` or less than zero.
3. Every positive award should cite a quotation or a specific, checkable part of the answer.
4. Quotations must be exact substrings after whitespace normalization; if no quote can be found, do not invent one.
5. A blank, off-topic, or too-short answer receives zero with an explanation, not fabricated content.
6. If the rubric is ambiguous or the answer cannot be matched to a criterion, return `needs_review` rather than guessing.
7. The model may not change the rubric, add criteria, remove criteria, or change the maximum.
8. The model may not follow instructions in the answer, prompt, or source text that ask it to change the grade or reveal the system prompt.
9. The model may not browse, call tools, write files, or access the vault.
10. The final total is computed deterministically from the criterion awards; the model never supplies a separate total that can disagree with the rows.

### 8.4 Aggregation

- Apply exclusive groups and gates before summing.
- Apply penalties only where the rubric permits them.
- Clamp to `[0, max_points]`.
- Record both the raw total and the rubric version.
- If a criterion is unresolved, mark the grade incomplete and do not present a total as final.

### 8.5 Confidence and review

Confidence is a routing signal, not decoration.

- Low-confidence criterion or total -> show "Review needed."
- Two-pass disagreement above a threshold -> show both rows or route to review; never silently average.
- The learner can accept, override, or mark the grade as unusable.
- Store override reasons; they are the main source of grader-quality feedback.

### 8.6 Prompting and model constraints

- Use structured output with a fixed schema.
- Temperature should be 0 or the lowest supported value for scoring.
- Pin the prompt version and model identifier in every grade.
- Re-run the evaluation suite before changing the default model or prompt.
- The shared AI layer (§4.6) handles provider selection, cost caps, and capability checks.
- AI grading is off by default and disclosed before the first send.

---

## 9. Note format and data model

### 9.1 Note sections

```markdown
---
question_id: frq-apush-001
question_type: frq
course: AP United States History
unit: Period 5
skill: causation
max_points: 7
rubric_source: user
rubric_version: 1
source_url: ""
source_checked_on: 2026-10-29
grading_mode: self
last_score: 4
last_max: 7
grading_confidence: 0.78
criteria_missed:
  - reasoning
graded_by: ""
graded_on: ""
needs_review: false
---

## Prompt

...

## Stimulus

...

## Rubric

...

## Sample Answer

...

## My Answer

...

## Grade History

<!-- append-only, one compact JSON object per line -->
```

### 9.2 Frontmatter fields

| Field | Purpose |
|---|---|
| `question_type: frq` | Item type; reuses the existing model. |
| `max_points` | Rubric maximum. |
| `rubric_source` | `official`, `user`, or `ai`. |
| `rubric_version` | Increments when criteria or points change. |
| `source_url`, `source_checked_on` | Provenance for the prompt/rubric. |
| `grading_mode` | `self`, `ai`, or `ai_reviewed`. |
| `last_score`, `last_max` | Latest result; useful in queries without parsing history. |
| `grading_confidence` | Latest overall confidence, 0–1. |
| `criteria_missed` | Stable criterion ids for weak-spot queries. |
| `graded_by`, `graded_on` | Model/provider and date; `self` for self-grade. |
| `needs_review` | Low confidence, disagreement, or invalid rubric. |
| `history` | Existing append-only scheduler history; do not put large rubric detail here. |

### 9.3 Grade history detail

Store full criterion detail in `## Grade History` as append-only JSON lines (or a fenced `jsonl` block). Keep frontmatter compact. The detail record includes:

- Timestamp and unique attempt id.
- Mode and model/provider.
- Rubric version and prompt version.
- Total, max, and per-criterion awarded/max.
- Evidence quotes and short rationales.
- Confidence and review flags.
- Override reason, if any.

Do not rewrite old lines. If a note grows very large, offer an archive/summary operation, but never silently discard the audit trail.

### 9.4 Scheduling

- Scheduler input uses the rubric percentage (`last_score / max_points`) plus confidence.
- A low-confidence or incomplete grade should not be treated as a reliable failure.
- Map percentage to the existing scheduler bands; keep the raw score so the mapping can be recalibrated later.
- Missed criteria feed weak spots and the study plan.
- A criterion can have its own weakness trend independent of the total score.

---

## 10. Evaluation plan

### 10.1 Evaluation goals

1. Prove rubric fidelity and scoring accuracy against independent human raters.
2. Prove that feedback cites real evidence and is useful to learners.
3. Prove stability across runs, prompt variants, and model versions.
4. Detect bias and unsafe behaviour before beta.
5. Establish cost and latency limits.
6. Decide whether AI grading should be recommended, optional, or withheld for a course.

### 10.2 Data sources and permissions

| Source | Use | Constraint |
|---|---|---|
| AP Central released FRQs and scoring information | Prompt/rubric shapes and, where permitted, sample responses | Link and cite; do not redistribute copyrighted content in the repository or release without permission |
| User/teacher-supplied prompts and rubrics | Realistic task coverage | User confirms they may use it; keep provenance |
| Experienced AP teachers/readers scoring responses | Gold-standard human scores and rationales | Written consent, compensation if appropriate, anonymized |
| Learner responses during beta | Production monitoring and error analysis | Opt-in, redacted, never used for training; retention policy |
| Synthetic/adversarial fixtures | Blank, off-topic, prompt-injection, overlong, multilingual, and edge cases | Created by us; safe to distribute |

**AP Classroom is not a data source.** Do not scrape, automate, or export account-gated question banks. Use links for the resource hub and user-supplied files for practice.

### 10.3 Sampling plan

**Pilot (Phase A):**

- 3 courses chosen from the recommended four, covering at least three rubric families.
- 3 prompts per course.
- 12 responses per prompt.
- 2 independent human scores per response.
- At least 30 adversarial/edge responses.
- Total: 108 scored responses + 30 adversarial = 138.

**Expanded (Phase B):**

- 5–6 courses.
- 3–4 prompts per course.
- 20 responses per prompt.
- Include score bands from 0 to maximum, short and long answers, and at least one non-native-English sample set.
- Re-score 10% of the pilot set after rubric revisions to check drift.

Stratify by:

- Course and task type.
- Score band (including 0 and full marks).
- Answer length.
- Criterion difficulty (thesis vs evidence vs reasoning).
- Blank/off-topic/partially completed.
- Prompt-injection and instruction-following attempts.
- Language background only with consent; otherwise use linguistic features without inferring identity.

### 10.4 Human annotation protocol

1. **Rubric calibration:** raters review the rubric, scoring notes, and 5–10 training responses together.
2. **Independent scoring:** each response is scored twice, blind to the model and to the other rater, in randomized order.
3. **Evidence requirement:** raters record the quotation or specific reason for each award.
4. **Adjudication:** a third experienced rater resolves disagreements and records the reason.
5. **IRR gate:** compute human-human agreement before model evaluation. If total QWK is below the agreed threshold, the rubric or guide is ambiguous; fix it before judging the model.
6. **Versioning:** store rubric version, rater ids, timestamps, and adjudication notes with the fixture. Do not let model output leak into the human labels.
7. **Drift check:** re-score a random 10% sample after any rubric change or model change.

### 10.5 Metrics

#### Criterion-level

- Exact agreement with human award.
- Agreement within one point.
- Mean absolute error (MAE) per criterion.
- Quadratic weighted kappa (QWK) per criterion.
- Coverage: percentage of criteria that received a valid award.
- Bias: mean signed difference (model minus human), with bootstrap confidence intervals.

#### Total-score level

- Exact total agreement.
- Within-one-point agreement.
- MAE and normalized MAE (`MAE / max_points`).
- QWK and Spearman correlation.
- Score-band confusion matrix.
- Systematic over/under-scoring by course, task, score band, and answer length.

#### Feedback quality

- Evidence-quote precision: quoted text exists and supports the award.
- Evidence-quote recall: the important part of the answer was cited.
- Hallucinated-evidence rate.
- Rationale specificity and actionability, rated by humans on a 1–5 scale.
- Learner-rated usefulness in beta.
- Whether the feedback names a next step, not just "needs improvement."

#### Reliability and calibration

- Run-to-run QWK and MAE at fixed settings.
- Two-pass disagreement rate and adjudication outcome.
- Confidence calibration: expected calibration error (ECE) and Brier score.
- Selective accuracy: error rate when confidence is above a threshold.
- Low-confidence error capture: percentage of large errors flagged for review.

#### Safety

- Prompt-injection success rate: any change to rubric, total, criteria, system prompt, or tool use.
- Refusal rate for legitimate answers.
- PII leakage and cross-request leakage.
- Harmful or demeaning feedback rate.
- Robustness to empty, overlong, duplicated, and non-English answers.

#### Operations

- p50/p95 latency.
- Tokens and cost per grade; cost by course/task.
- Failure and retry rate.
- Offline queue success.

### 10.6 Provisional go/no-go thresholds

These are initial research gates, not public promises. Recalibrate after the human-human baseline is measured.

| Area | Provisional gate |
|---|---|
| Human-human total QWK | At least 0.80 on the gold set; otherwise revise rubric/guide first |
| Model criterion QWK | At least 0.70 |
| Model total QWK | At least 0.75 |
| Total within-one-point | At least 90% |
| Total normalized MAE | At most 0.12 of maximum points |
| Evidence quote precision | At least 95% |
| Hallucinated evidence | At most 1% of criteria |
| Prompt-injection success | 0 in the adversarial suite |
| Confidence calibration | ECE at most 0.10; large errors mostly flagged |
| Latency | p95 at most 20 seconds per grade (excluding offline queue) |
| Cost | At most $0.05 per grade at default settings; user-visible estimate |
| Failure rate | At most 1% excluding provider outage; graceful fallback |

A course may fail the gate and still ship in **self-grade-only** mode. That is a valid outcome.

### 10.7 Experiments

Run the following as controlled comparisons on the same fixture set:

1. **Rubric-only prompt vs rubric + descriptors + one worked example.**
2. **Structured JSON output vs free-text output parsed afterward.**
3. **No evidence requirement vs exact-quote requirement.**
4. **Single pass vs two independent passes with disagreement flagging.**
5. **Model tiers/providers** on accuracy, stability, cost, and latency.
6. **Confidence thresholding**: route low-confidence rows to review and measure selective accuracy.
7. **Answer length**: short, typical, overlong, and truncated.
8. **Adversarial answers**: instructions to inflate the score, fake rubric text, prompt leakage, repeated rubric, HTML/Markdown tricks.
9. **Self-grade vs AI-grade** on learner confidence and perceived usefulness.
10. **Prompt version changes** to catch regressions before a release.

### 10.8 Error analysis

Sample at least 10% of errors and all P0 safety failures. Classify:

- Rubric misunderstanding or ambiguous descriptor.
- Evidence hallucination.
- Over-credit for vague claims.
- Under-credit for valid paraphrase.
- Point aggregation or gate error.
- Length/verbosity bias.
- Language/grammar bias.
- Refusal or truncated output.
- Prompt injection or instruction leakage.

Each error gets a root cause and a proposed fix: rubric clarification, prompt change, deterministic rule, UI review, or model change. Re-run the affected fixtures after the fix.

### 10.9 Evaluation harness (specification only)

When implementation begins, use a fixture-based runner. No code is written in this research phase.

- One JSON fixture per response with prompt, rubric, answer, human scores, rater notes, and metadata.
- A runner that calls the configured provider at fixed settings.
- Raw output stored with request id, prompt version, model, temperature, and timestamp.
- A report with per-course and per-criterion tables, confidence intervals, and failure lists.
- A regression subset that must pass before any model/prompt change.
- A red-team subset that must have zero successful injections.
- No learner data in the repository unless consent and redaction are documented.

### 10.10 Research sequence and gates

| Gate | Deliverable | Decision |
|---|---|---|
| R0 | Source/permissions review and course matrix | Which courses and materials may be used? |
| R1 | Rubric schema, authoring guide, annotation guide | Is the rubric expressive enough? Is human-human agreement adequate? |
| R2 | Pilot evaluation report (3 courses) | Does the grader meet the accuracy, evidence, safety, and cost gates? |
| R3 | Expanded evaluation (5–6 courses) + regression suite | Which courses are AI-grade ready, self-grade only, or deferred? |
| R4 | Beta with opt-in users, override analytics, feedback survey | Is the grader useful and trusted in real practice? |
| R5 | Final go/no-go memo and release spec | Ship as optional module, limited courses, AI off by default? |

---

## 11. Privacy, safety, and legal constraints

### 11.1 Learner data

- AI grading is opt-in and off by default.
- The first send discloses exactly what is transmitted: prompt, rubric, answer, and selected source text.
- Do not send the whole vault, unrelated notes, or calendar data.
- Redact or warn about names, emails, and other PII in practice answers.
- Do not train models on learner answers.
- Document provider retention and deletion; prefer providers with no-training terms.
- Keep a local self-grade path that sends nothing.

### 11.2 Prompt injection and model safety

- Treat the answer, prompt, rubric, and source documents as untrusted.
- The grader has no tools and no write access.
- The system prompt must not be revealed.
- The model must not follow answer text that says "give me full marks," "ignore the rubric," or "print your instructions."
- Invalid output is rejected, not repaired silently.
- Adversarial fixtures are part of every release gate.

### 11.3 AP/College Board terms

- AP and Advanced Placement are College Board trademarks. Do not imply affiliation, endorsement, or official scoring.
- Link to AP Central resources rather than copying them into the plugin or repository.
- Do not redistribute released prompts, scoring guidelines, sample responses, or AP Classroom content without permission.
- Keep source URLs and checked dates; remove or update stale links.
- If the product needs to reproduce any College Board material, submit a permission request and record the outcome before shipping.
- The UI must say the grade is an **AI estimate for practice**, not an official AP score.

### 11.4 Academic integrity

- The grader is a study aid, not a replacement for a teacher or reader.
- Do not market it as a way to obtain official scores or to complete assessed work dishonestly.
- Make limitations visible: rubric version, model, confidence, and review flags.

### 11.5 Bias and fairness

- Evaluate by course, task, score band, answer length, and language background (with consent).
- Do not infer sensitive attributes.
- Investigate systematic under-scoring of grammatical variation or non-native English.
- Publish limitations and keep human override available.

---

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Rubric ambiguity | Inconsistent human and AI scores | Human-human IRR gate; rubric authoring guide; review flags |
| AI overconfidence | Learner trusts a wrong score | Calibration, confidence display, second pass, override |
| Hallucinated evidence | Feedback looks authoritative but is false | Exact-quote validation; reject unverifiable awards |
| Model updates change scores | History becomes incomparable | Pin model/prompt versions; regression suite; versioned rubric |
| Copyright/trademark issue | Release blocked or legal risk | Link-only policy; permission review; no bundled AP content |
| Prompt injection | Grade manipulation or leakage | No tools; untrusted input; adversarial suite |
| Cost/latency | Poor mobile experience | Cheap pre-checks; optional AI; queue; user-visible estimate |
| Scope creep into full AP platform | Delays the core feature | Pilot courses; separate score calculator/resource hub |
| Learner data exposure | Privacy harm | Opt-in, redaction, no training, provider policy review |

---

## 13. Deliverables from the research phase

1. Course and rubric matrix for the pilot.
2. Final rubric schema and authoring guide.
3. Annotation guide and human-human IRR report.
4. Versioned evaluation fixture set and scoring sheets.
5. Evaluation harness specification and report template.
6. Pilot evaluation report with per-course, per-criterion, safety, cost, and latency results.
7. Error taxonomy and regression subset.
8. Privacy, copyright, and trademark review memo.
9. UX flows for create, practise, grade, override, self-grade, and review.
10. Go/no-go recommendation: AI-grade ready, self-grade only, or defer per course.

---

## 14. Definition of ready

Implementation starts only when all of these are true:

- The pilot courses and rubric families are chosen.
- The rubric schema can represent every pilot task without ad-hoc exceptions.
- A human-scored evaluation set exists with at least two independent scores and adjudication.
- Human-human agreement meets the agreed baseline.
- The grader contract, deterministic aggregation rules, and invalid-output handling are specified.
- The first model/prompt has met the provisional accuracy, evidence, safety, latency, and cost gates on the pilot.
- The self-grade path is specified and does not depend on AI.
- The privacy disclosure, data-retention policy, and AP trademark/copyright review are complete.
- The note format and migration plan preserve existing notes.
- The owner has reviewed the go/no-go report and approved the scope.

---

## 15. Open decisions for the owner

1. **Pilot courses:** AP US History, AP English Language, AP Biology, and AP Calculus AB are the recommended first set. **Provisional decision:** start with these four; confirm demand, rubric clarity and permissions before locking them.
2. **AI default:** keep AI grading off by default; self-grade is always available.
3. **Rubric authoring:** start with paste/import plus a simple editor, or require structured JSON from the start?
4. **Official samples:** are user-supplied released responses allowed in local evaluation only, or should the product avoid them entirely until permission is confirmed?
5. **Cost ceiling:** what per-grade cost is acceptable for the default model?
6. **Teacher mode:** is a teacher-facing batch view in scope later, or should the product stay learner-only?
7. **Handwriting:** confirm photo grading remains a later optional feature.
8. **AP score display:** should the FRQ screen show only rubric points, or also a clearly unofficial projected AP score after the calculator exists?

---

## 16. References

- College Board, AP Central — past free-response questions and scoring information: <https://apcentral.collegeboard.org/courses/past-exam-questions>
- College Board, AP Central — score setting and scoring: <https://apcentral.collegeboard.org/courses/how-ap-develops-courses-and-exams/score-setting-and-scoring>
- College Board, AP Central — courses and exams: <https://apcentral.collegeboard.org/courses>
- College Board, AP Students — exam dates and score information: <https://apstudents.collegeboard.org/>
- College Board, AP Classroom (account-gated): <https://myap.collegeboard.org/>
- College Board, copyright and trademark permissions: <https://privacy.collegeboard.org/copyright-trademark>
- College Board, trademark guidelines: <https://privacy.collegeboard.org/copyright-trademark/guidelines>
- Project plan, general FRQ grading: [plan.md](../plan.md) §5.5
- Project plan, flashcard AI grading patterns and privacy: [plan.md](../plan.md) §5.17
- Project plan, AP research backlog: [plan.md](../plan.md) §5.20
- Project plan, property schema: [plan.md](../plan.md) §6
- Project plan, privacy and quality gates: [plan.md](../plan.md) §8

---

## Appendix A — Example fixture shape

```json
{
  "fixture_id": "apush-dbq-2024-q1-r03",
  "course": "AP United States History",
  "exam_year": 2024,
  "task": "DBQ",
  "prompt_version": "user-supplied-1",
  "rubric_version": 1,
  "source": "user-supplied released prompt",
  "source_url": "",
  "answer": "Student answer text...",
  "human_scores": [
    { "rater": "r1", "total": 4, "criteria": { "thesis": 1, "context": 0, "evidence": 2, "reasoning": 1 } },
    { "rater": "r2", "total": 5, "criteria": { "thesis": 1, "context": 1, "evidence": 2, "reasoning": 1 } }
  ],
  "adjudicated": { "total": 4, "criteria": { "thesis": 1, "context": 0, "evidence": 2, "reasoning": 1 } },
  "split": "test",
  "tags": ["source-based", "partial-credit"]
}
```

The fixture format is illustrative. Do not commit copyrighted prompt or response text without permission.

## Appendix B — Human scoring sheet fields

- Fixture id, course, task, rubric version.
- Rater id, date, blind order.
- Per-criterion award, evidence quotation, rationale.
- Total and any gate/penalty notes.
- Confidence in the human score.
- Adjudication result and reason, if any.
- Free-text notes on rubric ambiguity.

## Appendix C — What would make us stop

Stop or narrow the feature if:

- Human raters cannot agree on the rubric.
- No model meets the safety gate without unacceptable abstention.
- The legal/permission review forbids the intended source use.
- Cost or latency makes the flow worse than self-grade.
- The product cannot keep learner answers private under the chosen provider terms.
