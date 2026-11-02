"use strict";
/*
 * A deliberately small expression parser for the Reference plotter.
 *
 * It never calls eval() or Function: a short recursive-descent parser turns a
 * text expression into a numeric function. Only the names below are allowed, so
 * a pasted expression cannot reach the app, the vault or the network.
 *
 * A graph holds several rows, like a Desmos expression list. A row can be
 *   - an expression in x                   `sin(x)` (drawn as y = sin(x))
 *   - an explicit equation                 `y = sin(x)`
 *   - a definition reused by later rows    `f(x) = x^2`
 *   - an implicit relation in x and y      `y^2 = 2x + 1`, `x^2 + y^2 = 9`
 *   - a regression fitted to the data      `y ~ m x + b`
 *   - a parameter with a slider            `a = 2`
 *   - an inequality shading a region       `y < 2x + 1`, `x^2 + y^2 <= 9`
 *   - a domain/range restriction           `y = x^2 {0 < x < 3}`, `{y > 0}`
 *   - a piecewise value                    `y = {x < 0: -x, x >= 0: x}`
 *   - a polar curve in r and theta         `r = 1 + cos(theta)`
 * Explicit rows are sampled; implicit rows are traced with marching squares;
 * inequalities shade a coarse cell grid and draw their boundary;
 * regression rows are fitted to the x/y table with a local least-squares
 * solver, so no calculator service or third-party code is involved.
 */

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
};

const CONSTANTS = { pi: Math.PI, e: Math.E };
const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const IDENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

function isKnownFunction(name, extraNames) {
  if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) return true;
  if (!extraNames) return false;
  if (Array.isArray(extraNames)) return extraNames.indexOf(name) >= 0;
  return Object.prototype.hasOwnProperty.call(extraNames, name);
}

function tokenize(text, functionNames) {
  const src = String(text || "");
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if (raw === "." || (raw.match(/\./g) || []).length > 1) throw new Error(`Bad number "${raw}".`);
      out.push({ type: "number", value: Number(raw) });
      i = j;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let j = i + 1;
      while (j < src.length && IDENT_PART.test(src[j])) j++;
      out.push({ type: "ident", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === "<" || ch === ">") {
      if (src[i + 1] === "=") {
        out.push({ type: ch + "=" });
        i += 2;
      } else {
        out.push({ type: ch });
        i++;
      }
      continue;
    }
    if ("+-*/^(),~{}:=≤≥".includes(ch)) {
      out.push({ type: ch });
      i++;
      continue;
    }
    throw new Error(`Unsupported character "${ch}".`);
  }
  return insertImplicitMultiplication(out, functionNames);
}

function insertImplicitMultiplication(tokens, functionNames) {
  const out = [];
  const endsValue = (t) => t && (t.type === "number" || t.type === "ident" || t.type === ")");
  const startsValue = (t) => t && (t.type === "number" || t.type === "ident" || t.type === "(");
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prev = out[out.length - 1];
    if (endsValue(prev) && startsValue(token)) {
      // `sin(x)` and `f(x)` are calls, not multiplication by a bracketed term.
      if (!(prev.type === "ident" && token.type === "(" && isKnownFunction(prev.value, functionNames))) out.push({ type: "*" });
    }
    out.push(token);
  }
  return out;
}

/**
 * Compile an expression into a function of a variable scope.
 * `scopeNames` are the names read from the scope object (for example x, or x and y);
 * `environment` maps extra names to numbers or to user-defined functions.
 */
