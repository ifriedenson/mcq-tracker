"use strict";
/*
 * Simple Flashcards-compatible blocks. A bullet ending in `:::` opens a block;
 * only its direct child bullets become cards. The parser is local and never
 * throws, so a malformed block can explain the syntax in place.
 *
 *   - French vocab :::
 *     - Capital of France :: Paris
 *     - el perro >> the dog
 *     - the dog << el perro
 *     - uno <> one
 *     - The sky is {blue}
 *     - Inner planets ;;
 *       - Mercury
 *       - Venus, Earth, Mars
 */
const { str } = require("./util");

const MAX_CARDS = 300;
const PAIR_DELIMITERS = ["<>", ">>", "<<", "::", ";;"];

function indentOf(raw) {
  const lead = str(raw).match(/^[ \t]*/)[0];
  let width = 0;
  for (const char of lead) width += char === "\t" ? 4 : 1;
  return width;
}

function stripBullet(raw) {
  return str(raw)
    .replace(/^[ \t]*/, "")
    .replace(/^(?:[-*+]|\d+[.)])\s+/, "")
    .trimEnd();
}

function isBlank(raw) {
  return !str(raw).trim();
}

function takeDeck(text) {
  const source = str(text).trim();
  const match = source.match(/(?:^|\s)#deck\/([^\s#]+)/i);
  if (!match) return { text: source, deck: "" };
  return { text: source.replace(match[0], " ").trim(), deck: match[1] };
}

function headerOf(raw) {
  const text = stripBullet(raw).trim();
  if (!/:::\s*$/.test(text)) return null;
  const withoutMarker = text.replace(/:::\s*$/, "").trim();
  const tagged = takeDeck(withoutMarker);
  return { label: tagged.text.trim(), deck: tagged.deck };
}

function delimiterOf(text) {
  let found = null;
  for (const delimiter of PAIR_DELIMITERS) {
    const at = text.indexOf(delimiter);
    if (at < 0) continue;
    if (!found || at < found.at) found = { delimiter, at };
  }
  return found;
}

function clozeEntries(text) {
  const matches = [...str(text).matchAll(/\{(\d+)\|([^{}]+)\}|\{([^{}]+)\}/g)];
  if (!matches.length) return [];
  let auto = 0;
  const numbered = matches.map((match) => (match[1] ? Number(match[1]) : 0)).filter((value) => value > 0);
  let nextAuto = numbered.length ? Math.max(...numbered) : 0;
  return matches
    .map((match) => {
      const answer = str(match[2] || match[3]).trim();
      if (!answer) return null;
      const key = match[1] ? `n${Number(match[1])}` : `a${++nextAuto}-${++auto}`;
      return { key, answer, match };
    })
    .filter(Boolean);
}

function clozeFront(text, entries, key) {
  let out = "";
  let cursor = 0;
  for (const entry of entries) {
    out += str(text).slice(cursor, entry.match.index);
    out += entry.key === key ? "______" : entry.answer;
    cursor = entry.match.index + entry.match[0].length;
  }
  return out + str(text).slice(cursor);
}

function clozeCards(text, deck, label) {
  const entries = clozeEntries(text);
  if (!entries.length) return [];
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.key)) groups.set(entry.key, []);
    groups.get(entry.key).push(entry.answer);
  }
  return [...groups].map(([key, answers]) => ({
    front: clozeFront(text, entries, key),
    back: answers.join(", "),
    type: "cloze",
    direction: "forward",
    deck,
    label,
  }));
}

function cardIssue(issues, number, message) {
  issues.push(`Card ${number}: ${message}`);
}

