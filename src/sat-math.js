"use strict";
/*
 * SAT Math-style fenced blocks. A block contains one or more Solve, Inequality,
 * Line, System, Quadratic, Percent or Ratio commands. Everything is local and read-only.
 * Score prediction is deliberately not estimated: a scaled SAT score needs an
 * official curve, so this module only shows the mathematics.
 *
 *   ```sat-math
 *   Solve: 2x + 3 = 11
 *   Quadratic: x^2 - 5x + 6 = 0
 *   System: 2x + y = 7; x - y = 2
 *   Percent: 15% of 80
 *   Ratio: 3:4 = 9:x
 *   ```
 */
const { str } = require("./util");

const COMMAND = /^(Solve|Equation|Inequality|System|Quadratic|Percent|Ratio|Line)\s*:\s*(.*)$/i;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function clean(value) {
  return str(value).replace(/\s+/g, " ").trim();
}

function normalizeExpr(value) {
  return clean(value).replace(/[−–]/g, "-").replace(/[×·]/g, "*").replace(/²/g, "^2");
}

function isNumber(text) {
  return NUMBER.test(text);
}

function numberValue(text) {
  return isNumber(text) ? Number(text) : NaN;
}

function fmt(value) {
  if (!Number.isFinite(value)) return "undefined";
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** Parse `ax + by + c` into coefficients; reject powers, division and unknown letters. */
function parseSide(side, vars) {
  const text = normalizeExpr(side).replace(/\s+/g, "");
  if (!text || text.includes("/")) return null;
  const tokens = text.match(/[+-]?[^+-]+/g);
  if (!tokens) return null;
  const out = { coef: {}, constant: 0 };
  for (const variable of vars) out.coef[variable] = 0;
  for (const token of tokens) {
    if (!token || token === "+" || token === "-" || token.includes("^")) return null;
    const variable = vars.find((name) => token.endsWith(name));
    if (variable) {
      const raw = token.slice(0, -variable.length).replace(/\*+$/, "");
      if (raw.includes("*") || raw.endsWith(".")) return null;
      const coef = raw === "" || raw === "+" ? 1 : raw === "-" ? -1 : numberValue(raw);
      if (!Number.isFinite(coef)) return null;
      out.coef[variable] += coef;
    } else {
      if (!isNumber(token)) return null;
      out.constant += Number(token);
    }
  }
  return out;
}

function splitEquation(equation) {
  const text = normalizeExpr(equation);
  const parts = text.split("=");
  return parts.length === 2 ? parts.map((part) => part.trim()) : null;
}

function invalid(kind, prompt, error) {
  return { valid: false, kind, prompt, answer: "", steps: [], error };
}

function linearFromCoefficients(a, b, equation) {
  const prompt = clean(equation);
  if (a === 0) {
    if (b === 0) {
      return {
        valid: true,
        kind: "Linear equation",
        prompt,
        answer: "Every value of x works.",
        steps: [`Start: ${prompt}.`, "The x terms cancel and the constants are equal, so the equation is an identity."],
      };
    }
    return {
      valid: true,
      kind: "Linear equation",
      prompt,
      answer: "No solution.",
      steps: [`Start: ${prompt}.`, "The x terms cancel and the constants disagree, so no x can satisfy the equation."],
    };
  }
  const x = b / a;
  const steps = [`Start: ${prompt}.`, `Collect the x terms: ${fmt(a)}x = ${fmt(b)}.`];
  if (a !== 1) steps.push(`Divide both sides by ${fmt(a)}: x = ${fmt(x)}.`);
  else steps.push(`Read off the solution: x = ${fmt(x)}.`);
  return { valid: true, kind: "Linear equation", prompt, answer: `x = ${fmt(x)}`, steps };
}

function solveLinear(equation) {
  const parts = splitEquation(equation);
  if (!parts) return invalid("Linear equation", clean(equation), "Use one equals sign, for example 2x + 3 = 11.");
  const left = parseSide(parts[0], ["x"]);
  const right = parseSide(parts[1], ["x"]);
  if (!left || !right) return invalid("Linear equation", clean(equation), "Use only numbers, x, +, - and multiplication, with no powers or division.");
  return linearFromCoefficients(left.coef.x - right.coef.x, right.constant - left.constant, equation);
}

function solveInequality(input) {
  const prompt = clean(input).replace(/≤/g, "<=").replace(/≥/g, ">=");
  const match = prompt.match(/(<=|>=|<|>)/);
  if (!match) return invalid("Inequality", prompt, "Use an inequality sign such as <, <=, > or >=.");
  const at = prompt.indexOf(match[1]);
  const left = parseSide(prompt.slice(0, at), ["x"]);
  const right = parseSide(prompt.slice(at + match[1].length), ["x"]);
  if (!left || !right) return invalid("Inequality", prompt, "Use only numbers, x, +, - and multiplication, with no powers or division.");
  const a = left.coef.x - right.coef.x;
  const b = right.constant - left.constant;
  let op = match[1];
  const steps = [`Start: ${prompt}.`, `Collect the x terms: ${fmt(a)}x ${op} ${fmt(b)}.`];
  if (a === 0) {
    const holds = op === "<" ? 0 < b : op === "<=" ? 0 <= b : op === ">" ? 0 > b : 0 >= b;
    steps.push(`The x terms cancel, leaving 0 ${op} ${fmt(b)}, which is ${holds ? "true" : "false"}.`);
    return { valid: true, kind: "Inequality", prompt, answer: holds ? "Every real value of x works." : "No solution.", steps };
  }
  if (a < 0) {
    op = op === "<" ? ">" : op === "<=" ? ">=" : op === ">" ? "<" : "<=";
    steps.push("Divide by a negative number and flip the inequality sign.");
  }
  const x = b / a;
  steps.push(`Divide both sides by ${fmt(a)}: x ${op} ${fmt(x)}.`);
  return { valid: true, kind: "Inequality", prompt, answer: `x ${op} ${fmt(x)}`, steps };
}

function solveLine(input) {
  const prompt = clean(input).replace(/^line\s*:\s*/i, "");
  const points = [...prompt.matchAll(/\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
  if (points.length !== 2) return invalid("Line", prompt, "Use two points like (1, 2) and (3, 6).");
  const [first, second] = points;
  if (first.x === second.x && first.y === second.y) return invalid("Line", prompt, "Use two different points.");
  const steps = [`Start: ${prompt}.`];
  if (first.x === second.x) {
    steps.push(`The x-values are equal (${fmt(first.x)}), so the line is vertical and the slope is undefined.`);
    return { valid: true, kind: "Line", prompt, answer: `x = ${fmt(first.x)}`, steps };
  }
  const slope = (second.y - first.y) / (second.x - first.x);
  const intercept = first.y - slope * first.x;
  steps.push(`Slope = (y2 - y1) / (x2 - x1) = (${fmt(second.y)} - ${fmt(first.y)}) / (${fmt(second.x)} - ${fmt(first.x)}) = ${fmt(slope)}.`);
  steps.push(`Use y = mx + b at (${fmt(first.x)}, ${fmt(first.y)}): b = ${fmt(first.y)} - (${fmt(slope)})(${fmt(first.x)}) = ${fmt(intercept)}.`);
  let equation;
  if (slope === 0) equation = `y = ${fmt(intercept)}`;
  else {
    const m = slope === 1 ? "x" : slope === -1 ? "-x" : `${fmt(slope)}x`;
    equation = intercept === 0 ? `y = ${m}` : `y = ${m} ${intercept > 0 ? "+" : "-"} ${fmt(Math.abs(intercept))}`;
  }
  steps.push(`The line is ${equation}.`);
  return { valid: true, kind: "Line", prompt, answer: equation, steps };
}

/** Parse a quadratic side into ax² + bx + c. */
function parseQuadraticSide(side) {
  const text = normalizeExpr(side).replace(/\s+/g, "");
  if (!text || text.includes("/")) return null;
  const tokens = text.match(/[+-]?[^+-]+/g);
  if (!tokens) return null;
  const out = { a: 0, b: 0, c: 0 };
  for (const token of tokens) {
    if (!token || token === "+" || token === "-") return null;
    if (token.includes("^")) {
      if (!/x\^2$/.test(token)) return null;
      const raw = token.slice(0, -3).replace(/\*+$/, "");
      const coef = raw === "" || raw === "+" ? 1 : raw === "-" ? -1 : numberValue(raw);
      if (!Number.isFinite(coef)) return null;
      out.a += coef;
    } else if (token.endsWith("x")) {
      const raw = token.slice(0, -1).replace(/\*+$/, "");
      const coef = raw === "" || raw === "+" ? 1 : raw === "-" ? -1 : numberValue(raw);
      if (!Number.isFinite(coef)) return null;
      out.b += coef;
    } else if (isNumber(token)) {
      out.c += Number(token);
    } else {
      return null;
    }
  }
  return out;
}

function solveQuadratic(equation) {
  const parts = splitEquation(equation);
  if (!parts) return invalid("Quadratic equation", clean(equation), "Use one equals sign, for example x^2 - 5x + 6 = 0.");
  const left = parseQuadraticSide(parts[0]);
  const right = parseQuadraticSide(parts[1]);
  if (!left || !right) return invalid("Quadratic equation", clean(equation), "Use only x^2, x, numbers, +, - and multiplication.");
  const a = left.a - right.a;
  const b = left.b - right.b;
  const c = left.c - right.c;
  const prompt = clean(equation);
  if (a === 0) return linearFromCoefficients(b, -c, equation);
  const d = b * b - 4 * a * c;
  const steps = [
    `Start: ${prompt}.`,
    `Write it as ax^2 + bx + c = 0 with a = ${fmt(a)}, b = ${fmt(b)}, c = ${fmt(c)}.`,
    `Discriminant: b^2 - 4ac = ${fmt(b)}^2 - 4(${fmt(a)})(${fmt(c)}) = ${fmt(d)}.`,
  ];
  if (d < 0) {
    steps.push("A negative discriminant means there are no real solutions.");
    return { valid: true, kind: "Quadratic equation", prompt, answer: "No real solutions.", steps };
  }
  if (d === 0) {
    const root = -b / (2 * a);
    steps.push(`One repeated root: x = -b / (2a) = ${fmt(root)}.`);
    return { valid: true, kind: "Quadratic equation", prompt, answer: `x = ${fmt(root)}`, steps };
  }
  const root1 = (-b - Math.sqrt(d)) / (2 * a);
  const root2 = (-b + Math.sqrt(d)) / (2 * a);
  steps.push(`Use x = (-b ± √D) / (2a): x = (${fmt(-b)} ± √${fmt(d)}) / ${fmt(2 * a)}.`);
  steps.push(`The two roots are ${fmt(root1)} and ${fmt(root2)}.`);
  return { valid: true, kind: "Quadratic equation", prompt, answer: `x = ${fmt(root1)} or x = ${fmt(root2)}`, steps };
}

function solveSystem(input) {
  const prompt = clean(input);
  const equations = prompt.split(";").map((part) => part.trim()).filter(Boolean);
  if (equations.length !== 2) return invalid("System of equations", prompt, "Write exactly two equations separated by a semicolon.");
  const parsed = [];
  for (const equation of equations) {
    const parts = splitEquation(equation);
    if (!parts) return invalid("System of equations", prompt, `Could not read "${equation}". Use one equals sign per equation.`);
    const left = parseSide(parts[0], ["x", "y"]);
    const right = parseSide(parts[1], ["x", "y"]);
    if (!left || !right) return invalid("System of equations", prompt, `Could not read "${equation}". Use only x, y, numbers, +, - and multiplication.`);
    parsed.push({
      a: left.coef.x - right.coef.x,
      b: left.coef.y - right.coef.y,
      c: right.constant - left.constant,
      equation,
    });
  }
  const [first, second] = parsed;
  const det = first.a * second.b - second.a * first.b;
  const steps = [`Equation 1: ${first.equation}.`, `Equation 2: ${second.equation}.`, `Determinant: (${fmt(first.a)})(${fmt(second.b)}) - (${fmt(second.a)})(${fmt(first.b)}) = ${fmt(det)}.`];
  if (det === 0) {
    steps.push("A zero determinant means the lines are parallel or identical, so there is no unique solution.");
    return { valid: true, kind: "System of equations", prompt, answer: "No unique solution.", steps };
  }
  const x = (first.c * second.b - second.c * first.b) / det;
  const y = (first.a * second.c - second.a * first.c) / det;
  steps.push(`x = (c1·b2 - c2·b1) / D = ${fmt(x)}.`);
  steps.push(`y = (a1·c2 - a2·c1) / D = ${fmt(y)}.`);
  return { valid: true, kind: "System of equations", prompt, answer: `x = ${fmt(x)}, y = ${fmt(y)}`, steps };
}

function solvePercent(input) {
  const prompt = clean(input);
  const match = prompt.match(/([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*%\s*(?:of)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/i);
  if (!match) return invalid("Percent", prompt, "Use a phrase like 15% of 80.");
  const rate = Number(match[1]);
  const base = Number(match[2]);
  const answer = (rate / 100) * base;
  return {
    valid: true,
    kind: "Percent",
    prompt,
    answer: fmt(answer),
    steps: [`Start: ${prompt}.`, `${fmt(rate)}% = ${fmt(rate / 100)}.`, `${fmt(rate / 100)} × ${fmt(base)} = ${fmt(answer)}.`],
  };
}

function solveRatio(input) {
  const prompt = clean(input);
  const match = prompt.match(/^([^:]+):([^:]+)=([^:]+):([^:]+)$/);
  if (!match) return invalid("Ratio", prompt, "Use a proportion like 3:4 = 9:x.");
  const parts = match.slice(1).map((part) => part.trim());
  const variableAt = parts.findIndex((part) => /^x$/i.test(part));
  if (variableAt < 0) return invalid("Ratio", prompt, "Include one x in the proportion.");
  if (parts.filter((part) => /^x$/i.test(part)).length > 1) return invalid("Ratio", prompt, "Use exactly one x.");
  const values = parts.map((part, index) => (index === variableAt ? NaN : numberValue(part)));
  if (values.some((value, index) => index !== variableAt && !Number.isFinite(value))) {
    return invalid("Ratio", prompt, "Use numbers and one x.");
  }
  const [a, b, c, d] = values;
  const coefficients = [d, c, b, a];
  const constants = [b * c, a * d, a * d, b * c];
  const coefficient = coefficients[variableAt];
  const constant = constants[variableAt];
  if (coefficient === 0) return invalid("Ratio", prompt, "The cross-multiplied coefficient is zero, so x cannot be isolated.");
  const x = constant / coefficient;
  return {
    valid: true,
    kind: "Ratio",
    prompt,
    answer: `x = ${fmt(x)}`,
    steps: [`Start: ${prompt}.`, `Cross-multiply: ${fmt(a)} × ${fmt(d)} = ${fmt(b)} × ${fmt(c)}.`, `Solve: ${fmt(coefficient)}x = ${fmt(constant)}, so x = ${fmt(x)}.`],
  };
}

function detectKind(text) {
  if (/(<=|>=|<|>|≤|≥)/.test(text)) return "inequality";
  if (/;/.test(text)) return "system";
  if (/\^2/.test(text)) return "quadratic";
  if (/%/.test(text)) return "percent";
  if (/:/.test(text) && /=/.test(text)) return "ratio";
  return "linear";
}

function solveCommand(kind, input) {
  const text = clean(input);
  if (!text) return invalid("SAT Math", "", "Add an expression after the command.");
  const resolved = kind === "solve" || kind === "equation" ? detectKind(text) : kind;
  if (resolved === "inequality") return solveInequality(text);
  if (resolved === "line") return solveLine(text);
  if (resolved === "system") return solveSystem(text);
  if (resolved === "quadratic") return solveQuadratic(text);
  if (resolved === "percent") return solvePercent(text);
  if (resolved === "ratio") return solveRatio(text);
  return solveLinear(text);
}

function parseSatMath(source) {
  const lines = str(source).replace(/\r\n?/g, "\n").split("\n");
  const problems = [];
  const issues = [];
  let pending = null;
  const push = () => {
    if (!pending) return;
    const solved = solveCommand(pending.kind, pending.input);
    problems.push(solved);
    if (!solved.valid && solved.error) issues.push(solved.error);
    pending = null;
  };
  for (const line of lines) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const match = text.match(COMMAND);
    if (match) {
      push();
      pending = { kind: match[1].toLowerCase(), input: match[2].trim() };
      continue;
    }
    if (!pending) {
      issues.push(`Could not read "${text.slice(0, 60)}". Start each problem with Solve:, Inequality:, Line:, System:, Quadratic:, Percent: or Ratio:.`);
      continue;
    }
    pending.input = pending.input ? `${pending.input}${pending.kind === "system" ? "; " : " "}${text}` : text;
  }
  push();
  if (!problems.length && !issues.length) issues.push("Add a Solve: line with an equation, for example Solve: 2x + 3 = 11.");
  return { problems, issues };
}

function normalizeSatMathSettings(value) {
  return { enabled: !value || value.enabled !== false };
}

function renderSatMathBlock(plugin, source, el) {
  if (plugin && typeof plugin.satMathEnabled === "function" && !plugin.satMathEnabled()) {
    el.createDiv({ cls: "qt-sat-math-issue", text: "SAT Math is off. Turn it on in Settings, Global, Modules." });
    return null;
  }
  const parsed = parseSatMath(source);
  const box = el.createDiv({ cls: "qt-sat-math" });
  box.createDiv({ cls: "qt-sat-math-title", text: "SAT Math · step by step" });
  box.createDiv({
    cls: "qt-sat-math-meta",
    text: `${parsed.problems.length} problem${parsed.problems.length === 1 ? "" : "s"} · local solver · no score estimate`,
  });
  for (const issue of parsed.issues.slice(0, 8)) box.createDiv({ cls: "qt-sat-math-issue", text: issue });
  for (const problem of parsed.problems) {
    const card = box.createDiv({ cls: "qt-sat-math-problem" });
    card.createDiv({ cls: "qt-sat-math-kind", text: problem.kind });
    card.createDiv({ cls: "qt-sat-math-prompt", text: problem.prompt });
    if (!problem.valid) {
      card.createDiv({ cls: "qt-sat-math-error", text: problem.error });
      continue;
    }
    card.createDiv({ cls: "qt-sat-math-answer", text: problem.answer });
    const steps = card.createDiv({ cls: "qt-sat-math-steps" });
    for (const step of problem.steps) steps.createDiv({ cls: "qt-sat-math-step", text: step });
  }
  return parsed;
}

module.exports = {
  normalizeSatMathSettings,
  parseSatMath,
  renderSatMathBlock,
  solveCommand,
  solveInequality,
  solveLine,
  solveLinear,
  solvePercent,
  solveQuadratic,
  solveRatio,
  solveSystem,
};
