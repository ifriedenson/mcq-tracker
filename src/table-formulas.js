"use strict";
/*
 * TBLFM formulas and CSV output for Markdown tables.
 *
 * Formulas use the org-mode style documented by Advanced Tables:
 *   <!-- TBLFM: @>$2=sum(@I..@-1) -->
 * References, ranges, arithmetic, sum/mean/count/min/max, conditionals,
 * chained formulas and numeric formatting are parsed locally. Nothing here
 * uses eval, Function, a DOM or an Obsidian API.
 */

const FORMULA_COMMENT = /^\s*<!--\s*TBLFM:\s*(.*?)\s*-->\s*$/i;
const MAX_FORMULA_LENGTH = 4000;
const MAX_FORMULAS = 100;
const MAX_RANGE_CELLS = 100000;
const MAX_FORMULA_ARGUMENTS = 64;

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function fail(message, reason) {
  return { ok: false, reason: reason || "formula", message };
}

function sameNumber(left, right) {
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function cell(table, row, column) {
  if (!table || !Array.isArray(table.rows) || !table.rows[row]) {
    throw new Error(`Row ${row + 1} is outside the table.`);
  }
  const value = table.rows[row][column];
  if (value === undefined) throw new Error(`Column ${column + 1} is outside the table.`);
  return value;
}

function unescapePipes(value) {
  return text(value).replace(/\\\|/g, "|");
}

function numeric(value) {
  const raw = unescapePipes(value).trim();
  if (!raw) return 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number : NaN;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) throw new Error("The result is not a finite number.");
  const normal = Object.is(value, -0) ? 0 : value;
  return String(Number(normal.toPrecision(12)));
}

function escapeCell(value) {
  let cellText = text(value).replace(/\r\n?/g, "\n").replace(/\n+/g, " ").trim();
  let escaped = "";
  for (let i = 0; i < cellText.length; i += 1) {
    if (cellText[i] === "|" && !isEscaped(cellText, i)) escaped += "\\";
    escaped += cellText[i];
  }
  return escaped;
}

function isEscaped(value, index) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && value[i] === "\\"; i -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function splitFormulas(value) {
  const source = text(value);
  const parts = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && source.slice(i, i + 2) === "::") {
      if (!current.trim()) throw new Error("An empty formula was found.");
      parts.push(current.trim());
      current = "";
      i += 1;
      continue;
    }
    current += source[i];
  }
  if (!current.trim()) throw new Error("An empty formula was found.");
  parts.push(current.trim());
  if (parts.length > MAX_FORMULAS) throw new Error(`A table can have at most ${MAX_FORMULAS} formulas.`);
  return parts;
}

/** Extract contiguous TBLFM comments immediately after a parsed table. */
function parseTableFormulas(lines, table) {
  if (!Array.isArray(lines) || !table) return fail("The table is no longer available.", "table");
  let index = table.end + 1;
  const formulas = [];
  while (index < lines.length) {
    const match = FORMULA_COMMENT.exec(lines[index]);
    if (!match) break;
    const body = text(match[1]).trim();
    if (body.length > MAX_FORMULA_LENGTH) return fail(`A formula is longer than ${MAX_FORMULA_LENGTH} characters.`);
    try {
      formulas.push(...splitFormulas(body));
    } catch (error) {
      return fail(error && error.message ? error.message : "That formula could not be read.");
    }
    if (formulas.length > MAX_FORMULAS) return fail(`A table can have at most ${MAX_FORMULAS} formulas.`);
    index += 1;
  }
  return { ok: true, formulas };
}

function readRowToken(source, position) {
  if (source[position] !== "@") return null;
  let index = position + 1;
  if (source[index] === "<") return { token: { kind: "first" }, next: index + 1 };
  if (source[index] === ">") return { token: { kind: "last" }, next: index + 1 };
  if (source[index] === "I" || source[index] === "i") return { token: { kind: "body" }, next: index + 1 };
  const match = /^([+-]?)(\d+)/.exec(source.slice(index));
  if (!match) throw new Error("Expected a row after @ (use @1, @<, @>, @I, @-1 or @+1).");
  const value = Number(match[2]);
  if (!Number.isInteger(value) || value < 0) throw new Error("That row number is invalid.");
  if (!match[1] && value < 1) throw new Error("Table rows are numbered from 1.");
  return { token: match[1] ? { kind: "relative", value: match[1] === "-" ? -value : value } : { kind: "absolute", value }, next: index + match[0].length };
}

