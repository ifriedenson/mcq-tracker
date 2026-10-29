"use strict";
/*
 * Zipped QTI banks. Canvas and Blackboard export a QTI quiz as a .zip whose
 * question XML sits beside an imsmanifest.xml. This reads only the archive's
 * XML entries with the existing local ZIP reader and parses each with the QTI
 * parser; nothing is extracted to disk, and no new dependency is added.
 */
const { str } = require("./util");
const { readZipEntries } = require("./apkg");
const { parseQtiXml } = require("./cards-import");

function parseQtiArchive(input, options) {
  const opts = options || {};
  const source = str(opts.sourcePath || "QTI archive");
  const deck = str(opts.deck).trim() || "Imported";
  const entries = readZipEntries(input);
  const names = [...entries.keys()].filter(
    (name) => /\.xml$/i.test(name) && !/(^|\/)imsmanifest\.xml$/i.test(name)
  );
  if (!names.length) throw new Error("That QTI archive has no quiz .xml file inside it.");
  const cards = [];
  const errors = [];
  let skipped = 0;
  for (const name of names) {
    const parsed = parseQtiXml(entries.get(name).toString("utf8"), {
      sourcePath: `${source} › ${name}`,
      deck,
    });
    cards.push(...parsed.cards);
    skipped += Math.max(0, Number(parsed.skipped) || 0);
    if (Array.isArray(parsed.errors)) errors.push(...parsed.errors);
  }
  if (!cards.length) errors.push("No QTI questions with a correct answer were found in that archive.");
  return { cards, skipped, errors, source, format: "qti" };
}

module.exports = { parseQtiArchive };
