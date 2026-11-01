"use strict";
/*
 * Local STEM diagrams for question content.
 *
 * Everything here is deterministic, dependency-free and offline:
 *   - chemistry: a local SMILES structure or a simple reaction equation
 *   - biology:   DNA/RNA strands, complements and codon translation
 *   - circuits:  a small two-terminal schematic renderer
 *
 * The parsers deliberately reject syntax outside the documented subset rather
 * than guessing. Nothing is sent to a provider or fetched from a service.
 */
const { renderSmilesSvg } = require("./smiles");
const { safeSvg } = require("./svg-safety");
const { codonEntry } = require("./reference-sheets");

const MAX_SOURCE = 6000;
const MAX_CHEM_SPECIES = 8;
const MAX_CHEM_LINES = 8;
const MAX_SEQUENCE = 1200;
const MAX_CIRCUIT_COMPONENTS = 40;
const MAX_CIRCUIT_NODES = 24;

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function errorResult(message) {
  return { ok: false, error: String(message || "The diagram could not be read.") };
}

/* --------------------------------------------------------------- chemistry */

const CHEM_FORMULA = /^[A-Z][A-Za-z0-9()]*(?:[·.]\d*[A-Z][A-Za-z0-9()]*)*$/;
const CHEM_ARROW = /\s*(<=>|<->|-->|->|<-|⇌|→|←)\s*/;
const CHEM_ARROWS = {
  "->": "→",
  "-->": "→",
  "<-": "←",
  "<--": "←",
  "<->": "↔",
  "<=>": "⇌",
  "→": "→",
  "←": "←",
  "⇌": "⇌",
};

function parseChemicalSpecies(raw) {
  let text = String(raw || "").trim();
  if (!text || text.length > 80) return null;
  let coefficient = "";
  const coefficientMatch = /^(\d+(?:\.\d+)?)\s*(?=[A-Z(])/.exec(text);
  if (coefficientMatch) {
    coefficient = coefficientMatch[1];
    text = text.slice(coefficientMatch[0].length);
  }
  let state = "";
  const stateMatch = /\((s|l|g|aq)\)$/i.exec(text);
  if (stateMatch) {
    state = stateMatch[1].toLowerCase();
    text = text.slice(0, -stateMatch[0].length);
  }
  let charge = "";
  const chargeMatch = /\^([0-9]*[+-])$/.exec(text) || /([0-9]*[+-])$/.exec(text);
  if (chargeMatch) {
    charge = chargeMatch[1];
    text = text.slice(0, -chargeMatch[0].length);
  }
  if (!CHEM_FORMULA.test(text)) return null;
  return { coefficient, formula: text, charge, state };
}

function chemicalFormulaHtml(formula) {
  return escapeHtml(formula).replace(/(\)|[A-Z][a-z]?)(\d+)/g, "$1<sub>$2</sub>");
}

function chemicalSpeciesHtml(species) {
  const coefficient = species.coefficient ? `<span class="qt-chem-coefficient">${escapeHtml(species.coefficient)}</span>` : "";
  const charge = species.charge ? `<sup>${escapeHtml(species.charge)}</sup>` : "";
  const state = species.state ? `<span class="qt-chem-state">(${escapeHtml(species.state)})</span>` : "";
  return `<span class="qt-chem-species">${coefficient}<span class="qt-chem-formula">${chemicalFormulaHtml(species.formula)}${charge}</span>${state}</span>`;
}

function parseChemicalSide(raw) {
  const terms = String(raw || "").trim().split(/\s+\+\s+/);
  if (!terms.length || terms.length > MAX_CHEM_SPECIES) return null;
  const species = terms.map(parseChemicalSpecies);
  if (species.some((item) => !item)) return null;
  return species;
}

function chemistrySideHtml(species) {
  return species.map(chemicalSpeciesHtml).join('<span class="qt-chem-plus" aria-hidden="true">+</span>');
}

