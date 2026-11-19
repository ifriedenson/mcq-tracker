# Security policy

MCQ Tracker is an Obsidian plugin that runs with your vault's permissions. It
reads the notes you point it at, imports PDFs and documents you choose, and can
send that text to an AI provider you configure. It has no telemetry, no network
request of its own, and no server.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's
private reporting instead:

1. Open <https://github.com/ifriedenson/mcq-tracker/security/advisories/new>.
2. Describe the version (`Settings → Community plugins` shows it, and
   `manifest.json` has it), the Obsidian version, the platform, and the steps
   that reproduce the problem.
3. If the report involves an AI provider key, rotate it first. Never paste a key
   or the contents of a private note into a report, an issue, a screenshot or a
   log.

You will get an answer within a week. If a fix is needed, it ships as a patch
version through the normal release process, and the advisory names the version
that fixes it.

## Supported versions

Only the newest published version is supported. Obsidian updates plugins from
`manifest.json`, and every release tags the exact commit it was built from, so
the fix always exists as a release rather than only on `main`.

## What is in scope

- Importing a malicious PDF, DOCX, EPUB or image: parser crashes, unbounded
  memory or CPU, a crafted file writing outside the import folder, or a file
  reaching the AI prompt when you did not ask for it
- Path handling: a note, folder or attachment name that reads or writes outside
  the vault
- The AI request path: sending vault text to an address other than the provider
  you configured, leaking an API key into a note, a log, an export or a
  screenshot, or executing model output as code
- Any way for content in a vault, an imported file or a provider reply to run
  code in Obsidian (the plugin forbids `eval`, `new Function` and dynamic
  timers, and `npm run check` enforces that)

Out of scope: the security of the AI provider you choose, the accuracy of a
model's answers, and vulnerabilities in Obsidian itself (report those to
Obsidian).
