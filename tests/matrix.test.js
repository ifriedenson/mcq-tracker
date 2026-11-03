"use strict";
// Matrix calculator: pure arithmetic, validation and the Reference tab.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers/load");
const { makeApp, makeDom } = require("./helpers/fake");

const { T, Plugin: QT } = load();

test("matrix: arithmetic, transpose and scalar multiplication", () => {
  const m = T.matrix;
  assert.deepEqual(m.add([[1, 2]], [[3, 4]]), [[4, 6]]);
  assert.deepEqual(m.subtract([[5, 6]], [[1, 2]]), [[4, 4]]);
  assert.deepEqual(m.multiply([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[19, 22], [43, 50]]);
  assert.deepEqual(m.scalarMultiply([[1, -2]], 3), [[3, -6]]);
  assert.deepEqual(m.transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]]);
  assert.deepEqual(m.identity(3), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
});

test("matrix: determinant, inverse and reduced row-echelon form", () => {
  const m = T.matrix;
  assert.equal(m.determinant([[1, 2], [3, 4]]), -2);
  assert.equal(m.determinant([[1, 2], [2, 4]]), 0);
  assert.equal(m.determinant([[2, 0, 1], [3, 0, 0], [5, 1, 1]]), 3);
  assert.throws(() => m.inverse([[1, 2], [2, 4]]), /singular/i);
  const inverse = m.inverse([[1, 2], [3, 4]]);
  const near = (actual, expected) => Math.abs(actual - expected) < 1e-9;
  assert.ok(near(inverse[0][0], -2) && near(inverse[0][1], 1));
  assert.ok(near(inverse[1][0], 1.5) && near(inverse[1][1], -0.5));
  const product = m.multiply([[1, 2], [3, 4]], inverse);
  assert.ok(near(product[0][0], 1) && near(product[1][1], 1));
  assert.ok(near(product[0][1], 0) && near(product[1][0], 0));
  const reduced = m.rref([[1, 2, 3], [2, 4, 7]]);
  assert.equal(reduced.rank, 2);
  assert.deepEqual(reduced.pivots, [0, 2]);
  assert.equal(reduced.matrix[0][2], 0);
  assert.equal(reduced.matrix[1][2], 1);
});

test("matrix: solving reports unique, none and infinitely many", () => {
  const m = T.matrix;
  assert.deepEqual(m.solve([[2, 1], [1, 3]], [[5], [10]]), [1, 3]);
  assert.deepEqual(m.solve([[1, 0], [0, 1]], [[4], [-2]]), [4, -2]);
  assert.throws(() => m.solve([[1, 1], [1, 1]], [[1], [2]]), /no solution/i);
  assert.throws(() => m.solve([[1, 1], [1, 1]], [[1], [1]]), /infinitely many/i);
  assert.throws(() => m.solve([[1, 2, 3], [4, 5, 6]], [[1], [2]]), /square/i);
});

test("matrix: invalid dimensions and non-finite cells are refused", () => {
  const m = T.matrix;
  assert.throws(() => m.add([[1]], [[1, 2]]), /same number/i);
  assert.throws(() => m.multiply([[1, 2]], [[1, 2]]), /columns in A/i);
  assert.throws(() => m.grid([[1, ""]], "Matrix A"), /finite number/i);
  assert.throws(() => m.grid([[1], [1, 2]], "Matrix A"), /same number of columns/i);
  assert.throws(() => m.determinant([[1, 2, 3], [4, 5, 6]]), /square/i);
  assert.throws(() => m.identity(0), /whole number/i);
});

test("matrix: stored state normalizes old or incomplete settings", () => {
  const m = T.matrix;
  const state = m.normalizeState({ a: [["1", "2"], ["3", "4"]], b: [["5"]] });
  assert.deepEqual(state.a, [["1", "2"], ["3", "4"]]);
  assert.deepEqual(state.b, [["5"]]);
  assert.deepEqual(m.normalizeState(null).a, [["", ""], ["", ""]]);
});

test("reference view: the matrix tab evaluates operations and persists state", async () => {
  const app = makeApp([]);
  const plugin = new QT(app);
  await plugin.onload();
  plugin.settings.reference.enabled = true;
  const view = new T.ReferenceView({ app }, plugin);
  view.app = app;
  const dom = makeDom();
  view.contentEl = dom.root;
  view.tab = "matrix";
  view.render();
  assert.ok(dom.texts().includes("Matrix A"));
  assert.ok(dom.texts().includes("Matrix B"));

  await dom.click("A + B");
  assert.equal(view.matrixError, "");
  assert.match(view.matrixResult, /\[ 6  8 \]/);
  assert.match(view.matrixResult, /\[ 10  12 \]/);
  assert.equal(plugin.settings.reference.matrix.a[0][0], "1", "matrix state is saved");

  await dom.click("A × B");
  assert.match(view.matrixResult, /\[ 19  22 \]/);
  await dom.click("determinant A");
  assert.equal(view.matrixResult, "-2");

  await dom.click("Add row");
  assert.equal(view.matrixState.a.length, 3);
  assert.equal(view.matrixState.b.length, 2);
  view.matrixState.a[0][0] = "";
  const result = view.runMatrix("add");
  assert.equal(result.ok, false);
  assert.match(view.matrixError, /finite number/i);
  assert.equal(plugin.settings.reference.matrix.a[0][0], "", "the editable state is still saved");
});
