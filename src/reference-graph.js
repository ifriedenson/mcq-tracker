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
 *   - a parametric pair in t               `(cos(t), sin(t))`
 *   - a point or point list                `(1, 2)`, `[(1, 2), (3, 4)]`
 * Explicit rows are sampled; implicit rows are traced with marching squares;
 * inequalities shade a coarse cell grid and draw their boundary;
 * regression rows are fitted to the x/y table with a local least-squares
 * solver, so no calculator service or third-party code is involved.
 */

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sec: (x) => reciprocalOf(Math.cos(x)),
  csc: (x) => reciprocalOf(Math.sin(x)),
  cot: (x) => reciprocalOf(Math.tan(x)),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  csch: (x) => (x === 0 ? NaN : reciprocalOf(Math.sinh(x))),
  sech: (x) => reciprocalOf(Math.cosh(x)),
  coth: (x) => (x === 0 ? NaN : reciprocalOf(Math.tanh(x))),
  asinh: Math.asinh,
  acosh: Math.acosh,
  atanh: (x) => (Math.abs(x) < 1 ? Math.atanh(x) : NaN),
  acsch: (x) => (x === 0 ? NaN : Math.asinh(reciprocalOf(x))),
  asech: (x) => (x <= 0 || x > 1 ? NaN : Math.acosh(reciprocalOf(x))),
  acoth: (x) => (Math.abs(x) <= 1 ? NaN : Math.atanh(reciprocalOf(x))),
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  sign: Math.sign,
  round: (x) => (Number.isFinite(x) ? Math.sign(x) * Math.round(Math.abs(x)) : NaN),
};

const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

/** `1 / value`, or NaN at a pole so a graph draws a gap instead of an Infinity stroke. */
function reciprocalOf(value) {
  return Number.isFinite(value) && Math.abs(value) > 1e-9 ? 1 / value : NaN;
}

function wholeNumbers(values) {
  return values.every((value) => Number.isInteger(value));
}

function integerGcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

function combinationCount(n, r) {
  let result = 1;
  for (let i = 1; i <= r; i++) result = (result * (n - r + i)) / i;
  return Math.round(result);
}

function permutationCount(n, r) {
  let result = 1;
  for (let i = 1; i <= r; i++) result *= n - r + i;
  return result;
}

function validChoice(n, r) {
  return Number.isInteger(n) && Number.isInteger(r) && n >= 0 && r >= 0 && r <= n;
}

/** Two-value functions; each validates literal arguments so bad input reports inline. */
const MULTI_FUNCTIONS = {
  mod: {
    arity: 2,
    fn: (a, b) => (b === 0 ? NaN : ((a % b) + b) % b),
  },
  nthroot: {
    arity: 2,
    fn: (x, n) => {
      if (!Number.isInteger(n) || n < 2) return NaN;
      if (x < 0) return n % 2 === 1 ? -Math.pow(-x, 1 / n) : NaN;
      return Math.pow(x, 1 / n);
    },
    validate: ([x, n]) => (Number.isInteger(n) && n >= 2 ? "" : "nthroot needs a whole root of 2 or more, like nthroot(8, 3)."),
  },
  gcd: {
    arity: 2,
    fn: (a, b) => (wholeNumbers([a, b]) ? integerGcd(a, b) : NaN),
    validate: ([a, b]) => (wholeNumbers([a, b]) ? "" : "gcd needs whole numbers, like gcd(12, 18)."),
  },
  lcm: {
    arity: 2,
    fn: (a, b) => {
      if (!wholeNumbers([a, b])) return NaN;
      if (a === 0 || b === 0) return 0;
      return Math.abs((a / integerGcd(a, b)) * b);
    },
    validate: ([a, b]) => (wholeNumbers([a, b]) ? "" : "lcm needs whole numbers, like lcm(4, 6)."),
  },
  nCr: {
    arity: 2,
    fn: (n, r) => (validChoice(n, r) ? combinationCount(n, r) : NaN),
    validate: ([n, r]) => (validChoice(n, r) ? "" : "nCr needs whole numbers with 0 ≤ r ≤ n, like nCr(5, 2)."),
  },
  nPr: {
    arity: 2,
    fn: (n, r) => (validChoice(n, r) ? permutationCount(n, r) : NaN),
    validate: ([n, r]) => (validChoice(n, r) ? "" : "nPr needs whole numbers with 0 ≤ r ≤ n, like nPr(5, 2)."),
  },
};

function isBuiltInName(name) {
  return (
    Object.prototype.hasOwnProperty.call(FUNCTIONS, name) ||
    Object.prototype.hasOwnProperty.call(MULTI_FUNCTIONS, name) ||
    Object.prototype.hasOwnProperty.call(CONSTANTS, name)
  );
}
const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;
const IDENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_VIEW = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };

function isKnownFunction(name, extraNames) {
  if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) return true;
  if (Object.prototype.hasOwnProperty.call(MULTI_FUNCTIONS, name)) return true;
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
      if (has(MULTI_FUNCTIONS, name)) {
        const spec = MULTI_FUNCTIONS[name];
        const args = argumentList();
        if (args.length !== spec.arity) throw new Error(`${name} takes ${spec.arity} values.`);
        if (spec.validate) {
          let values = null;
          try {
            values = args.map((arg) => arg({}));
          } catch (e) {
            values = null;
          }
          if (values && values.every((value) => Number.isFinite(value))) {
            const message = spec.validate(values);
            if (message) throw new Error(message);
          }
        }
        return (vals) => spec.fn.apply(null, args.map((arg) => arg(vals)));
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
  if (isBuiltInName(name)) {
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
  let fill = false;
  let markerStyle = "closed";
  let label = "";
  for (;;) {
    if (body.startsWith("(") || body.startsWith("[")) {
      const styleMatch = /(^|\s)(open|closed)$/i.exec(body);
      if (styleMatch) {
        markerStyle = styleMatch[2].toLowerCase();
        body = body.slice(0, body.length - styleMatch[0].length).trim();
        if (!body) throw new Error('An "open" or "closed" row still needs a point, like (1, 2) open.');
        continue;
      }
      const labelMatch = /(^|\s)"([^"]*)"$/.exec(body);
      if (labelMatch) {
        label = labelMatch[2];
        body = body.slice(0, body.length - labelMatch[0].length).trim();
        if (!body) throw new Error('A label still needs a point, like (1, 2) "A".');
        continue;
      }
      if (!fill && /(^|\s)fill$/i.test(body)) {
        fill = true;
        body = body.replace(/(^|\s)fill$/i, "").trim();
        if (!body) throw new Error('A "fill" row still needs a curve, like (cos(t), sin(t)) fill.');
        continue;
      }
    }
    const split = splitRestriction(body);
    if (!split.condition) break;
    restrictions.push(split.condition);
    body = split.body;
  }
  const condition = restrictions.join(" and ");
  const pointList = splitPointList(body);
  if (pointList) {
    if (fill) throw new Error("Fill needs a single closed curve, not a point list.");
    return { kind: "points", text: raw, pairs: pointList, style: markerStyle, label, condition };
  }
  const parametric = splitParametric(body);
  if (parametric) {
    const freeParameter = ["t", "theta"].some((name) => mentions(parametric.xBody, name) || mentions(parametric.yBody, name));
    if (!freeParameter) {
      if (fill) throw new Error("Fill needs a curve, like (cos(t), sin(t)) fill.");
      return { kind: "point", text: raw, xBody: parametric.xBody, yBody: parametric.yBody, style: markerStyle, label, condition };
    }
    return {
      kind: "parametric",
      text: raw,
      xBody: parametric.xBody,
      yBody: parametric.yBody,
      fill,
      label: raw,
      condition,
    };
  }
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
    if (isBuiltInName(lhs)) {
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
 * Split `(cos(t), sin(t))` into its two coordinate expressions.
 * A single parenthesised expression stays an explicit row.
 */
function splitParametric(text) {
  const trimmed = String(text == null ? "" : text).trim();
  if (!trimmed.startsWith("(")) return null;
  let depth = 0;
  let closeAt = -1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        closeAt = i;
        break;
      }
    }
  }
  if (closeAt !== trimmed.length - 1) return null;
  const parts = splitTopLevel(trimmed.slice(1, -1), ",");
  if (parts.length === 1) return null;
  if (parts.length !== 2) throw new Error("A parametric row needs exactly two expressions, like (cos(t), sin(t)).");
  const xBody = parts[0].trim();
  const yBody = parts[1].trim();
  if (!xBody || !yBody) throw new Error("Both x and y in a parametric row need an expression, like (cos(t), sin(t)).");
  return { xBody, yBody };
}

/**
 * Split `[(1, 2), (3, 4)]` into its pairs. Each entry must be a pair.
 */
function splitPointList(text) {
  const trimmed = String(text == null ? "" : text).trim();
  if (!trimmed.startsWith("[")) return null;
  if (!trimmed.endsWith("]")) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) throw new Error("A point list needs at least one point, like [(1, 2), (3, 4)].");
  return splitTopLevel(inner, ",").map((part) => {
    const pair = splitParametric(part.trim());
    if (!pair) throw new Error("Each point in a list needs a pair, like (1, 2).");
    return pair;
  });
}