function chemistrySidePlain(species) {
  return species.map((item) => `${item.coefficient ? `${item.coefficient} ` : ""}${item.formula}${item.charge || ""}${item.state ? `(${item.state})` : ""}`).join(" + ");
}

function renderChemistryStructure(source) {
  const result = renderSmilesSvg(source);
  if (!result.ok) return errorResult(`SMILES: ${result.error}`);
  const svg = safeSvg(result.svg);
  if (!svg) return errorResult("The structure renderer produced an unsafe SVG.");
  return {
    ok: true,
    kind: "structure",
    svg,
    html: `<div class="qt-chem qt-chem-structure">${svg}</div>`,
    plain: String(source || "").trim(),
  };
}

/**
 * A `chem` block accepts either `SMILES: ...` or one or more equations such as
 * `2H2 + O2 -> 2H2O`. The supported formula subset is intentionally small.
 */
function renderChemistryDiagram(source) {
  const text = String(source || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return errorResult("Add a SMILES structure or a chemical equation.");
  if (text.length > MAX_SOURCE) return errorResult(`A chemistry diagram is limited to ${MAX_SOURCE} characters.`);

  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && !line.startsWith("//"));
  if (!lines.length) return errorResult("Add a SMILES structure or a chemical equation.");
  const smilesLine = lines.findIndex((line) => /^(smiles?|structure)\s*:/i.test(line));
  if (smilesLine >= 0) {
    if (smilesLine !== 0) return errorResult("Put a SMILES structure on the first line.");
    const first = lines[0].replace(/^(smiles?|structure)\s*:/i, "").trim();
    const rest = lines.slice(1).join("");
    return renderChemistryStructure(`${first}${rest}`);
  }

  if (lines.length > MAX_CHEM_LINES) return errorResult(`A chemistry block is limited to ${MAX_CHEM_LINES} equations.`);
  const equations = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/^(reaction|equation)\s*:\s*/i, "").trim();
    if (!line) continue;
    const parts = line.split(CHEM_ARROW);
    if (parts.length > 3) return errorResult("Use one reaction arrow per equation.");
    if (parts.length === 1) {
      const side = parseChemicalSide(parts[0]);
      if (!side) return errorResult(`Unsupported chemical formula in "${rawLine}".`);
      const plain = chemistrySidePlain(side);
      equations.push({
        html: `<div class="qt-chem-equation" role="img" aria-label="${escapeHtml(plain)}"><span class="qt-chem-side">${chemistrySideHtml(side)}</span></div>`,
        plain,
      });
      continue;
    }
    const left = parseChemicalSide(parts[0]);
    const right = parseChemicalSide(parts[2]);
    if (!left || !right) return errorResult(`Unsupported chemical formula in "${rawLine}".`);
    const arrow = CHEM_ARROWS[parts[1]];
    if (!arrow) return errorResult(`Unsupported reaction arrow "${parts[1]}".`);
    const plain = `${chemistrySidePlain(left)} ${arrow} ${chemistrySidePlain(right)}`;
    equations.push({
      html: `<div class="qt-chem-equation" role="img" aria-label="${escapeHtml(plain)}"><span class="qt-chem-side">${chemistrySideHtml(left)}</span><span class="qt-chem-arrow" aria-hidden="true">${arrow}</span><span class="qt-chem-side">${chemistrySideHtml(right)}</span></div>`,
      plain,
    });
  }
  if (!equations.length) return errorResult("Add a chemical equation.");
  const plain = equations.map((item) => item.plain).join(" · ");
  return {
    ok: true,
    kind: "equation",
    html: `<div class="qt-chem qt-chem-equations" role="group" aria-label="${escapeHtml(plain)}">${equations.map((item) => item.html).join("")}</div>`,
    plain,
    equations: equations.length,
  };
}

/* ---------------------------------------------------------------- biology */

