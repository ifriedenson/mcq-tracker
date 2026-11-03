"use strict";
/*
 * Local complex arithmetic and a small complex expression parser.
 *
 * Values are plain `{re, im}` objects. The parser never evaluates text and
 * accepts only numbers, the constants i/pi/e/tau, named variables supplied by
 * the caller, the operators + - * / ^, parentheses, and a small function table.
 * It is shared by the Calculator tab and the later complex graph mode.
 */

const EPSILON = 1e-12;

function make(re, im) {
  const real = Number(re);
  const imaginary = Number(im);
  return { re: Number.isFinite(real) ? real : NaN, im: Number.isFinite(imaginary) ? imaginary : NaN };
}

function from(value) {
  if (value && typeof value === "object" && "re" in value) return make(value.re, value.im);
  return make(value, 0);
}

function finite(value) {
  const z = from(value);
  return Number.isFinite(z.re) && Number.isFinite(z.im);
}

function add(a, b) {
  const x = from(a);
  const y = from(b);
  return make(x.re + y.re, x.im + y.im);
}

function sub(a, b) {
  const x = from(a);
  const y = from(b);
  return make(x.re - y.re, x.im - y.im);
}

function neg(a) {
  const x = from(a);
  return make(-x.re, -x.im);
}

function mul(a, b) {
  const x = from(a);
  const y = from(b);
  return make(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
}

function div(a, b) {
  const x = from(a);
  const y = from(b);
  const denominator = y.re * y.re + y.im * y.im;
  if (!(denominator > 0) || !Number.isFinite(denominator)) return make(NaN, NaN);
  return make((x.re * y.re + x.im * y.im) / denominator, (x.im * y.re - x.re * y.im) / denominator);
}

function abs(a) {
  const x = from(a);
  return Math.hypot(x.re, x.im);
}

function arg(a) {
  const x = from(a);
  return Math.atan2(x.im, x.re);
}

function conj(a) {
  const x = from(a);
  return make(x.re, -x.im);
}

function exp(a) {
  const x = from(a);
  const scale = Math.exp(x.re);
  return make(scale * Math.cos(x.im), scale * Math.sin(x.im));
}

function log(a) {
  const x = from(a);
  if (x.re === 0 && x.im === 0) return make(-Infinity, 0);
  return make(Math.log(abs(x)), arg(x));
}

/** Principal square root. */
function sqrt(a) {
  const x = from(a);
  const radius = abs(x);
  if (!Number.isFinite(radius)) return make(NaN, NaN);
  if (radius === 0) return make(0, 0);
  const real = Math.sqrt(Math.max(0, (radius + x.re) / 2));
  const imaginary = Math.sign(x.im || 1) * Math.sqrt(Math.max(0, (radius - x.re) / 2));
  return make(real, imaginary);
}

function pow(a, b) {
  const base = from(a);
  const exponent = from(b);
  if (base.re === 0 && base.im === 0) {
    if (exponent.im === 0 && exponent.re > 0) return make(0, 0);
    return make(NaN, NaN);
  }
  if (exponent.im === 0 && Number.isInteger(exponent.re) && Math.abs(exponent.re) <= 64) {
    let result = make(1, 0);
    const count = Math.abs(exponent.re);
    for (let i = 0; i < count; i++) result = mul(result, base);
    return exponent.re < 0 ? div(make(1, 0), result) : result;
  }
  return exp(mul(exponent, log(base)));
}

function sin(a) {
  const x = from(a);
  return make(Math.sin(x.re) * Math.cosh(x.im), Math.cos(x.re) * Math.sinh(x.im));
}

function cos(a) {
  const x = from(a);
  return make(Math.cos(x.re) * Math.cosh(x.im), -Math.sin(x.re) * Math.sinh(x.im));
}

function tan(a) {
  return div(sin(a), cos(a));
}

function sinh(a) {
  const x = from(a);
  return make(Math.sinh(x.re) * Math.cos(x.im), Math.cosh(x.re) * Math.sin(x.im));
}

function cosh(a) {
  const x = from(a);
  return make(Math.cosh(x.re) * Math.cos(x.im), Math.sinh(x.re) * Math.sin(x.im));
}

function tanh(a) {
  return div(sinh(a), cosh(a));
}

function roundPart(value, digits) {
  if (!Number.isFinite(value)) return "—";
  const rounded = Number(value.toPrecision(digits || 10));
  return Math.abs(rounded) < EPSILON ? 0 : Object.is(rounded, -0) ? 0 : rounded;
}

function format(value, digits) {
  const z = from(value);
  if (!finite(z)) return "—";
  const re = roundPart(z.re, digits);
  const im = roundPart(z.im, digits);
  if (im === 0) return String(re);
  const imaginary = Math.abs(im) === 1 ? "i" : `${Math.abs(im)}i`;
  if (re === 0) return im < 0 ? `-${imaginary}` : imaginary;
  return `${re} ${im < 0 ? "-" : "+"} ${imaginary}`;
}

function isZero(value) {
  const z = from(value);
  return z.re === 0 && z.im === 0;
}

const CONSTANTS = {
  i: make(0, 1),
  pi: make(Math.PI, 0),
  e: make(Math.E, 0),
  tau: make(Math.PI * 2, 0),
};

const FUNCTIONS = {
  abs: (z) => make(abs(z), 0),
  arg: (z) => make(arg(z), 0),
  conj: (z) => conj(z),
  re: (z) => make(z.re, 0),
  im: (z) => make(z.im, 0),
  sqrt: (z) => sqrt(z),
  exp: (z) => exp(z),
  ln: (z) => log(z),
  log: (z) => log(z),
  sin: (z) => sin(z),
  cos: (z) => cos(z),
  tan: (z) => tan(z),
  sinh: (z) => sinh(z),
  cosh: (z) => cosh(z),
  tanh: (z) => tanh(z),
};

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;

function tokenize(source) {
  const text = String(source || "");
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const rest = text.slice(index);
    if (/^\s+/.test(rest)) {
      index += rest.match(/^\s+/)[0].length;
      continue;
    }
    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({ type: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident) {
      tokens.push({ type: "ident", value: ident[0] });
      index += ident[0].length;
      continue;
    }
    const ch = text[index];
    if ("+-*/^(),".includes(ch)) {
      tokens.push({ type: ch });
      index++;
      continue;
    }
    throw new Error(`Unsupported character "${ch}".`);
  }
  tokens.push({ type: "end" });
  return tokens;
}

function startsPrimary(token) {
  return token && (token.type === "number" || token.type === "ident" || token.type === "(");
}

/**
 * Compile a complex expression. `options.variables` lists runtime names such as
 * `z`; the returned function takes a scope object of numbers or complex values.
 */
function compileComplex(source, options) {
  const opts = options || {};
  const variables = new Set(Array.isArray(opts.variables) ? opts.variables : []);
  const tokens = tokenize(source);
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function take(type) {
    const token = tokens[index];
    if (token.type !== type) throw new Error(`Expected ${type === ")" ? "a closing parenthesis" : type}.`);
    index++;
    return token;
  }

  function parsePrimary() {
    const token = peek();
    if (token.type === "number") {
      index++;
      return () => make(token.value, 0);
    }
    if (token.type === "(") {
      index++;
      const inner = parseExpression();
      take(")");
      return inner;
    }
    if (token.type === "ident") {
      index++;
      const name = token.value;
      if (peek().type === "(") {
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Unknown function "${name}".`);
        index++;
        const argument = parseExpression();
        take(")");
        return (scope) => fn(argument(scope));
      }
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
        const value = CONSTANTS[name];
        return () => value;
      }
      if (variables.has(name)) {
        return (scope) => from(scope && scope[name] !== undefined ? scope[name] : 0);
      }
      throw new Error(`Unknown name "${name}".`);
    }
    throw new Error("Expected a number, name or opening parenthesis.");
  }

  function parsePower() {
    let base = parsePrimary();
    if (peek().type === "^") {
      index++;
      const exponent = parseUnary();
      const previous = base;
      base = (scope) => pow(previous(scope), exponent(scope));
    }
    return base;
  }

  function parseUnary() {
    const token = peek();
    if (token.type === "+") {
      index++;
      return parseUnary();
    }
    if (token.type === "-") {
      index++;
      const value = parseUnary();
      return (scope) => neg(value(scope));
    }
    return parsePower();
  }

  function parseTerm() {
    let left = parseUnary();
    for (;;) {
      const token = peek();
      if (token.type === "*" || token.type === "/") {
        index++;
        const right = parseUnary();
        const previous = left;
        left = token.type === "*" ? (scope) => mul(previous(scope), right(scope)) : (scope) => div(previous(scope), right(scope));
        continue;
      }
      if (startsPrimary(token)) {
        const right = parseUnary();
        const previous = left;
        left = (scope) => mul(previous(scope), right(scope));
        continue;
      }
      break;
    }
    return left;
  }

  function parseExpression() {
    let left = parseTerm();
    for (;;) {
      const token = peek();
      if (token.type !== "+" && token.type !== "-") break;
      index++;
      const right = parseTerm();
      const previous = left;
      left = token.type === "+" ? (scope) => add(previous(scope), right(scope)) : (scope) => sub(previous(scope), right(scope));
    }
    return left;
  }

  const evaluate = parseExpression();
  if (peek().type !== "end") throw new Error("That expression has extra characters.");
  return evaluate;
}

function evaluateComplexText(expression, options) {
  const text = String(expression || "").trim();
  if (!text) return { ok: false, value: null, text: "", error: "Enter a calculation." };
  try {
    const value = compileComplex(text, options)({});
    if (!finite(value)) return { ok: false, value: null, text: "", error: "That result is not a finite complex number." };
    return { ok: true, value, text: format(value), error: "" };
  } catch (e) {
    return { ok: false, value: null, text: "", error: e && e.message ? e.message : "That expression is not valid." };
  }
}

module.exports = {
  CONSTANTS,
  FUNCTIONS,
  abs,
  add,
  arg,
  compileComplex,
  conj,
  cos,
  cosh,
  div,
  evaluateComplexText,
  exp,
  finite,
  format,
  from,
  isZero,
  log,
  make,
  mul,
  neg,
  pow,
  sin,
  sinh,
  sqrt,
  sub,
  tan,
  tanh,
};
