"use strict";
/*
 * Text alternatives for the Reference graph.
 *
 * `rowSummary` describes one built row, `graphSummary` describes the whole window and
 * `graphTable` returns the rows a native table can render. Everything is plain data plus
 * strings, so the view only assigns text and builds elements; there is no DOM or Obsidian
 * dependency here and no third-party code.
 */

const KIND_LABELS = {
  explicit: "curve",
  regression: "fitted curve",
  implicit: "implicit curve",
  inequality: "inequality",
  polar: "polar curve",
  parametric: "parametric curve",
  point: "point",
  points: "point list",
  definition: "definition",
  parameter: "slider",
  complex: "complex domain",
};

function formatValue(value) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return String(Number(number.toPrecision(6)));
}

function finitePointCount(row) {
  if (!row || !Array.isArray(row.points)) return 0;
  return row.points.filter((point) => point && point.y !== null && point.y !== undefined && Number.isFinite(Number(point.y))).length;
}

function markerCount(row) {
  return row && Array.isArray(row.markers) ? row.markers.length : 0;
}

function interestCount(row) {
  return row && Array.isArray(row.interest) ? row.interest.length : 0;
}

/** One row's drawn state, without the row number or trailing punctuation. */
function rowDetail(row) {
  if (!row) return "nothing to draw";
  if (row.error) return String(row.error);
  if (row.kind === "complex") return row.detail || "a complex domain coloring";
  const kind = KIND_LABELS[row.kind] || "row";
  const points = finitePointCount(row);
  const markers = markerCount(row);
  let detail;
  switch (row.kind) {
    case "definition":
      detail = "a definition, not drawn";
      break;
    case "parameter":
      detail = `a slider with value ${formatValue(row.value)}`;
      break;
    case "point":
    case "points":
      detail = `${kind} with ${markers} marker${markers === 1 ? "" : "s"}`;
      break;
    case "inequality":
      detail = row.region ? "a shaded inequality region" : "an inequality with no shaded region in this window";
      break;
    default:
      if (row.points && Array.isArray(row.points) && row.points.length) {
        detail = points
          ? `${kind} with ${points} sampled point${points === 1 ? "" : "s"}`
          : `${kind} with no real values in this window`;
      } else if (markers) {
        detail = `${kind} with ${markers} marker${markers === 1 ? "" : "s"}`;
      } else if (row.region) {
        detail = "a shaded region";
      } else if (row.segments && Array.isArray(row.segments) && row.segments.length) {
        detail = `${kind} with ${row.segments.length} segment${row.segments.length === 1 ? "" : "s"}`;
      } else {
        detail = `${kind} with nothing drawn in this window`;
      }
  }
  const interest = interestCount(row);
  if (interest) detail += ` and ${interest} point${interest === 1 ? "" : "s"} of interest`;
  return detail;
}

/** "Row 2, y = x^2: curve with 600 sampled points and 1 point of interest." */
function rowSummary(row, index) {
  const number = Number.isInteger(index) && index >= 0 ? index + 1 : 1;
  const text = row && typeof row.text === "string" ? row.text.trim() : "";
  const head = text ? `Row ${number}, ${text}` : `Row ${number}`;
  const detail = rowDetail(row);
  return `${head}: ${/[.!?]$/.test(detail) ? detail : `${detail}.`}`;
}

/** The whole graph: how many rows, the window, then each row. */
function graphSummary(graph) {
  const rows = graph && Array.isArray(graph.rows) ? graph.rows : [];
  if (!rows.length) return "The graph is empty. Add an expression to draw a graph.";
  const windowText = `x from ${formatValue(graph.xMin)} to ${formatValue(graph.xMax)}, y from ${formatValue(graph.yMin)} to ${formatValue(graph.yMax)}.`;
  return [`Graph with ${rows.length} row${rows.length === 1 ? "" : "s"}. Window ${windowText}`, ...rows.map((row, index) => rowSummary(row, index))].join(" ");
}

/** Table data for the rows in drawn order; an empty graph is an honest refusal. */
function graphTable(graph) {
  const rows = graph && Array.isArray(graph.rows) ? graph.rows : [];
  if (!rows.length) return { ok: false, reason: "empty", message: "Draw a graph before opening the data table." };
  return {
    ok: true,
    caption: "Graph data table",
    headers: ["Row", "Expression", "Kind", "What is drawn"],
    rows: rows.map((row, index) => ({
      number: String(index + 1),
      expression: row && typeof row.text === "string" && row.text.trim() ? row.text.trim() : "—",
      kind: KIND_LABELS[row && row.kind] || (row && row.kind) || "row",
      detail: rowDetail(row),
    })),
  };
}

module.exports = { KIND_LABELS, rowDetail, rowSummary, graphSummary, graphTable };