const NUCLEOTIDE = /^[ACGTURYSWKMBDHVN-]+$/;
const PROTEIN = /^[ACDEFGHIKLMNPQRSTVWY*X-]+$/;
const DNA_COMPLEMENT = { A: "T", T: "A", C: "G", G: "C", R: "Y", Y: "R", S: "S", W: "W", K: "M", M: "K", B: "V", V: "B", D: "H", H: "D", N: "N", "-": "-" };
const RNA_COMPLEMENT = { A: "U", U: "A", T: "A", C: "G", G: "C", R: "Y", Y: "R", S: "S", W: "W", K: "M", M: "K", B: "V", V: "B", D: "H", H: "D", N: "N", "-": "-" };

function parseBoolean(value, fallback) {
  const text = String(value == null ? "" : value).trim().toLowerCase();
  if (!text) return fallback;
  if (["true", "yes", "on", "1"].includes(text)) return true;
  if (["false", "no", "off", "0"].includes(text)) return false;
  return null;
}

function complementSequence(sequence, type) {
  const map = type === "rna" ? RNA_COMPLEMENT : DNA_COMPLEMENT;
  return [...sequence].map((base) => map[base] || base).join("");
}

function nucleotideCodons(sequence, type) {
  const rows = [];
  let stopped = false;
  for (let i = 0; i < sequence.length; i += 3) {
    const bases = sequence.slice(i, i + 3);
    let entry = bases.length === 3 ? codonEntry(bases) : null;
    let code = "?";
    let aminoAcid = "Incomplete codon";
    if (bases.includes("-")) {
      aminoAcid = "Gap";
    } else if (!entry && /[^ACGTU]/.test(bases)) {
      aminoAcid = "Ambiguous base";
    } else if (entry && stopped) {
      aminoAcid = "After stop";
    } else if (entry) {
      code = entry.code;
      aminoAcid = entry.aminoAcid;
      if (entry.stop) stopped = true;
    }
    rows.push({ bases, code, aminoAcid, stop: code === "*" });
  }
  return { rows, protein: rows.map((row) => row.code).join("") };
}

function baseSpan(base) {
  const color = /[ACGTU]/.test(base) ? ` qt-bio-${base}` : "";
  return `<span class="qt-bio-base${color}">${escapeHtml(base)}</span>`;
}

function nucleotideTrackHtml(sequence) {
  let html = "";
  for (let i = 0; i < sequence.length; i += 3) {
    const bases = sequence.slice(i, i + 3);
    html += `<span class="qt-bio-codon">${[...bases].map(baseSpan).join("")}</span>`;
  }
  return html;
}

function proteinTrackHtml(sequence) {
  let html = "";
  for (let i = 0; i < sequence.length; i += 10) {
    html += `<span class="qt-bio-protein-group">${[...sequence.slice(i, i + 10)].map((residue) => `<span class="qt-bio-residue">${escapeHtml(residue)}</span>`).join("")}</span>`;
  }
  return html;
}

/**
 * A `biology`/`biosequence` block accepts either a raw sequence or key/value
 * options (`type`, `sequence`, `translate`, `complement`, `name`). It renders
 * the strand, its complement and the standard codon translation locally.
 */