function compileScoped(text, scopeNames, environment, mode) {
  const scope = Array.isArray(scopeNames) ? scopeNames : [];
  const env = environment || {};
  const functionNames = Object.keys(env).filter((name) => env[name] && typeof env[name] === "object");
  const tokens = tokenize(text, functionNames);
  let at = 0;
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const peek = () => tokens[at];
  const take = (type) => {
    const token = tokens[at];
    if (!token || token.type !== type) throw new Error(`Expected ${type === ")" ? "a closing parenthesis" : type}.`);
    at++;
    return token;
  };

  function expression() {
    let left = term();
    while (peek() && (peek().type === "+" || peek().type === "-")) {
      const op = tokens[at++].type;
      const right = term();
      const a = left;
      left = op === "+" ? (vals) => a(vals) + right(vals) : (vals) => a(vals) - right(vals);
    }
    return left;
  }

  function term() {
    let left = unary();
    while (peek() && (peek().type === "*" || peek().type === "/")) {
      const op = tokens[at++].type;
      const right = unary();
      const a = left;
      left = op === "*" ? (vals) => a(vals) * right(vals) : (vals) => a(vals) / right(vals);
    }
    return left;
  }

  function unary() {
    if (peek() && (peek().type === "+" || peek().type === "-")) {
      const op = tokens[at++].type;
      const inner = unary();
      return op === "-" ? (vals) => -inner(vals) : inner;
    }
    return power();
  }

  function power() {
    const left = primary();
    if (peek() && peek().type === "^") {
      at++;
      const right = unary();
      return (vals) => Math.pow(left(vals), right(vals));
    }
    return left;
  }

  function argumentList() {
    take("(");
    const args = [];
    if (peek() && peek().type !== ")") {
      args.push(expression());
      while (peek() && peek().type === ",") {
        at++;
        args.push(expression());
      }
    }
    take(")");
    return args;
  }

  const COMPARISONS = ["<", ">", "<=", ">=", "≤", "≥", "="];

  function compareTest(op) {
    if (op === "<") return (a, b) => a < b;
    if (op === ">") return (a, b) => a > b;
    if (op === "<=" || op === "≤") return (a, b) => a <= b;
    if (op === ">=" || op === "≥") return (a, b) => a >= b;
    return (a, b) => Math.abs(a - b) <= 1e-9;
  }

  /** One comparison or a chain such as `0 < x < 3`. */
  function comparison() {
    let left = expression();
    let test = null;
    while (peek() && COMPARISONS.indexOf(peek().type) >= 0) {
      const op = tokens[at++].type;
      const previous = left;
      const right = expression();
      const check = compareTest(op);
      const prior = test;
      test = prior
        ? (vals) => prior(vals) && check(previous(vals), right(vals))
        : (vals) => check(previous(vals), right(vals));
      left = right;
    }
    if (!test) throw new Error("Expected a comparison such as x > 0.");
    return test;
  }

  /** Comparisons joined with `and` / `or`. */
  function condition() {
    let test = comparison();
    while (peek() && peek().type === "ident" && /^(and|or)$/i.test(peek().value)) {
      const op = tokens[at++].value.toLowerCase();
      const left = test;
      const right = comparison();
      test = op === "and" ? (vals) => left(vals) && right(vals) : (vals) => left(vals) || right(vals);
    }
    return test;
  }

  /** True when the tokens ahead are `condition: value` rather than a default value. */
  function looksLikeCondition() {
    let paren = 0;
    let brace = 0;
    for (let i = at; i < tokens.length; i++) {
      const type = tokens[i].type;
      if (type === "(") paren++;
      else if (type === ")") paren--;
      else if (type === "{") brace++;
      else if (type === "}") {
        if (paren === 0 && brace === 0) return false;
        brace--;
      } else if (paren === 0 && brace === 0) {
        if (type === ":" || type === ",") return false;
        if (COMPARISONS.indexOf(type) >= 0) return true;
      }
    }
    return false;
  }

  /** `{x < 0: -x, x >= 0: x}` or a final default value. */
  function piecewise() {
    take("{");
    const cases = [];
    let fallback = null;
    while (peek() && peek().type !== "}") {
      if (looksLikeCondition()) {
        const test = condition();
        take(":");
        cases.push({ test, value: expression() });
      } else {
        fallback = expression();
      }
      if (peek() && peek().type === ",") {
        at++;
        continue;
      }
      break;
    }
    take("}");
    return (vals) => {
      for (const entry of cases) {
        if (entry.test(vals)) return entry.value(vals);
      }
      return fallback ? fallback(vals) : NaN;
    };
  }

  function primary() {
    const token = peek();
    if (!token) throw new Error("The expression is incomplete.");
    if (token.type === "number") {
      at++;
      const n = token.value;
      return () => n;
    }
    if (token.type === "ident") {
      at++;
      const name = token.value;
      if (scope.indexOf(name) >= 0) return (vals) => (vals ? vals[name] : NaN);
      if (has(CONSTANTS, name)) {
        const n = CONSTANTS[name];
        return () => n;
      }
      if (has(env, name)) {
        const entry = env[name];
        if (typeof entry === "number") return () => entry;
        if (entry && Array.isArray(entry.params) && typeof entry.fn === "function") {
          const args = argumentList();
          if (args.length !== entry.params.length) {
            throw new Error(`${name} takes ${entry.params.length} value${entry.params.length === 1 ? "" : "s"}.`);
          }
          return (vals) => entry.fn(args.map((arg) => arg(vals)));
        }
        throw new Error(`"${name}" is not a number.`);
      }
      if (has(FUNCTIONS, name)) {
        const args = argumentList();
        const fn = FUNCTIONS[name];
        if (args.length !== 1) throw new Error(`${name} takes one value.`);
        return (vals) => fn(args[0](vals));
      }
      const known = scope.concat(["pi", "e"]);
      throw new Error(`Unknown name "${name}". Use ${known.join(", ")} and the listed functions.`);
    }
    if (token.type === "{") return piecewise();
    if (token.type === "(") {
      at++;
      const inner = expression();
      take(")");
      return inner;
    }
    throw new Error(`Unexpected "${token.type}".`);
  }

  const fn = mode === "condition" ? condition() : expression();
  if (at !== tokens.length) throw new Error("Unexpected extra text after the expression.");
  return fn;
}