function formatPointLabel(x, y) {
  const fmt = (value) => {
    const rounded = Math.round(value * 1e6) / 1e6;
    return String(Object.is(rounded, -0) ? 0 : rounded);
  };
  return `(${fmt(x)}, ${fmt(y)})`;
}

/**
 * Pixel positions for point markers and their labels under the current view.
 * A label that would overflow an edge flips to the other side or below the marker.
 */
function markerLayout(markers, view, width, height) {
  const spanX = view.xMax - view.xMin;
  const spanY = view.yMax - view.yMin;
  const list = Array.isArray(markers) ? markers : [];
  return list.map((marker) => {
    const x = spanX > 0 ? ((marker.x - view.xMin) / spanX) * width : 0;
    const y = spanY > 0 ? height - ((marker.y - view.yMin) / spanY) * height : 0;
    const label = String(marker.label || "");
    const estimate = label.length * 6.6;
    let labelX = x + 8;
    let align = "left";
    if (label && labelX + estimate > width - 2) {
      labelX = x - 8;
      align = "right";
    }
    if (labelX < 4) {
      labelX = 4;
      align = "left";
    }
    let labelY = y - 8;
    if (labelY < 14) labelY = y + 16;
    return { x, y, label, labelX, labelY, align };
  });
}

function parametricBound(text, definitions) {
  let value;
  try {
    value = compileScoped(text, [], definitions)({});
  } catch (e) {
    throw new Error(`A parametric bound must be a number, like {0 < t < 2pi}: ${e.message}`);
  }
  if (!Number.isFinite(value)) throw new Error("A parametric bound must be a finite number, like {0 < t < 2pi}.");
  return value;
}

/**
 * A condition that is exactly `low < t < high` (or `theta`) sets the sweep.
 * Any other condition filters a 0..2pi sweep instead.
 */
function parametricRange(condition, definitions) {
  if (!condition) return null;
  const match = /^\s*(.+?)\s*(?:<=|<)\s*(?:t|theta)\s*(?:<=|<)\s*(.+?)\s*$/.exec(condition);
  if (!match) return null;
  const start = parametricBound(match[1], definitions);
  const end = parametricBound(match[2], definitions);
  if (!(end > start)) throw new Error("The end of a parametric range must be larger than its start.");
  return { start, end };
}

/**
 * Sample a parametric pair over `bounds` into x/y points.
 * A non-finite coordinate leaves a gap so no chord is drawn across it.
 */
function sampleParametric(xFn, yFn, condition, bounds, samples) {
  const count = Math.max(240, Math.min(4000, Math.round(numeric(samples, 600))));
  const start = bounds[0];
  const end = bounds[1];
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = start + ((end - start) * i) / (count - 1);
    let x;
    let y;
    try {
      const scope = { t, theta: t };
      x = xFn(scope);
      y = yFn(scope);
    } catch (e) {
      x = NaN;
      y = NaN;
    }
    const allowed = Number.isFinite(x) && Number.isFinite(y) && (!condition || condition({ t, theta: t, x, y }));
    points.push(allowed ? { x, y, t } : { x: null, y: null, t });
  }
  return points;
}

/**
 * Turn sampled points into a fill polygon, refusing anything that is not a
 * continuous closed curve so a bad fill reports instead of shading wrongly.
 */
function parametricFillPolygon(points) {
  const drawn = points.filter((point) => point.y !== null);
  if (drawn.length < 3) return { error: "Fill needs a closed curve with at least three points." };
  if (drawn.length !== points.length) return { error: "Fill needs a continuous curve; this one has gaps where a coordinate is not a number." };
  const first = drawn[0];
  const last = drawn[drawn.length - 1];
  const xs = drawn.map((point) => point.x);
  const ys = drawn.map((point) => point.y);
  const span = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys), 1e-9);
  if (Math.hypot(first.x - last.x, first.y - last.y) > span * 0.05) {
    return { error: "Fill needs a closed curve: make the parameter range end where it starts." };
  }
  return { polygon: drawn.map((point) => ({ x: point.x, y: point.y })) };
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

const POI_LIMIT = 24;

/** Bisect a sign change down to the machine-precision root. */
function refineRoot(fn, lo, hi) {
  let a = lo;
  let b = hi;
  let fa = fn(a);
  for (let i = 0; i < 80 && b - a > 1e-12; i++) {
    const mid = (a + b) / 2;
    const fm = fn(mid);
    if (!Number.isFinite(fm)) break;
    if (fm === 0) return mid;
    if ((fa < 0) === (fm < 0)) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

/** Ternary search for one local maximum or minimum inside a bracket. */
function refineExtremum(fn, lo, hi, mode) {
  let a = lo;
  let b = hi;
  for (let i = 0; i < 100 && b - a > 1e-12; i++) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    const v1 = fn(m1);
    const v2 = fn(m2);
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) break;
    if (mode === "minimum" ? v1 < v2 : v1 > v2) b = m2;
    else a = m1;
  }
  return (a + b) / 2;
}

