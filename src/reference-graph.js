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
 * Explicit rows are sampled; implicit rows are traced with marching squares.
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
    if ("+-*/^(),".includes(ch)) {
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
function compileScoped(text, scopeNames, environment) {
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
    if (token.type === "(") {
      at++;
      const inner = expression();
      take(")");
      return inner;
    }
    throw new Error(`Unexpected "${token.type}".`);
  }

  const fn = expression();
  if (at !== tokens.length) throw new Error("Unexpected extra text after the expression.");
  return fn;
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

function splitTopLevelEquals(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === "=" && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
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
  if (!raw) return { kind: "empty", text: raw, label: "" };
  if (/[<>≤≥]/.test(raw)) throw new Error("Inequalities are not supported yet. Use = for an equation.");
  const parts = splitTopLevelEquals(raw);
  if (parts.length > 2) throw new Error('Use a single "=" in each row.');
  if (parts.length === 1) return { kind: "explicit", text: raw, body: raw, label: `y = ${raw}` };
  const lhs = parts[0].trim();
  const rhs = parts[1].trim();
  if (!lhs || !rhs) throw new Error('Both sides of "=" need an expression.');
  const definition = functionDefinition(lhs);
  if (definition) {
    return { kind: "definition", text: raw, name: definition.name, params: definition.params, body: rhs, label: `${lhs} = ${rhs}` };
  }
  if (lhs === "y" && !mentions(rhs, "y")) return { kind: "explicit", text: raw, body: rhs, label: raw };
  if (rhs === "y" && !mentions(lhs, "y")) return { kind: "explicit", text: raw, body: lhs, label: raw };
  return { kind: "implicit", text: raw, lhs, rhs, label: raw };
}

function numeric(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
 * Build every row of a graph. One bad row gets an error and the rest still plot.
 * Definitions are shared with the rows below them, in order.
 */
function buildGraph(options) {
  const opts = options || {};
  const view = readView(opts);
  if (!(view.xMax > view.xMin)) throw new Error("The maximum x must be larger than the minimum x.");
  if (!(view.yMax > view.yMin)) throw new Error("The maximum y must be larger than the minimum y.");
  const rows = Array.isArray(opts.rows) ? opts.rows : [];
  const samples = numeric(opts.samples, 400);
  const resolution = opts.resolution || {};
  const definitions = {};
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const input = rows[i];
    const raw = typeof input === "string" ? input : String((input && input.text) || "");
    const row = { index: i, text: raw, kind: "empty", label: raw, error: "" };
    try {
      const parsed = parseGraphRow(raw);
      row.kind = parsed.kind;
      row.label = parsed.label;
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
      } else if (parsed.kind === "explicit") {
        const compiled = compileScoped(parsed.body, ["x"], definitions);
        const fn = (x) => compiled({ x });
        row.points = sampleExplicit(fn, view, samples);
        if (!row.points.some((point) => point.y !== null)) row.error = "That expression has no real values in this window.";
      } else if (parsed.kind === "implicit") {
        const fn = compileRelation(parsed.lhs, parsed.rhs, definitions);
        row.segments = traceImplicit(fn, view, resolution);
        if (!row.segments.length) row.error = "That equation has no points in this window.";
      }
    } catch (e) {
      row.error = String((e && e.message) || e) || "That row is not valid.";
      if (row.kind === "empty") row.kind = "invalid";
    }
    out.push(row);
  }
  return {
    rows: out,
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
  compileScoped,
  parseGraphRow,
  sampleExplicit,
  tokenize,
  traceImplicit,
};