function readColumnToken(source, position) {
  if (source[position] !== "$") return null;
  let index = position + 1;
  if (source[index] === "<") return { token: { kind: "first" }, next: index + 1 };
  if (source[index] === ">") return { token: { kind: "last" }, next: index + 1 };
  const match = /^([+-]?)(\d+)/.exec(source.slice(index));
  if (!match) throw new Error("Expected a column after $ (use $1, $<, $>, $-1 or $+1).");
  const value = Number(match[2]);
  if (!Number.isInteger(value) || value < 0) throw new Error("That column number is invalid.");
  if (!match[1] && value < 1) throw new Error("Table columns are numbered from 1.");
  return { token: match[1] ? { kind: "relative", value: match[1] === "-" ? -value : value } : { kind: "absolute", value }, next: index + match[0].length };
}

function readEndpoint(source, position) {
  let index = position;
  let row = null;
  let column = null;
  const rowPart = readRowToken(source, index);
  if (rowPart) {
    row = rowPart.token;
    index = rowPart.next;
  }
  const columnPart = readColumnToken(source, index);
  if (columnPart) {
    column = columnPart.token;
    index = columnPart.next;
  }
  if (!row && !column) return null;
  return {
    endpoint: { row, column, rowOnly: Boolean(row && !column), columnOnly: Boolean(column && !row) },
    next: index,
  };
}

function readReference(source, position) {
  const first = readEndpoint(source, position);
  if (!first) throw new Error("Expected a cell reference such as @2$3, @< or $>.");
  let index = first.next;
  let second = null;
  if (source.slice(index, index + 2) === "..") {
    index += 2;
    const part = readEndpoint(source, index);
    if (!part) throw new Error("Expected a reference after the range dots.");
    second = part.endpoint;
    index = part.next;
  }
  return { reference: { first: first.endpoint, second }, next: index };
}

function resolveRow(token, destinationRow, table) {
  if (token.kind === "absolute") return token.value - 1;
  if (token.kind === "first") return 0;
  if (token.kind === "last") return table.rows.length - 1;
  if (token.kind === "body") return Math.min(table.rows.length - 1, Math.max(0, table.headerCount || 1));
  return destinationRow + token.value;
}

function resolveColumn(token, destinationColumn, table) {
  if (token.kind === "absolute") return token.value - 1;
  if (token.kind === "first") return 0;
  if (token.kind === "last") return table.columns - 1;
  return destinationColumn + token.value;
}

function ensureRow(table, row) {
  if (!Number.isInteger(row) || row < 0 || row >= table.rows.length) throw new Error("A formula reference points outside the table.");
  return row;
}

function ensureColumn(table, column) {
  if (!Number.isInteger(column) || column < 0 || column >= table.columns) throw new Error("A formula reference points outside the table.");
  return column;
}

function cellList(table, rowStart, rowEnd, columnStart, columnEnd) {
  const firstRow = ensureRow(table, Math.min(rowStart, rowEnd));
  const lastRow = ensureRow(table, Math.max(rowStart, rowEnd));
  const firstColumn = ensureColumn(table, Math.min(columnStart, columnEnd));
  const lastColumn = ensureColumn(table, Math.max(columnStart, columnEnd));
  if ((lastRow - firstRow + 1) * (lastColumn - firstColumn + 1) > MAX_RANGE_CELLS) {
    throw new Error(`A range cannot contain more than ${MAX_RANGE_CELLS} cells.`);
  }
  const cells = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) cells.push({ row, column });
  }
  return cells;
}

function expressionCell(table, reference, destinationRow, destinationColumn) {
  const first = reference.first;
  const row = first.row ? resolveRow(first.row, destinationRow, table) : destinationRow;
  const column = first.column ? resolveColumn(first.column, destinationColumn, table) : destinationColumn;
  return { row: ensureRow(table, row), column: ensureColumn(table, column) };
}

function expressionRange(table, reference, destinationRow, destinationColumn) {
  const first = reference.first;
  const second = reference.second;
  const firstRow = first.row ? resolveRow(first.row, destinationRow, table) : null;
  const secondRow = second.row ? resolveRow(second.row, destinationRow, table) : null;
  const firstColumn = first.column ? resolveColumn(first.column, destinationColumn, table) : null;
  const secondColumn = second.column ? resolveColumn(second.column, destinationColumn, table) : null;
  const rowStart = firstRow === null ? (secondRow === null ? destinationRow : secondRow) : firstRow;
  const rowEnd = secondRow === null ? rowStart : secondRow;
  const columnStart = firstColumn === null ? (secondColumn === null ? destinationColumn : secondColumn) : firstColumn;
  const columnEnd = secondColumn === null ? columnStart : secondColumn;
  return cellList(table, rowStart, rowEnd, columnStart, columnEnd);
}

