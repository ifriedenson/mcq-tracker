"use strict";
/*
 * Small, original SMILES renderer for chemistry notes.
 *
 * It supports the useful teaching subset: organic atoms, bracket atoms with
 * charge/hydrogen counts, single/double/triple/aromatic bonds, branches,
 * ring-closure digits, `%nn` labels and disconnected fragments. It is not a
 * full SMILES implementation and never guesses at unsupported syntax: the
 * result is either a deterministic SVG or a clear error.
 */

const ORGANIC = new Set(["B", "C", "N", "O", "P", "S", "F", "Cl", "Br", "I"]);
const AROMATIC = new Set(["b", "c", "n", "o", "p", "s"]);
const TWO_LETTER = new Set(["Cl", "Br", "Si", "Se", "Na", "Li", "Mg", "Ca", "Fe", "Zn", "Cu", "Al"]);
const BOND_CHARS = { "-": 1, "=": 2, "#": 3, ":": 1.5, "/": 1, "\\": 1 };
const MAX_ATOMS = 120;
const MAX_RINGS = 40;

function cleanElement(value) {
  const text = String(value || "");
  if (ORGANIC.has(text) || AROMATIC.has(text)) return text;
  const match = /^([A-Z][a-z]?)/.exec(text);
  return match && TWO_LETTER.has(match[1]) ? match[1] : "";
}

function parseBracket(body) {
  const inner = String(body || "").trim();
  const m = /^(\d*)([A-Z][a-z]?|[a-z]{1,2})(@{0,2})?(H\d*)?([+-]\d*|\d*[+-])?$/.exec(inner);
  if (!m) return null;
  const element = cleanElement(m[2]);
  if (!element) return null;
  const hydrogens = m[4] ? Number(m[4].slice(1) || 1) : 0;
  let charge = 0;
  if (m[5]) {
    const text = m[5];
    if (/^[+-]\d+$/.test(text)) charge = (text[0] === "-" ? -1 : 1) * Number(text.slice(1));
    else if (/^\d+[+-]$/.test(text)) charge = (text.slice(-1) === "-" ? -1 : 1) * Number(text.slice(0, -1));
    else if (text === "+") charge = 1;
    else if (text === "-") charge = -1;
  }
  return { element, aromatic: /^[a-z]/.test(m[2]), hydrogens, charge, bracket: true };
}

function atomAt(smiles, i) {
  const char = smiles[i];
  if (char === "[") {
    const end = smiles.indexOf("]", i + 1);
    if (end < 0) return { error: "An atom bracket is not closed." };
    const atom = parseBracket(smiles.slice(i + 1, end));
    if (!atom) return { error: `Unsupported bracket atom: [${smiles.slice(i + 1, end)}].` };
    return { atom, i: end + 1 };
  }
  const two = smiles.slice(i, i + 2);
  if (ORGANIC.has(two) || TWO_LETTER.has(two)) {
    return { atom: { element: two, aromatic: false, hydrogens: 0, charge: 0, bracket: false }, i: i + 2 };
  }
  if (ORGANIC.has(char)) {
    return { atom: { element: char, aromatic: false, hydrogens: 0, charge: 0, bracket: false }, i: i + 1 };
  }
  if (AROMATIC.has(char)) {
    return { atom: { element: char, aromatic: true, hydrogens: 0, charge: 0, bracket: false }, i: i + 1 };
  }
  return { error: `Unexpected character "${char}".` };
}

function addAtom(graph, atom) {
  if (graph.atoms.length >= MAX_ATOMS) throw new Error(`A structure is limited to ${MAX_ATOMS} atoms.`);
  graph.atoms.push({ id: graph.atoms.length, ...atom });
  return graph.atoms[graph.atoms.length - 1];
}

function addBond(graph, a, b, order) {
  if (a === undefined || b === undefined) throw new Error("A bond is missing an atom.");
  if (a === b) throw new Error("A bond cannot connect an atom to itself.");
  const existing = graph.bonds.find((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a));
  if (existing) {
    existing.order = Math.max(existing.order, order || 1);
    return existing;
  }
  const bond = { a, b, order: order || 1 };
  graph.bonds.push(bond);
  return bond;
}