function renderBiologyDiagram(source) {
  const text = String(source || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return errorResult("Add a DNA, RNA or protein sequence.");
  if (text.length > MAX_SOURCE) return errorResult(`A biology diagram is limited to ${MAX_SOURCE} characters.`);
  const options = {};
  const rawParts = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    let match = /^(type|sequence|seq|translate|complement|name|label|frame|readingframe)\s*:\s*(.*)$/i.exec(line);
    if (match) {
      options[match[1].toLowerCase()] = match[2].trim();
      continue;
    }
    match = /^(dna|rna|protein)\s*:\s*(.*)$/i.exec(line);
    if (match) {
      options.type = match[1].toLowerCase();
      options.sequence = match[2].trim();
      continue;
    }
    if (/^(dna|rna|protein)$/i.test(line) && !options.type) {
      options.type = line.toLowerCase();
      continue;
    }
    rawParts.push(line);
  }
  let sequence = String(options.sequence || options.seq || rawParts.join("")).toUpperCase();
  sequence = sequence.replace(/\s+/g, "").replace(/^5['′]?/, "").replace(/3['′]?$/, "");
  if (!sequence) return errorResult("Add a DNA, RNA or protein sequence.");
  if (sequence.length > MAX_SEQUENCE) return errorResult(`A sequence is limited to ${MAX_SEQUENCE} characters.`);

  let type = String(options.type || "").toLowerCase();
  if (type && !["dna", "rna", "protein"].includes(type)) return errorResult(`Unknown sequence type "${options.type}".`);
  if (!type) {
    if (sequence.includes("U")) type = "rna";
    else if (sequence.includes("T")) type = "dna";
    else if (NUCLEOTIDE.test(sequence)) type = "dna";
    else type = "protein";
  }
  if (type === "protein" && !PROTEIN.test(sequence)) return errorResult("A protein sequence can only use the standard amino-acid letters, *, X or -.");
  if (type !== "protein" && !NUCLEOTIDE.test(sequence)) {
    return errorResult(`${type.toUpperCase()} sequences can only use IUPAC nucleotide letters, U/T or -.`);
  }
  if (type === "dna" && sequence.includes("U")) return errorResult("A DNA sequence cannot contain U; use RNA or replace U with T.");
  if (type === "rna") sequence = sequence.replace(/T/g, "U");

  const translateOption = parseBoolean(options.translate, type !== "protein");
  const complementOption = parseBoolean(options.complement, type === "dna");
  if (translateOption === null) return errorResult("translate must be true or false.");
  if (complementOption === null) return errorResult("complement must be true or false.");
  const label = String(options.name || options.label || "").trim();
  const title = label ? `<div class="qt-bio-name">${escapeHtml(label)}</div>` : "";

  if (type === "protein") {
    const html = `<div class="qt-bio qt-bio-protein" role="group" aria-label="${escapeHtml(label || `Protein sequence, ${sequence.length} residues`)}">${title}<div class="qt-bio-meta">Protein · ${sequence.length} residues</div><div class="qt-bio-protein-track">${proteinTrackHtml(sequence)}</div></div>`;
    return { ok: true, kind: "protein", type, sequence, protein: sequence, html, length: sequence.length };
  }

  const complement = complementOption ? complementSequence(sequence, type) : "";
  const translated = nucleotideCodons(sequence, type);
  const codons = translated.rows.length;
  const preamble = `${type.toUpperCase()} · ${sequence.length} nt · ${codons} codon${codons === 1 ? "" : "s"}`;
  const rows = [
    `<div class="qt-bio-strand"><span class="qt-bio-end">5'</span><span class="qt-bio-track">${nucleotideTrackHtml(sequence)}</span><span class="qt-bio-end">3'</span></div>`,
  ];
  if (complement) {
    rows.push(`<div class="qt-bio-strand qt-bio-complement"><span class="qt-bio-end">3'</span><span class="qt-bio-track">${nucleotideTrackHtml(complement)}</span><span class="qt-bio-end">5'</span></div>`);
  }
  if (translateOption) {
    const aa = translated.rows.map((row) => `<span class="qt-bio-codon"><span class="qt-bio-aa${row.stop ? " qt-bio-stop" : ""}" title="${escapeHtml(row.aminoAcid)}">${escapeHtml(row.code)}</span></span>`).join("");
    rows.push(`<div class="qt-bio-translation"><span class="qt-bio-end">Protein</span><span class="qt-bio-track">${aa}</span></div>`);
  }
  const description = label ? `${label}: ${preamble}` : preamble;
  return {
    ok: true,
    kind: type,
    type,
    sequence,
    complement,
    codons: translated.rows,
    protein: translated.protein,
    html: `<div class="qt-bio qt-bio-${type}" role="group" aria-label="${escapeHtml(description)}">${title}<div class="qt-bio-meta">${escapeHtml(preamble)}</div>${rows.join("")}</div>`,
    length: sequence.length,
  };
}