/** Compile `x > 0 and y < 1` into a `(scope) => boolean` predicate. */
function compileCondition(text, scopeNames, environment) {
  return compileScoped(text, scopeNames, environment, "condition");
}

/** Compile one expression in x into a plain `(x) => number` function. */
function compileExpression(text, bindings) {
  const env = bindings || {};
  const fn = compileScoped(text, ["x"], env);
  return (x) => fn({ x });
}

/** Compile `lhs = rhs` into a two-variable residual; the curve is where it is zero. */
function compileRelation(lhs, rhs, bindings) {
  const env = bindings || {};
  const left = compileScoped(lhs, ["x", "y"], env);
  const right = compileScoped(rhs, ["x", "y"], env);
  return (x, y) => left({ x, y }) - right({ x, y });
}

function identifiersOf(text) {
  return tokenize(text)
    .filter((token) => token.type === "ident")
    .map((token) => token.value);
}

function mentions(text, name) {
  return identifiersOf(text).indexOf(name) >= 0;
}

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "{") depth++;
    else if (ch === ")" || ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function splitTopLevelEquals(text) {
  return splitTopLevel(text, "=");
}

const COMPARISON_CHARS = "<>≤≥";

/** Split `lhs < rhs` (or <=, >, >=, ≤, ≥) at the first top-level comparison. */
function splitComparison(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "{") depth++;
    else if (ch === ")" || ch === "}") depth = Math.max(0, depth - 1);
    else if (depth === 0 && COMPARISON_CHARS.indexOf(ch) >= 0) {
      let op = ch;
      if ((ch === "<" || ch === ">") && text[i + 1] === "=") op += "=";
      return { lhs: text.slice(0, i).trim(), op, rhs: text.slice(i + op.length).trim() };
    }
  }
  return null;
}

const COMPARISON_IN_TEXT = /[<>≤≥=]/;

/**
 * Peel a trailing `{condition}` off a row. A brace group with a top-level
 * colon is a piecewise value, not a restriction, so it stays in the body.
 */
function splitRestriction(text) {
  const trimmed = String(text == null ? "" : text).trim();
  if (!trimmed.endsWith("}")) return { body: trimmed, condition: "" };
  let depth = 0;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const ch = trimmed[i];
    if (ch === "}") depth++;
    else if (ch === "{") {
      depth--;
      if (depth === 0) {
        const before = trimmed.slice(0, i).trim();
        const inside = trimmed.slice(i + 1, -1).trim();
        if (!before || !inside) return { body: trimmed, condition: "" };
        if (splitTopLevel(inside, ":").length > 1) return { body: trimmed, condition: "" };
        if (!COMPARISON_IN_TEXT.test(inside)) return { body: trimmed, condition: "" };
        return { body: before, condition: inside };
      }
    }
  }
  return { body: trimmed, condition: "" };
}

function functionDefinition(lhs) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)$/.exec(lhs);
  if (!match) return null;
  const name = match[1];
  const inner = match[2].trim();
  const params = inner ? inner.split(",").map((part) => part.trim()) : [];
  if (params.some((param) => !IDENT_NAME.test(param))) return null;
  if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name) || Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
    throw new Error(`"${name}" is already a built-in name. Pick another one, like f or g.`);
  }
  if (new Set(params).size !== params.length) throw new Error("A function cannot use the same parameter name twice.");
  return { name, params };
}

/**
 * Read one graph row into a descriptor.
 * Kinds: empty, explicit, implicit, definition.
 */
