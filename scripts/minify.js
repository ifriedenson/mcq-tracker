"use strict";
/*
 * A tiny dependency-free JavaScript minifier: strips comments and collapses
 * whitespace. It never renames identifiers, never touches strings, template
 * literals or regex bodies, and never reorders code: the output only removes
 * bytes that cannot change how the code parses or runs.
 *
 * Safety comes from tokenizing like scripts/check-no-dynamic-code.js does:
 * `//` and `/* ...` open comments only in code position, quotes open strings,
 * backticks open templates (with ${} interpolations scanned as code), and a
 * `/` opens a regex only where the previous significant token allows it.
 * Regex bodies are copied verbatim, so a pattern never loses a space and a
 * `[/]` never breaks the scan.
 *
 * Whitespace is dropped everywhere except where removing it would merge two
 * tokens (between two identifier characters, between a digit and an
 * identifier start, and around `+`/`-` runs). Two newline spots are sacred
 * because ASI reads them: the restricted productions (`return`, `break`,
 * `continue`, `throw`, `yield`, and `async function` split across lines) and
 * `++`/`--` runs (`a` newline `++b` is two statements, `a ++b` parses as
 * `a++ b`). A newline survives exactly there; everywhere else it goes.
 *
 * Legal comments (`/*! ... *\/`, e.g. the Apache header the vendored pdf-lib
 * carries) travel with the bundle; all other comments go.
 */
function isIdentifierChar(ch) {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9") || ch === "_" || ch === "$";
}

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

const REGEX_PREFIX_CHARS = "(,=:[!&|?{};+-*%^~<>";
const REGEX_PREFIX_WORDS = new Set([
  "return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
  "case", "do", "else", "yield", "await", "throw",
]);

function wordEndingAt(source, end) {
  let start = end;
  while (start >= 0 && isWhitespace(source[start])) start--;
  let stop = start;
  while (stop >= 0 && isIdentifierChar(source[stop])) stop--;
  const word = source.slice(stop + 1, start + 1);
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(word) ? word : "";
}

function startsRegex(source, index, previous) {
  if (isIdentifierChar(previous)) {
    return REGEX_PREFIX_WORDS.has(wordEndingAt(source, index - 1));
  }
  return previous === "" || REGEX_PREFIX_CHARS.includes(previous);
}

function isWhitespace(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\v" || ch === "\f" || ch === "\u00a0";
}

// Words after which a newline changes the parse (restricted productions).
const ASI_WORDS = new Set(["return", "break", "continue", "throw", "yield", "async"]);

