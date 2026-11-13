# Mobile and desktop layout contract

MCQ Tracker has two deliberate practice layouts, not one layout that is stretched
to fit every screen:

- **Phone** is the dedicated mobile screen. The question screen is selected by
  `Platform.isMobile === true` while the **Mobile practice view** switch is on
  (the default). The post-answer review adds `Platform.isPhone !== false` so an
  iPad/tablet keeps the shared review split it has today. Older Obsidian builds
  that do not expose `isPhone` fall back to the phone layout.
- **Mobile practice view** is a switch on **Practice session** settings. Turning
  it off gives an iPad or phone the desktop question and review tree, so an iPad
  can use the computer layout. Desktop is always the computer layout, and notes,
  attempts and scheduling are unchanged.
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

## Mobile practice view switch

**Mobile practice view** is on by default on **Practice session** settings. It
only chooses the rendered practice tree:

- On, a phone uses the mobile question and review screens; an iPad uses the
  mobile question screen and the shared review split (the existing behavior).
- Off, an iPad or phone uses the desktop question and shared review tree.
- Desktop ignores the switch and always uses the desktop tree.

The switch writes `settings.mobilePracticeView` and refreshes open practice
views immediately. It does not change the Settings navigation, notes, attempts,
scheduling or the separate distraction-free chrome setting.

## CSS boundary

Phone layout rules live in the `phone question layout` block in `styles.css`.
Every selector there is either `.qt-wrap.qt-mobile` or starts with
`.qt-mobile `, so no phone rule can leak into a desktop or tablet pane. The
separate `distraction-free practice` block lives immediately above it and is
guarded by `body.is-mobile.mcq-practice-mode`; the tests assert both boundaries
directly.

## Distraction-free practice

The **Distraction-free practice mode** setting is on by default. While the
active practice leaf is showing a `question` or `result`, the plugin adds
`mcq-practice-mode` to `document.body`. Under `body.is-mobile`, CSS then hides
`.workspace-leaf-content[data-type="question-tracker-view"] .view-header` and
`.mobile-navbar`; desktop never receives the class because the mobile document
check fails.

The class is removed on the idle screen, `onClose`, plugin unload, a switch to
another leaf, setting off, and a fresh plugin load. That covers normal exit,
closing the view, navigating away, reloading the plugin and a stale class left
by a crash. Multiple practice leaves use the active leaf; closing an inactive
leaf does not clear the class for the active one. The practice content gets
`env(safe-area-inset-top)` and keeps the existing bottom safe-area padding on
the answer and review bars.

The selectors use Obsidian's mobile DOM classes. The real iOS/Android visual
pass is still a manual gate: the automated tests prove the class lifecycle and
stylesheet contract, not native rendering.

## Quick Practice home-screen link

The plugin registers the custom protocol action `mcq-tracker-quick`:

`obsidian://mcq-tracker-quick?minutes=5`

`minutes` accepts 2, 5 or 10; `count` accepts 5, 10 or 20 and cannot be combined
with `minutes`; `course=Biology` scopes the queue to that course or test. With
no parameter the link uses the saved Quick Practice default. It opens the same
practice view, saved queue and scheduler as the ribbon command; invalid values
and an empty course match show a Notice instead of starting a different
session. Unknown query keys are ignored, so an Obsidian `vault` parameter does
not break the link. Obsidian Mobile decides whether the OS lets a home-screen
shortcut open a custom URI; the plugin does not claim an OS-level shortcut it
cannot create.

## Tests

`tests/mobile-practice.test.js` covers **18 focused tests**. It renders the same
question and review with `Platform` set for phone, desktop and tablet, and
covers:

- question passage tabs, a single question scroller and the gated answer bar;
- review tabs, a single review scroller and the re-used `.qt-review` content;
- review action bar and More sheet actions;
- touch targets of at least 44px;
- `dvh` sizing, safe-area padding and no-horizontal-overflow CSS;
- no mobile classes in the desktop or tablet review tree and no desktop classes
  in the phone tree;
- every rule in the phone CSS block being scoped under `.qt-mobile`;
- the distraction-free class lifecycle, setting, multi-view cleanup and
  body-class-scoped header/navbar selectors (`tests/practice-fullscreen.test.js`).

- the `obsidian://mcq-tracker-quick` parser and real plugin entry point,
  including time, count, course, invalid input and a disabled module
  (`tests/quick-practice-uri.test.js`).

Run the focused check with:

```bash
node --test tests/mobile-practice.test.js
```

The mobile layout audit is closed at code level on Nov 13, 2026: all 18 focused
tests pass and a 600 px live narrow render was checked. No physical iOS or
Android device was available, so **no device behaviour is claimed**; the
checklist above remains an optional owner follow-up and is no longer a plan gate.