function parseGraphRow(text) {
  const raw = String(text == null ? "" : text).trim();
  if (!raw) return { kind: "empty", text: raw, label: "", condition: "" };
  let body = raw.replace(/θ/g, "theta");
  const restrictions = [];
  for (;;) {
    const split = splitRestriction(body);
    if (!split.condition) break;
    restrictions.push(split.condition);
    body = split.body;
  }
  const condition = restrictions.join(" and ");
  const comparison = splitComparison(body);
  if (comparison) {
    if (!comparison.lhs || !comparison.rhs) throw new Error("Both sides of the comparison need an expression.");
    return {
      kind: "inequality",
      text: raw,
      lhs: comparison.lhs,
      op: comparison.op,
      rhs: comparison.rhs,
      strict: comparison.op === "<" || comparison.op === ">",
      label: raw,
      condition,
    };
  }
  const tildeParts = splitTopLevel(body, "~");
  if (tildeParts.length > 2) throw new Error('Use a single "~" in each row.');
  if (tildeParts.length === 2) {
    const lhs = tildeParts[0].trim();
    const rhs = tildeParts[1].trim();
    if (!lhs || !rhs) throw new Error('Both sides of "~" need an expression.');
    if (splitTopLevelEquals(rhs).length > 1) throw new Error('Use either "=" or "~" in one row, not both.');
    if (lhs !== "y" && lhs !== "y_1") throw new Error("A regression row starts with y ~ ..., like y ~ m x + b.");
    return { kind: "regression", text: raw, lhs, rhs: normalizeRegressionText(rhs), label: raw, condition };
  }
  const parts = splitTopLevelEquals(body);
  if (parts.length > 2) throw new Error('Use a single "=" in each row.');
  if (parts.length === 1) return { kind: "explicit", text: raw, body: parts[0].trim(), label: `y = ${parts[0].trim()}`, condition };
  const lhs = parts[0].trim();
  const rhs = parts[1].trim();
  if (!lhs || !rhs) throw new Error('Both sides of "=" need an expression.');
  const definition = functionDefinition(lhs);
  if (definition) {
    return { kind: "definition", text: raw, name: definition.name, params: definition.params, body: rhs, label: `${lhs} = ${rhs}`, condition };
  }
  if (lhs === "r") {
    return { kind: "polar", text: raw, body: rhs, label: raw, condition };
  }
  if (IDENT_NAME.test(lhs) && lhs !== "x" && lhs !== "y") {
    if (Object.prototype.hasOwnProperty.call(FUNCTIONS, lhs) || Object.prototype.hasOwnProperty.call(CONSTANTS, lhs)) {
      throw new Error(`"${lhs}" is a built-in name. Pick another one, like a or k.`);
    }
    const value = numericLiteral(rhs);
    if (value === null) throw new Error(`A parameter value must be a number, like ${lhs} = 2.`);
    return { kind: "parameter", text: raw, name: lhs, value, label: raw, condition };
  }
  if (lhs === "y" && !mentions(rhs, "y")) return { kind: "explicit", text: raw, body: rhs, label: raw, condition };
  if (rhs === "y" && !mentions(lhs, "y")) return { kind: "explicit", text: raw, body: lhs, label: raw, condition };
  return { kind: "implicit", text: raw, lhs, rhs, label: raw, condition };
}

