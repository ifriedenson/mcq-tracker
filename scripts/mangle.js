"use strict";
/*
 * Scope-aware local identifier mangling (no dependencies, no parsing library).
 *
 * After scripts/minify.js has stripped comments and whitespace, most of the
 * remaining bundle bytes are local names this codebase chose for readers.
 * This pass renames them to short names without changing what the code does:
 *
 * - Only bindings DECLARED in the module are renamed (var/let/const, function
 *   and class names, parameters, catch parameters). Anything undeclared is a
 *   global (Object, JSON, require, the Obsidian API, ...) and is never
 *   touched, so no allow-list of globals is needed.
 * - Property names are never touched: after "." or "?.", object keys, method
 *   names, class members, labels and case targets keep their text. A local
 *   that shares a property's text is still safe to rename because only the
 *   binding occurrences are rewritten.
 * - Shorthand is expanded, never merged: an object literal with a shorthand
 *   member becomes key-colon-new-name and a destructuring shorthand becomes
 *   key-colon-new-name, so the property on the wire never changes while the
 *   local gets short.
 * - Spacing is reproduced gap-for-gap from the minified input (spaces and the
 *   ASI newlines the minifier kept), so token merging cannot change either.
 *
 * Every declared binding is renamed when no surviving text pins its name:
 * parameters, locals and functions. Classes keep their names because
 * constructor.name is observable identity (the window tests pin modal class
 * names). No shipped function name is read through the name property (only
 * data name fields and AbortError), so the function rename is unobservable
 * except in stack traces. Names that survive in the output (kept bindings,
 * globals, labels) are never reused for another binding.
 *
 * Bail-outs keep it honest: a module that uses "with", is not strict, has an
 * import or export statement, or hits a shape the parser does not model is
 * returned minified but unmangled. Minification alone is always safe; mangling
 * has to earn its way, and the full test suite runs against the mangled
 * bundle.
 */
const KEYWORDS = new Set(
  "break,case,catch,class,const,continue,debugger,default,delete,do,else,export,extends,finally,for,function,if,import,in,instanceof,new,return,super,switch,this,throw,try,typeof,var,void,while,with,yield,let,static,enum,true,false,null,undefined".split(",")
);
// get, set, async and of are usable as ordinary binding names, so they are
// not keywords here. The member parsers recognize them in modifier and key
// positions by shape instead, and for-of still matches of by text.

function isIdentifierStart(ch) {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_" || ch === "$";
}

function isIdentifierChar(ch) {
  return isIdentifierStart(ch) || (ch >= "0" && ch <= "9");
}

function isGapChar(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\v" || ch === "\f" || ch === " " || ch === "\u00a0";
}

/*
 * Tokenize minified code. Strings, template text, regexes and numbers become
 * single opaque raw tokens (their bytes are emitted verbatim and are never
 * renamed); template interpolations are tokenized as code inline. Every token
 * records whether whitespace or a newline preceded it, which the emitter
 * reproduces exactly.
 */
