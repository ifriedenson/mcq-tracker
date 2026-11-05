"use strict";
/*
 * Upstream parity for formulas: every example in tgrosinger/md-advanced-tables
 * docs/formulas.md is evaluated here and the resulting rows are compared cell
 * by cell, so the claim "our evaluator produces the same table" is tested
 * rather than asserted. The last case runs the same formulas through
 * updateTableFormulas, the serialized write path the plugin uses, and checks
 * that the delimiter row and alignment survive.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const editor = require("../src/table-editor");
const formulas = require("../src/table-formulas");

function oneTable(markdown) {
  const tables = editor.parseTables(markdown);
  assert.equal(tables.length, 1, "the fixture holds exactly one table");
  return tables[0];
}

function evaluate(markdown) {
  const table = oneTable(markdown);
  const parsed = formulas.parseTableFormulas(markdown.split("\n"), table);
  assert.equal(parsed.ok, true, parsed.message);
  const applied = formulas.applyTableFormulas(table, parsed.formulas, editor.escapeCell);
  assert.equal(applied.ok, true, applied.message);
  return applied.table.rows;
}

/* ---- docs: the overview example (sum over a column range) ---- */

test("upstream example: @>$2=sum(@I..@-1) totals the column", () => {
  const markdown = [
    "| Item              | Grams |",
    "| ----------------- | ----- |",
    "| Whole Wheat Flour | 110   |",
    "| Bread Flour       | 748   |",
    "| Warm Water        | 691   |",
    "| Salt              | 18    |",
    "| Starter           | 40    |",
    "| **Total Grams**   |       |",
    "<!-- TBLFM: @>$2=sum(@I..@-1) -->",
  ].join("\n");
  assert.deepEqual(evaluate(markdown).at(-1), ["**Total Grams**", "1607"]);
});

/* ---- docs: destination range, relative rows (Fibonacci) ---- */

test("upstream example: @4$>..@>$>=(@-1+@-2) fills the Fibonacci column", () => {
  const markdown = [
    "| Start | Fibonacci |",
    "| ----- | --------- |",
    "|     1 |         1 |",
    "|     1 |         1 |",
    "|       |         2 |",
    "|       |         3 |",
    "|       |         5 |",
    "|       |         8 |",
    "|       |        13 |",
    "|       |        21 |",
    "<!-- TBLFM: @4$>..@>$>=(@-1+@-2) -->",
  ].join("\n");
  assert.deepEqual(evaluate(markdown), [
    ["Start", "Fibonacci"],
    ["1", "1"],
    ["1", "1"],
    ["", "2"],
    ["", "3"],
    ["", "5"],
    ["", "8"],
    ["", "13"],
    ["", "21"],
  ]);
});

/* ---- docs: subtraction with a row reference ---- */

test("upstream example: @>=(@2$3-@3) subtracts row three from one cell", () => {
  const markdown = [
    "| One | Two | Three |",
    "| --- | --- | ----- |",
    "|   1 |   2 |     3 |",
    "|   4 |   5 |     6 |",
    "|  -1 |  -2 |    -3 |",
    "<!-- TBLFM: @>=(@2$3-@3) -->",
  ].join("\n");
  assert.deepEqual(evaluate(markdown).at(-1), ["-1", "-2", "-3"]);
});

/* ---- docs: conditional, written with the #+TBLFM: alias ---- */

test("upstream example: #+TBLFM: $>=if($1>3, $1, 3) keeps the larger value", () => {
  const markdown = [
    "| One | Two | Three |",
    "| --- | --- | ----- |",
    "|   1 |   2 |     3 |",
    "|   4 |   5 |     4 |",
    "|  -1 |  -2 |     3 |",
    "#+TBLFM: $>=if($1>3, $1, 3)",
  ].join("\n");
  assert.deepEqual(evaluate(markdown).slice(1), [
    ["1", "2", "3"],
    ["4", "5", "4"],
    ["-1", "-2", "3"],
  ]);
});

/* ---- docs: nested functions ---- */

test("upstream example: if(@2$4+@2$5==@2$6, @3$3, @4$3) nests arithmetic in a conditional", () => {
  const markdown = [
    "| A | B | C | D | E | F |",
    "| - | - | - | - | - | - |",
    "| 1 | 2 | 3 | 4 | 5 | 9 |",
    "| 7 | 8 | 9 | 1 | 1 | 1 |",
    "| 1 | 1 | 1 | 1 | 1 | 1 |",
    "<!-- TBLFM: @3$3=if(@2$4+@2$5==@2$6, @3$3, @4$3) -->",
  ].join("\n");
  assert.equal(evaluate(markdown)[2][2], "9");
});

test("upstream example: sum(@2$<..@3$2) adds a two-by-two range", () => {
  const markdown = [
    "|       One | Two | Three |",
    "| --------- | --- | ----- |",
    "|         1 |   2 |       |",
    "|         4 |   5 |       |",
    "| **Total** |     |       |",
    "<!-- TBLFM: @>$>=sum(@2$<..@3$2) -->",
  ].join("\n");
  assert.deepEqual(evaluate(markdown).at(-1), ["**Total**", "", "12"]);
});

/* ---- docs: the formatting directive ---- */