function numeric(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const NUMBER_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** A plain signed number, or null when the text is anything else. */
function numericLiteral(text) {
  const raw = String(text == null ? "" : text).trim();
  if (!NUMBER_LITERAL.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readView(options) {
  const opts = options || {};
  return {
    xMin: numeric(opts.xMin, DEFAULT_VIEW.xMin),
    xMax: numeric(opts.xMax, DEFAULT_VIEW.xMax),
    yMin: numeric(opts.yMin, DEFAULT_VIEW.yMin),
    yMax: numeric(opts.yMax, DEFAULT_VIEW.yMax),
  };
}

/**
 * Sample `r = f(theta)` over 0..2pi into x/y points.
 * A negative radius lands on the opposite side and a non-finite radius leaves a gap.
 */
function samplePolar(fn, condition, samples) {
  const count = Math.max(240, Math.min(4000, Math.round(numeric(samples, 900))));
  const points = [];
  for (let i = 0; i < count; i++) {
    const theta = (Math.PI * 2 * i) / (count - 1);
    let radius;
    try {
      radius = fn({ theta });
    } catch (e) {
      radius = NaN;
    }
    const allowed = Number.isFinite(radius) && (!condition || condition({ theta, r: radius }));
    points.push(allowed ? { x: radius * Math.cos(theta), y: radius * Math.sin(theta), theta } : { x: null, y: null, theta });
  }
  return points;
}

function sampleExplicit(fn, view, samples) {
  const points = [];
  const count = Math.max(3, Math.min(2000, Math.round(samples) || 400));
  for (let i = 0; i < count; i++) {
    const x = view.xMin + ((view.xMax - view.xMin) * i) / (count - 1);
    let y;
    try {
      y = fn(x);
    } catch (e) {
      y = NaN;
    }
    points.push({ x, y: Number.isFinite(y) ? y : null });
  }
  return points;
}

/**
 * Trace where a two-variable residual is zero with marching squares.
 * Returns line segments in graph coordinates; each cell contributes at most two.
 */
function traceImplicit(fn, view, resolution) {
  const opts = resolution || {};
  const nx = Math.max(8, Math.min(400, Math.round(opts.x) || 220));
  const ny = Math.max(8, Math.min(400, Math.round(opts.y) || 170));
  const dx = (view.xMax - view.xMin) / nx;
  const dy = (view.yMax - view.yMin) / ny;
  const grid = [];
  for (let j = 0; j <= ny; j++) {
    const y = view.yMin + dy * j;
    const line = [];
    for (let i = 0; i <= nx; i++) {
      const x = view.xMin + dx * i;
      let value;
      try {
        value = fn(x, y);
      } catch (e) {
        value = NaN;
      }
      line.push(Number.isFinite(value) ? value : NaN);
    }
    grid.push(line);
  }

  const segments = [];
  const limit = 20000;
  const edgePoint = (ax, ay, va, bx, by, vb) => {
    const denom = va - vb;
    const t = denom === 0 ? 0.5 : va / denom;
    return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
  };
  for (let j = 0; j < ny && segments.length < limit; j++) {
    for (let i = 0; i < nx && segments.length < limit; i++) {
      const x0 = view.xMin + dx * i;
      const x1 = x0 + dx;
      const y0 = view.yMin + dy * j;
      const y1 = y0 + dy;
      const v0 = grid[j][i];
      const v1 = grid[j][i + 1];
      const v2 = grid[j + 1][i + 1];
      const v3 = grid[j + 1][i];
      if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(v3)) continue;
      const index = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
      if (index === 0 || index === 15) continue;
      const pointB = () => edgePoint(x0, y0, v0, x1, y0, v1);
      const pointR = () => edgePoint(x1, y0, v1, x1, y1, v2);
      const pointT = () => edgePoint(x0, y1, v3, x1, y1, v2);
      const pointL = () => edgePoint(x0, y0, v0, x0, y1, v3);
      const push = (a, b) => segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      switch (index) {
        case 1:
          push(pointB(), pointL());
          break;
        case 2:
          push(pointB(), pointR());
          break;
        case 3:
          push(pointL(), pointR());
          break;
        case 4:
          push(pointR(), pointT());
          break;
        case 5: {
          const center = (v0 + v1 + v2 + v3) / 4;
          if (center > 0) {
            push(pointB(), pointR());
            push(pointL(), pointT());
          } else {
            push(pointB(), pointL());
            push(pointR(), pointT());
          }
          break;
        }
        case 6:
          push(pointB(), pointT());
          break;
        case 7:
          push(pointL(), pointT());
          break;
        case 8:
          push(pointL(), pointT());
          break;
        case 9:
          push(pointB(), pointT());
          break;
        case 10: {
          const center = (v0 + v1 + v2 + v3) / 4;
          if (center > 0) {
            push(pointB(), pointL());
            push(pointR(), pointT());
          } else {
            push(pointB(), pointR());
            push(pointL(), pointT());
          }
          break;
        }
        case 11:
          push(pointR(), pointT());
          break;
        case 12:
          push(pointL(), pointR());
          break;
        case 13:
          push(pointB(), pointR());
          break;
        case 14:
          push(pointB(), pointL());
          break;
        default:
          break;
      }
    }
  }
  return segments;
}

/**
 * Sample an inequality predicate into a coarse cell grid the canvas can fill.
 */
function sampleRegion(inside, view, resolution) {
  const opts = resolution || {};
  const cols = Math.max(8, Math.min(240, Math.round(numeric(opts.x, 110))));
  const rows = Math.max(8, Math.min(180, Math.round(numeric(opts.y, 70))));
  const dx = (view.xMax - view.xMin) / cols;
  const dy = (view.yMax - view.yMin) / rows;
  const cells = [];
  for (let j = 0; j < rows; j++) {
    const y = view.yMin + dy * (j + 0.5);
    for (let i = 0; i < cols; i++) {
      const x = view.xMin + dx * (i + 0.5);
      let hit = false;
      try {
        hit = inside(x, y) === true;
      } catch (e) {
        hit = false;
      }
      cells.push(hit ? 1 : 0);
    }
  }
  return { x0: view.xMin, y0: view.yMin, dx, dy, cols, rows, cells };
}

/**
 * Read the x/y table used by regression rows. Blank pairs are skipped so a
 * half-typed row never breaks the plot; bad numbers are reported separately.
 */
function readDataPoints(rows) {
  const points = [];
  const errors = [];
  const list = Array.isArray(rows) ? rows : [];
  for (let i = 0; i < list.length; i++) {
    const entry = list[i] || {};
    const rawX = entry.x;
    const rawY = entry.y;
    const blankX = rawX === undefined || rawX === null || String(rawX).trim() === "";
    const blankY = rawY === undefined || rawY === null || String(rawY).trim() === "";
    if (blankX && blankY) continue;
    if (blankX || blankY) continue;
    const x = Number(rawX);
    const y = Number(rawY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(`Data row ${i + 1} needs two numbers.`);
      continue;
    }
    points.push({ x, y });
  }
  return { points, error: errors.join(" ") };
}

/** `x_1` is the Desmos table column; accept it as another name for x. */
function normalizeRegressionText(text) {
  return String(text).replace(/\bx_1\b/g, "x");
}

/** The names on the right of `~` that are not variables, functions or constants. */
function regressionParameters(text, definitions) {
  const known = definitions || {};
  const tokens = tokenize(text, Object.keys(known));
  const names = [];
  for (const token of tokens) {
    if (token.type !== "ident") continue;
    const name = token.value;
    if (name === "x") continue;
    if (name === "y" || name === "y_1") throw new Error('Use x on the right of "~" and y on the left, like y ~ m x + b.');
    if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) continue;
    if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) continue;
    if (Object.prototype.hasOwnProperty.call(known, name)) continue;
    if (names.indexOf(name) < 0) names.push(name);
  }
  const callPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match;
  while ((match = callPattern.exec(text))) {
    const name = match[1];
    if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) continue;
    if (Object.prototype.hasOwnProperty.call(known, name)) continue;
    throw new Error(`Unknown function "${name}". Define it in an earlier row or use the listed functions.`);
  }
  return names;
}