/** Parse the supported SMILES subset into atoms and bonds. */
function parseSmiles(input) {
  const smiles = String(input || "").trim();
  if (!smiles) return { error: "Enter a SMILES string." };
  const graph = { smiles, atoms: [], bonds: [], rings: new Map() };
  let current = null;
  let pendingOrder = null;
  const branchStack = [];
  let i = 0;
  try {
    while (i < smiles.length) {
      const char = smiles[i];
      if (/\s/.test(char)) return { error: "SMILES cannot contain whitespace." };
      if (BOND_CHARS[char] !== undefined) {
        pendingOrder = BOND_CHARS[char];
        i++;
        continue;
      }
      if (char === "(") {
        if (current === null) throw new Error("A branch cannot start before an atom.");
        if (branchStack.length >= 32) throw new Error("Branches are nested too deeply.");
        branchStack.push(current);
        i++;
        continue;
      }
      if (char === ")") {
        if (!branchStack.length) throw new Error("A branch closes without opening.");
        current = branchStack.pop();
        pendingOrder = null;
        i++;
        continue;
      }
      if (char === ".") {
        current = null;
        pendingOrder = null;
        i++;
        continue;
      }
      if (/\d/.test(char) || char === "%") {
        if (current === null) throw new Error("A ring label needs an atom.");
        let label = char;
        if (char === "%") {
          if (!/^\d{2}$/.test(smiles.slice(i + 1, i + 3))) throw new Error("A % ring label needs two digits.");
          label = smiles.slice(i + 1, i + 3);
          i += 2;
        }
        i++;
        const prior = graph.rings.get(label);
        if (prior) {
          addBond(graph, prior.atom, current, pendingOrder || prior.order || 1);
          graph.rings.delete(label);
        } else {
          if (graph.rings.size >= MAX_RINGS) throw new Error("Too many open ring labels.");
          graph.rings.set(label, { atom: current, order: pendingOrder || 1 });
        }
        pendingOrder = null;
        continue;
      }
      const parsed = atomAt(smiles, i);
      if (parsed.error) throw new Error(parsed.error);
      const atom = addAtom(graph, parsed.atom);
      if (current !== null) addBond(graph, current, atom.id, pendingOrder || 1);
      current = atom.id;
      pendingOrder = null;
      i = parsed.i;
    }
    if (branchStack.length) throw new Error("A branch is not closed.");
    if (graph.rings.size) throw new Error(`Unclosed ring label${graph.rings.size === 1 ? "" : "s"}.`);
    if (!graph.atoms.length) throw new Error("No atoms were found.");
    return { ok: true, graph };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function components(graph) {
  const seen = new Set();
  const out = [];
  for (const atom of graph.atoms) {
    if (seen.has(atom.id)) continue;
    const stack = [atom.id];
    const ids = [];
    seen.add(atom.id);
    while (stack.length) {
      const id = stack.pop();
      ids.push(id);
      for (const bond of graph.bonds) {
        const other = bond.a === id ? bond.b : bond.b === id ? bond.a : -1;
        if (other >= 0 && !seen.has(other)) {
          seen.add(other);
          stack.push(other);
        }
      }
    }
    out.push(ids);
  }
  return out;
}

function neighbors(graph, id) {
  return graph.bonds
    .filter((bond) => bond.a === id || bond.b === id)
    .map((bond) => ({ id: bond.a === id ? bond.b : bond.a, order: bond.order }));
}

/** First simple cycle in a component, used to lay rings out as regular polygons. */
function findCycle(graph, ids) {
  const allowed = new Set(ids);
  const state = new Map();
  const parent = new Map();
  let cycle = null;
  const visit = (id, from) => {
    if (cycle) return;
    state.set(id, 1);
    for (const next of neighbors(graph, id).map((n) => n.id)) {
      if (!allowed.has(next) || next === from) continue;
      if (state.get(next) === 1) {
        const path = [id];
        let at = id;
        while (at !== next && parent.has(at)) {
          at = parent.get(at);
          path.push(at);
        }
        if (at === next) cycle = path.reverse();
        return;
      }
      if (!state.has(next)) {
        parent.set(next, id);
        visit(next, id);
      }
    }
    state.set(id, 2);
  };
  for (const id of ids) if (!state.has(id)) visit(id, -1);
  return cycle;
}

function placeBranches(graph, cycle, positions) {
  const queue = cycle.slice();
  const seen = new Set(cycle);
  while (queue.length) {
    const id = queue.shift();
    const base = positions.get(id);
    const parent = cycle.includes(id) ? null : graph._layoutParent && graph._layoutParent.get(id);
    const candidates = neighbors(graph, id)
      .map((n) => n.id)
      .filter((next) => !seen.has(next));
    candidates.forEach((next, index) => {
      seen.add(next);
      if (!graph._layoutParent) graph._layoutParent = new Map();
      graph._layoutParent.set(next, id);
      const angle = (index * 2 * Math.PI) / Math.max(2, candidates.length) + (parent === null ? -Math.PI / 2 : 0);
      const distance = 1.25;
      positions.set(next, {
        x: base.x + Math.cos(angle) * distance,
        y: base.y + Math.sin(angle) * distance,
      });
      queue.push(next);
    });
  }
}

function layout(graph) {
  const positions = new Map();
  for (const ids of components(graph)) {
    const cycle = findCycle(graph, ids);
    if (cycle && cycle.length >= 3) {
      const radius = Math.max(0.9, (cycle.length * 0.5) / Math.PI);
      cycle.forEach((id, index) => {
        const angle = (index / cycle.length) * Math.PI * 2 - Math.PI / 2;
        positions.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
      graph._layoutParent = new Map();
      cycle.forEach((id, index) => graph._layoutParent.set(id, cycle[(index + cycle.length - 1) % cycle.length]));
      placeBranches(graph, cycle, positions);
      continue;
    }
    const root = ids[0];
    positions.set(root, { x: 0, y: 0 });
    const queue = [root];
    const seen = new Set([root]);
    while (queue.length) {
      const id = queue.shift();
      const parent = [...positions.keys()].find((key) => key !== id && graph.bonds.some((b) => (b.a === key && b.b === id) || (b.a === id && b.b === key)));
      const base = positions.get(id);
      const list = neighbors(graph, id)
        .map((n) => n.id)
        .filter((next) => !seen.has(next));
      list.forEach((next, index) => {
        seen.add(next);
        const angle = (parent === undefined ? -Math.PI / 2 : Math.atan2(base.y - positions.get(parent).y, base.x - positions.get(parent).x)) + (index % 2 ? -1 : 1) * (Math.PI / 3);
        positions.set(next, { x: base.x + Math.cos(angle) * 1.25, y: base.y + Math.sin(angle) * 1.25 });
        queue.push(next);
      });
    }
  }
  return positions;
}

function atomLabel(atom) {
  const element = atom.aromatic ? atom.element.toUpperCase() : atom.element;
  if (!atom.aromatic && element === "C" && !atom.charge && !atom.hydrogens) return "";
  const h = atom.hydrogens ? `H${atom.hydrogens > 1 ? atom.hydrogens : ""}` : "";
  const charge = atom.charge ? `${Math.abs(atom.charge) > 1 ? Math.abs(atom.charge) : ""}${atom.charge > 0 ? "+" : "-"}` : "";
  return `${element}${h}${charge}`;
}

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

/** Deterministic SVG for one parsed structure. */
function renderSmilesSvg(input, options) {
  const parsed = parseSmiles(input);
  if (!parsed.ok) return { ok: false, error: parsed.error, svg: "" };
  const graph = parsed.graph;
  const positions = layout(graph);
  const xs = [...positions.values()].map((p) => p.x);
  const ys = [...positions.values()].map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const pad = 26;
  const scale = Number(options && options.scale) || 34;
  const width = Math.max(64, (maxX - minX) * scale + pad * 2);
  const height = Math.max(56, (maxY - minY) * scale + pad * 2);
  const point = (id) => {
    const p = positions.get(id);
    return { x: pad + (p.x - minX) * scale, y: pad + (p.y - minY) * scale };
  };
  const lines = [];
  for (const bond of graph.bonds) {
    const a = point(bond.a);
    const b = point(bond.b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const orders = bond.order >= 3 ? [-3, 0, 3] : bond.order >= 2 ? [-2.5, 2.5] : [0];
    for (const offset of orders) {
      lines.push(`<line x1="${(a.x + nx * offset).toFixed(1)}" y1="${(a.y + ny * offset).toFixed(1)}" x2="${(b.x + nx * offset).toFixed(1)}" y2="${(b.y + ny * offset).toFixed(1)}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />`);
    }
  }
  const labels = [];
  for (const atom of graph.atoms) {
    const text = atomLabel(atom);
    if (!text) continue;
    const p = point(atom.id);
    const w = Math.max(18, text.length * 8.2);
    labels.push(`<rect x="${(p.x - w / 2).toFixed(1)}" y="${(p.y - 11).toFixed(1)}" width="${w.toFixed(1)}" height="22" rx="4" fill="var(--background-primary, #fff)" />`);
    labels.push(`<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-family="var(--font-interface, sans-serif)" fill="currentColor">${escapeXml(text)}</text>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="qt-smiles-svg" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" width="${width.toFixed(0)}" height="${height.toFixed(0)}" role="img" aria-label="Chemical structure: ${escapeXml(graph.smiles)}">${lines.join("")}${labels.join("")}</svg>`;
  return { ok: true, svg, atoms: graph.atoms.length, bonds: graph.bonds.length, smiles: graph.smiles };
}

module.exports = {
  parseSmiles,
  renderSmilesSvg,
};
