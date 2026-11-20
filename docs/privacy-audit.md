# Privacy audit: study content

Scope: every shipped source file under `src/`. Question: can a card's text, a note's file name, a
course name, a deck name or a review statistic leave the vault, other than through the provider the
user configured on purpose?

Enforced by `tests/privacy-audit.test.js`, which fails if a telemetry client, a beacon or a new
network sink appears in `src/`.

## Network sinks

| File | Sink | Destination | Guard |
| --- | --- | --- | --- |
| `src/api-client.js` | `requestUrl`, `fetch` (SSE) | The user's own AI provider base URL | `safeApiBase` (HTTPS, or HTTP only on loopback); key only in an auth header |
| `src/opencode-client.js` | `requestUrl`, `fetch` (SSE) | Local OpenCode server | `safeApiBase`; per-run Basic auth |
| `src/opencode-manager.js` | `requestUrl` | `api.github.com` (constant repository) | Constant URL, GitHub JSON only, release allow-list |
| `src/plugin.js` | `requestUrl` ×2 | A calendar `.ics` feed the user names | `safeCalendarFeedUrl`; 2 MB cap |
| `src/anki-connect.js` | AnkiConnect request | `127.0.0.1:8765` (Anki on the same computer) | Loopback only |
| `src/couchdb-sync.js` | CouchDB request | The database URL the user configures | User configuration only |

No other file in `src/` names `requestUrl` or `fetch`. All six are opt-in: AI off, no calendar feed,
no Anki and no CouchDB means no request at all.

## What is never sent

- No analytics or telemetry client: no `gtag`, `mixpanel`, `posthog`, `amplitude`, `segment`,
  `plausible`, `sentry`, `datadog`, `hotjar`, `fullstory` or `navigator.sendBeacon`.
- No crash reporting, no installation id, no usage counters, no "first run" ping.
- Rendering a view never makes a request. Today, Flashcards, practice, the calendar and the
  reference tools read the vault and local storage only.
- Logs are local (`console`). Written notices and modals name a file only when the user asked about
  that file, and the same text is already on screen.

## What the user controls

- AI content leaves only when the user starts an AI action (import, answer check, tutor chat, AI
  grade). The import preflight reads the file locally first and shows what it found before sending.
- Background AI (blind answer checks, overnight import) is an explicit opt-in.
- CouchDB sync sends card and review fields to the database the user configured; the field list is
  fixed in `src/couchdb-sync.js` and excludes note body text beyond the card fields it syncs.
- Deleting a note, deck or import folder never sends anything.

## Verification

- `tests/privacy-audit.test.js` scans `src/` for telemetry tokens and asserts the network-sink
  allow-list above.
- `docs/security-inventory.md` pins the same sinks at the call-site level.
- The audit was re-run after every feature in this series; new modules (`card-triage`,
  `import-health`, `anki-schedule`) contain no network code.
