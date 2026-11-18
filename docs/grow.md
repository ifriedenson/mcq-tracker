# How to grow MCQ Tracker

**Written:** Nov 16, 2026 · **Baseline:** 1.307.16 · **Sources:** Obsidian Stats plugin pages, the authors' own r/ObsidianMD posts, Obsidian's developer docs.

This is a growth doc, not a product doc. `plan.md` is the source of truth for what the plugin does; this file is only about getting it in front of people. Everything here is either (a) a number read from Obsidian Stats on Nov 16, 2026, (b) a direct quote from an author's own post, or (c) marked **inference**.

---

## 1. The scoreboard

Four study plugins, all in the same niche, all shipped in 2026.

| Plugin | In the community list since | Downloads | Stars | Days listed | Downloads/day | Issues open+closed | Commits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **LearnKit** (was Sprout) | 2026-05-14 | **29,575** | 183 | 143 | **~207** | 116 | 634 |
| **Spaceforge** | ~May 2026 | **2,667** | 15 | 180 | **~15** | 1 | 55 |
| **Adaptive Practice** | ~Aug 2026 | **686** | 1 | 75 | **~9** | 0 | 134 |
| **MCQ Tracker** | ~2026-10-31 | **884** | 2 | 17 | **~52** | 0 | 570 |

Three things fall out of that table.

**1. LearnKit is 11× Spaceforge and 43× Adaptive Practice.** It is not 43× better software. Adaptive Practice has *more* commits than Spaceforge and 2.5× the commits-per-day, and it has the fewest downloads of the four. Distribution, not engineering, is the whole gap.

**2. The download counter counts update events, so our 884 is the least trustworthy number in that table.** Obsidian increments the counter on installs *and* updates. LearnKit has shipped ~48 versions in 143 days. **This repo has shipped dozens of point releases in its 17 listed days** (1.301.1 → 1.307.16). That inflates our number heavily and makes the `downloads/day` column a measure of shipping cadence as much as adoption. Do not read it as "we are second only to LearnKit." The honest statement is that **we do not currently know how many people use this plugin**, because nothing in the plugin measures it and nobody has been asked.

**3. What we can say for certain.** Three things are true regardless of the counter: the plugin has never been announced in any public channel, its listing shows **0 reviews**, and its GitHub shows **0 issues**. Every single growth lever the other two plugins pulled — public posts, positioning, reviews, a community — is still untouched here. That is the whole argument of this document.

### What each plugin actually did

**LearnKit — the benchmark. Six months of build-in-public, then a rename.**

Timeline reconstructed from the repo and the author's posts:

- **Repo created 2026-01-11.** The author is a final-year medical student who posts as "Will" / `u/ctrlaltwill_`, and says why in the first line of his launch post: *"Kia ora! I'm Will, a final-year medical student."*
- **Beta shipped as "Sprout" via BRAT, months before listing.** His posts reference earlier ones — *"I previously posted about the flashcard plugin I've been building for Obsidian"* — so there were at least three Reddit posts before it was ever installable from the store. BRAT is the standard way to get real users onto an unlisted plugin, and it is what the Obsidian docs themselves recommend for betas.
- **First stable post leads with a positioning section.** The release post is titled *"Plugin Release: Sprout – Flashcards & Spaced Repetition"* and contains a heading **"Why Sprout and not other spaced repetition plugins?"** — an explicit head-to-head against the incumbents, in the post itself.
- **The follow-up post is built on user requests.** *"I shared the first stable release a few weeks ago and the response was great! Since then I've been focused on fixing bugs and building the features people asked for. One of the most requested additions was audio support."* Then the TTS feature, framed as *"a lot of people using Obsidian for language learning were keen for it"* — a whole second audience reached by shipping one requested feature and saying who it was for.
- **Rebranded Sprout → LearnKit** and broadened the description from "flashcards" to *"A native study system for your Obsidian vault."* Same code, bigger category, better search result.
- **Invested in the listing surface itself.** A GitHub Pages docs site with nine branded banner images, an FAQ (`Can I use LearnKit with my existing notes?`, `Does it work with Anki?`, `Does it work on mobile?`), a plain-language privacy disclosure, and translations. The docs site is in the repo (`site/`), so it costs nothing to keep current.
- **Used Anki as the wedge.** Anki import/export landed early. That is the single largest pool of addressable users in this space, and it converts them by removing a migration cost rather than asking for a leap of faith.
- **Result: 116 issues and 104 PRs.** Highest engagement of the four by an order of magnitude, and the reviews on its listing are actual 5-star write-ups.