/* ---------------------------------------------------------------- circuits */

const CIRCUIT_TYPES = {
  battery: "battery",
  source: "battery",
  voltage: "battery",
  v: "battery",
  resistor: "resistor",
  r: "resistor",
  lamp: "lamp",
  bulb: "lamp",
  led: "led",
  switch: "switch",
  sw: "switch",
  capacitor: "capacitor",
  cap: "capacitor",
  c: "capacitor",
  inductor: "inductor",
  coil: "inductor",
  ind: "inductor",
  i: "inductor",
  motor: "motor",
  m: "motor",
  diode: "diode",
  d: "diode",
  wire: "wire",
  w: "wire",
  ground: "ground",
  gnd: "ground",
};

const CIRCUIT_LABELS = {
  battery: "Battery",
  resistor: "Resistor",
  lamp: "Lamp",
  led: "LED",
  switch: "Switch",
  capacitor: "Capacitor",
  inductor: "Inductor",
  motor: "Motor",
  diode: "Diode",
  wire: "Wire",
  ground: "Ground",
};

function typeFromId(id) {
  const prefix = String(id || "").replace(/\d+$/, "").toUpperCase();
  if (["V", "E", "BAT"].includes(prefix)) return "battery";
  if (prefix === "R") return "resistor";
  if (["L", "LAMP", "LED"].includes(prefix)) return prefix === "LED" ? "led" : "lamp";
  if (prefix === "C") return "capacitor";
  if (["I", "IND", "COIL"].includes(prefix)) return "inductor";
  if (prefix === "M") return "motor";
  if (prefix === "D") return "diode";
  if (prefix === "SW") return "switch";
  if (prefix === "W") return "wire";
  if (prefix === "GND") return "ground";
  return "";
}

