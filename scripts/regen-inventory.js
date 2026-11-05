"use strict";
/*
 * Regenerates docs/capability-inventory.md from the built bundle.
 *
 * The module table is rebuilt from `T` (one row per group, sorted, with its real
 * export count and the test files that cite `T.<group>`), and the command table is
 * rebuilt from the plugin's own registered commands in registration order. The
 * Gaps section is left alone: it lists only the internal byte-movers, and the
 * drift test fails if that list and the table disagree.
 */
const fs = require("fs");
const path = require("path");
const { load } = require("../tests/helpers/load");
const { makeApp } = require("../tests/helpers/fake");

const ROOT = path.join(__dirname, "..");
const DOC = path.join(ROOT, "docs", "capability-inventory.md");

function main() {
  const { T, Plugin } = load();
  const testFiles = fs.readdirSync(path.join(ROOT, "tests")).filter((f) => f.endsWith(".test.js")).sort();
  const testText = Object.fromEntries(testFiles.map((f) => [f, fs.readFileSync(path.join(ROOT, "tests", f), "utf8")]));
  const cites = (group) => testFiles.filter((file) => testText[file].includes("T." + group));
  const exportCount = (group) => {
    const value = T[group];
    return value && (typeof value === "object" || typeof value === "function") ? Object.keys(value).length : 0;
  };

  const plugin = new Plugin(makeApp([]));
  const ready = plugin.onload ? plugin.onload() : null;
  return Promise.resolve(ready).then(() => {
    const groups = Object.keys(T).sort();
    const moduleRows = groups.map((group) => {
      const tests = cites(group);
      return `| \`${group}\` | ${exportCount(group)} | ${tests.length ? tests.map((f) => `\`tests/${f}\``).join(", ") : "—"} |`;
    });
    const commandRows = plugin.commands.map((command) => {
      const called = String(command.callback || command.checkCallback || "").match(/this\.([A-Za-z0-9_]+)\(/);
      const callback = called ? called[1] : "";
      const cited = testFiles.filter((file) => testText[file].includes(command.id) || (callback && testText[file].includes(callback)));
      return `| \`${command.id}\` | ${String(command.name || "").replace(/\|/g, "\\|")} | ${callback ? `\`${callback}\`` : "—"} | ${
        cited.length ? cited.map((f) => `\`tests/${f}\``).join(", ") : "—"
      } |`;
    });

    const lines = fs.readFileSync(DOC, "utf8").split("\n");
    const modulesAt = lines.findIndex((line) => line.trim() === "## Modules");
    if (modulesAt < 0) throw new Error("docs/capability-inventory.md has no ## Modules section");
    const modulesEnd = lines.findIndex((line, i) => i > modulesAt && /^## /.test(line));
    const moduleHeaderEnd = modulesAt + 4; // heading, blank, column names, separator
    lines.splice(moduleHeaderEnd, (modulesEnd < 0 ? lines.length : modulesEnd) - moduleHeaderEnd, ...moduleRows, "");

    const commandsAt = lines.findIndex((line) => line.trim() === "## Commands");
    if (commandsAt < 0) throw new Error("docs/capability-inventory.md has no ## Commands section");
    const commandsEnd = lines.findIndex((line, i) => i > commandsAt && /^## /.test(line));
    const commandHeaderEnd = commandsAt + 4;
    lines.splice(commandHeaderEnd, (commandsEnd < 0 ? lines.length : commandsEnd) - commandHeaderEnd, ...commandRows, "");

    const exports = groups.reduce((sum, group) => sum + exportCount(group), 0);
    let doc = lines.join("\n");
    doc = doc.replace(
      /\*\*Modules:\*\* \d+ groups, \d+ exports\. \*\*Commands:\*\* \d+\./,
      `**Modules:** ${groups.length} groups, ${exports} exports. **Commands:** ${commandRows.length}.`
    );
    fs.writeFileSync(DOC, doc);
    console.log(`groups ${groups.length}, exports ${exports}, commands ${commandRows.length}`);
  });
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