**Spaceforge — the update-post play.**

- **Launch post is a feature dump, and it works.** Title: *"Spaced Repetition, Calendar, Pomodoro timer, and AI-Powered Study Plugin for Obsidian."* Flaired `showcase`. Then a dense paragraph naming every feature, two links, and a close: *"I would love to get suggestions on future features."*
- **Came back 28 days ago with a version in the title.** *"Spaceforge v1.1.0 — Anki support, adaptive AI tutor, and improved spaced repetition for Obsidian."* The structure is worth copying exactly: recall the last post → the three biggest changes → **credit a commenter by username** for a UX fix → what changed under the hood → two links → ask for feedback.
- **Anki support arrived in the update, not the launch.** The v1.1.0 post leads with it, and the top comment thread is about using Anki on mobile without paying for Anki Mobile. Adding a bridge to the biggest incumbent is a repeatable growth move.
- **Fights in the comments, politely, on positioning.** When asked about overlap with another plugin: *"there's definitely some overlap. My focus with Spaceforge is more on studying notes in context, organizing them into a logical hierarchy based on how they're linked..."* That is a positioning statement delivered as a comment reply — and it does more work than the post did.
- **Numbers: ~1,907 downloads at day 157 → 2,667 at day 180.** That is ~760 downloads in 23 days (~33/day) right after an update post, against a lifetime average of ~15/day. **A single good update post roughly doubled its run rate.** That is the most directly copyable result in this whole doc.
- **Weak spot to avoid:** 15 stars, 0 reviews, 1 issue. The author never converted downloads into a community.

**Adaptive Practice — the cautionary tale.**

- **686 downloads in 75 days, 1 star, 0 reviews, 0 issues, 0 PRs** — on 134 commits of genuinely sophisticated work: a native helper engine, checksum-pinned downloads, fluency-aware scheduling, provider breadth, a thoughtful security disclosure.
- **Its only public post is titled "Adaptive Practice is on the community page!"** and got ~1 upvote. That was the entire launch. No positioning, no user story, no follow-up, no reply bait.
- The lesson is not subtle: **the best-specified engine in the category is invisible.** A launch post is not a launch.

### Common threads in the two that grew

1. **Public, specific, dated, repeated posts** in r/ObsidianMD, always flaired `showcase`, always by the author, always asking for something.
2. **A named audience.** Medical student; language learners; Anki refugees. Not "Obsidian users."
3. **Positioning stated explicitly**, in the post and again in the comments.
4. **A migration path from an incumbent** (Anki) rather than a demand to abandon it.
5. **Shipping what users asked for, then saying so by name.**
6. **A polished listing**: branded images, FAQ, privacy answer, docs site.

Adaptive Practice did numbers 6 partially and none of 1–5. It has 3% of LearnKit's downloads.

---

## 2. What MCQ Tracker already has

This matters because the plan below should use what exists, not build more.

- A landing page (`ifriedenson.github.io/mcq-tracker`) and a docs folder with real screenshots.
- A **Tally feedback form** (`tally.so/r/PRDe1d`) already linked in the README — i.e. a channel, with no traffic pushing into it yet.
- Real recorded GIFs: install (6 frames), practice (12 frames), quick add (5 frames), timed test (3 frames). **This is better demo material than any of the three competitors has.** LearnKit uses static banners; Spaceforge uses a video. We have frame-by-frame real captures.
- Onboarding that most plugins don't have: first-run **Start here** note, **Open welcome guide**, clickable example question, **What's new** after updates.
- A **"How it compares with Spaceforge"** table in the README — honest, sourced, claims-limited.
- 200+ commands, seven question types, timed tests, AP/Bluebook-style tools. The differentiator is *exam simulation*, not flashcards.
- 570 commits and per-version release notes, so there is a visible shipping record to point at.
- **The best first-17-days download rate of any plugin in the comparison except LearnKit.**

What it does not have: a single Reddit post, a forum release thread, a Discord announcement, a review on its own listing, or any user quoted anywhere.

---

## 3. The plan, ranked by return per hour

### Do this week

**3.1 Post the launch on r/ObsidianMD.** The plugin has been listed for 17 days and has never been announced. This is the largest single gap. Use the copy in §4.1. Flair it `showcase`, post from a personal-feeling account, and **plan to sit in the comments for the first four hours** — that is where Spaceforge's positioning actually happened.