/**
 * Collect the roots, the y-intercept and the extrema of one sampled curve.
 * Every candidate is refined against the compiled function and merged when two
 * readings land on the same x, so a vertex that is also an intercept appears
 * once. A restriction already removed the values it excludes, so a root
 * outside the drawn domain is never reported.
 */
function findRowInterest(fn, points, view, rowIndex) {
  const span = Math.max(view.xMax - view.xMin, 1e-9);
  const tolerance = span * 1e-6;
  const found = [];
  const push = (kind, x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < view.xMin - tolerance || x > view.xMax + tolerance) return;
    const existing = found.find((point) => Math.abs(point.x - x) <= tolerance);
    if (existing) {
      if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
      return;
    }
    if (found.length >= POI_LIMIT) return;
    found.push({ kind, kinds: [kind], x, y, label: formatPointLabel(x, y), rowIndex });
  };
  if (view.xMin <= 0 && view.xMax >= 0) {
    let zero;
    try {
      zero = fn(0);
    } catch (e) {
      zero = NaN;
    }
    if (Number.isFinite(zero)) push("intercept", 0, zero);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a.y === null || b.y === null) continue;
    if (a.y === 0) {
      push("root", a.x, 0);
      continue;
    }
    if ((a.y < 0) === (b.y < 0)) continue;
    const x = refineRoot(fn, a.x, b.x);
    let y;
    try {
      y = fn(x);
    } catch (e) {
      y = NaN;
    }
    push("root", x, Number.isFinite(y) ? y : 0);
  }
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const here = points[i];
    const next = points[i + 1];
    if (prev.y === null || here.y === null || next.y === null) continue;
    const before = here.y - prev.y;
    const after = next.y - here.y;
    if (before === 0 || after === 0 || (before < 0) === (after < 0)) continue;
    const mode = before > 0 ? "maximum" : "minimum";
    const x = refineExtremum(fn, prev.x, next.x, mode);
    let y;
    try {
      y = fn(x);
    } catch (e) {
      y = NaN;
    }
    push(mode, x, Number.isFinite(y) ? y : here.y);
  }
  found.sort((a, b) => a.x - b.x);
  return found;
}

/**
 * Find where two sampled curves cross by bisecting the difference on the
 * shared sample grid. A tangency with no sign change is not reported.
 */
