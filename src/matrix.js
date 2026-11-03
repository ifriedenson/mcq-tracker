"use strict";
/*
 * Local matrix arithmetic for the Reference panel.
 *
 * Every operation is a pure function over a rectangular numeric array. The
 * module has no DOM, Obsidian, storage or network dependency, and it never
 * evaluates text. The view parses its cells and calls these functions.
 */

const MAX_SIZE = 8;
const UI_MAX_SIZE = 6;
const TOLERANCE = 1e-10;

function refuse(message) {
  throw new Error(message);
}

function grid(value, label) {
  if (!Array.isArray(value) || !value.length) refuse(`${label} must have at least one row.`);
  if (value.length > MAX_SIZE) refuse(`${label} can have at most ${MAX_SIZE} rows.`);
  const rows = value.map((row, index) => {
    if (!Array.isArray(row) || !row.length) refuse(`${label} row ${index + 1} must have at least one value.`);
    if (row.length > MAX_SIZE) refuse(`${label} can have at most ${MAX_SIZE} columns.`);
    return row.map((cell, column) => {
      const number = Number(cell);
      if (cell === "" || cell === null || cell === undefined || !Number.isFinite(number)) {
        refuse(`${label} row ${index + 1}, column ${column + 1} must be a finite number.`);
      }
      return Object.is(number, -0) ? 0 : number;
    });
  });
  const width = rows[0].length;
  if (rows.some((row) => row.length !== width)) refuse(`${label} rows must all have the same number of columns.`);
  return rows;
}

function dimensions(matrix, label) {
  const rows = grid(matrix, label || "Matrix");
  return { rows: rows.length, columns: rows[0].length };
}

function sameSize(a, b) {
  return a.length === b.length && a[0].length === b[0].length;
}

function clone(matrix) {
  return matrix.map((row) => row.slice());
}

function zero(rows, columns) {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => 0));
}

function identity(size) {
  if (!Number.isInteger(size) || size < 1 || size > MAX_SIZE) refuse(`Identity size must be a whole number from 1 to ${MAX_SIZE}.`);
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => (row === column ? 1 : 0)));
}

function add(a, b) {
  const left = grid(a, "Matrix A");
  const right = grid(b, "Matrix B");
  if (!sameSize(left, right)) refuse("Matrix addition needs the same number of rows and columns.");
  return left.map((row, r) => row.map((value, c) => value + right[r][c]));
}

function subtract(a, b) {
  const left = grid(a, "Matrix A");
  const right = grid(b, "Matrix B");
  if (!sameSize(left, right)) refuse("Matrix subtraction needs the same number of rows and columns.");
  return left.map((row, r) => row.map((value, c) => value - right[r][c]));
}

function scalarMultiply(matrix, scalar) {
  const source = grid(matrix, "Matrix");
  const factor = Number(scalar);
  if (!Number.isFinite(factor)) refuse("The scalar must be a finite number.");
  return source.map((row) => row.map((value) => value * factor));
}

function multiply(a, b) {
  const left = grid(a, "Matrix A");
  const right = grid(b, "Matrix B");
  if (left[0].length !== right.length) {
    refuse("Matrix multiplication needs the columns in A to equal the rows in B.");
  }
  const result = zero(left.length, right[0].length);
  for (let r = 0; r < left.length; r++) {
    for (let c = 0; c < right[0].length; c++) {
      let sum = 0;
      for (let k = 0; k < right.length; k++) sum += left[r][k] * right[k][c];
      result[r][c] = sum;
    }
  }
  return result;
}

function transpose(matrix) {
  const source = grid(matrix, "Matrix");
  return source[0].map((_, column) => source.map((row) => row[column]));
}

function pivotScale(matrix) {
  let largest = 0;
  for (const row of matrix) for (const value of row) largest = Math.max(largest, Math.abs(value));
  return largest > 0 ? largest : 1;
}

function determinant(matrix, options) {
  const source = clone(grid(matrix, "Matrix"));
  if (source.length !== source[0].length) refuse("A determinant needs a square matrix.");
  const tolerance = Number((options && options.tolerance) || TOLERANCE);
  const scale = pivotScale(source);
  let result = 1;
  for (let column = 0; column < source.length; column++) {
    let pivot = column;
    for (let row = column + 1; row < source.length; row++) {
      if (Math.abs(source[row][column]) > Math.abs(source[pivot][column])) pivot = row;
    }
    if (Math.abs(source[pivot][column]) <= tolerance * scale) return 0;
    if (pivot !== column) {
      const swap = source[pivot];
      source[pivot] = source[column];
      source[column] = swap;
      result = -result;
    }
    const divisor = source[column][column];
    result *= divisor;
    for (let row = column + 1; row < source.length; row++) {
      const factor = source[row][column] / divisor;
      for (let c = column + 1; c < source.length; c++) source[row][c] -= factor * source[column][c];
    }
  }
  return Object.is(result, -0) ? 0 : result;
}