**3.2 Post the forum release thread.** `forum.obsidian.md` → **Share & showcase** → **Plugins**, tag `plugin-release`. Lower traffic than Reddit but permanent, indexed, and it is what reviewers and newsletter writers read. Copy in §4.3.

**3.3 Post in Discord `#updates`.** Needs the developer role. Two sentences plus a link. Copy in §4.4. Takes five minutes and is the only channel the Obsidian team itself recommends alongside the forum.

**3.4 Ask the existing 884 for a review.** The listing shows **0 reviews** while LearnKit shows two 5-star write-ups. Reviews are visible on the plugin page inside Obsidian and change install decisions. Copy in §4.6.

### Next two weeks

**3.5 Run the update-post loop every 3–4 weeks.** This is the single most proven tactic in the data: Spaceforge's ~33/day post-update rate against a ~15/day lifetime average. One post per meaningful release, version number in the title, three changes, one user credited by name. Template in §4.2.

**3.6 Pitch the newsletters.** Two are live and actively featuring plugins: **This Week in Obsidian** (`thisweekinobsidian.substack.com`, weekly, open-source, community-run since Obsidian Roundup went quiet) and **Obsidian Stats** (`obsidianpluginstats.substack.com`, weekly roundup with a "plugins worth checking out" section). One short email each. Copy in §4.7.

**3.7 Convert the framing from "flashcards" to "exam practice."** LearnKit won by renaming Sprout into a bigger category. MCQ Tracker's category is not crowded — nobody else does timed multi-section tests with confidence ratings and mistake tags. Make "exam-style practice" the first four words everywhere: manifest description, README `<title>`, landing page H1, Reddit title, forum title.

### Next month

**3.8 Get into a video.** Spaceforge and LearnKit both benefit from being easy to *show*. We have GIFs; a creator with a camera is better. Short, specific outreach in §4.8 — target Obsidian productivity channels and study/exam-prep channels separately, because they want different things.

**3.9 Ship one thing a named audience asked for, and say who asked.** The Tally form is the input. LearnKit's TTS post is the model: feature → *"the most requested addition was X"* → *"people using Obsidian for Y were keen for it."*

**3.10 Enter Obsidian October** next cycle (the annual community event, runs through October, with Discord channels for works-in-progress) and any **Gems of the Year** category that fits. Free, and being named is a permanent badge.

---

## 4. Copy-paste pack

Rules that apply to all of it: **never claim affiliation with the College Board or AP** (the README already handles this — keep the disclaimer nearby), **link the community listing and the repo**, and **answer every comment for the first few hours.** Do not post the same text to Reddit and the forum on the same day; rewrite the opening line.

### 4.1 r/ObsidianMD launch post