/** Solve A x = b by Gauss-Jordan elimination with partial pivoting. */
function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const rows = matrix.map((row, i) => row.slice().concat([vector[i]]));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    if (!Number.isFinite(rows[pivot][col]) || Math.abs(rows[pivot][col]) < 1e-14) return null;
    const swap = rows[col];
    rows[col] = rows[pivot];
    rows[pivot] = swap;
    const lead = rows[col][col];
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = rows[row][col] / lead;
      if (!factor) continue;
      for (let k = col; k <= n; k++) rows[row][k] -= factor * rows[col][k];
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const value = rows[i][n] / rows[i][i];
    if (!Number.isFinite(value)) return null;
    out.push(value);
  }
  return out;
}

/**
 * Levenberg-Marquardt least squares on a numeric Jacobian.
 * Deterministic: it starts from `start` and takes no random step.
 */
function fitParameters(model, xs, ys, start, options) {
  const opts = options || {};
  const params = start.slice();
  const count = params.length;
  const maxIterations = Math.max(1, Math.min(120, Math.round(numeric(opts.iterations, 60))));
  const evaluate = (values) => {
    const residuals = [];
    for (let i = 0; i < xs.length; i++) {
      let predicted;
      try {
        predicted = model(xs[i], values);
      } catch (e) {
        return null;
      }
      if (!Number.isFinite(predicted)) return null;
      residuals.push(predicted - ys[i]);
    }
    return residuals;
  };
  const sumSquares = (residuals) => residuals.reduce((sum, value) => sum + value * value, 0);
  let residuals = evaluate(params);
  if (!residuals) throw new Error("That model does not give a number at every data point.");
  let cost = sumSquares(residuals);
  let lambda = 1e-3;
  for (let iteration = 0; iteration < maxIterations && cost > 1e-24; iteration++) {
    const jacobian = xs.map(() => new Array(count).fill(0));
    for (let j = 0; j < count; j++) {
      const h = 1e-6 * Math.max(1, Math.abs(params[j]));
      const plus = params.slice();
      plus[j] += h;
      const minus = params.slice();
      minus[j] -= h;
      const up = evaluate(plus);
      const down = evaluate(minus);
      if (!up || !down) throw new Error("That model does not give a number at every data point.");
      for (let i = 0; i < xs.length; i++) jacobian[i][j] = (up[i] - down[i]) / (2 * h);
    }
    const normal = [];
    const gradient = new Array(count).fill(0);
    for (let j = 0; j < count; j++) {
      normal.push(new Array(count).fill(0));
      for (let i = 0; i < xs.length; i++) gradient[j] += jacobian[i][j] * residuals[i];
    }
    for (let j = 0; j < count; j++) {
      for (let k = j; k < count; k++) {
        let sum = 0;
        for (let i = 0; i < xs.length; i++) sum += jacobian[i][j] * jacobian[i][k];
        normal[j][k] = sum;
        normal[k][j] = sum;
      }
    }
    const damped = normal.map((row, j) => row.map((value, k) => (j === k ? value + lambda * (Math.abs(value) > 1e-12 ? Math.abs(value) : 1) : value)));
    const step = solveLinearSystem(damped, gradient.map((value) => -value));
    if (!step) throw new Error("That model cannot be fitted to these points. Try a simpler form.");
    const candidate = params.map((value, j) => value + step[j]);
    const candidateResiduals = evaluate(candidate);
    if (candidateResiduals && sumSquares(candidateResiduals) < cost) {
      params.splice(0, params.length, ...candidate);
      residuals = candidateResiduals;
      cost = sumSquares(candidateResiduals);
      lambda = Math.max(1e-9, lambda / 3);
      let biggest = 0;
      for (const value of step) biggest = Math.max(biggest, Math.abs(value));
      if (biggest < 1e-10 * (1 + Math.max.apply(null, params.map((value) => Math.abs(value))))) break;
    } else {
      lambda *= 4;
      if (lambda > 1e12) break;
    }
  }
  return { values: params, cost };
}