function findIntersections(curves, view) {
  const span = Math.max(view.xMax - view.xMin, 1e-9);
  const tolerance = span * 1e-6;
  const found = [];
  for (let i = 0; i < curves.length; i++) {
    for (let j = i + 1; j < curves.length; j++) {
      const first = curves[i];
      const second = curves[j];
      const length = Math.min(first.points.length, second.points.length);
      const difference = (x) => {
        try {
          return first.fn(x) - second.fn(x);
        } catch (e) {
          return NaN;
        }
      };
      for (let k = 0; k < length - 1 && found.length < POI_LIMIT; k++) {
        const a0 = first.points[k];
        const a1 = first.points[k + 1];
        const b0 = second.points[k];
        const b1 = second.points[k + 1];
        if (a0.y === null || a1.y === null || b0.y === null || b1.y === null) continue;
        const d0 = a0.y - b0.y;
        const d1 = a1.y - b1.y;
        if (d0 !== 0 && (d0 < 0) === (d1 < 0)) continue;
        let x;
        if (d0 === 0) {
          x = a0.x;
        } else {
          const left = difference(a0.x);
          const right = difference(a1.x);
          if (!Number.isFinite(left) || !Number.isFinite(right) || (left === 0 && right === 0)) continue;
          x = refineRoot(difference, a0.x, a1.x);
        }
        let y;
        try {
          y = first.fn(x);
        } catch (e) {
          y = NaN;
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (found.some((point) => Math.abs(point.x - x) <= tolerance)) continue;
        found.push({
          kind: "intersection",
          kinds: ["intersection"],
          x,
          y,
          label: formatPointLabel(x, y),
          rowIndex: second.index,
          rows: [first.index, second.index],
        });
      }
    }
  }
  found.sort((a, b) => a.x - b.x);
  return found;
}

/**
 * Read every sampled curve at one x. Explicit and regression rows interpolate
 * between their samples; a gap or an x outside the window reports nothing.
 */
function traceAt(built, x) {
  const rows = built && Array.isArray(built.rows) ? built.rows : [];
  if (!Number.isFinite(x)) return [];
  const out = [];
  for (const row of rows) {
    if (!row.points || !row.points.length) continue;
    if (row.kind !== "explicit" && row.kind !== "regression") continue;
    const points = row.points;
    const first = points[0];
    const last = points[points.length - 1];
    if (!(x >= Math.min(first.x, last.x) - 1e-12 && x <= Math.max(first.x, last.x) + 1e-12)) continue;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (x < a.x - 1e-12 || x > b.x + 1e-12) continue;
      if (a.y === null || b.y === null || b.x === a.x) break;
      const t = (x - a.x) / (b.x - a.x);
      const y = a.y + (b.y - a.y) * t;
      if (Number.isFinite(y)) out.push({ rowIndex: row.index, x, y });
      break;
    }
  }
  return out;
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
    if (isBuiltInName(name)) continue;
    if (Object.prototype.hasOwnProperty.call(known, name)) continue;
    if (names.indexOf(name) < 0) names.push(name);
  }
  const callPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let match;
  while ((match = callPattern.exec(text))) {
    const name = match[1];
    if (isBuiltInName(name)) continue;
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
  const curves = [];
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
      const condition = parsed.condition && parsed.kind !== "polar" && parsed.kind !== "parametric" ? compileCondition(parsed.condition, ["x", "y"], definitions) : null;
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
      } else if (parsed.kind === "point" || parsed.kind === "points") {
        const pairs = parsed.kind === "points" ? parsed.pairs : [{ xBody: parsed.xBody, yBody: parsed.yBody }];
        const markers = [];
        for (const pair of pairs) {
          const x = compileScoped(pair.xBody, [], definitions)({});
          const y = compileScoped(pair.yBody, [], definitions)({});
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error("A point needs numeric coordinates, like (1, 2) or (a, b) with a slider.");
          }
          if (condition && !condition({ x, y })) continue;
          const label = parsed.kind === "point" && parsed.label ? parsed.label : formatPointLabel(x, y);
          markers.push({ x, y, label });
        }
        row.markers = markers;
        row.style = parsed.style;
        row.label = parsed.label;
        if (!markers.length) row.error = parsed.condition ? "No point matches that restriction." : "That point list is empty.";
      } else if (parsed.kind === "parametric") {
        const xCompiled = compileScoped(parsed.xBody, ["t", "theta"], definitions);
        const yCompiled = compileScoped(parsed.yBody, ["t", "theta"], definitions);
        const range = parametricRange(parsed.condition, definitions);
        const filter = range || !parsed.condition ? null : compileCondition(parsed.condition, ["t", "theta", "x", "y"], definitions);
        const bounds = range ? [range.start, range.end] : [0, Math.PI * 2];
        row.points = sampleParametric(xCompiled, yCompiled, filter, bounds, samples * 2);
        row.bounds = bounds;
        row.fill = parsed.fill === true;
        if (!row.points.some((point) => point.y !== null)) {
          row.error = "That parametric curve has no values in this window.";
        } else if (row.fill) {
          const filled = parametricFillPolygon(row.points);
          if (filled.error) row.error = filled.error;
          else row.polygon = filled.polygon;
        }
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
        row.interest = findRowInterest(fn, row.points, view, i);
        curves.push({ index: i, fn, points: row.points });
        if (!row.points.some((point) => point.y !== null)) {
          row.error = "That expression has no real values in this window.";
          row.interest = [];
        }
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
        row.interest = findRowInterest(sample, row.points, view, i);
        curves.push({ index: i, fn: sample, points: row.points });
        if (!row.points.some((point) => point.y !== null)) {
          row.error = "That fit has no real values in this window.";
          row.interest = [];
        }
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
  const intersections = findIntersections(curves, view);
  for (const crossing of intersections) {
    const row = out[crossing.rowIndex];
    if (!row) continue;
    if (!row.interest) row.interest = [];
    row.interest.push(crossing);
  }
  const interest = [];
  for (const row of out) if (row.interest && row.interest.length) interest.push.apply(interest, row.interest);
  interest.sort((a, b) => a.x - b.x);
  return {
    rows: out,
    interest,
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
  MULTI_FUNCTIONS,
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
  findRowInterest,
  findIntersections,
  traceAt,
  markerLayout,
  formatPointLabel,
  sampleParametric,
  samplePolar,
  sampleRegion,
  parametricFillPolygon,
  splitRestriction,
  tokenize,
  traceImplicit,
};
