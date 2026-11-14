# Ledger — 1.302.0 overnight import (branch freebuff/d88551267b6076e698552363, base 0b2a53c)

## Done (committed)
- 8af0008 Phase 1: probe-before-restart, VERIFY_IDLE_TIMEOUT_MS, deleteSession, recoverForSlowCheck. Tests: verify-slow-check (4), updated answer-verification (2), import-batch-window (1).
- 1ce1fd6 Phase 2: batched agent self-check prompt + __test importer export. Tests: importer-prompt (2).

## Uncommitted (in tree)
- src/plugin.js: verifyDraftQuestions pool (o.concurrency 1..4, default 1), checkOptions.deleteSession, aiChat session cleanup.
- src/overnight-checks.js: runCheckQueue (new, no callers yet).
- main.js rebuilt with pool. AGENTS.md no-questions rule (uncommitted, requested).

## Rulings
- R1: str_replace flaky ("bad request") → python edits via run_terminal, verified with git diff + node --check.
- R2: opencode-client duplication incident → deduped via python; cause unknown; verified via diff. Cost if wrong: none, diff reviewed.
- R3: updated 3 existing tests to new expected behavior (restart only on dead probe); added probe coverage. Not weakening: old behavior preserved as dead-probe case.
- R4: TDD order inverted for Phase 1/3a-core by the interrupted turn. Remedy: RED-prove by stashing src and rebuilding (pool), and delete-rewrite for overnight-checks.js. Cost if skipped: tests might not catch regressions.
- R5: tests load main.js bundle → every src change needs node scripts/build.js before tests see it. Cost: ~1-2 min per rebuild.

## Remaining
- [x] Pool RED→GREEN proof (4 fail on old code, 5 pass on new — committed 264ebea).
- [x] overnight-checks tests (RED with module deleted → 7 pass; drove quota/stop/wake fixes — committed).
- [ ] Modal unattended plumbing + manifest/resume/log/commands/settings UI (tests first per slice).
- [ ] Flagged answers surface (tests first).
- [ ] Bug pass, full suite, npm run check, rebuild, headless Obsidian, release.
- [ ] Bug pass, full suite (4 shards), npm run check, rebuild, headless Obsidian 1.15.0 verification.
- [ ] Release 1.302.0 (version bumps, notes, whats-new, plan.md, AGENTS.md numbers, commit, push).