function destinationCells(table, reference) {
  const first = reference.first;
  const second = reference.second;
  const relative = (endpoint) => (endpoint.row && endpoint.row.kind === "relative") || (endpoint.column && endpoint.column.kind === "relative");
  if (relative(first) || (second && relative(second))) {
    throw new Error("The destination cannot use a relative reference.");
  }
  const firstRow = first.row ? resolveRow(first.row, 0, table) : null;
  const secondRow = second ? (second.row ? resolveRow(second.row, 0, table) : null) : null;
  const firstColumn = first.column ? resolveColumn(first.column, 0, table) : null;
  const secondColumn = second ? (second.column ? resolveColumn(second.column, 0, table) : null) : null;

  if (!second) {
    if (firstRow !== null && firstColumn !== null) return [expressionCell(table, reference, 0, 0)];
    if (firstRow !== null) return cellList(table, firstRow, firstRow, 0, table.columns - 1);
    return cellList(table, Math.max(0, table.headerCount || 1), table.rows.length - 1, firstColumn, firstColumn);
  }

  if (firstRow !== null || secondRow !== null) {
    const rowStart = firstRow === null ? secondRow : firstRow;
    const rowEnd = secondRow === null ? rowStart : secondRow;
    if (firstColumn === null && secondColumn === null) return cellList(table, rowStart, rowEnd, 0, table.columns - 1);
    const columnStart = firstColumn === null ? secondColumn : firstColumn;
    const columnEnd = secondColumn === null ? columnStart : secondColumn;
    return cellList(table, rowStart, rowEnd, columnStart, columnEnd);
  }

  const columnStart = firstColumn === null ? secondColumn : firstColumn;
  const columnEnd = secondColumn === null ? columnStart : secondColumn;
  return cellList(table, Math.max(0, table.headerCount || 1), table.rows.length - 1, columnStart, columnEnd);
}

function parseDirective(value) {
  const directive = text(value).trim();
  if (!directive) return { ok: true, directive: null };
  const fixed = /^%\.(\d+)f$/.exec(directive);
  if (fixed) {
    const digits = Number(fixed[1]);
    if (!Number.isInteger(digits) || digits < 0 || digits > 20) return fail("Choose a decimal precision from 0 to 20.");
    return { ok: true, directive: { kind: "fixed", digits } };
  }
  if (directive === "%d") return { ok: true, directive: { kind: "integer" } };
  return fail(`Unsupported TBLFM format "${directive}". Use ;%.2f or ;%d.`);
}

function parseFormulaPart(value) {
  const part = text(value).trim();
  const equals = part.indexOf("=");
  if (equals <= 0 || equals >= part.length - 1) throw new Error('A formula must look like "DEST=SOURCE".');
  const destination = part.slice(0, equals).trim();
  let expression = part.slice(equals + 1).trim();
  let directive = null;
  const formatMatch = /;([^;]+)$/.exec(expression);
  if (formatMatch) {
    expression = expression.slice(0, formatMatch.index).trim();
    const parsed = parseDirective(formatMatch[1]);
    if (!parsed.ok) throw new Error(parsed.message);
    directive = parsed.directive;
  }
  if (!expression) throw new Error("A formula needs a source expression.");
  return { part, destination, expression, directive };
}

function comparison(left, right, operator) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
  if (operator === "==") return numeric ? leftNumber === rightNumber : text(left) === text(right);
  if (operator === "!=") return numeric ? leftNumber !== rightNumber : text(left) !== text(right);
  const a = numeric ? leftNumber : text(left);
  const b = numeric ? rightNumber : text(right);
  if (operator === "<") return a < b;
  if (operator === ">") return a > b;
  if (operator === "<=") return a <= b;
  return a >= b;
}