function addCard(cards, issues, raw, nested, header, number) {
  const tagged = takeDeck(stripBullet(raw));
  const text = tagged.text.trim();
  if (!text) {
    cardIssue(issues, number, "The card is empty.");
    return;
  }
  const deck = tagged.deck || header.deck;
  const found = delimiterOf(text);
  if (!found) {
    const cloze = clozeCards(text, deck, header.label);
    if (cloze.length) {
      cards.push(...cloze);
      return;
    }
    // Plain bullets are notes, not cards, matching Simple Flashcards.
    return;
  }
  if (found.delimiter === ";;") {
    const front = text.slice(0, found.at).trim();
    const trailing = text.slice(found.at + 2).trim();
    const answerLines = nested.map(stripBullet).filter((line) => line.trim());
    if (!front) {
      cardIssue(issues, number, "Add the prompt before ;;.");
      return;
    }
    if (trailing) {
      cardIssue(issues, number, "The multiline marker ;; must be at the end of the card line.");
      return;
    }
    if (!answerLines.length) {
      cardIssue(issues, number, "Add at least one nested bullet under a ;; card as its answer.");
      return;
    }
    cards.push({
      front,
      back: answerLines.map((line) => `- ${line.trim()}`).join("\n"),
      type: "multiline",
      direction: "forward",
      deck,
      label: header.label,
    });
    return;
  }
  const left = text.slice(0, found.at).trim();
  const right = text.slice(found.at + found.delimiter.length).trim();
  if (!left || !right) {
    cardIssue(issues, number, "Add text on both sides of the delimiter.");
    return;
  }
  if (found.delimiter === "<>") {
    cards.push({ front: left, back: right, type: "bidirectional", direction: "forward", deck, label: header.label });
    cards.push({ front: right, back: left, type: "bidirectional", direction: "reverse", deck, label: header.label });
    return;
  }
  const backward = found.delimiter === "<<";
  cards.push({
    front: backward ? right : left,
    back: backward ? left : right,
    type: found.delimiter === "::" ? "basic" : backward ? "backward" : "forward",
    direction: backward ? "reverse" : "forward",
    deck,
    label: header.label,
  });
}

/**
 * Parse a Simple Flashcards block. Cards are scoped to each bullet ending in
 * `:::`; plain bullets and deeper-nested bullets are ignored unless they are
 * the answer of a `;;` card. Never throws.
 */
function parseSimpleFlashcards(source) {
  const text = str(source).replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const cards = [];
  const issues = [];
  let blocks = 0;
  let number = 0;
  let index = 0;

  while (index < lines.length) {
    const header = headerOf(lines[index]);
    if (!header) {
      index++;
      continue;
    }
    blocks++;
    const headerIndent = indentOf(lines[index]);
    let end = index + 1;
    while (end < lines.length && (isBlank(lines[end]) || indentOf(lines[end]) > headerIndent)) end++;
    const blockLines = lines.slice(index + 1, end);
    const childIndent = blockLines
      .filter((line) => !isBlank(line))
      .reduce((lowest, line) => Math.min(lowest, indentOf(line)), Infinity);
    if (!Number.isFinite(childIndent)) {
      issues.push(`The "${header.label || "untitled"}" ::: block has no cards.`);
      index = end;
      continue;
    }

    let at = 0;
    while (at < blockLines.length) {
      if (isBlank(blockLines[at]) || indentOf(blockLines[at]) !== childIndent) {
        at++;
        continue;
      }
      const raw = blockLines[at];
      at++;
      const nested = [];
      while (at < blockLines.length && (isBlank(blockLines[at]) || indentOf(blockLines[at]) > childIndent)) {
        if (!isBlank(blockLines[at])) nested.push(blockLines[at]);
        at++;
      }
      number++;
      if (cards.length >= MAX_CARDS) {
        issues.push(`Only the first ${MAX_CARDS} cards were loaded.`);
        break;
      }
      addCard(cards, issues, raw, nested, header, number);
    }
    index = end;
  }

  if (!blocks) {
    issues.push('Start a card block with a bullet ending in :::, for example "- French vocab :::".');
  } else if (!cards.length && !issues.some((issue) => issue.startsWith("The "))) {
    issues.push("No cards were found. Add one child bullet with ::, >>, <<, <>, ;; or a {cloze}.");
  }

  return { cards, issues, blocks };
}

module.exports = { MAX_CARDS, parseSimpleFlashcards };