function tokenize(source) {
  const tokens = [];
  let gapSpace = false;
  let gapNewline = false;

  function push(t, v) {
    tokens.push({ t, v, gapSpace, gapNewline });
    gapSpace = false;
    gapNewline = false;
  }

  function noteGap(ch) {
    if (ch === "\n" || ch === "\r") gapNewline = true;
    else gapSpace = true;
  }

  // Index of the closing brace matching the opening brace at index at.
  // Strings, comments, regexes, nested templates and nested interpolations
  // are skipped correctly; regex detection uses the same conservative
  // previous-token heuristic as the minifier.
  function braceMatch(at) {
    const REGEX_CHARS = "(,=:[!&|?{};+-*%^~<>";
    const REGEX_WORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "case", "do", "else", "yield", "await", "throw"]);
    const wordBefore = (pos) => {
      let e = pos - 1;
      while (e >= 0 && isGapChar(source[e])) e--;
      const stop = e;
      while (e >= 0 && isIdentifierChar(source[e])) e--;
      const w = source.slice(e + 1, stop + 1);
      return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(w) ? w : "";
    };
    let j = at + 1;
    let depth = 1;
    let state = "code";
    let quote = "";
    let prev = "";
    const n = source.length;
    while (j < n && depth > 0) {
      const c = source[j];
      const d = source[j + 1];
      if (state === "line") {
        if (c === "\n") state = "code";
        j++;
        continue;
      }
      if (state === "block") {
        if (c === "*" && d === "/") {
          state = "code";
          j += 2;
        } else j++;
        continue;
      }
      if (state === "string") {
        if (c === "\\") j += 2;
        else if (c === quote) {
          state = "code";
          j++;
        } else j++;
        continue;
      }
      if (state === "template") {
        if (c === "\\") j += 2;
        else if (c === "`") {
          state = "code";
          j++;
        } else if (c === "$" && d === "{") {
          j = braceMatch(j + 1) + 1;
        } else j++;
        continue;
      }
      if (c === "/" && d === "/") {
        state = "line";
        j += 2;
        continue;
      }
      if (c === "/" && d === "*") {
        state = "block";
        j += 2;
        continue;
      }
      if (c === '"' || c === "'") {
        state = "string";
        quote = c;
        j++;
        continue;
      }
      if (c === "`") {
        state = "template";
        j++;
        continue;
      }
      if (c === "/" && (isIdentifierChar(prev) ? REGEX_WORDS.has(wordBefore(j)) : prev === "" || REGEX_CHARS.includes(prev))) {
        j++;
        let inClass = false;
        while (j < n) {
          const e2 = source[j];
          if (e2 === "\\") {
            j += 2;
            continue;
          }
          if (e2 === "\n") break;
          if (inClass) {
            if (e2 === "]") inClass = false;
            j++;
            continue;
          }
          if (e2 === "[") {
            inClass = true;
            j++;
            continue;
          }
          if (e2 === "/") {
            j++;
            break;
          }
          j++;
        }
        while (j < n && /[a-z]/i.test(source[j])) j++;
        prev = "/";
        continue;
      }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") prev = c;
      j++;
    }
    return j - 1;
  }

  // Scan a template starting at the backtick at index at; returns the index
  // just past the closing backtick. Raw text becomes raw tokens and each
  // interpolation body is tokenized as code.
  function templateEnd(at) {
    const n = source.length;
    let j = at + 1;
    let chunkStart = at;
    const flushRaw = (end) => {
      if (end > chunkStart) {
        push("raw", source.slice(chunkStart, end));
      }
    };
    while (j < n) {
      const c = source[j];
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === "`") {
        flushRaw(j);
        push("raw", "`");
        return j + 1;
      }
      if (c === "$" && source[j + 1] === "{") {
        flushRaw(j);
        push("punct", "${");
        const innerEnd = braceMatch(j + 1);
        tokenizeSlice(j + 2, innerEnd);
        push("punct", "}");
        j = innerEnd + 1;
        chunkStart = j;
        continue;
      }
      j++;
    }
    flushRaw(n);
    return n;
  }

  function tokenizeSlice(start, end) {
    const REGEX_CHARS = "(,=:[!&|?{};+-*%^~<>";
    const REGEX_WORDS = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "case", "do", "else", "yield", "await", "throw"]);
    const wordBefore = (pos) => {
      let e = pos - 1;
      while (e >= start && isGapChar(source[e])) e--;
      const stop = e;
      while (e >= start && isIdentifierChar(source[e])) e--;
      const w = source.slice(e + 1, stop + 1);
      return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(w) ? w : "";
    };
    let k = start;
    let prev = "";
    while (k < end) {
      const c = source[k];
      const d = source[k + 1];
      if (isGapChar(c)) {
        noteGap(c);
        k++;
        continue;
      }
      if (c === "/" && d === "/") {
        while (k < end && source[k] !== "\n") k++;
        continue;
      }
      if (c === "/" && d === "*") {
        const keep = source[k + 2] === "!";
        let j = k + 2;
        while (j < end && !(source[j - 1] === "*" && source[j] === "/")) j++;
        j++;
        if (keep) push("raw", source.slice(k, j));
        k = j;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = k + 1;
        while (j < end && source[j] !== c) {
          if (source[j] === "\\") j++;
          j++;
        }
        j++;
        push("raw", source.slice(k, j));
        prev = c;
        k = j;
        continue;
      }
      if (c === "`") {
        k = templateEnd(k);
        prev = "`";
        continue;
      }
      if (c === "/" && (isIdentifierChar(prev) ? REGEX_WORDS.has(wordBefore(k)) : prev === "" || REGEX_CHARS.includes(prev))) {
        let j = k + 1;
        let inClass = false;
        while (j < end) {
          const e2 = source[j];
          if (e2 === "\\") {
            j += 2;
            continue;
          }
          if (e2 === "\n") break;
          if (inClass) {
            if (e2 === "]") inClass = false;
            j++;
            continue;
          }
          if (e2 === "[") {
            inClass = true;
            j++;
            continue;
          }
          if (e2 === "/") {
            j++;
            break;
          }
          j++;
        }
        while (j < end && /[a-z]/i.test(source[j])) j++;
        push("raw", source.slice(k, j));
        prev = "/";
        k = j;
        continue;
      }
      if (isIdentifierStart(c)) {
        let j = k + 1;
        while (j < end && isIdentifierChar(source[j])) j++;
        push("ident", source.slice(k, j));
        prev = source[j - 1];
        k = j;
        continue;
      }
      if (c >= "0" && c <= "9") {
        let j = k + 1;
        while (j < end && /[0-9a-zA-Z_$.]/.test(source[j])) j++;
        push("raw", source.slice(k, j));
        prev = source[j - 1];
        k = j;
        continue;
      }
      if (c === "=" && d === ">") {
        push("punct", "=>");
        prev = ">";
        k += 2;
        continue;
      }
      push("punct", c);
      prev = c;
      k++;
    }
  }

  tokenizeSlice(0, source.length);
  return tokens;
}

/*
 * Analyze tokenized code and rename in-scope local bindings. Throws a
 * {bail} object for anything the parser does not model; the caller then
 * returns the input unchanged.
 */