function evaluateExpression(source, table, destinationRow, destinationColumn) {
  let position = 0;
  const skip = () => {
    while (position < source.length && /\s/.test(source[position])) position += 1;
  };
  const error = (message) => {
    throw new Error(`${message} (at character ${position + 1}).`);
  };
  const scalar = (value) => {
    if (!value || value.kind !== "scalar") error("A range needs sum(), mean(), count(), min() or max().");
    return value.value;
  };
  const number = (value) => {
    const raw = scalar(value);
    const parsed = numeric(raw);
    if (!Number.isFinite(parsed)) error(`"${text(raw)}" is not a number.`);
    return parsed;
  };

  const parseArguments = () => {
    const args = [];
    skip();
    if (source[position] === ")") {
      position += 1;
      return args;
    }
    while (position < source.length) {
      args.push(parseExpression());
      if (args.length > MAX_FORMULA_ARGUMENTS) error(`A function can take at most ${MAX_FORMULA_ARGUMENTS} arguments.`);
      skip();
      if (source[position] === ",") {
        position += 1;
        continue;
      }
      if (source[position] === ")") {
        position += 1;
        break;
      }
      error("Expected a comma or closing parenthesis.");
    }
    return args;
  };

  const aggregateValues = (args) => {
    const values = [];
    const add = (raw) => {
      const value = text(raw).trim() === "" ? null : numeric(raw);
      values.push(value);
    };
    for (const arg of args) {
      if (arg.kind === "range") {
        for (const ref of arg.cells) add(cell(table, ref.row, ref.column));
      } else {
        add(arg.value);
      }
    }
    return values;
  };

  const aggregateRawValues = (args) => {
    const values = [];
    for (const arg of args) {
      if (arg.kind === "range") {
        for (const ref of arg.cells) values.push(cell(table, ref.row, ref.column));
      } else {
        values.push(arg.value);
      }
    }
    return values;
  };

  const parsePrimary = () => {
    skip();
    if (position >= source.length) error("Expected a number, cell reference or function.");
    if (source[position] === "(") {
      position += 1;
      const inner = parseExpression();
      skip();
      if (source[position] !== ")") error("Expected a closing parenthesis.");
      position += 1;
      return inner;
    }
    if (/[0-9.]/.test(source[position])) {
      const match = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(source.slice(position));
      if (!match) error("Bad number.");
      position += match[0].length;
      const value = Number(match[0]);
      if (!Number.isFinite(value)) error("Bad number.");
      return { kind: "scalar", value };
    }
    if (source[position] === "@" || source[position] === "$") {
      const parsed = readReference(source, position);
      position = parsed.next;
      if (parsed.reference.second) {
        return { kind: "range", cells: expressionRange(table, parsed.reference, destinationRow, destinationColumn) };
      }
      const ref = expressionCell(table, parsed.reference, destinationRow, destinationColumn);
      return { kind: "scalar", value: cell(table, ref.row, ref.column) };
    }
    if (/[A-Za-z_]/.test(source[position])) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(position));
      const name = match[0].toLowerCase();
      position += match[0].length;
      skip();
      if (source[position] === "(") {
        position += 1;
        const args = parseArguments();
        if (name === "sum") return { kind: "scalar", value: aggregateValues(args).filter(Number.isFinite).reduce((a, b) => a + b, 0) };
        if (name === "mean") {
          const values = aggregateValues(args).filter(Number.isFinite);
          return { kind: "scalar", value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 };
        }
        if (name === "count") return { kind: "scalar", value: aggregateRawValues(args).filter((v) => text(v).trim() !== "").length };
        if (name === "min" || name === "max") {
          const values = aggregateValues(args).filter(Number.isFinite);
          return { kind: "scalar", value: values.length ? (name === "min" ? Math.min(...values) : Math.max(...values)) : 0 };
        }
        if (name === "if") {
          if (args.length !== 3) error("if() needs a condition, a true value and a false value.");
          const condition = scalar(args[0]);
          const conditionText = text(condition).trim();
          const conditionNumber = Number(conditionText);
          const truthy = conditionText !== "" && (Number.isFinite(conditionNumber) ? conditionNumber !== 0 : true);
          return truthy ? args[1] : args[2];
        }
        if (name === "round") {
          if (args.length < 1 || args.length > 2) error("round() needs a value and an optional digit count.");
          const digits = args.length === 2 ? Math.max(0, Math.min(20, Math.round(number(args[1])))) : 0;
          return { kind: "scalar", value: Number(number(args[0]).toFixed(digits)) };
        }
        if (name === "abs") return { kind: "scalar", value: Math.abs(number(args[0] || { kind: "scalar", value: "" })) };
        if (name === "sqrt") return { kind: "scalar", value: Math.sqrt(number(args[0] || { kind: "scalar", value: "" })) };
        error(`Unknown function "${name}".`);
      }
      if (name === "pi") return { kind: "scalar", value: Math.PI };
      if (name === "e") return { kind: "scalar", value: Math.E };
      if (name === "tau") return { kind: "scalar", value: Math.PI * 2 };
      error(`Unknown function "${name}".`);
    }
    error("Expected a number, cell reference or function.");
    return { kind: "scalar", value: "" };
  };

  const parsePower = () => {
    let value = parsePrimary();
    skip();
    if (source[position] === "^") {
      position += 1;
      const exponent = parseUnary();
      value = { kind: "scalar", value: Math.pow(number(value), number(exponent)) };
      skip();
    }
    return value;
  };

  const parseUnary = () => {
    skip();
    if (source[position] === "+") {
      position += 1;
      return parseUnary();
    }
    if (source[position] === "-") {
      position += 1;
      return { kind: "scalar", value: -number(parseUnary()) };
    }
    return parsePower();
  };

  const parseTerm = () => {
    let left = parseUnary();
    skip();
    while (source[position] === "*" || source[position] === "/") {
      const operator = source[position];
      position += 1;
      const right = parseUnary();
      left = { kind: "scalar", value: operator === "*" ? number(left) * number(right) : number(left) / number(right) };
      skip();
    }
    return left;
  };

  const parseAdditive = () => {
    let left = parseTerm();
    skip();
    while (source[position] === "+" || source[position] === "-") {
      const operator = source[position];
      position += 1;
      const right = parseTerm();
      left = { kind: "scalar", value: operator === "+" ? number(left) + number(right) : number(left) - number(right) };
      skip();
    }
    return left;
  };

  const parseComparison = () => {
    const left = parseAdditive();
    skip();
    const operators = ["<=", ">=", "==", "!=", "<", ">"];
    const operator = operators.find((entry) => source.slice(position, position + entry.length) === entry);
    if (!operator) return left;
    position += operator.length;
    const right = parseAdditive();
    return { kind: "scalar", value: comparison(scalar(left), scalar(right), operator) ? 1 : 0 };
  };

  const parseExpression = () => parseComparison();
  const value = parseExpression();
  skip();
  if (position < source.length) error("Unexpected input.");
  return value;
}

