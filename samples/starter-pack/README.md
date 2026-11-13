# Starter pack

Original practice questions you can paste straight into the plugin, plus the format template for making your own.

| Pack | File | Questions | Formats |
| --- | --- | --- | --- |
| AP World History: Modern | [`ap-world-history.txt`](ap-world-history.txt) | 12 | 11 multiple choice, 1 select-all |
| SAT Math | [`sat-math.txt`](sat-math.txt) | 10 | 6 multiple choice, 4 student-produced response |

**Use a pack in two minutes**

1. Install and enable MCQ Tracker.
2. Open the pack you want and copy everything in it. The two header lines at the top are ignored by the importer.
3. Press `Ctrl/Cmd+P`, run **Quick add questions from pasted text**, and paste.
4. Check the preview, then import. The questions land in your vault as ordinary question notes, ready to practise.

**What each pack sets up**

- **AP World History: Modern** uses the course name the plugin's own AP resources already know, `AP World History: Modern`, so Practice filters, the AP resources hub and the score calculator all recognise it. Units 1 to 8 are covered; skills are named the way the course names them.
- **SAT Math** uses the course `SAT` and the test `Math`, and mixes multiple choice with student-produced response, the two formats the real section uses.

**Why the keys are trustworthy**

Every question is written from scratch: none of it comes from College Board, AP Classroom, a practice test, a textbook or a question bank, and nothing is adapted or closely paraphrased from one. Each explanation states the fact or the arithmetic the key rests on, so a student can check an answer without trusting the pack author. AP is a trademark of the College Board. These packs are not affiliated with or endorsed by the College Board, and no AP question, rubric or question bank is reproduced here.

`template.txt` is the same syntax with empty fields. Copy one block per question, or share it with a teacher who wants to write a pack for their own subject. The importer's rules are documented at the top of that file, and the code behind them is `src/quick-add.js`.

The check that keeps this honest is `tests/starter-pack.test.js`: it reads both packs from disk, parses them through the same `parseQuickAdd` function the paste window calls, then asserts the question count, each question type, every answer key, and that the notes written from them pass the plugin's own note validator.
