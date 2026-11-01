# Mobile and desktop layout contract

MCQ Tracker has two deliberate practice layouts, not one layout that is stretched
to fit every screen:

- **Mobile** is the dedicated phone screen used when Obsidian runs on a phone or
  tablet. It is selected by `Platform.isMobile === true`, not by pane width.
- **Desktop** is the split-screen practice layout. It is used everywhere else,
  including a narrow sidebar or split pane on a laptop. A narrow desktop pane
  keeps desktop markup and labels; it must never receive the phone tree.

The switch lives in `PracticeView.renderQuestion()` in `src/practice-view.js`.
The phone classes are added only inside that branch.

## Mobile tree

The mobile screen is built from `.qt-mobile` and is intentionally not a
CSS-only rearrangement of desktop markup:

| Part | Markup | Purpose |
|---|---|---|
| Header | `.qt-m-bar` | Question number, unit/skill, timer with pause, flag and More |
| Passage/Question tabs | `.qt-m-tabs`, `.qt-m-tab` | One pane visible at a time |
| Question scroller | `.qt-m-scroll` | The only vertical scroller in the question pane |
| Answer bar | `.qt-m-answerbar` | Confidence and Submit; hidden until an answer is selected |
| More sheet | `.qt-m-sheet`, `.qt-m-sheet-backdrop` | Skip, Don't know, Known, Bury, Suspend, Exclude, Open note and End session |

The answer bar is armed by an answer and Submit stays disabled until confidence
is also chosen. The sheet and answer bar include
`env(safe-area-inset-bottom)`, and the phone wrapper uses `100dvh` with a
`100vh` fallback, capped to the leaf.

## Desktop tree

Desktop keeps the original split and footer:

- `.qt-split` with `.qt-pane-left` (passage) and `.qt-pane-right` (question).
- `.qt-qhead` with the question number and full flag label.
- `.qt-ctl` with `.qt-foot-left`, `.qt-foot-center` and `.qt-foot-right`.
- Long labels such as `Skip (don't log)` and `How sure are you?`.

None of the `.qt-m-*` classes, and never `.qt-mobile`, are added on desktop.

## CSS boundary

All phone rules live in the `phone question layout` block in `styles.css`.
Every selector there is either `.qt-wrap.qt-mobile` or starts with
`.qt-mobile `, so no phone rule can leak into a desktop pane. The tests assert
this boundary directly.

## Tests

`tests/mobile-practice.test.js` renders the same question twice, once with
`Platform.isMobile` true and once false, and covers:

- passage tab isolation and a single question scroller;
- the answer bar appearing only after an answer, with confidence gating Submit;
- secondary actions only in the More sheet, with touch targets of at least 44px;
- `dvh` sizing and safe-area padding;
- no mobile classes in the desktop tree and no desktop classes in the mobile
  tree;
- every rule in the phone CSS block being scoped under `.qt-mobile`.

Run the focused check with:

```bash
node --test tests/mobile-practice.test.js
```

The real iOS/Android device audit is still a manual gate recorded in
`plan.md`; the automated tests prove the code and CSS boundary, not device
behaviour.