function analyze(tokens) {
  const bail = (reason) => {
    throw { bail: reason };
  };
  // Scopes: {parent, func, bindings: Map(name -> binding)}.
  const scopes = [{ parent: -1, func: true, bindings: new Map() }];
  let current = 0;
  const skip = new Set();
  const declAt = new Map();
  const useAt = new Map();
  const labelNames = new Set();
  const matchCache = new Map();
  const st = { pos: 0 };

  const peek = (k) => tokens[st.pos + (k || 0)];
  const prevTok = (k) => tokens[st.pos - (k || 1)];

  const newScope = (func) => {
    scopes.push({ parent: current, func, bindings: new Map() });
    current = scopes.length - 1;
    return current;
  };
  const popScope = (to) => {
    current = to === undefined ? scopes[current].parent : to;
  };
  const nearestFunc = () => {
    let s = current;
    while (s >= 0 && !scopes[s].func) s = scopes[s].parent;
    return s < 0 ? 0 : s;
  };

  const declareBinding = (name, kind, idx, opts) => {
    if (name === "arguments") bail("arguments cannot be declared in strict code");
    const target = kind === "var" || kind === "function" || kind === "param" ? nearestFunc() : current;
    const scope = scopes[target];
    const existing = scope.bindings.get(name);
    if (existing) {
      const mergeable = (a, b) => {
        const fnish = (x) => x === "var" || x === "function" || x === "param" || x === "catch";
        return fnish(a) && fnish(b);
      };
      if (mergeable(existing.kind, kind)) {
        existing.declIndices.push(idx);
        if (opts && opts.kept) existing.kept = true;
        if (opts && opts.anonInit) existing.anonInit = true;
        declAt.set(idx, { binding: existing, shorthand: !!(opts && opts.shorthand) });
        return existing;
      }
      bail("duplicate declaration of " + name);
    }
    // Classes keep their names: constructor.name is observable identity (the
    // window tests pin modal class names) and renames would only alias types.
    const keepClass = kind === "class";
    const binding = {
      name,
      scope: target,
      kind,
      kept: !!(opts && opts.kept) || keepClass,
      anonInit: !!(opts && opts.anonInit),
      newName: null,
      declIndices: [idx],
    };
    scope.bindings.set(name, binding);
    declAt.set(idx, { binding, shorthand: !!(opts && opts.shorthand) });
    return binding;
  };

  const recordUse = (idx, shorthand) => {
    useAt.set(idx, { scope: current, binding: null, shorthand: !!shorthand });
  };

  const findMatch = (l, open, close) => {
    const key = l + ":" + open;
    if (matchCache.has(key)) return matchCache.get(key);
    let depth = 0;
    for (let k = l; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.t === "punct" && t.v === open) depth++;
      else if (t.t === "punct" && t.v === close) {
        depth--;
        if (depth === 0) {
          matchCache.set(key, k);
          return k;
        }
      }
    }
    bail("unmatched " + open);
    return -1;
  };

  // True when the token at p starts an anonymous function, arrow or class
  // expression (whose name would be inferred from the binding being declared).
  const isAnonInit = (p) => {
    const t = tokens[p];
    if (!t) return false;
    if (t.t === "ident" && t.v === "async" && tokens[p + 1] && tokens[p + 1].t === "ident" && tokens[p + 1].v === "function") {
      return isAnonInit(p + 1);
    }
    if (t.t === "ident" && t.v === "function") {
      let q = p + 1;
      if (tokens[q] && tokens[q].t === "punct" && tokens[q].v === "*") q++;
      return !!(tokens[q] && tokens[q].t === "punct" && tokens[q].v === "(");
    }
    if (t.t === "ident" && t.v === "class") {
      const q = tokens[p + 1];
      return !!(q && ((q.t === "punct" && (q.v === "{" || q.v === "(")) || (q.t === "ident" && q.v === "extends")));
    }
    if (t.t === "ident" && tokens[p + 1] && tokens[p + 1].t === "punct" && tokens[p + 1].v === "=>") return true;
    if (t.t === "punct" && t.v === "(") {
      const m = findMatch(p, "(", ")");
      return !!(tokens[m + 1] && tokens[m + 1].t === "punct" && tokens[m + 1].v === "=>");
    }
    return false;
  };

  const expect = (v) => {
    const t = peek();
    if (!t || t.t !== "punct" || t.v !== v) bail("expected " + v);
    st.pos++;
  };

  const atStatementEnd = () => {
    const t = peek();
    return !t || (t.t === "punct" && (t.v === ";" || t.v === "}"));
  };

  function parseProgram() {
    parseStatementList();
    if (st.pos < tokens.length) bail("trailing tokens");
  }

  function parseStatementList() {
    while (st.pos < tokens.length) {
      const t = peek();
      if (t.t === "punct" && t.v === "}") return;
      parseStatement();
    }
  }

  function parseStatement() {
    const t = peek();
    if (!t) return;
    if (t.t === "punct" && t.v === ";") {
      st.pos++;
      return;
    }
    if (t.t === "punct" && t.v === "{") {
      st.pos++;
      const outer = current;
      newScope(false);
      parseStatementList();
      expect("}");
      popScope(outer);
      return;
    }
    if (t.t === "ident" && (t.v === "const" || t.v === "let" || t.v === "var")) {
      parseDeclaration(t.v, false);
      return;
    }
    if (t.t === "ident" && t.v === "function") {
      parseFunction(true);
      return;
    }
    if (t.t === "ident" && t.v === "class") {
      parseClass(true);
      return;
    }
    if (t.t === "ident" && t.v === "async" && peek(1) && peek(1).t === "ident" && peek(1).v === "function") {
      parseFunction(true);
      return;
    }
    if (t.t === "ident" && t.v === "if") {
      st.pos++;
      expect("(");
      parseCommaSeq(")", {});
      parseStatement();
      if (peek() && peek().t === "ident" && peek().v === "else") {
        st.pos++;
        parseStatement();
      }
      return;
    }
    if (t.t === "ident" && t.v === "for") {
      parseFor();
      return;
    }
    if (t.t === "ident" && t.v === "while") {
      st.pos++;
      expect("(");
      parseCommaSeq(")", {});
      parseStatement();
      return;
    }
    if (t.t === "ident" && t.v === "do") {
      st.pos++;
      parseStatement();
      const w = peek();
      if (!w || w.t !== "ident" || w.v !== "while") bail("do without while");
      st.pos++;
      expect("(");
      parseCommaSeq(")", {});
      if (peek() && peek().t === "punct" && peek().v === ";") st.pos++;
      return;
    }
    if (t.t === "ident" && t.v === "try") {
      st.pos++;
      expect("{");
      const outer = current;
      newScope(false);
      parseStatementList();
      expect("}");
      popScope(outer);
      let hadCatch = false;
      let hadFinally = false;
      while (peek() && peek().t === "ident" && (peek().v === "catch" || peek().v === "finally")) {
        if (peek().v === "catch") {
          hadCatch = true;
          st.pos++;
          const cOuter = current;
          newScope(false);
          if (peek() && peek().t === "punct" && peek().v === "(") {
            st.pos++;
            const p = peek();
            if (p.t === "punct" && p.v === "{") parseObjectPattern("catch");
            else if (p.t === "punct" && p.v === "[") parseArrayPattern("catch");
            else if (p.t === "ident") {
              declareBinding(p.v, "catch", st.pos, {});
              st.pos++;
            } else bail("bad catch param");
            expect(")");
          }
          expect("{");
          parseStatementList();
          expect("}");
          popScope(cOuter);
        } else {
          hadFinally = true;
          st.pos++;
          expect("{");
          const fOuter = current;
          newScope(false);
          parseStatementList();
          expect("}");
          popScope(fOuter);
        }
      }
      if (!hadCatch && !hadFinally) bail("try without catch");
      return;
    }
    if (t.t === "ident" && t.v === "switch") {
      st.pos++;
      expect("(");
      parseCommaSeq(")", {});
      expect("{");
      const outer = current;
      newScope(false);
      while (st.pos < tokens.length) {
        const c = peek();
        if (c.t === "punct" && c.v === "}") {
          st.pos++;
          break;
        }
        if (c.t === "ident" && c.v === "case") {
          st.pos++;
          parseExpression({ stops: new Set(), colonStops: true, stopIdents: new Set() });
          expect(":");
          continue;
        }
        if (c.t === "ident" && c.v === "default") {
          st.pos++;
          expect(":");
          continue;
        }
        parseStatement();
      }
      popScope(outer);
      return;
    }
    if (t.t === "ident" && (t.v === "return" || t.v === "throw")) {
      st.pos++;
      if (!atStatementEnd()) parseExpression({ stops: new Set([";"]), colonStops: false, stopIdents: new Set() });
      if (peek() && peek().t === "punct" && peek().v === ";") st.pos++;
      return;
    }
"use strict";
// Part 2 of scripts/mangle.js (concatenated at build time; not used directly).
// Continues parseStatement with break/continue, then declarations/patterns.

    if (t.t === "ident" && (t.v === "break" || t.v === "continue")) {
      st.pos++;
      if (peek() && peek().t === "ident" && !KEYWORDS.has(peek().v)) {
        labelNames.add(peek().v);
        skip.add(st.pos);
        st.pos++;
      }
      if (peek() && peek().t === "punct" && peek().v === ";") st.pos++;
      return;
    }
    if (t.t === "ident" && t.v === "debugger") {
      st.pos++;
      if (peek() && peek().t === "punct" && peek().v === ";") st.pos++;
      return;
    }
    if (t.t === "ident" && !KEYWORDS.has(t.v) && peek(1) && peek(1).t === "punct" && peek(1).v === ":") {
      labelNames.add(t.v);
      skip.add(st.pos);
      st.pos += 2;
      parseStatement();
      return;
    }
    if (t.t === "ident" && (t.v === "else" || t.v === "catch" || t.v === "finally" || t.v === "case" || t.v === "default")) {
      bail("stray " + t.v);
    }
    parseExpression({ stops: new Set([";"]), colonStops: false, stopIdents: new Set() });
    if (peek() && peek().t === "punct" && peek().v === ";") st.pos++;
  }

  function parseDeclaration(kind, forHead) {
    st.pos++;
    for (;;) {
      const t = peek();
      if (!t) bail("truncated declaration");
      if (t.t === "punct" && (t.v === "{" || t.v === "[")) {
        if (t.v === "{") parseObjectPattern(kind);
        else parseArrayPattern(kind);
        if (peek() && peek().t === "punct" && peek().v === "=") {
          st.pos++;
          parseExpression(forHead
            ? { stops: new Set([",", ";"]), colonStops: false, stopIdents: new Set(["in", "of"]) }
            : { stops: new Set([",", ";"]), colonStops: false, stopIdents: new Set() });
        }
      } else if (t.t === "ident" && !KEYWORDS.has(t.v)) {
        const idx = st.pos;
        st.pos++;
        let anonInit = false;
        if (peek() && peek().t === "punct" && peek().v === "=") {
          st.pos++;
          anonInit = isAnonInit(st.pos);
          parseExpression(forHead
            ? { stops: new Set([",", ";"]), colonStops: false, stopIdents: new Set(["in", "of"]) }
            : { stops: new Set([",", ";"]), colonStops: false, stopIdents: new Set() });
        }
        declareBinding(t.v, kind, idx, { anonInit });
      } else {
        bail("bad declarator");
      }
      const s = peek();
      if (s && s.t === "punct" && s.v === ",") {
        st.pos++;
        continue;
      }
      if (forHead) return;
      if (s && s.t === "punct" && s.v === ";") {
        st.pos++;
        return;
      }
      bail("bad declaration end");
    }
  }

  // Parse one binding target inside a pattern (after { key: or [ ...).
  function parsePatternTarget(kind, allowShorthand) {
    const t = peek();
    if (!t) bail("truncated pattern");
    if (t.t === "punct" && t.v === "{") {
      parseObjectPattern(kind);
      return;
    }
    if (t.t === "punct" && t.v === "[") {
      parseArrayPattern(kind);
      return;
    }
    if (t.t === "ident" && !KEYWORDS.has(t.v)) {
      const idx = st.pos;
      st.pos++;
      if (peek() && peek().t === "punct" && peek().v === "=") {
        st.pos++;
        parseExpression({ stops: new Set([",", ";", ")", "]", "}"]), colonStops: false, stopIdents: new Set() });
      }
      declareBinding(t.v, kind, idx, { shorthand: allowShorthand });
      return;
    }
    bail("bad pattern target");
  }

  function parseObjectPattern(kind) {
    expect("{");
    for (;;) {
      const t = peek();
      if (!t) bail("truncated object pattern");
      if (t.t === "punct" && t.v === "}") {
        st.pos++;
        return;
      }
      if (t.t === "punct" && t.v === "." && peek(1) && peek(1).v === "." && peek(2) && peek(2).v === ".") {
        st.pos += 3;
        parsePatternTarget(kind, false);
      } else if (t.t === "punct" && t.v === "[") {
        st.pos++;
        parseExpression({ stops: new Set(["]"]), colonStops: false, stopIdents: new Set() });
        expect("]");
        expect(":");
        parsePatternTarget(kind, false);
      } else if (t.t === "raw") {
        st.pos++;
        expect(":");
        parsePatternTarget(kind, false);
      } else if (t.t === "ident" && !KEYWORDS.has(t.v)) {
        const after = peek(1);
        if (after && after.t === "punct" && after.v === ":") {
          st.pos += 2;
          parsePatternTarget(kind, false);
        } else if (after && after.t === "punct" && (after.v === "," || after.v === "}" || after.v === "=")) {
          const idx = st.pos;
          st.pos++;
          let anonInit = false;
          if (peek() && peek().t === "punct" && peek().v === "=") {
            st.pos++;
            anonInit = isAnonInit(st.pos);
            parseExpression({ stops: new Set([",", "}"]), colonStops: false, stopIdents: new Set() });
          }
          declareBinding(t.v, kind, idx, { shorthand: true, kept: kind === "forlet", anonInit });
        } else {
          bail("bad object pattern member");
        }
      } else if (t.t === "ident" && KEYWORDS.has(t.v) && peek(1) && peek(1).t === "punct" && peek(1).v === ":") {
        st.pos += 2;
        parsePatternTarget(kind, false);
      } else {
        bail("bad object pattern");
      }
      if (peek() && peek().t === "punct" && peek().v === ",") st.pos++;
    }
  }

  function parseArrayPattern(kind) {
    expect("[");
    for (;;) {
      const t = peek();
      if (!t) bail("truncated array pattern");
      if (t.t === "punct" && t.v === "]") {
        st.pos++;
        return;
      }
      if (t.t === "punct" && t.v === ",") {
        st.pos++;
        continue;
      }
      if (t.t === "punct" && t.v === "." && peek(1) && peek(1).v === "." && peek(2) && peek(2).v === ".") {
        st.pos += 3;
        parsePatternTarget(kind, false);
      } else {
        parsePatternTarget(kind, false);
        if (peek() && peek().t === "punct" && peek().v === "=") {
          st.pos++;
          parseExpression({ stops: new Set([",", "]"]), colonStops: false, stopIdents: new Set() });
        }
      }
      if (peek() && peek().t === "punct" && peek().v === ",") st.pos++;
    }
  }

  function parseFunction(isDecl) {
    if (peek() && peek().t === "ident" && peek().v === "async") st.pos++;
    if (!peek() || peek().t !== "ident" || peek().v !== "function") bail("bad function");
    st.pos++;
    if (peek() && peek().t === "punct" && peek().v === "*") st.pos++;
    let name = null;
    let nameIdx = -1;
    if (peek() && peek().t === "ident" && !KEYWORDS.has(peek().v)) {
      name = peek().v;
      nameIdx = st.pos;
      st.pos++;
    } else if (isDecl) {
      bail("anonymous function declaration");
    }
    const enclosing = current;
    const fnScope = newScope(true);
    if (name !== null) {
      declAt.set(nameIdx, { binding: null, shorthand: false });
      if (isDecl) {
        current = enclosing;
        const b = declareBinding(name, "function", nameIdx, {});
        declAt.set(nameIdx, { binding: b, shorthand: false });
        current = fnScope;
      } else {
        const b = declareBinding(name, "function", nameIdx, {});
        declAt.set(nameIdx, { binding: b, shorthand: false });
      }
    }
    expect("(");
    parseParams();
    expect("{");
    current = fnScope;
    newScope(false);
    parseStatementList();
    expect("}");
    popScope(enclosing);
  }

  function parseParams() {
    const fnScope = current;
    for (;;) {
      const t = peek();
      if (!t) bail("truncated params");
      if (t.t === "punct" && t.v === ")") {
        st.pos++;
        return;
      }
      if (t.t === "punct" && t.v === ",") {
        st.pos++;
        continue;
      }
      if (t.t === "punct" && t.v === "." && peek(1) && peek(1).v === "." && peek(2) && peek(2).v === ".") {
        st.pos += 3;
        parsePatternTarget("param", false);
        continue;
      }
      if (t.t === "punct" && (t.v === "{" || t.v === "[")) {
        if (t.v === "{") parseObjectPattern("param");
        else parseArrayPattern("param");
        if (peek() && peek().t === "punct" && peek().v === "=") {
          st.pos++;
          parseExpression({ stops: new Set([",", ")"]), colonStops: false, stopIdents: new Set() });
        }
        continue;
      }
      if (t.t === "ident" && !KEYWORDS.has(t.v)) {
        const idx = st.pos;
        st.pos++;
        let anonInit = false;
        if (peek() && peek().t === "punct" && peek().v === "=") {
          st.pos++;
          anonInit = isAnonInit(st.pos);
          parseExpression({ stops: new Set([",", ")"]), colonStops: false, stopIdents: new Set() });
        }
        current = fnScope;
        declareBinding(t.v, "param", idx, { anonInit });
        continue;
      }
      bail("bad param");
    }
  }
