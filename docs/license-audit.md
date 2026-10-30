# License audit for the shipped bundle

Audit date: October 29, 2026. This covers code and data bundled in `main.js` and the release files, not every idea named in the product plan.

## Repository license

MCQ Tracker is MIT. The root [LICENSE](../LICENSE) applies to the plugin as a whole. Contributions are accepted under the same license.

## Runtime dependencies

`package.json` has no runtime or development dependencies and no lockfile packages. The build is a local CommonJS bundler in `scripts/build.js`; Obsidian supplies the runtime API.

## Bundled or adapted third-party work

| Item | License | Where | Status |
|---|---|---|---|
| ts-fsrs 5.4.1 (`dist/index.cjs`) | MIT, Open Spaced Repetition | `src/fsrs-lib.js` | Vendored, with the copyright and MIT text in `NOTICES.md`. |
| University Schedule and Calendar 1.2.0 calendar parser and presentation | MIT, Cesemess | `src/calendar-ics.js`, `src/calendar-model.js`, `src/calendar-notes.js`, `src/calendar-view.js`, `styles.css` | Adapted and modified; pinned commit and changes recorded in `NOTICES.md`. |

## Original code

Everything else in `src/` is original for this plugin, including:

- numeric grading, parameterized questions, computed verification and the local graph/calculator evaluators;
- the Reference formula list, constants, unit factors and element facts;
- the OCR prompts and Direct AI allow-listed tool protocol;
- the SMILES parser/layout/SVG renderer in `src/smiles.js`;
- the clean-room SM-2 scheduler in `src/sm2.js` (no Better Recall, Anki or SuperMemo code copied).

No GPL, AGPL, LGPL, MPL, non-commercial, no-derivatives or unlicensed code is bundled. No Desmos, RDKit, Ketcher, WKWebView, MathJax, mhchem, Chem or LearnKit source is copied into the bundle.

## Data and content

The AP Chemistry equations/constants and periodic-table masses are factual data transcribed from the official College Board reference sheets named in the README and `NOTICES.md`. No AP questions, rubrics, sample responses, PDF pages or question banks are bundled. AP resource links point to official domains and include original descriptions only.

The sample vault under `samples/` is original content written for this repository.

## Rule for future work

Before any new third-party code, dataset or binary is copied, check its actual repository `LICENSE` and `package.json`, prefer MIT/BSD/ISC/0BSD, keep the copyright and license text in `NOTICES.md`, and record the pinned version or commit. If the license cannot be found, do not copy the code.

## Notice in the shipped file

The build embeds the full project `LICENSE` and `NOTICES.md` into `main.js`, so the MIT text travels with the single file Obsidian installs. The release publishes only `main.js`, `manifest.json` and `styles.css`; the repository copies of `LICENSE` and `NOTICES.md` are the source for that embedded block.

## Authorship and contributions

Much of this code was written with AI coding agents under human direction; the commit history records the changes and human review. Purely AI-generated output may not be copyrightable in every jurisdiction, so the MIT grant applies only to the extent the author holds copyright. Contributions are accepted under the MIT license and must follow [CONTRIBUTING.md](../CONTRIBUTING.md). No similarity or license scanner has been run against third-party code; that remains an open question in `plan.md` section 11.
