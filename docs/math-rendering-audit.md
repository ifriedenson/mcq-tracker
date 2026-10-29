# Math and chemistry rendering audit

**Scope:** §5.16.1 of `plan.md`. This page records what was checked, what changed in 1.80.0, and the visual check that still needs a real Obsidian window.

## Renderer path

Every learner-facing text surface goes through `renderMarkdownInto()` in `src/view-helpers.js`, which uses Obsidian's own `MarkdownRenderer`. No surface builds a second Markdown or math pipeline.

| Surface | Code path |
| --- | --- |
| Practice question stem | `src/practice-view.js` — `renderQuestion()` |
| Stimulus / passage | `src/practice-view.js` — `renderQuestion()` |
| Answer choices | `src/practice-view.js` — `renderQuestion()`, one choice per button |
| Explanation and review screen | `src/practice-view.js` — `renderResult()` |
| Timed-test stem, stimulus, choices, review | `src/exam-view.js` |
| Card front, back, cloze and image-occlusion fallback | `src/cards-view.js` |
| Study-cards skin and mixed review | `src/practice-view.js`, `src/mixed-review.js` |
| AI chat transcript and assistant replies | `src/chat-panel.js` — `view.md()` |
| Error-log and weak-spot rows | These show the note title and the skill/error label, not the question body, so there is no math text to render. |
| Test score report | Shows scores and skill/domain labels, not question bodies. |

## What 1.80.0 changes

- **Simple `\ce{}` fallback.** Obsidian's default MathJax does not load mhchem, so a note like `$\ce{H2O}$` can show raw notation. `src/math-rendering.js` now rewrites a conservative subset into ordinary MathJax at render time:
  - formulas with element counts, parentheses and states: `\ce{Ca(OH)2}`, `\ce{H2O(l)}`;
  - charges: `\ce{Na+}`, `\ce{SO4^2-}`;
  - coefficients and reactions: `\ce{2H2 + O2 -> 2H2O}`;
  - arrows: `->`, `-->`, `<-`, `<->`, `<=>`.
- **No guessing.** Brackets, labels such as `->[heat]`, `\text{}`, backslashes and other complex mhchem syntax are left exactly as written for an mhchem/Extended MathJax installation. The source note is never changed.
- **Code is not rewritten.** Fenced code, inline code and escaped dollar signs are skipped.
- **Safe fallback.** A missing or throwing renderer falls back to the original text instead of leaving a blank pane.
- **Golden tests.** `tests/math-rendering.test.js` covers fractions, matrices, integrals, chemistry formulas and equations, choices, explanations, code fences, escaped dollars, unsupported chemistry and the practice review path.

No MathJax, mhchem, KaTeX or other third-party renderer code is bundled. The converter is original code in this MIT-licensed repository.

## Visual check still needed

The automated audit cannot see Obsidian's rendered output. Before calling the visual audit complete, open a note with this body in a real vault and check it in **Practice → answer → review**, **Timed test**, **Cards**, and a **review chat**:

```md
## Question
Evaluate $\int_0^1 x^2\,dx$ and simplify $\frac{3}{4}-\frac{1}{2}$.

## Answer Choices
- A. $\frac{1}{2}$
- B. $\begin{bmatrix}1 & 0\\0 & 1\end{bmatrix}$
- C. $\ce{2H2 + O2 -> 2H2O}$
- D. $\ce{Ca(OH)2}$

## Answer
> [!answer]- Reveal answer
> **Correct Answer: A**
>
> $\int_0^1 x^2\,dx = \frac{1}{3}$ and $\frac{3}{4}-\frac{1}{2}=\frac{1}{4}$.
```

Check light and dark themes, a narrow phone-sized pane, and one note with complex chemistry such as `$\ce{[Cu(NH3)4]^2+}$`. The last one needs an mhchem-enabled MathJax setup; the plugin intentionally leaves it untouched rather than producing a wrong structure.

If a formula still appears raw, record the surface, theme, platform and the exact source line in the issue tracker. Do not paste copyrighted exam content; use a minimal formula instead.
