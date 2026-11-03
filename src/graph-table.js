"use strict";
/*
 * Named, multi-column data tables for the Reference graph.
 *
 * A table has columns and rows. A column may be typed per row or computed by an
 * expression over the other columns by name (`2 * time`). Everything here is pure
 * arithmetic and string handling: no DOM, no Obsidian and no third-party code, and
 * expressions are parsed locally rather than passed to eval or Function.
 */

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 8;
const MAX_COLUMN_NAME = 24;
const MAX_EXPRESSION = 200;
const MAX_ROWS = 1000;

const DEFAULT_NAMES = ["x", "y", "z", "w", "u", "v", "s", "t"];

const TABLE_FUNCTIONS = {
  sqrt: { arity: 1, fn: Math.sqrt },
  abs: { arity: 1, fn: Math.abs },
  sin: { arity: 1, fn: Math.sin },
  cos: { arity: 1, fn: Math.cos },
  tan: { arity: 1, fn: Math.tan },
  ln: { arity: 1, fn: Math.log },
  log: { arity: 1, fn: Math.log10 },
  exp: { arity: 1, fn: Math.exp },
  floor: { arity: 1, fn: Math.floor },
  ceil: { arity: 1, fn: Math.ceil },
  sign: { arity: 1, fn: Math.sign },
  round: { arity: 1, fn: (value) => (Number.isFinite(value) ? Math.sign(value) * Math.round(Math.abs(value)) : NaN) },
  min: { arity: 2, fn: Math.min },
  max: { arity: 2, fn: Math.max },
  pow: { arity: 2, fn: Math.pow },
};

const TABLE_CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

function textValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

/** Trim, collapse whitespace and bound an expression. */
function normalizeExpression(value) {
  return textValue(value).replace(/\s+/g, " ").trim().slice(0, MAX_EXPRESSION);
}

/** Make a name safe to reference from an expression: letters, digits and underscores. */
function sanitizeColumnName(value, fallback) {
  let name = textValue(value)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_");
  if (name && !/^[A-Za-z_]/.test(name)) name = `c_${name}`;
  name = name.slice(0, MAX_COLUMN_NAME);
  return name || fallback;
}