"use strict";
// Part 3 of scripts/mangle.js (concatenated at build time; not used directly).
// Classes, for loops, expressions, resolution, emit, driver.

  function skipModifiers() {
    for (;;) {
      const t = peek();
      const a = peek(1);
      if (!t || t.t !== "ident") return;
      if (t.v === "static" || t.v === "async") {
        if (a && ((a.t === "ident" && !KEYWORDS.has(a.v)) || (a.t === "punct" && (a.v === "(" || a.v === "[" || a.v === "*" || a.v === "{" || a.v === ".")))) {
          skip.add(st.pos);
          st.pos++;
          continue;
        }
        return;
      }
      if (t.v === "get" || t.v === "set") {
        if (a && a.t === "punct" && a.v === "(") return;
        if (a && ((a.t === "ident" && !KEYWORDS.has(a.v)) || a.t === "raw" || (a.t === "punct" && a.v === "["))) {
          skip.add(st.pos);
          st.pos++;
          continue;
        }
        return;
      }
      return;
    }
  }

  function parseClass(isDecl) {
    st.pos++;
    let nameIdx = -1;
    let name = null;
    if (peek() && peek().t === "ident" && !KEYWORDS.has(peek().v)) {
      name = peek().v;
      nameIdx = st.pos;
      st.pos++;
    } else if (isDecl) {
      bail("anonymous class declaration");
    }
    const enclosing = current;
    const classScope = newScope(false);
    if (name !== null) {
      if (isDecl) {
        current = enclosing;
        const b = declareBinding(name, "class", nameIdx, {});
        declAt.set(nameIdx, { binding: b, shorthand: false });
        current = classScope;
      } else {
        const b = declareBinding(name, "class", nameIdx, {});
        declAt.set(nameIdx, { binding: b, shorthand: false });
      }
    }
    if (peek() && peek().t === "ident" && peek().v === "extends") {
      st.pos++;
      parseExpression({ stops: new Set(["{"]), colonStops: false, stopIdents: new Set() });
    }
    expect("{");
    while (st.pos < tokens.length) {
      const t = peek();
      if (t.t === "punct" && t.v === "}") {
        st.pos++;
        break;
      }
      if (t.t === "punct" && t.v === ";") {
        st.pos++;
        continue;
      }
      if (t.t === "punct" && t.v === "@") bail("decorators not supported");
      skipModifiers();
      const m = peek();
      if (!m) bail("truncated class body");
      if (m.t === "punct" && m.v === "{") {
        st.pos++;
        const bOuter = current;
        newScope(false);
        parseStatementList();
        expect("}");
        popScope(bOuter);
        continue;
      }
      if (m.t === "punct" && m.v === "#") {
        skip.add(st.pos);
        st.pos++;
        if (peek() && peek().t === "ident") {
          skip.add(st.pos);
          st.pos++;
        } else bail("bad private name");
      } else if (m.t === "punct" && m.v === "[") {
        st.pos++;
        parseExpression({ stops: new Set(["]"]), colonStops: false, stopIdents: new Set() });
        expect("]");
      } else if (m.t === "raw") {
        st.pos++;
      } else if (m.t === "ident") {
        skip.add(st.pos);
        st.pos++;
      } else if (m.t === "punct" && m.v === "*") {
        skip.add(st.pos);
        st.pos++;
        continue;
      } else {
        bail("bad class member");
      }
      const after = peek();
      if (after && after.t === "punct" && after.v === "(") {
        st.pos++;
        const fnScope = newScope(true);
        parseParams();
        current = fnScope;
        newScope(false);
        expect("{");
        parseStatementList();
        expect("}");
        popScope(classScope);
      } else if (after && after.t === "punct" && after.v === "=") {
        st.pos++;
        parseExpression({ stops: new Set([";", "}"]), colonStops: false, stopIdents: new Set() });
        if (peek() && peek().t === "punct" && peek().v === ";") st.pos++;
      } else if (after && (after.t === "punct" && (after.v === ";" || after.v === "}"))) {
        if (after.v === ";") st.pos++;
      } else {
        bail("bad class member end");
      }
    }
    popScope(enclosing);
  }

  function parseFor() {
    st.pos++;
    if (peek() && peek().t === "ident" && peek().v === "await") st.pos++;
    expect("(");
    const enclosing = current;
    const forScope = newScope(false);
    const t = peek();
    if (t && t.t === "ident" && (t.v === "let" || t.v === "const" || t.v === "var")) {
      parseDeclaration(t.v, true);
    } else if (!(t && t.t === "punct" && t.v === ";")) {
      parseExpression({ stops: new Set([";", ")"]), colonStops: false, stopIdents: new Set(["in", "of"]) });
    }
    const h = peek();
    if (h && h.t === "ident" && (h.v === "in" || h.v === "of")) {
      st.pos++;
      parseExpression({ stops: new Set([")"]), colonStops: false, stopIdents: new Set() });
      expect(")");
      parseStatement();
      popScope(enclosing);
      return;
    }
    expect(";");
    if (!(peek() && peek().t === "punct" && peek().v === ";")) {
      parseExpression({ stops: new Set([";"]), colonStops: false, stopIdents: new Set() });
    }
    expect(";");
    if (!(peek() && peek().t === "punct" && peek().v === ")")) {
      parseExpression({ stops: new Set([")"]), colonStops: false, stopIdents: new Set() });
    }
    expect(")");
    parseStatement();
    popScope(enclosing);
  }

  function parseExpression(opts) {
    const stops = opts.stops;
    const stopIdents = opts.stopIdents;
    let qdepth = 0;
    for (;;) {
      const t = peek();
      if (!t) return;
      if (t.t === "punct") {
        if (stops.has(t.v)) return;
        if (t.v === ")" || t.v === "]" || t.v === "}") return;
        if (t.v === "${") {
          st.pos++;
          parseExpression({ stops: new Set(["}"]), colonStops: false, stopIdents: new Set() });
          expect("}");
          continue;
        }
        if (t.v === "(") {
          parseArgGroupOrArrow();
          continue;
        }
        if (t.v === "[") {
          const p = prevTok();
          const memberPos = p && (p.t === "ident" || (p.t === "punct" && (p.v === ")" || p.v === "]")) || p.t === "raw");
          st.pos++;
          parseCommaSeq("]", {});
          if (!memberPos) {
            void 0;
          }
          continue;
        }
        if (t.v === "{") {
          parseObjectLiteral();
          continue;
        }
        if (t.v === "?") qdepth++;
        if (t.v === ":") {
          if (opts.colonStops && qdepth === 0) return;
          if (qdepth > 0) qdepth--;
        }
        st.pos++;
        continue;
      }
      if (t.t === "ident") {
        if (stopIdents.has(t.v)) return;
        if (KEYWORDS.has(t.v)) {
          if (t.v === "function") {
            parseFunction(false);
            continue;
          }
          if (t.v === "class") {
            parseClass(false);
            continue;
          }
          if (t.v === "const" || t.v === "let" || t.v === "var" || t.v === "with" || t.v === "import" || t.v === "export") {
            bail(t.v + " in expression");
          }
          st.pos++;
          continue;
        }
        const p = prevTok();
        if (p && p.t === "punct" && p.v === "." && !(prevTok(2) && prevTok(2).t === "punct" && prevTok(2).v === ".")) {
          skip.add(st.pos);
          st.pos++;
          continue;
        }
        if (p && p.t === "punct" && p.v === "#") {
          skip.add(st.pos);
          st.pos++;
          continue;
        }
        const nx = peek(1);
        if (nx && nx.t === "punct" && nx.v === "=>") {
          const idx = st.pos;
          st.pos += 2;
          const enclosing = current;
          const arrowScope = newScope(true);
          declareBinding(t.v, "param", idx, {});
          parseArrowBody();
          popScope(enclosing);
          void arrowScope;
          continue;
        }
        recordUse(st.pos, false);
        st.pos++;
        continue;
      }
      st.pos++;
    }
  }

  function parseCommaSeq(closer, extraStops) {
    for (;;) {
      const t = peek();
      if (!t) bail("truncated group");
      if (t.t === "punct" && t.v === closer) {
        st.pos++;
        return;
      }
      if (t.t === "punct" && t.v === "," && closer !== ",") {
        st.pos++;
        continue;
      }
      const stops = new Set([",", closer]);
      if (extraStops && extraStops.has) {
        extraStops.forEach((s) => stops.add(s));
      }
      parseExpression({ stops, colonStops: false, stopIdents: new Set() });
    }
  }

  function parseArgGroupOrArrow() {
    const l = st.pos;
    const m = findMatch(l, "(", ")");
    const after = tokens[m + 1];
    if (after && after.t === "punct" && after.v === "=>") {
      const enclosing = current;
      const arrowScope = newScope(true);
      const before = tokens[l - 1];
      const before2 = tokens[l - 2];
      if (before && before.t === "ident" && before.v === "async" && (!before2 || (before2.t === "punct" && before2.v !== ")" && before2.v !== "]" && before2.t !== "ident" && before2.t !== "raw"))) {
        skip.add(l - 1);
      }
      st.pos = l + 1;
      parseArrowParams(m);
      parseArrowBody();
      popScope(enclosing);
      void arrowScope;
      return;
    }
    st.pos = l + 1;
    parseCommaSeq(")", {});
  }

  function parseArrowParams(matchR) {
    const fnScope = current;
    for (;;) {
      const t = peek();
      if (!t) bail("truncated arrow params");
      if (t.t === "punct" && t.v === ")") {
        if (st.pos !== matchR) bail("arrow param mismatch");
        st.pos += 2;
        return;
      }
      if (t.t === "punct" && t.v === ",") {
        st.pos++;
        continue;
      }
      if (t.t === "punct" && t.v === "." && peek(1) && peek(1).v === "." && peek(2) && peek(2).v === ".") {
        st.pos += 3;
        parsePatternTarget("param", false);
        continue;
      }
      if (t.t === "punct" && (t.v === "{" || t.v === "[")) {
        if (t.v === "{") parseObjectPattern("param");
        else parseArrayPattern("param");
        if (peek() && peek().t === "punct" && peek().v === "=") {
          st.pos++;
          parseExpression({ stops: new Set([",", ")"]), colonStops: false, stopIdents: new Set() });
        }
        continue;
      }
      if (t.t === "ident" && !KEYWORDS.has(t.v)) {
        const idx = st.pos;
        st.pos++;
        let anonInit = false;
        if (peek() && peek().t === "punct" && peek().v === "=") {
          st.pos++;
          anonInit = isAnonInit(st.pos);
          parseExpression({ stops: new Set([",", ")"]), colonStops: false, stopIdents: new Set() });
        }
        current = fnScope;
        declareBinding(t.v, "param", idx, { anonInit });
        continue;
      }
      bail("bad arrow param");
    }
  }

  function parseArrowBody() {
    const arrowScope = current;
    const enclosing = scopes[arrowScope].parent;
    const t = peek();
    if (t && t.t === "punct" && t.v === "{") {
      st.pos++;
      newScope(false);
      parseStatementList();
      expect("}");
      popScope(enclosing);
      return;
    }
    parseExpression({ stops: new Set([",", ";"]), colonStops: false, stopIdents: new Set() });
    popScope(enclosing);
  }

  // True when the async/get/set ident at index idx modifies the member that
  // follows it (async method, getter, setter) rather than naming the member.
  function isMemberModifier(idx) {
    const kw = tokens[idx].v;
    const aft = tokens[idx + 1];
    if (!aft) return false;
    if (kw === "async") {
      if (aft.t === "punct" && (aft.v === "*" || aft.v === "[")) return true;
      if (aft.t === "punct" && aft.v === "(") return false;
      if (aft.t === "ident" && !KEYWORDS.has(aft.v)) {
        const aft2 = tokens[idx + 2];
        return !!(aft2 && aft2.t === "punct" && (aft2.v === "(" || aft2.v === "["));
      }
      return false;
    }
    if (kw === "get" || kw === "set") {
      if (aft.t === "punct" && aft.v === "(") return false;
      if (aft.t === "ident" && !KEYWORDS.has(aft.v)) return true;
      if (aft.t === "raw") return true;
      if (aft.t === "punct" && aft.v === "[") return true;
      return false;
    }
    return false;
  }

  function parseObjectLiteral() {
    expect("{");
    for (;;) {
      const t = peek();
      if (!t) bail("truncated object");
      if (t.t === "punct" && t.v === "}") {
        st.pos++;
        return;
      }
      if (t.t === "punct" && t.v === "." && peek(1) && peek(1).v === "." && peek(2) && peek(2).v === ".") {
        st.pos += 3;
        parseExpression({ stops: new Set([",", "}"]), colonStops: false, stopIdents: new Set() });
      } else if (t.t === "punct" && t.v === "[") {
        st.pos++;
        parseExpression({ stops: new Set(["]"]), colonStops: false, stopIdents: new Set() });
        expect("]");
        const after = peek();
        if (after && after.t === "punct" && after.v === ":") {
          st.pos++;
          parseExpression({ stops: new Set([",", "}"]), colonStops: false, stopIdents: new Set() });
        } else if (after && after.t === "punct" && after.v === "(") {
          st.pos++;
          const saved = current;
          const fnScope = newScope(true);
          parseParams();
          current = fnScope;
          newScope(false);
          expect("{");
          parseStatementList();
          expect("}");
          popScope(saved);
        } else {
          bail("bad computed member");
        }
      } else if (t.t === "raw") {
        st.pos++;
        expect(":");
        parseExpression({ stops: new Set([",", "}"]), colonStops: false, stopIdents: new Set() });
      } else if (t.t === "punct" && t.v === "*") {
        st.pos++;
        const m = peek();
        if (m && m.t === "ident" && !KEYWORDS.has(m.v)) {
          skip.add(st.pos);
          st.pos++;
        } else if (m && m.t === "punct" && m.v === "[") {
          st.pos++;
          parseExpression({ stops: new Set(["]"]), colonStops: false, stopIdents: new Set() });
          expect("]");
        } else {
          bail("bad generator member");
        }
        expect("(");
        const saved = current;
        const fnScope = newScope(true);
        parseParams();
        current = fnScope;
        newScope(false);
        expect("{");
        parseStatementList();
        expect("}");
        popScope(saved);
      } else if (t.t === "ident" && (!KEYWORDS.has(t.v) || t.v === "async" || t.v === "get" || t.v === "set" || t.v === "static")) {
        const after = peek(1);
        if ((t.v === "async" || t.v === "get" || t.v === "set") && isMemberModifier(st.pos)) {
          skip.add(st.pos);
          st.pos++;
          continue;
        }
        if (after && after.t === "punct" && after.v === ":") {
          skip.add(st.pos);
          st.pos += 2;
          parseExpression({ stops: new Set([",", "}"]), colonStops: false, stopIdents: new Set() });
        } else if (after && after.t === "punct" && after.v === "(") {
          skip.add(st.pos);
          st.pos++;
          expect("(");
          const saved = current;
          const fnScope = newScope(true);
          parseParams();
          current = fnScope;
          newScope(false);
          expect("{");
          parseStatementList();
          expect("}");
          popScope(saved);
        } else if (after && after.t === "punct" && (after.v === "," || after.v === "}")) {
          const idx = st.pos;
          st.pos++;
          useAt.set(idx, { scope: current, binding: null, shorthand: true });
        } else {
          bail("bad object member");
        }
      } else if (t.t === "ident" && KEYWORDS.has(t.v)) {
        const after = peek(1);
        if (after && after.t === "punct" && after.v === ":") {
          skip.add(st.pos);
          st.pos += 2;
          parseExpression({ stops: new Set([",", "}"]), colonStops: false, stopIdents: new Set() });
        } else if (after && after.t === "punct" && after.v === "(") {
          skip.add(st.pos);
          st.pos++;
          expect("(");
          const saved = current;
          const fnScope = newScope(true);
          parseParams();
          current = fnScope;
          newScope(false);
          expect("{");
          parseStatementList();
          expect("}");
          popScope(saved);
        } else {
          bail("bad object literal");
        }
      } else {
        bail("bad object literal");
      }
      if (peek() && peek().t === "punct" && peek().v === ",") st.pos++;
    }
  }

  function finishAnalyze() {
    for (const [idx, rec] of useAt) {
      const tok = tokens[idx];
      if (!tok || tok.t !== "ident") continue;
      let s = rec.scope;
      let found = null;
      while (s >= 0) {
        const b = scopes[s].bindings.get(tok.v);
        if (b) {
          found = b;
          break;
        }
        s = scopes[s].parent;
      }
      rec.binding = found;
    }
    // Only names that survive in the output can collide with a new name:
    // declared names (kept ones keep their text), uses that resolve to no
    // binding (globals keep their text) and labels. Property and key text
    // lives in its own namespace, so it never blocks a short name.
    const taken = new Set();
    for (const scope of scopes) {
      for (const binding of scope.bindings.values()) taken.add(binding.name);
    }
    for (const [idx, rec] of useAt) {
      if (!rec.binding && tokens[idx] && tokens[idx].t === "ident") taken.add(tokens[idx].v);
    }
    for (const name of labelNames) taken.add(name);
    const pool = [];
    const singles = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_";
    for (const c of singles) pool.push(c);
    outer: for (let a = 0; a < singles.length; a++) {
      for (let b = 0; b < singles.length; b++) {
        pool.push(singles[a] + singles[b]);
      }
    }
    outer2: for (let a = 0; a < singles.length; a++) {
      for (let b = 0; b < singles.length; b++) {
        for (let c = 0; c < singles.length; c++) {
          pool.push(singles[a] + singles[b] + singles[c]);
          if (pool.length > 300000) break outer2;
        }
      }
    }
    let next = 0;
    const draw = () => {
      for (;;) {
        if (next >= pool.length) bail("name pool exhausted");
        const name = pool[next];
        next++;
        if (taken.has(name)) continue;
        if (KEYWORDS.has(name) || name === "eval") continue;
        taken.add(name);
        return name;
      }
    };
    let renamed = 0;
    for (const scope of scopes) {
      for (const binding of scope.bindings.values()) {
        if (binding.kept) continue;
        if (labelNames.has(binding.name)) continue;
        binding.newName = draw();
        renamed++;
      }
    }
    return { renamed, scopes: scopes.length };
  }

  function emit() {
    let out = "";
    const byIndex = declAt;
    const useByIndex = useAt;
    for (let k = 0; k < tokens.length; k++) {
      const tok = tokens[k];
      if (tok.gapNewline) out += "\n";
      else if (tok.gapSpace) out += " ";
      if (tok.t !== "ident" || KEYWORDS.has(tok.v)) {
        out += tok.v;
        continue;
      }
      if (skip.has(k)) {
        out += tok.v;
        continue;
      }
      const d = byIndex.get(k);
      if (d && d.binding) {
        if (d.binding.newName) {
          out += d.shorthand ? tok.v + ":" + d.binding.newName : d.binding.newName;
        } else {
          out += tok.v;
        }
        continue;
      }
      const u = useByIndex.get(k);
      if (u && u.binding && u.binding.newName) {
        out += u.shorthand ? tok.v + ":" + u.binding.newName : u.binding.newName;
        continue;
      }
      out += tok.v;
    }
    return out;
  }

  parseProgram();
  const stats = finishAnalyze();
  return { code: emit(), stats };
}
"use strict";