/**
 * Build every row of a graph. One bad row gets an error and the rest still plot.
 * Definitions are shared with the rows below them, in order.
 */
function buildGraph(options) {
  const opts = options || {};
  const view = readView(opts);
  if (!(view.xMax > view.xMin)) throw new Error("The maximum x must be larger than the minimum x.");
  if (!(view.yMax > view.yMin)) throw new Error("The maximum y must be larger than the minimum y.");
  const rows = Array.isArray(opts.rows) ? opts.rows : [];
  const data = readDataPoints(opts.data);
  const parameterValues = opts.parameters && typeof opts.parameters === "object" ? opts.parameters : {};
  const samples = numeric(opts.samples, 400);
  const resolution = opts.resolution || {};
  const regionResolution = opts.regionResolution || {};
  const definitions = {};
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const input = rows[i];
    const raw = typeof input === "string" ? input : String((input && input.text) || "");
    const guess = input && typeof input === "object" ? input.guess : null;
    const row = { index: i, text: raw, kind: "empty", label: raw, error: "" };
    try {
      const parsed = parseGraphRow(raw);
      row.kind = parsed.kind;
      row.label = parsed.label;
      if (parsed.condition && (parsed.kind === "definition" || parsed.kind === "parameter" || parsed.kind === "regression")) {
        throw new Error("A restriction goes on an expression or equation, not on a definition, slider or regression.");
      }
      const condition = parsed.condition && parsed.kind !== "polar" ? compileCondition(parsed.condition, ["x", "y"], definitions) : null;
      if (parsed.kind === "definition") {
        const params = parsed.params.slice();
        const body = compileScoped(parsed.body, params, definitions);
        definitions[parsed.name] = {
          params,
          fn: (args) => {
            const vals = {};
            params.forEach((param, index) => {
              vals[param] = args[index];
            });
            return body(vals);
          },
        };
        row.name = parsed.name;
        row.params = params;
      } else if (parsed.kind === "parameter") {
        const override = numeric(parameterValues[parsed.name], NaN);
        const value = Number.isFinite(override) ? override : parsed.value;
        definitions[parsed.name] = value;
        row.name = parsed.name;
        row.value = value;
      } else if (parsed.kind === "polar") {
        const compiled = compileScoped(parsed.body, ["theta"], definitions);
        const polarCondition = parsed.condition ? compileCondition(parsed.condition, ["theta", "r"], definitions) : null;
        row.points = samplePolar((scope) => compiled(scope), polarCondition, samples * 2);
        if (!row.points.some((point) => point.y !== null)) row.error = "That polar curve has no values in this window.";
      } else if (parsed.kind === "explicit") {
        const compiled = compileScoped(parsed.body, ["x"], definitions);
        const base = (x) => compiled({ x });
        const fn = condition
          ? (x) => {
              const y = base(x);
              return Number.isFinite(y) && condition({ x, y }) ? y : NaN;
            }
          : base;
        row.points = sampleExplicit(fn, view, samples);
        if (!row.points.some((point) => point.y !== null)) row.error = "That expression has no real values in this window.";
      } else if (parsed.kind === "regression") {
        const paramNames = regressionParameters(parsed.rhs, definitions);
        if (!paramNames.length) throw new Error('Add a name to fit, like y ~ m x + b.');
        if (paramNames.length > 8) throw new Error("A regression can fit at most 8 parameters.");
        if (!data.points.length) throw new Error("Add data points (x, y) to fit this model.");
        if (data.points.length < paramNames.length) {
          throw new Error(`Add at least ${paramNames.length} data points to fit ${paramNames.length} parameters.`);
        }
        const xs = data.points.map((point) => point.x);
        const ys = data.points.map((point) => point.y);
        const compiled = compileScoped(parsed.rhs, ["x"].concat(paramNames), definitions);
        const model = (x, values) => {
          const scope = { x };
          paramNames.forEach((name, index) => {
            scope[name] = values[index];
          });
          return compiled(scope);
        };
        const start = paramNames.map((name) => {
          const value = guess ? numeric(guess[name], NaN) : NaN;
          return Number.isFinite(value) ? value : 1;
        });
        const fitted = fitParameters(model, xs, ys, start);
        row.parameters = paramNames.map((name, index) => ({ name, value: fitted.values[index] }));
        const mean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
        const total = ys.reduce((sum, value) => sum + (value - mean) * (value - mean), 0);
        row.r2 = total > 0 ? 1 - fitted.cost / total : fitted.cost < 1e-12 ? 1 : null;
        row.residual = fitted.cost;
        const sample = (x) => model(x, fitted.values);
        row.points = sampleExplicit(sample, view, samples);
        if (!row.points.some((point) => point.y !== null)) row.error = "That fit has no real values in this window.";
      } else if (parsed.kind === "implicit") {
        const relation = compileRelation(parsed.lhs, parsed.rhs, definitions);
        const fn = condition ? (x, y) => (condition({ x, y }) ? relation(x, y) : NaN) : relation;
        row.segments = traceImplicit(fn, view, resolution);
        if (!row.segments.length) row.error = "That equation has no points in this window.";
      } else if (parsed.kind === "inequality") {
        const left = compileScoped(parsed.lhs, ["x", "y"], definitions);
        const right = compileScoped(parsed.rhs, ["x", "y"], definitions);
        const difference = (x, y) => left({ x, y }) - right({ x, y });
        const residual = condition ? (x, y) => (condition({ x, y }) ? difference(x, y) : NaN) : difference;
        const below = parsed.op.charAt(0) === "<" || parsed.op === "≤";
        const inside = (x, y) => {
          const value = residual(x, y);
          return Number.isFinite(value) && (below ? value < 0 : value > 0);
        };
        row.strict = parsed.strict;
        row.region = sampleRegion(inside, view, regionResolution);
        row.segments = traceImplicit(residual, view, resolution);
        if (!row.segments.length && !row.region.cells.some((cell) => cell)) {
          row.error = "That inequality has no region in this window.";
        }
      }
    } catch (e) {
      row.error = String((e && e.message) || e) || "That row is not valid.";
      if (row.kind === "empty") row.kind = "invalid";
    }
    out.push(row);
  }
  return {
    rows: out,
    data: data.points,
    dataError: data.error,
    xMin: view.xMin,
    xMax: view.xMax,
    yMin: view.yMin,
    yMax: view.yMax,
    definitions: Object.keys(definitions),
  };
}