> **Title:** I built an Obsidian plugin for practise exams — timed tests, confidence ratings, and it records why you missed each question
>
> **Flair:** showcase
>
> I've been building MCQ Tracker for a while and it's now in the community plugins list. I'm posting because I'd rather hear what's wrong with it from people who actually study than guess.
>
> **The problem I had:** I was making flashcards in Obsidian and they were fine for facts, but useless for the thing I actually had to do — sit a timed exam where the difficulty is the question *style*, not the recall. So I built the other half.
>
> **What it does:**
> - **Practice in seven question formats** — multiple choice, student-produced response, fill-in, matching, true/false, select-all, and free response. Filter by course, skill, difficulty or folder, or save a preset.
> - **Timed multi-section tests** with a question navigator, mark-for-review, option shuffle and a pass mark. It's built to feel like sitting the real thing.
> - **It records why you missed it.** Every answer saves your pick, your confidence, a mistake tag you choose, and the next review date — onto the question note itself, in its properties. Nothing lives in a private database.
> - **Spaced review on a schedule.** Correct answers come back after 1, 3, 7, 21 and 60 days by default; a miss comes back tomorrow. Cards and whole notes can use FSRS or SM-2 if you prefer.
> - **No AI required.** Paste questions you already have and it writes the notes. AI import is there for PDFs if you want it, with your own key, and it's off by default.
>
> **What it isn't:** it ships no AP questions, rubrics or question banks, and it isn't affiliated with or endorsed by the College Board. You bring the questions; the plugin does the practice, the grading and the schedule.
>
> Your notes stay plain Markdown, the review state travels with the vault, and there's no telemetry.
>
> Install: Settings → Community plugins → Browse → `MCQ Tracker`.
> [Community listing](https://community.obsidian.md/plugins/mcq-tracker) · [Source](https://github.com/ifriedenson/mcq-tracker) · [Landing page](https://ifriedenson.github.io/mcq-tracker/)
>
> If you try it and something is confusing, there's a two-minute form in the README and I read every answer. If it's just wrong, tell me here — I'd rather know.

**Why this shape:** Adaptive Practice's launch was a status update ("it's on the community page!") and got one upvote. This one leads with a specific problem, names the category nobody else occupies, admits a limitation, and asks for criticism rather than praise. Spaceforge's launch worked because it was dense and specific; this is dense and specific plus a reason to care.

### 4.2 r/ObsidianMD update post — reusable template

Post one of these per meaningful release, roughly every 3–4 weeks. Fill the brackets. Keep the credit line even if the suggestion was small — it is the difference between a press release and a conversation.

> **Title:** MCQ Tracker v[X.Y] — [biggest feature], [second feature], and [third feature] for exam practice in Obsidian
>
> **Flair:** showcase
>
> I posted about MCQ Tracker [N weeks] ago and the response was genuinely useful — several of the things in this release came straight out of those comments.
>
> **What's new:**
> - **[Feature 1]** — [one sentence on what it does, one on why it matters]
> - **[Feature 2]** — [same]
> - **[Feature 3]** — [same]
>
> Thanks to u/[name] for [the specific suggestion] — that's in this build.
>
> Under the hood: [one line on the real engineering, e.g. fixed a batch import that could park a whole queue on a spent API tier].
>
> [Community listing](https://community.obsidian.md/plugins/mcq-tracker) · [Source](https://github.com/ifriedenson/mcq-tracker)
>
> Still the same deal: no account, no telemetry, your review state lives in your notes' properties. If you tried it before and bounced off something, I'd especially like to hear what it was.

### 4.3 Obsidian forum — Share & showcase, `plugin-release` tag

> **Title:** MCQ Tracker — exam-style practice and spaced review from your notes (seven question formats, timed tests, mistake tags)
>
> Hi all. MCQ Tracker turns notes into practise exams rather than decks. It's question-first: any note with a `question_id` property is a question, and every attempt, confidence rating, mistake tag and review date is written back into that note's properties, so review state travels with the vault and stays readable by   Bases or Dataview or a text editor.
>
> **Highlights**
> - Seven question formats, including free response and student-produced response
> - Timed multi-section tests with a navigator, mark-for-review, option shuffle and a pass mark
> - Confidence ratings, mistake tags, per-skill accuracy and weak-spot practice
> - Spaced review on an interval ladder by default; FSRS and SM-2 available for cards and whole notes
> - Optional cards, calendar, assignments and an AI tutor — all off until you turn them on
> - Works offline; AI is optional and uses your own provider key
>
> **Install:** Settings → Community plugins → Browse → `MCQ Tracker`
>
> [Community listing](https://community.obsidian.md/plugins/mcq-tracker) · [Source and changelog](https://github.com/ifriedenson/mcq-tracker) · [Docs and screenshots](https://ifriedenson.github.io/mcq-tracker/)
>
> The plugin ships no exam questions or banks, and is not affiliated with or endorsed by the College Board. Feedback thread and a short form are both in the README — I'd welcome either.

### 4.4 Discord `#updates`

> **MCQ Tracker 1.307** — exam-style practice in Obsidian: timed tests, seven question formats, confidence ratings and mistake tags, with spaced review written into each question note's properties. No AI required, no telemetry.
> [community.obsidian.md/plugins/mcq-tracker](https://community.obsidian.md/plugins/mcq-tracker)

### 4.5 Reply templates for the four questions that will come

Answer these in-thread, every time, in your own words. Spaceforge's positioning happened entirely in comments.

**"How is this different from Spaced Repetition / LearnKit?"**
> They're card-first; this is question-first. If you already have cards, LearnKit and Spaced Repetition are both good and you should keep using them — the Cards module here can import `.apkg` so nothing is trapped. What's different is the exam layer: timed multi-section tests, confidence ratings, mistake tags, per-skill weak spots, and review state stored on the question note itself instead of in a plugin database.

**"How is this different from Spaceforge?"**
> Real overlap — both do FSRS and both can generate questions with your own key. Spaceforge is stronger on the AI tutor and objective tracking; I've written an honest row-by-row comparison in the README rather than claiming I win every line. Where this one leads is exam simulation: timed tests, FRQ, a gradebook, and mistake analytics. Different product for a different job.

**"Does it need AI / an API key / a subscription?"**
> No. Practice, timed tests, review, cards, calendar and the gradebook all work with AI off and no key at all. AI is only for turning a PDF into question notes and for the optional tutor, and it's off by default.

**"Why should I trust it with my study notes?"**
> Review state is written into each note's YAML properties, so it survives a plugin reinstall and stays readable without the plugin. Settings live in `data.json`. There's no telemetry, no account, and no self-updater. Uninstall and your notes are exactly as they were, plus some properties.

### 4.6 Review request (in-plugin notice + README line)

The listing sits at **0 reviews**. Add this to the README under the install block, and consider a one-time notice after a user's Nth review session (not on install):

> **Finding it useful?** A one-line review on the [community listing](https://community.obsidian.md/plugins/mcq-tracker) helps other students find it — that page is the whole discovery mechanism for plugins like this one.

### 4.7 Newsletter pitch

Two short emails. Personal, no attachment, one link, and something they can quote.

**To This Week in Obsidian** (open-source, community-run, tips via the repo or Substack):
> **Subject:** Study plugin for the roundup — exam practice inside Obsidian
>
> Hi — I maintain MCQ Tracker, an Obsidian plugin that's been in the community list since [date] and is at ~[N] downloads.
>
> The angle I think your readers would like: it's the opposite of a flashcard plugin. Any note with a `question_id` is a question, you practise it, and the attempt, your confidence and the next review date get written into that note's properties — so review state travels with the vault and stays readable without the plugin. Seven question formats, timed multi-section tests, no account, no telemetry, AI optional.
>
> Listing: https://community.obsidian.md/plugins/mcq-tracker
> Source: https://github.com/ifriedenson/mcq-tracker
>
> Happy to send screenshots or answer anything. Thanks either way.

**To Obsidian Stats** (`obsidianpluginstats.substack.com` — it runs a weekly "plugins worth checking out" list):
> **Subject:** New plugin submission for the weekly roundup — MCQ Tracker
>
> Hi Ganessh — MCQ Tracker ([listing](https://community.obsidian.md/plugins/mcq-tracker)) is in the community list as of [date] and has a [score] on your site. It's exam-style practice rather than flashcards: seven question formats including free response, timed multi-section tests, confidence ratings and mistake tags, with review state written into the question notes' properties rather than a central database. No AI required, no telemetry.
>
> I'd love a review on the listing if you try it — and if you'd like a short piece on the note-properties-as-database design for the blog, I'd be glad to write it.

### 4.8 Creator outreach DM

Send to individual channels, not a mass blast. Reference a specific video so it's obviously not a template.

**To an Obsidian productivity channel:**
> Hi [name] — I saw your [specific video] and the part about [specific thing] matched a problem I've been working on. I maintain MCQ Tracker, an Obsidian plugin for exam practice: seven question formats, timed tests, and it writes your confidence and mistake tags back into each question note. It's free, offline, no AI required.
>
> No ask if it's not a fit — but if you ever want to try it, I'll set up a demo vault with real questions so you don't have to build one, and I'll answer questions in the comments.

**To a study/exam-prep channel:**
> Hi [name] — you cover [exam] prep, so this might be relevant: I built an Obsidian plugin that does timed multi-section practice tests and tracks which skills you're actually weak in, rather than just flashcards. It doesn't ship any questions — you bring your own — and it isn't affiliated with the exam board.
>
> I'd rather it be tested by someone who knows the exam than promoted, honestly. Happy to send a demo vault.

**The demo vault is the whole offer.** None of the three competitors do this, and it removes the only real barrier to a video: nobody wants to author test questions on camera.

---

## 5. Positioning lines, ready to paste

Pick one per surface. Consistency matters more than cleverness.

- **Manifest / one-liner:** `Exam-style practice from your notes: timed tests, confidence ratings, mistake tags and spaced review. Works offline. AI is optional.` (already close — good)
- **Category sentence:** *"Question-first, not card-first."*
- **Long line:** *"The other study plugins help you remember facts. MCQ Tracker helps you sit the exam."*
- **Technical credibility line:** *"Your review state lives in your notes' properties, not in a plugin database — so it survives a reinstall and stays readable without the plugin."*
- **Honesty line (keep it, it converts better than hype):** *"It ships no questions. You bring those."*

---

## 6. Anti-playbook — what the losers did

- **Don't launch with "it's available now."** Adaptive Practice's entire public footprint is one post announcing its own existence, with ~1 upvote. Say what problem it solves for whom.
- **Don't rely on the listing.** 10,287 plugins are in the directory. The listing is a checkout page, not a shop window.
- **Don't publish a feature dump without a user in it.** Spaceforge's launch was dense but audience-free, and it took 180 days to reach 2,667. LearnKit named a person and a use case in line one.
- **Don't let downloads stand in for a community.** Spaceforge has 2,667 downloads and 1 GitHub issue. Reviews, issues and PRs are what a new visitor reads as proof.
- **Don't ship silently for 570 commits.** Which is what we have done so far.

---

## 7. What to measure

The lifetime download number is nearly useless because it counts updates. Record these weekly in a table at the bottom of this file:

| Week of | Downloads (total) | Δ week | Listing reviews | GitHub stars | Issues | Tally responses |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-16 | 884 | — (baseline) | 0 | 2 | 0 | not measured |

Baseline read from Obsidian Stats and the listing on Nov 16, 2026, the same day `docs/grow.md` was written. Every later row is a weekly reading of the same four pages, taken on a Monday. Remember that the total counts update events, so a week with a release will look better than the week after it — compare Δ week against how many versions shipped that week.

Three things to actually watch:

1. **Δ week, not the total.** A good post should show up within 48 hours; Spaceforge's update post ran at ~33/day against a ~15/day baseline. If a post moves nothing, the post was the problem, not the plugin.
2. **Reviews per 1,000 downloads.** Currently 0. LearnKit: 2 per 29.5k, Spaceforge: 0 per 2.7k. Low bar — clearing it is cheap.
3. **Tally responses per post.** If a launch post produces zero form responses, it produced zero engaged users, whatever the download counter says.

---

## 8. The 30-day checklist

**Done in the repo.** These four needed nothing but a commit, and they are in.

- [x] **README review ask live** (§4.6) — the line sits under the install block, where a reader has just finished installing.
- [x] **Category rename, where it was still wrong** — the landing page `<title>` and `og:title` now read "exam practice inside Obsidian". The `<h1>` ("Turn notes and PDFs into practice"), the manifest description and the README all already led with exam practice, so nothing else needed changing.
- [x] **First row of the metrics table filled in** (§7).
- [x] **The demo vault for creator outreach already exists** — `samples/sample-vault`, with a README explaining how to open it. Zip it and attach it.

**Yours to send.** Each needs an account this repo cannot log into. The text is written and final in §4; the run order is in `docs/growth/README.md`.

- [ ] r/ObsidianMD launch post (§4.1) — and reply to every comment the same day
- [ ] Forum Share & showcase thread with the `plugin-release` tag (§4.3)
- [ ] Discord `#updates` message, after getting the developer role (§4.4)
- [ ] Email This Week in Obsidian and Obsidian Stats (§4.7)
- [ ] One creator outreach per channel type, with the demo vault offered (§4.8)

**Waiting on a release.**

- [ ] Ship the next release with a version-in-title update post (§4.2) — the template is ready; there is nothing truthful to announce until a release exists.

**Deliberately not done.** §4.6 also floated a one-time in-plugin notice after a user's Nth review session. That is a product change with its own tests, not a growth step, so it is not part of this pass.

---

## 9. Sources and caveats

- **Obsidian Stats** plugin pages for [LearnKit](https://www.obsidianstats.com/plugins/learnkit), [Spaceforge](https://www.obsidianstats.com/plugins/spaceforge), [Adaptive Practice](https://www.obsidianstats.com/plugins/adaptive-practice) and [MCQ Tracker](https://www.obsidianstats.com/plugins/mcq-tracker), read Nov 16, 2026. All counts in §1 come from these.
- **r/ObsidianMD posts by the authors:** `1qo80o1` and `1qztt9u` (Sprout beta and first stable release), `1rhts0x` (Sprout 1.0.8 / TTS), `1tjcsg6` (Spaceforge launch), `1x9pu45` (Spaceforge v1.1.0), `1uqnvo2` (Adaptive Practice community-page post).
- **Obsidian developer docs and `obsidianmd/obsidian-releases`:** the forum + Discord `#updates` announcement path and the BRAT beta recommendation.
- **Caveats.** Download counts include updates, so they overstate users and overstate them most for whichever plugin ships the most versions — which is this one. That is why §1 refuses to rank MCQ Tracker by downloads/day. Publication dates for Spaceforge and Adaptive Practice are derived from "days listed" and are approximate, as is the Spaceforge version count used in that estimate. The Spaceforge "~33/day after the update post" figure assumes the post is the cause; **inference**, not measured attribution, though the timing is close. Reddit upvote counts were not captured except where quoted. No analytics are available for any of these plugins, so nothing here is a user count.