function parseCircuit(source) {
  const text = String(source || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return errorResult("Add a circuit netlist.");
  if (text.length > MAX_SOURCE) return errorResult(`A circuit is limited to ${MAX_SOURCE} characters.`);
  const components = [];
  const nodes = [];
  const nodeSet = new Set();
  const ids = new Set();
  let title = "";
  const addNode = (node) => {
    const value = String(node || "").trim();
    if (!value || value.length > 32 || /[\s,;]/.test(value)) return false;
    if (!nodeSet.has(value)) {
      nodeSet.add(value);
      nodes.push(value);
    }
    return true;
  };
  const add = (component) => {
    if (components.length >= MAX_CIRCUIT_COMPONENTS) throw new Error(`A circuit is limited to ${MAX_CIRCUIT_COMPONENTS} components.`);
    if (!component.id || component.id.length > 32 || /[\s,;]/.test(component.id)) throw new Error("Every component needs a short ID.");
    if (ids.has(component.id.toLowerCase())) throw new Error(`Duplicate component ID "${component.id}".`);
    ids.add(component.id.toLowerCase());
    if (component.type !== "ground") {
      if (!addNode(component.a) || !addNode(component.b)) throw new Error(`Component "${component.id}" needs two valid nodes.`);
    } else if (!addNode(component.a)) {
      throw new Error(`Ground "${component.id}" needs a valid node.`);
    }
    components.push(component);
  };

  try {
    for (const rawLine of text.split("\n")) {
      const line = rawLine.replace(/\s+#.*$/, "").replace(/^\s*\/\/.*$/, "").trim();
      if (!line) continue;
      const titleMatch = /^(circuit|title)\s*:\s*(.+)$/i.exec(line);
      if (titleMatch) {
        title = titleMatch[2].trim();
        continue;
      }
      if (/^circuit$/i.test(line)) continue;
      const tokens = line.split(/\s+/);
      let type = CIRCUIT_TYPES[tokens[0].toLowerCase()] || "";
      let id;
      let a;
      let b;
      let value;
      if (type) {
        if (type === "ground") {
          id = tokens[1] || "GND";
          a = tokens[2] || tokens[1];
          value = tokens.slice(3).join(" ");
        } else {
          id = tokens[1];
          a = tokens[2];
          b = tokens[3];
          value = tokens.slice(4).join(" ");
        }
      } else {
        id = tokens[0];
        const inferred = typeFromId(id);
        if (!inferred) throw new Error(`Unknown component type or ID prefix in "${rawLine}".`);
        type = inferred;
        if (type === "ground") {
          a = tokens[1];
          value = tokens.slice(2).join(" ");
        } else {
          a = tokens[1];
          b = tokens[2];
          value = tokens.slice(3).join(" ");
        }
      }
      if (!id || !a || (type !== "ground" && !b)) throw new Error(`Component "${id || "?"}" is missing its nodes.`);
      add({ id, type, a, b, value: value || "" });
    }
  } catch (e) {
    return errorResult(e && e.message ? e.message : String(e));
  }

  if (!components.length) return errorResult("Add at least one component.");
  if (!nodes.length) return errorResult("Add at least one node.");
  if (nodes.length > MAX_CIRCUIT_NODES) return errorResult(`A circuit is limited to ${MAX_CIRCUIT_NODES} nodes.`);
  const wired = components.filter((component) => component.type !== "ground");
  if (!wired.length) return errorResult("Add a component between two nodes, not only ground.");
  if (nodes.length < 2) return errorResult("A circuit needs at least two nodes.");
  return { ok: true, components, nodes, title };
}

function circuitAdjacency(components, nodes) {
  const adj = new Map(nodes.map((node) => [node, []]));
  for (const component of components) {
    if (component.type === "ground" || component.type === "wire") continue;
    if (!adj.has(component.a) || !adj.has(component.b)) continue;
    adj.get(component.a).push({ other: component.b, component });
    adj.get(component.b).push({ other: component.a, component });
  }
  return adj;
}

function cycleOrder(nodes, adj) {
  if (nodes.length < 3 || nodes.some((node) => (adj.get(node) || []).length !== 2)) return [];
  const start = nodes[0];
  const order = [];
  let previous = null;
  let current = start;
  for (let i = 0; i < nodes.length; i++) {
    order.push(current);
    const next = (adj.get(current) || []).find((edge) => edge.other !== previous);
    if (!next) return [];
    previous = current;
    current = next.other;
  }
  return current === start && order.length === nodes.length ? order : [];
}

function rectanglePositions(nodes) {
  const width = 320;
  const height = 200;
  const left = 40;
  const top = 40;
  const perimeter = 2 * (width + height);
  return nodes.map((node, index) => {
    let t = (index / nodes.length) * perimeter;
    if (t < width) return { node, x: left + t, y: top };
    t -= width;
    if (t < height) return { node, x: left + width, y: top + t };
    t -= height;
    if (t < width) return { node, x: left + width - t, y: top + height };
    t -= width;
    return { node, x: left, y: top + height - t };
  });
}

function radialPositions(nodes) {
  const cx = 200;
  const cy = 150;
  const rx = 140;
  const ry = 100;
  return nodes.map((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    return { node, x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function layoutCircuit(components, nodes) {
  const wired = components.filter((component) => component.type !== "ground");
  const adj = circuitAdjacency(components, nodes);
  if (nodes.length === 2 && wired.length > 0 && wired.every((component) => component.a === nodes[0] && component.b === nodes[1] || component.a === nodes[1] && component.b === nodes[0])) {
    const positions = new Map([[nodes[0], { x: 50, y: 150 }], [nodes[1], { x: 350, y: 150 }]]);
    return { positions, edges: wired, mode: "parallel" };
  }
  const order = cycleOrder(nodes, adj);
  if (order.length) {
    const rows = rectanglePositions(order);
    return { positions: new Map(rows.map((row) => [row.node, { x: row.x, y: row.y }])), edges: wired, mode: "loop" };
  }
  const rows = radialPositions(nodes);
  return { positions: new Map(rows.map((row) => [row.node, { x: row.x, y: row.y }])), edges: wired, mode: "radial" };
}

function componentHalf(type) {
  return {
    battery: 14,
    resistor: 22,
    lamp: 15,
    led: 18,
    switch: 22,
    capacitor: 10,
    inductor: 22,
    motor: 16,
    diode: 18,
    wire: 0,
  }[type] || 18;
}

function circuitSymbol(type, value) {
  const stroke = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  if (type === "battery") {
    return `<line x1="-7" y1="-14" x2="-7" y2="14" ${stroke}/><line x1="7" y1="-8" x2="7" y2="8" ${stroke}/><text x="-14" y="-12" font-size="10" fill="currentColor">+</text>`;
  }
  if (type === "resistor") {
    return `<rect x="-22" y="-8" width="44" height="16" rx="2" fill="var(--background-primary, #fff)" stroke="currentColor" stroke-width="1.8"/>`;
  }
  if (type === "lamp") {
    return `<circle cx="0" cy="0" r="14" fill="var(--background-primary, #fff)" stroke="currentColor" stroke-width="1.8"/><line x1="-9" y1="-9" x2="9" y2="9" ${stroke}/><line x1="9" y1="-9" x2="-9" y2="9" ${stroke}/>`;
  }
  if (type === "led") {
    return `<path d="M -10 -10 L -10 10 L 8 0 Z" fill="var(--background-primary, #fff)" stroke="currentColor" stroke-width="1.8"/><line x1="8" y1="-11" x2="8" y2="11" ${stroke}/><path d="M -14 -14 L -20 -20 M -11 -17 L -17 -23" ${stroke}/>`;
  }
  if (type === "diode") {
    return `<path d="M -10 -10 L -10 10 L 8 0 Z" fill="var(--background-primary, #fff)" stroke="currentColor" stroke-width="1.8"/><line x1="8" y1="-11" x2="8" y2="11" ${stroke}/>`;
  }
  if (type === "switch") {
    return `<circle cx="-12" cy="0" r="2.5" fill="currentColor"/><circle cx="12" cy="0" r="2.5" fill="currentColor"/><line x1="-12" y1="0" x2="11" y2="-10" ${stroke}/><line x1="-22" y1="0" x2="-14" y2="0" ${stroke}/><line x1="14" y1="0" x2="22" y2="0" ${stroke}/>`;
  }
  if (type === "capacitor") {
    return `<line x1="-5" y1="-14" x2="-5" y2="14" ${stroke}/><line x1="5" y1="-14" x2="5" y2="14" ${stroke}/>`;
  }
  if (type === "inductor") {
    return `<path d="M -22 0 q 7 -13 14 0 q 7 -13 14 0 q 7 -13 14 0" ${stroke}/>`;
  }
  if (type === "motor") {
    return `<circle cx="0" cy="0" r="15" fill="var(--background-primary, #fff)" stroke="currentColor" stroke-width="1.8"/><text x="0" y="4" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">M</text>`;
  }
  if (type === "wire") return "";
  return `<rect x="-18" y="-10" width="36" height="20" rx="3" fill="var(--background-primary, #fff)" stroke="currentColor" stroke-width="1.8"/><text x="0" y="4" text-anchor="middle" font-size="10" fill="currentColor">${escapeHtml(CIRCUIT_LABELS[type] || type)}</text>`;
}

/**
 * A `circuit` block draws a small two-terminal schematic. It is a renderer,
 * not a simulator: it never solves currents or voltages.
 *
 * Examples:
 *   battery V1 1 0 9V
 *   resistor R1 1 2 100Ω
 *   lamp L1 2 0
 */
function renderCircuitDiagram(source) {
  const parsed = parseCircuit(source);
  if (!parsed.ok) return parsed;
  const { components, nodes, title } = parsed;
  const layout = layoutCircuit(components, nodes);
  const ground = components.filter((component) => component.type === "ground");
  const groups = new Map();
  for (const component of layout.edges) {
    const key = [component.a, component.b].sort().join("\u0000");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(component);
  }
  const lines = [];
  const symbols = [];
  const labels = [];
  for (const component of layout.edges) {
    const a = layout.positions.get(component.a);
    const b = layout.positions.get(component.b);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const nx = -uy;
    const ny = ux;
    const key = [component.a, component.b].sort().join("\u0000");
    const peers = groups.get(key) || [];
    const index = peers.indexOf(component);
    const offset = (index - (peers.length - 1) / 2) * (peers.length > 1 ? 34 : 0);
    const cx = (a.x + b.x) / 2 + nx * offset;
    const cy = (a.y + b.y) / 2 + ny * offset;
    const half = componentHalf(component.type);
    const p1 = { x: cx - ux * half, y: cy - uy * half };
    const p2 = { x: cx + ux * half, y: cy + uy * half };
    if (component.type === "wire") {
      lines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`);
    } else {
      lines.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${p1.x.toFixed(1)}" y2="${p1.y.toFixed(1)}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`);
      lines.push(`<line x1="${p2.x.toFixed(1)}" y1="${p2.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`);
    }
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    symbols.push(`<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${angle.toFixed(1)})">${circuitSymbol(component.type, component.value)}</g>`);
    const label = [component.id, component.value].filter(Boolean).join(" ");
    if (label) {
      const lx = cx + nx * (peers.length > 1 ? 24 : 30);
      const ly = cy + ny * (peers.length > 1 ? 24 : 30);
      labels.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--text-muted, currentColor)">${escapeHtml(label)}</text>`);
    }
  }
  for (const node of nodes) {
    const p = layout.positions.get(node);
    if (!p) continue;
    lines.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="currentColor"/>`);
    labels.push(`<text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-faint, currentColor)">${escapeHtml(node)}</text>`);
  }
  for (const component of ground) {
    const p = layout.positions.get(component.a);
    if (!p) continue;
    lines.push(`<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})"><line x1="0" y1="4" x2="0" y2="18" stroke="currentColor" stroke-width="1.8"/><line x1="-12" y1="18" x2="12" y2="18" stroke="currentColor" stroke-width="1.8"/><line x1="-8" y1="22" x2="8" y2="22" stroke="currentColor" stroke-width="1.8"/><line x1="-4" y1="26" x2="4" y2="26" stroke="currentColor" stroke-width="1.8"/></g>`);
    if (component.value) labels.push(`<text x="${p.x.toFixed(1)}" y="${(p.y + 40).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-muted, currentColor)">${escapeHtml(component.value)}</text>`);
  }
  const labelText = title || "Circuit diagram";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="qt-circuit-svg" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="${escapeHtml(labelText)}">${lines.join("")}${symbols.join("")}${labels.join("")}</svg>`;
  const safe = safeSvg(svg);
  if (!safe) return errorResult("The circuit renderer produced an unsafe SVG.");
  return {
    ok: true,
    kind: "circuit",
    svg: safe,
    html: `<div class="qt-circuit" role="group" aria-label="${escapeHtml(labelText)}">${safe}</div>`,
    components: components.length,
    nodes: nodes.length,
    mode: layout.mode,
  };
}

module.exports = {
  parseChemicalSpecies,
  renderChemistryDiagram,
  renderBiologyDiagram,
  parseCircuit,
  layoutCircuit,
  renderCircuitDiagram,
};