/** Reduced row-echelon form with pivot columns. */
function rref(matrix, options) {
  const source = clone(grid(matrix, "Matrix"));
  const tolerance = Number((options && options.tolerance) || TOLERANCE);
  const scale = pivotScale(source);
  const pivots = [];
  let row = 0;
  for (let column = 0; column < source[0].length && row < source.length; column++) {
    let pivot = row;
    for (let candidate = row + 1; candidate < source.length; candidate++) {
      if (Math.abs(source[candidate][column]) > Math.abs(source[pivot][column])) pivot = candidate;
    }
    if (Math.abs(source[pivot][column]) <= tolerance * scale) continue;
    if (pivot !== row) {
      const swap = source[pivot];
      source[pivot] = source[row];
      source[row] = swap;
    }
    const divisor = source[row][column];
    for (let c = 0; c < source[0].length; c++) source[row][c] /= divisor;
    for (let other = 0; other < source.length; other++) {
      if (other === row) continue;
      const factor = source[other][column];
      if (Math.abs(factor) <= tolerance * scale) continue;
      for (let c = 0; c < source[0].length; c++) source[other][c] -= factor * source[row][c];
    }
    pivots.push(column);
    row++;
  }
  for (const current of source) {
    for (let c = 0; c < current.length; c++) {
      if (Math.abs(current[c]) <= tolerance * scale) current[c] = 0;
    }
  }
  return { matrix: source, pivots, rank: pivots.length };
}

function inverse(matrix, options) {
  const source = grid(matrix, "Matrix");
  if (source.length !== source[0].length) refuse("An inverse needs a square matrix.");
  const size = source.length;
  if (rref(source, options).rank < size) refuse("Matrix is singular; it has no inverse.");
  const augmented = source.map((row, index) => row.concat(identity(size)[index]));
  const reduced = rref(augmented, options);
  return reduced.matrix.map((row) => row.slice(size));
}

function solve(a, b, options) {
  const left = grid(a, "Matrix A");
  const right = grid(b, "Vector b");
  if (left.length !== left[0].length) refuse("Solving A x = b needs a square matrix A.");
  if (right.length !== left.length || right[0].length !== 1) {
    refuse("Vector b must have one value for each row of A.");
  }
  const augmented = left.map((row, index) => row.concat(right[index][0]));
  const reduced = rref(augmented, options);
  const size = left.length;
  for (const row of reduced.matrix) {
    if (row.slice(0, size).every((value) => value === 0) && row[size] !== 0) {
      refuse("This system has no solution.");
    }
  }
  if (reduced.pivots.length < size) refuse("This system has infinitely many solutions.");
  const solution = Array.from({ length: size }, () => 0);
  reduced.pivots.forEach((column, row) => {
    solution[column] = reduced.matrix[row][size];
  });
  return solution;
}

function rank(matrix, options) {
  return rref(matrix, options).rank;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const cleaned = Math.abs(number) < 1e-10 ? 0 : Number(number.toPrecision(10));
  return String(Object.is(cleaned, -0) ? 0 : cleaned);
}

function formatMatrix(matrix) {
  return grid(matrix, "Matrix").map((row) => `[ ${row.map(formatNumber).join("  ")} ]`).join("\n");
}

function normalizeGrid(value, rows, columns) {
  const rowCount = Math.min(UI_MAX_SIZE, Math.max(1, Math.floor(Number(rows) || 2)));
  const columnCount = Math.min(UI_MAX_SIZE, Math.max(1, Math.floor(Number(columns) || 2)));
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: rowCount }, (_, r) =>
    Array.from({ length: columnCount }, (_, c) => {
      const cell = source[r] && source[r][c];
      return cell === undefined || cell === null ? "" : String(cell);
    })
  );
}

/** Restore both editable matrices without rejecting a partly typed state. */
function normalizeState(state) {
  const source = state && typeof state === "object" ? state : {};
  const aRows = Array.isArray(source.a) && source.a.length ? source.a.length : 2;
  const aColumns = Array.isArray(source.a) && Array.isArray(source.a[0]) && source.a[0].length ? source.a[0].length : 2;
  const bRows = Array.isArray(source.b) && source.b.length ? source.b.length : 2;
  const bColumns = Array.isArray(source.b) && Array.isArray(source.b[0]) && source.b[0].length ? source.b[0].length : 2;
  return {
    a: normalizeGrid(source.a, aRows, aColumns),
    b: normalizeGrid(source.b, bRows, bColumns),
  };
}

module.exports = {
  MAX_SIZE,
  UI_MAX_SIZE,
  TOLERANCE,
  add,
  clone,
  determinant,
  dimensions,
  formatMatrix,
  formatNumber,
  grid,
  identity,
  inverse,
  multiply,
  normalizeGrid,
  normalizeState,
  rank,
  rref,
  scalarMultiply,
  solve,
  subtract,
  transpose,
  zero,
};