function formatValue(value, directive) {
  if (!value || value.kind !== "scalar") throw new Error("A formula must produce one value.");
  const raw = value.value;
  if (directive) {
    const number = numeric(raw);
    if (!Number.isFinite(number)) throw new Error(`"${text(raw)}" cannot be formatted as a number.`);
    if (directive.kind === "integer") return String(Math.round(number));
    return number.toFixed(directive.digits);
  }
  if (typeof raw === "number") return formatNumber(raw);
  return text(raw);
}

/** Apply parsed TBLFM formulas to a table, returning a detached new table. */
function applyTableFormulas(table, formulas, escape) {
  if (!table || !Array.isArray(table.rows)) return fail("The table is no longer available.", "table");
  const list = Array.isArray(formulas) ? formulas : [];
  if (!list.length) return fail("No TBLFM formula follows this table.", "no-formulas");
  const rows = table.rows.map((row) => row.slice());
  const working = { ...table, rows, header: rows[0].slice() };
  let changed = false;
  for (const part of list) {
    let parsed;
    let destinations;
    try {
      parsed = parseFormulaPart(part);
      const reference = readReference(parsed.destination, 0);
      if (text(parsed.destination).slice(reference.next).trim()) throw new Error("The destination has trailing text.");
      destinations = destinationCells(working, reference.reference);
      if (!destinations.length) throw new Error("The destination selects no cells.");
    } catch (error) {
      return fail(`Formula "${part}": ${error && error.message ? error.message : "could not be read."}`);
    }
    for (const destination of destinations) {
      try {
        const result = evaluateExpression(parsed.expression, working, destination.row, destination.column);
        const next = (typeof escape === "function" ? escape : escapeCell)(formatValue(result, parsed.directive));
        if (rows[destination.row][destination.column] !== next) {
          rows[destination.row][destination.column] = next;
          working.header = rows[0].slice();
          changed = true;
        }
      } catch (error) {
        return fail(`Formula "${part}": ${error && error.message ? error.message : "could not be evaluated."}`);
      }
    }
  }
  return { ok: true, table: working, changed };
}

/** CSV for the table's source rows, with RFC-style quoting and formula-injection protection. */
function csvCell(value) {
  let result = unescapePipes(value);
  if (/^[=+@\t\r]/.test(result)) result = `'${result}`;
  if (/[",\r\n]/.test(result)) result = `"${result.replace(/"/g, '""')}"`;
  return result;
}

function tableToCsv(table) {
  if (!table || !Array.isArray(table.rows) || !table.rows.length) return "";
  return table.rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

module.exports = {
  MAX_FORMULA_LENGTH,
  MAX_FORMULAS,
  applyTableFormulas,
  csvCell,
  formatNumber,
  parseTableFormulas,
  tableToCsv,
};