function uniqueColumnName(name, used) {
  let candidate = name;
  let suffix = 2;
  while (used.has(candidate)) {
    const tail = `_${suffix}`;
    candidate = `${name.slice(0, MAX_COLUMN_NAME - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

/** Normalise a column list: 2–8 columns, safe unique names, optional expressions. */
function normalizeColumns(value) {
  const list = Array.isArray(value) ? value : [];
  const count = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, list.length));
  const columns = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const entry = list[i];
    const isObject = entry && typeof entry === "object";
    const fallback = DEFAULT_NAMES[i] || `column${i + 1}`;
    const base = isObject ? entry.name : entry;
    const name = uniqueColumnName(sanitizeColumnName(base, fallback), used);
    columns.push({ name, expression: isObject ? normalizeExpression(entry.expression) : "" });
  }
  return columns;
}

/** Keep the stored cells for every column, adding blanks for new columns. */
function normalizeRows(rows, columns) {
  const list = Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : [];
  const names = normalizeColumns(columns).map((column) => column.name);
  return list.map((row) => {
    const source = row && typeof row === "object" ? row : {};
    const cells = {};
    for (const name of names) cells[name] = textValue(source[name]);
    return cells;
  });
}

function normalizeTable(table) {
  const source = table && typeof table === "object" ? table : {};
  const columns = normalizeColumns(source.columns);
  return { columns, rows: normalizeRows(source.rows, columns) };
}

function normalizeRegressionPair(pair, columns) {
  const names = normalizeColumns(columns).map((column) => column.name);
  const source = pair && typeof pair === "object" ? pair : {};
  const x = names.indexOf(source.x) >= 0 ? source.x : names[0];
  const y = names.indexOf(source.y) >= 0 ? source.y : names[1] || names[0];
  return { x, y };
}

/**
 * Compile one column expression against the table's column names.
 * Returns `{ok:true, evaluate(scope)}` or `{ok:false, reason, message}`.
 */
function compileTableExpression(value, names) {
  const source = normalizeExpression(value);
  if (!source) return { ok: false, reason: "empty", message: "Enter a column expression." };
  const allowed = new Set((Array.isArray(names) ? names : []).map(String));
  const references = new Set();
  let pos = 0;

  const skip = () => {
    while (pos < source.length && /\s/.test(source[pos])) pos += 1;
  };
  const syntax = (message) => {
    throw new Error(`${message} (at character ${pos + 1}).`);
  };

  const parseArguments = () => {
    const args = [];
    skip();
    if (source[pos] === ")") {
      pos += 1;
      return args;
    }
    while (pos < source.length) {
      args.push(parseExpression());
      skip();
      if (source[pos] === ",") {
        pos += 1;
        continue;
      }
      if (source[pos] === ")") {
        pos += 1;
        break;
      }
      syntax("Expected a comma or closing parenthesis");
    }
    return args;
  };

  const parsePrimary = () => {
    skip();
    const ch = source[pos];
    if (ch === "(") {
      pos += 1;
      const inner = parseExpression();
      skip();
      if (source[pos] !== ")") syntax("Expected a closing parenthesis");
      pos += 1;
      return inner;
    }
    if (ch !== undefined && /[0-9.]/.test(ch)) {
      const match = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(source.slice(pos));
      if (!match) syntax("Bad number");
      pos += match[0].length;
      const number = Number(match[0]);
      if (!Number.isFinite(number)) syntax("Bad number");
      return () => number;
    }
    if (ch !== undefined && /[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(pos));
      const name = match[0];
      pos += name.length;
      skip();
      if (source[pos] === "(") {
        pos += 1;
        const spec = TABLE_FUNCTIONS[name];
        if (!spec) syntax(`Unknown function "${name}"`);
        const args = parseArguments();
        while (args.length < spec.arity) args.push(() => NaN);
        return (scope) => spec.fn(...args.slice(0, spec.arity).map((arg) => arg(scope)));
      }
      if (Object.prototype.hasOwnProperty.call(TABLE_CONSTANTS, name)) {
        const constant = TABLE_CONSTANTS[name];
        return () => constant;
      }
      if (!allowed.has(name)) syntax(`Unknown column "${name}"`);
      references.add(name);
      return (scope) => {
        const value = scope && scope[name];
        return value === null || value === undefined ? NaN : Number(value);
      };
    }
    syntax("Expected a number, a column name or a parenthesis");
    return () => NaN;
  };

  const parseUnary = () => {
    skip();
    if (source[pos] === "+") {
      pos += 1;
      return parseUnary();
    }
    if (source[pos] === "-") {
      pos += 1;
      const inner = parseUnary();
      return (scope) => -inner(scope);
    }
    return parsePower();
  };

  const parsePower = () => {
    const base = parsePrimary();
    skip();
    if (source[pos] === "^") {
      pos += 1;
      const exponent = parseUnary();
      return (scope) => Math.pow(base(scope), exponent(scope));
    }
    return base;
  };

  const parseTerm = () => {
    let left = parseUnary();
    skip();
    while (source[pos] === "*" || source[pos] === "/") {
      const op = source[pos];
      pos += 1;
      const right = parseUnary();
      const prev = left;
      left = op === "*" ? (scope) => prev(scope) * right(scope) : (scope) => prev(scope) / right(scope);
      skip();
    }
    return left;
  };

  function parseExpression() {
    let left = parseTerm();
    skip();
    while (source[pos] === "+" || source[pos] === "-") {
      const op = source[pos];
      pos += 1;
      const right = parseTerm();
      const prev = left;
      left = op === "+" ? (scope) => prev(scope) + right(scope) : (scope) => prev(scope) - right(scope);
      skip();
    }
    return left;
  }

  let compiled;
  try {
    compiled = parseExpression();
    skip();
    if (pos < source.length) syntax("Unexpected input");
  } catch (error) {
    return { ok: false, reason: "syntax", message: error && error.message ? error.message : "That expression could not be read." };
  }
  return {
    ok: true,
    references: Array.from(references),
    evaluate(scope) {
      try {
        return compiled(scope);
      } catch (e) {
        return NaN;
      }
    },
  };
}

function formatTableValue(value) {
  if (value === null || value === undefined) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return String(Number(number.toPrecision(12)));
}

/**
 * Evaluate every column for every row. Typed columns read their cell; computed
 * columns are resolved by name, so a column may use any other column regardless
 * of its position. Cycles and bad expressions become column errors, never throws.
 */
function resolveTable(columnsInput, rowsInput) {
  const columns = normalizeColumns(columnsInput);
  const rows = normalizeRows(rowsInput, columns);
  const names = columns.map((column) => column.name);
  const values = {};
  const byName = {};
  const errors = [];
  const visiting = new Set();

  for (const column of columns) {
    if (column.expression) continue;
    values[column.name] = rows.map((row, index) => {
      const raw = row[column.name];
      if (textValue(raw).trim() === "") return null;
      const number = Number(raw);
      if (!Number.isFinite(number)) {
        if (!errors.some((entry) => entry.column === column.name)) {
          errors.push({ column: column.name, message: `Column "${column.name}" has a value that is not a number (row ${index + 1}).` });
        }
        return null;
      }
      return number;
    });
  }

  const computedValues = (name) => {
    if (Object.prototype.hasOwnProperty.call(values, name) && values[name]) return values[name];
    const column = columns.find((entry) => entry.name === name);
    if (!column) return rows.map(() => null);
    if (visiting.has(name)) throw new Error(`Column "${name}" depends on itself.`);
    if (!column.expression) return rows.map(() => null);
    visiting.add(name);
    const compiled = compileTableExpression(column.expression, names);
    if (!compiled.ok) {
      errors.push({ column: name, message: `Column "${name}": ${compiled.message}` });
      values[name] = rows.map(() => null);
      visiting.delete(name);
      return values[name];
    }
    const out = rows.map((row, index) => {
      const scope = {};
      for (const other of columns) {
        if (other.name === name) continue;
        const source = other.expression ? computedValues(other.name) : values[other.name];
        scope[other.name] = source ? source[index] : null;
      }
      if (compiled.references.some((key) => scope[key] === null || scope[key] === undefined)) return null;
      const result = compiled.evaluate(scope);
      if (!Number.isFinite(result)) {
        if (!errors.some((entry) => entry.column === name)) {
          errors.push({ column: name, message: `Column "${name}" is not a number at row ${index + 1}.` });
        }
        return null;
      }
      return result;
    });
    visiting.delete(name);
    values[name] = out;
    return out;
  };

  for (const column of columns) {
    if (!column.expression) continue;
    try {
      computedValues(column.name);
    } catch (error) {
      visiting.clear();
      values[column.name] = rows.map(() => null);
      if (!errors.some((entry) => entry.column === column.name)) {
        errors.push({ column: column.name, message: error && error.message ? error.message : `Column "${column.name}" could not be computed.` });
      }
    }
  }

  for (const column of columns) {
    byName[column.name] = {
      name: column.name,
      expression: column.expression,
      computed: Boolean(column.expression),
      values: values[column.name] || rows.map(() => null),
    };
  }
  return { columns, rows, names, byName, errors };
}

/**
 * The numeric x/y pair a regression row fits, chosen by column name. Blank or
 * non-numeric cells are skipped, and a missing column pair is refused honestly.
 */
function regressionPair(columns, rows, xName, yName) {
  const resolved = resolveTable(columns, rows);
  for (const requested of [xName, yName]) {
    if (requested === undefined || requested === null || String(requested) === "") continue;
    if (resolved.names.indexOf(String(requested)) < 0) {
      return { ok: false, reason: "column", message: `There is no table column named "${requested}".` };
    }
  }
  const pair = normalizeRegressionPair({ x: xName, y: yName }, resolved.columns);
  const xColumn = resolved.byName[pair.x];
  const yColumn = resolved.byName[pair.y];
  if (!xColumn || !yColumn) {
    return { ok: false, reason: "column", message: "Choose two table columns for the regression." };
  }
  const points = [];
  for (let i = 0; i < resolved.rows.length; i++) {
    const x = xColumn.values[i];
    const y = yColumn.values[i];
    if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ x, y });
  }
  return { ok: true, points, xName: pair.x, yName: pair.y, skipped: resolved.rows.length - points.length };
}

/** One sentence for the screen-reader summary, including computed columns and the pair. */
function tableSummary(columns, rows, pair) {
  const resolved = resolveTable(columns, rows);
  const labels = resolved.columns.map((column) => (column.expression ? `${column.name} (computed)` : column.name));
  const chosen = normalizeRegressionPair(pair, resolved.columns);
  const count = resolved.rows.length;
  const head = `Data table with ${resolved.columns.length} columns: ${labels.join(", ")} and ${count} row${count === 1 ? "" : "s"}.`;
  return `${head} Regression uses ${chosen.x} and ${chosen.y}.`;
}

/** Rows and headers for CSV: resolved values, named headers, fully blank rows skipped. */
function tableExport(columns, rows) {
  const resolved = resolveTable(columns, rows);
  const headers = resolved.columns.map((column) => column.name);
  const out = [];
  for (let i = 0; i < resolved.rows.length; i++) {
    const row = {};
    let filled = false;
    for (const column of resolved.columns) {
      // Typed cells are exported exactly as entered; a computed cell is its resolved value.
      const value = column.expression
        ? formatTableValue(resolved.byName[column.name].values[i])
        : textValue(resolved.rows[i][column.name]);
      row[column.name] = value;
      if (value) filled = true;
    }
    if (filled) out.push(row);
  }
  return { headers, rows: out };
}

module.exports = {
  MIN_COLUMNS,
  MAX_COLUMNS,
  MAX_COLUMN_NAME,
  MAX_ROWS,
  normalizeColumns,
  normalizeRows,
  normalizeTable,
  normalizeRegressionPair,
  sanitizeColumnName,
  normalizeExpression,
  compileTableExpression,
  resolveTable,
  regressionPair,
  tableSummary,
  tableExport,
  formatTableValue,
};