/** Samples one expression into graph points with an auto-fitted y range. */
function buildPlot(text, options) {
  const opts = options || {};
  const fn = compileExpression(text);
  const xMin = numeric(opts.xMin, -10);
  const xMax = numeric(opts.xMax, 10);
  if (!(xMax > xMin)) throw new Error("The maximum x must be larger than the minimum x.");
  const points = sampleExplicit(fn, { xMin, xMax }, Math.max(3, Math.min(1200, Math.round(Number(opts.samples) || 241))));
  let low = Infinity;
  let high = -Infinity;
  for (const point of points) {
    if (point.y === null) continue;
    low = Math.min(low, point.y);
    high = Math.max(high, point.y);
  }
  if (low === Infinity) throw new Error("That expression has no real values in this range.");
  if (low === high) {
    low -= 1;
    high += 1;
  } else {
    const pad = (high - low) * 0.08;
    low -= pad;
    high += pad;
  }
  return { points, xMin, xMax, yMin: low, yMax: high };
}

module.exports = {
  CONSTANTS,
  DEFAULT_VIEW,
  FUNCTIONS,
  buildGraph,
  buildPlot,
  compileExpression,
  compileRelation,
  compileCondition,
  compileScoped,
  fitParameters,
  parseGraphRow,
  readDataPoints,
  regressionParameters,
  sampleExplicit,
  samplePolar,
  sampleRegion,
  splitRestriction,
  tokenize,
  traceImplicit,
};