/** Minify one JavaScript source string. */
function minify(source) {
  let out = "";
  let previous = "";
  let i = 0;
  const n = source.length;
  const stack = [{ kind: "code", depth: 0 }];

  function prevWord() {
    let k = out.length - 1;
    while (k >= 0 && (out[k] === " " || out[k] === "\n")) k--;
    const end = k;
    while (k >= 0 && isIdentifierChar(out[k])) k--;
    return out.slice(k + 1, end + 1);
  }

  function emitSpace(next, nextNext, hadNewline) {
    if (!previous) return;
    const p = previous;
    if (hadNewline) {
      if (ASI_WORDS.has(prevWord()) && next !== ";" && next !== "}" && next !== ",") {
        out += "\n";
        previous = "\n";
        return;
      }
      if ((next === "+" || next === "-") && (nextNext === next || p === next)) {
        out += "\n";
        previous = "\n";
        return;
      }
    }
    if (isIdentifierChar(p) && isIdentifierChar(next)) {
      out += " ";
      previous = " ";
      return;
    }
    if (isDigit(p) && (next === "." || isIdentifierChar(next))) {
      out += " ";
      previous = " ";
      return;
    }
    if ((p === "+" || p === "-") && next === p) {
      out += " ";
      previous = " ";
      return;
    }
    if (p === "-" && next === ">") {
      out += " ";
      previous = " ";
    }
  }

  function emit(ch) {
    out += ch;
    previous = ch;
  }

  while (i < n) {
    const frame = stack[stack.length - 1];
    const ch = source[i];
    const next = source[i + 1];
    if (frame.kind === "line") {
      if (ch === "\n") stack.pop();
      i++;
      continue;
    }
    if (frame.kind === "block") {
      if (ch === "*" && next === "/") {
        stack.pop();
        i += 2;
      } else i++;
      continue;
    }
    if (frame.kind === "string") {
      if (ch === "\\") {
        emit(ch);
        if (i + 1 < n) emit(source[i + 1]);
        i += 2;
      } else if (ch === frame.quote) {
        emit(ch);
        stack.pop();
        i++;
      } else {
        emit(ch);
        i++;
      }
      continue;
    }
    if (frame.kind === "template") {
      if (ch === "\\") {
        emit(ch);
        if (i + 1 < n) emit(source[i + 1]);
        i += 2;
      } else if (ch === "`") {
        emit(ch);
        stack.pop();
        i++;
      } else if (ch === "$" && next === "{") {
        emit(ch);
        emit(next);
        stack.push({ kind: "code", depth: 0, interpolation: true });
        i += 2;
      } else {
        emit(ch);
        i++;
      }
      continue;
    }
    if (isWhitespace(ch)) {
      let j = i + 1;
      let hadNewline = ch === "\n" || ch === "\r";
      while (j < n && isWhitespace(source[j])) {
        if (source[j] === "\n" || source[j] === "\r") hadNewline = true;
        j++;
      }
      if (j < n) emitSpace(source[j], source[j + 1], hadNewline);
      i = j;
      continue;
    }
    if (ch === "/" && next === "/") {
      stack.push({ kind: "line" });
      i += 2;
      continue;
    }
    if (ch === "/" && next === "*") {
      if (source[i + 2] === "!") {
        let j = i + 3;
        while (j < n && !(source[j - 1] === "*" && source[j] === "/")) j++;
        j++;
        for (let k = i; k < j; k++) emit(source[k]);
        i = j;
        continue;
      }
      stack.push({ kind: "block" });
      i += 2;
      continue;
    }
    if (ch === "/" && startsRegex(source, i, previous === " " ? prevSignificant() : previous)) {
      let end = i + 1;
      let inClass = false;
      while (end < n) {
        const c = source[end];
        if (c === "\\") {
          end += 2;
          continue;
        }
        if (c === "\n") break;
        if (inClass) {
          if (c === "]") inClass = false;
          end++;
          continue;
        }
        if (c === "[") {
          inClass = true;
          end++;
          continue;
        }
        if (c === "/") {
          end++;
          break;
        }
        end++;
      }
      while (end < n && /[a-z]/i.test(source[end])) end++;
      for (let k = i; k < end; k++) emit(source[k]);
      i = end;
      continue;
    }
    if (ch === '"' || ch === "'") {
      stack.push({ kind: "string", quote: ch });
      emit(ch);
      i++;
      continue;
    }
    if (ch === "`") {
      stack.push({ kind: "template" });
      emit(ch);
      i++;
      continue;
    }
    if (frame.interpolation) {
      if (ch === "{") {
        frame.depth++;
        emit(ch);
        i++;
        continue;
      }
      if (ch === "}") {
        emit(ch);
        if (frame.depth === 0) stack.pop();
        else frame.depth--;
        i++;
        continue;
      }
    }
    emit(ch);
    i++;
  }
  return out;

  function prevSignificant() {
    for (let k = out.length - 1; k >= 0; k--) {
      const c = out[k];
      if (c !== " " && c !== "\n") return c;
    }
    return "";
  }
}

module.exports = { minify };

if (require.main === module) {
  const fs = require("fs");
  const path = require("path");
  const target = process.argv[2];
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.name.endsWith(".js")) out.push(full);
    }
    return out;
  };
  const files = target ? [target] : [...walk(path.join(__dirname, "..", "src")), ...walk(path.join(__dirname, "..", "vendor"))];
  let before = 0;
  let after = 0;
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const min = minify(src);
    before += src.length;
    after += min.length;
  }
  console.log("minify: " + before.toLocaleString("en-US") + " -> " + after.toLocaleString("en-US") + " bytes (" + ((100 * (before - after)) / before).toFixed(1) + "% off) across " + files.length + " files.");
}
