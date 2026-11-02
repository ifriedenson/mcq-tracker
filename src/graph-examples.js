"use strict";
/*
 * Ready-made graph examples for the Reference graph tab.
 *
 * Each example is a small list of expression rows written in the same syntax the tab already
 * accepts, so loading one only fills the row list; the view turns the strings into rows with the
 * normal style defaults. No third-party code is copied and nothing here samples or draws.
 */

const EXAMPLES = [
  { id: "parabola", name: "Parabola", rows: ["y = x^2 - 4"] },
  { id: "trig", name: "Sine and cosine", rows: ["y = sin(x)", "y = cos(x)"] },
  { id: "polar", name: "Polar rose", rows: ["r = 2 cos(3 theta)"] },
  { id: "parametric", name: "Parametric circle", rows: ["(cos(t), sin(t)) fill"] },
  { id: "inequality", name: "Inequality region", rows: ["x^2 + y^2 <= 9"] },
  { id: "points", name: "Point list", rows: ["[(1, 2), (2, 3), (3, 5)]"] },
  { id: "piecewise", name: "Piecewise", rows: ["y = {x < 0: -x, x >= 0: x}"] },
];

/** The example with this id, or null. */
function exampleById(id) {
  const wanted = String(id || "");
  return EXAMPLES.find((example) => example.id === wanted) || null;
}

/** The row sources of an example, copied so a caller cannot mutate the catalogue. */
function exampleTexts(id) {
  const example = exampleById(id);
  return example ? example.rows.slice() : [];
}

module.exports = { EXAMPLES, exampleById, exampleTexts };