test("upstream example: ;%.2f rounds a divided row", () => {
  const markdown = [
    "| A   | B   | C   | D   |",
    "| --- | --- | --- | --- |",
    "| 1   | 2   | 5   | 6   |",
    "| 3   | 4   | 7   | 8   |",
    "|     |     |     |     |",
    "<!-- TBLFM: @>=(@I / @3$4);%.2f -->",
  ].join("\n");
  assert.deepEqual(evaluate(markdown).at(-1), ["0.13", "0.25", "0.63", "0.75"]);
});

/* ---- docs: ;dt and datetime arithmetic ---- */

test("upstream example: $>=($1 + $2);dt adds milliseconds to a datetime", () => {
  const markdown = [
    "| Start            | Ms     | End |",
    "| ---------------- | ------ | --- |",
    "| 2023-07-12 10:00 | 600000 |     |",
    "<!-- TBLFM: $>=($1 + $2);dt -->",
  ].join("\n");
  assert.deepEqual(evaluate(markdown)[1], ["2023-07-12 10:00", "600000", "2023-07-12 10:10"]);
});

test("upstream example: datetime subtraction and ;hm produce 02:10", () => {
  const markdown = [
    "| Start            | End              | Ms      | Mins | Duration |",
    "| ---------------- | ---------------- | ------- | ---- | -------- |",
    "| 2023-07-12 10:00 | 2023-07-12 12:10 | 7800000 | 130  | 02:10    |",
    "<!-- TBLFM: $3=($2 - $1) -->",
    "<!-- TBLFM: $4=(($2 - $1) / 60000) -->",
    "<!-- TBLFM: $5=($2 - $1);hm -->",
  ].join("\n");
  assert.deepEqual(evaluate(markdown)[1], [
    "2023-07-12 10:00",
    "2023-07-12 12:10",
    "7800000",
    "130",
    "02:10",
  ]);
});

/* ---- docs: the full times-and-durations table ---- */

test("upstream example: a task table keeps each duration and totals them", () => {
  const markdown = [
    "| Task        | Start |   End | Duration |",
    "| ----------- | ----- | ----: | -------- |",
    "| Plan day    | 09:00 | 09:15 |    00:15 |",
    "| Fix Bug#1   | 09:27 | 11:33 |    02:06 |",
    "| Fix Bug#2   |       | 12:22 |    00:49 |",
    "| Triage bugs | 13:00 | 17:00 |    04:00 |",
    "| Clean desk  |       | 17:30 |    00:30 |",
    "| **Total**   |       |       |    07:40 |",
    "<!-- TBLFM: $>=($3 - if($2>0, $2, @-1$3));hm -->",
    "<!-- TBLFM: @>$>=sum(@I..@-1);hm -->",
  ].join("\n");
  assert.deepEqual(evaluate(markdown).slice(1).map((row) => row[3]), [
    "00:15",
    "02:06",
    "00:49",
    "04:00",
    "00:30",
    "07:40",
  ]);
});

/* ---- docs: chaining and multiple lines are equivalent ---- */

test("upstream example: chained formulas and two formula lines agree", () => {
  const chained = [
    "| A | B |",
    "| - | - |",
    "| 1 | 2 |",
    "| 3 | 4 |",
    "| 5 | 6 |",
    "<!-- TBLFM: @2=@4::$1=$2 -->",
  ].join("\n");
  const split = [
    "| A | B |",
    "| - | - |",
    "| 1 | 2 |",
    "| 3 | 4 |",
    "| 5 | 6 |",
    "<!-- TBLFM: @2=@4 -->",
    "<!-- TBLFM: $1=$2 -->",
  ].join("\n");
  assert.deepEqual(evaluate(chained), evaluate(split));
  assert.deepEqual(evaluate(chained), [
    ["A", "B"],
    ["6", "6"],
    ["4", "4"],
    ["6", "6"],
  ]);
});

/* ---- docs: the row-to-column range is invalid ---- */

test("upstream example: a range from a row to a column is refused", () => {
  const markdown = [
    "| A | B |",
    "| - | - |",
    "| 1 | 2 |",
    "| 3 | 4 |",
    "<!-- TBLFM: @>$1=sum(@2..$2) -->",
  ].join("\n");
  const table = oneTable(markdown);
  const parsed = formulas.parseTableFormulas(markdown.split("\n"), table);
  assert.equal(parsed.ok, true, parsed.message);
  const applied = formulas.applyTableFormulas(table, parsed.formulas, editor.escapeCell);
  assert.equal(applied.ok, false);
  assert.match(applied.message, /cannot go from a row to a column/);
});

/* ---- write back through the serialized path ---- */

test("formula write-back keeps the delimiter row and padded alignment", () => {
  const markdown = [
    "| Item  | Grams |",
    "| :---- | ----: |",
    "| A     | 1     |",
    "| Total |       |",
    "<!-- TBLFM: @>$2=sum(@I..@-1) -->",
  ].join("\n");
  const result = editor.updateTableFormulas(markdown, 0);
  assert.equal(result.ok, true, result.message);
  const lines = result.text.split("\n");
  assert.equal(lines[1], "| :---- | ----: |");
  assert.deepEqual(editor.parseTables(result.text)[0].align, ["left", "right"]);
  assert.deepEqual(editor.parseTables(result.text)[0].rows.at(-1), ["Total", "1"]);
  assert.match(lines[3], /^\|\s+Total\s+\|\s+1\s+\|$/);
});
