# Mobile and desktop layout contract

MCQ Tracker has two deliberate practice layouts, not one layout that is stretched
to fit every screen:

- **Phone** is the dedicated mobile screen. The question screen is selected by
  `Platform.isMobile === true`. The post-answer review adds
  `Platform.isPhone !== false` so an iPad/tablet keeps the shared review split it
  has today. Older Obsidian builds that do not expose `isPhone` fall back to the
  phone layout.
- **Desktop** uses the shared split-screen practice layout. A narrow desktop
  pane keeps desktop markup and labels; it must never receive the phone tree.
- **Tablet** is a deliberate boundary: its existing question screen still
  follows `Platform.isMobile` exactly as before, but its review keeps the shared
  split because `Platform.isPhone` is false. That preserves the tablet review
  behavior and avoids putting a phone-sized review shell on a wide screen.

The question switch lives in `PracticeView.renderQuestion()` in
`src/practice-view.js`; the review switch lives in `renderResult()`. Phone
classes are added only inside those branches.

## Phone question tree

The question screen is built from `.qt-mobile` and is intentionally not a
CSS-only rearrangement of desktop markup:

| Part | Markup | Purpose |
|---|---|---|
| Header | `.qt-m-bar` | Question number, unit/skill, timer with pause, flag and More |
| Passage/Question tabs | `.qt-m-tabs`, `.qt-m-tab` | One pane visible at a time |
| Question scroller | `.qt-m-scroll` | The only vertical scroller in the question pane |
| Answer bar | `.qt-m-answerbar` | Confidence and Submit; hidden until an answer is selected |
| More sheet | `.qt-m-sheet`, `.qt-m-sheet-backdrop` | Skip, Don't know, Known, Bury, Suspend, Exclude, Open note and End session |

The answer bar is armed by an answer and Submit stays disabled until confidence
is also chosen.

## Phone review tree

The post-answer review reuses the same phone shell and the shared review content:

| Part | Markup | Purpose |
|---|---|---|
| Review header | `.qt-m-bar`, `.qt-m-review-status` | Correct/Incorrect, course context, time, flag and More |
| Review/Passage tabs | `.qt-m-tabs`, `.qt-m-tab` | The review starts visible; the passage is one tap away |
| Review scroller | `.qt-m-review-scroll` | The only vertical scroller in the review pane |
| Action bar | `.qt-m-reviewbar` | Done and Next question, with safe-area padding |
| More sheet | `.qt-m-sheet`, `.qt-m-sheet-backdrop` | Open question note, Known and Exclude |

The review content itself is the same `.qt-review` block used on desktop. The
phone branch relocates primary actions into the action bar and secondary
actions into the More sheet; it does not duplicate the review markup.

Long review text, choice labels, notes and tags can shrink and wrap. The review
scroller hides horizontal overflow, the notes box is border-box width 100%, and
the review action bar uses `env(safe-area-inset-bottom)`.

## Desktop tree

Desktop and tablet review keep the original layout:

- `.qt-split` with `.qt-pane-left` (passage) and `.qt-pane-right` (question).
- `.qt-qhead` with the question number and full flag label on the question screen.
- `.qt-resbar` with `.qt-res-actions`, including Open note, flag, Known, Exclude
  and Next question.
- `.qt-done` at the end of the review.
- Long labels such as `Skip (don't log)` and `How sure are you?`.

None of the `.qt-m-*` classes, and never `.qt-mobile`, are added on desktop or
tablet review.

## CSS boundary

All phone rules live in the `phone question layout` block in `styles.css`.
Every selector there is either `.qt-wrap.qt-mobile` or starts with
`.qt-mobile `, so no phone rule can leak into a desktop or tablet pane. The
tests assert this boundary directly.

## Tests

`tests/mobile-practice.test.js` covers **17 focused tests**. It renders the same
question and review with `Platform` set for phone, desktop and tablet, and
covers:

- question passage tabs, a single question scroller and the gated answer bar;
- review tabs, a single review scroller and the re-used `.qt-review` content;
- review action bar and More sheet actions;
- touch targets of at least 44px;
- `dvh` sizing, safe-area padding and no-horizontal-overflow CSS;
- no mobile classes in the desktop or tablet review tree and no desktop classes
  in the phone tree;
- every rule in the phone CSS block being scoped under `.qt-mobile`.

Run the focused check with:

```bash
node --test tests/mobile-practice.test.js
```

The real iOS/Android device audit is still a manual gate recorded in
`plan.md`; the automated tests prove the code and CSS boundary, not device
behaviour.