function mangleModule(source) {
  const head = source.slice(0, 32);
  const strict = head.indexOf('"use strict";') !== -1 || head.indexOf("'use strict';") !== -1;
  if (!strict) return { code: source, bailed: "not strict", stats: null };
  let tokens;
  try {
    tokens = tokenize(source);
  } catch (err) {
    return { code: source, bailed: "tokenize error", stats: null };
  }
  for (const tok of tokens) {
    if (tok.t === "ident" && tok.v === "with") return { code: source, bailed: "with statement", stats: null };
  }
  try {
    const result = analyze(tokens);
    return { code: result.code, bailed: null, stats: result.stats };
  } catch (err) {
    if (err && err.bail) return { code: source, bailed: err.bail, stats: null };
    throw err;
  }
}

module.exports = { tokenize, mangleModule };

if (require.main === module) {
  const fs = require("fs");
  const { minify } = require("./minify.js");
  const target = process.argv[2];
  if (!target) {
    console.log("usage: node scripts/mangle.js <file.js>");
    process.exit(1);
  }
  const src = fs.readFileSync(target, "utf8");
  const min = minify(src);
  const out = mangleModule(min);
  console.log("file: " + target);
  console.log("original: " + src.length);
  console.log("minified: " + min.length);
  console.log("mangled:  " + out.code.length + (out.bailed ? " (bailed: " + out.bailed + ")" : ""));
  if (out.stats) console.log("renamed bindings: " + out.stats.renamed + " in " + out.stats.scopes + " scopes");
}
