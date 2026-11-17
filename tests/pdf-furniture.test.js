"use strict";
/*
 * Repeated page furniture. An imported exam PDF carries a download stamp, a watermark id, a running
 * header, a copyright footer and a printed page number on every page. They are the file's furniture,
 * not part of its questions, so the text the importer reads must not contain them — while a line
 * that only some pages share, or that sits in the body of the page, must survive untouched.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, obsidian } = require("./helpers/load");

const PAGE_W = 612;
const PAGE_H = 792;
const HEADER = "AP World History: Modern Test Booklet";
const STAMP = "Downloaded by Bobby Joe (hummingbirdrhino@gmail.com)";
const WATERMARK = "lOMoARcPSD|64937195";
const COPYRIGHT =
  "Copyright (c) 2021. The College Board. These materials are part of a College Board program.";

let provider = () => {
  throw new Error("this test never opens a document");
};
obsidian.loadPdfJs = async () => provider();
load();
const pdf = require("../src/pdf");

/** A line at a fixed spot on the page, in the reader's pixel units (y grows downward). */
function line(text, y) {
  return { text, y };
}

/** A page as readPdfPages collects it before the furniture pass. */
function page(n, textLines, lines) {
  return { n, pageHeight: PAGE_H, textLines, lines: lines || [] };
}

const HEAD = line(HEADER, 30);
const FOOT_STAMP = line(STAMP, 740);
const FOOT_COPYRIGHT = line(COPYRIGHT, 758);

test("a stamp repeated in the footer band is dropped from a three-page document", () => {
  const pages = [
    page(1, [HEAD, line("1. Which of the following best explains the trade?", 200), FOOT_STAMP]),
    page(2, [HEAD, line("A Easing of tensions among European states", 200), FOOT_STAMP]),
    page(3, [HEAD, line("2. The two interpretations differ most strongly concerning", 200), FOOT_STAMP]),
  ];
  const furniture = pdf.repeatedFurniture(pages);
  assert.deepEqual([...furniture].sort(), [HEADER.toLowerCase(), STAMP.toLowerCase()].sort());
  for (const one of pages) {
    const kept = pdf.withoutRepeatedFurniture(one.textLines, furniture, one.pageHeight, one.n).map((l) => l.text);
    assert.equal(kept.includes(STAMP), false, `page ${one.n} loses the stamp`);
    assert.equal(kept.includes(HEADER), false, `page ${one.n} loses the running header`);
    assert.equal(kept.length, 1, `page ${one.n} keeps its body line`);
  }
});

test("a line on only one page is kept", () => {
  const pages = [
    page(1, [line("Name", 200), FOOT_STAMP]),
    page(2, [line("Source 1: [In the sixteenth through the eighteenth centuries]", 200), FOOT_STAMP]),
    page(3, [line("Source 2: The societies of Europe had been at the margins", 200), FOOT_STAMP]),
  ];
  const furniture = pdf.repeatedFurniture(pages);
  const kept = pdf.withoutRepeatedFurniture(pages[0].textLines, furniture, PAGE_H, 1).map((l) => l.text);
  assert.deepEqual(kept, ["Name"], "the one-page line stays and only the stamp goes");
});

test("a legitimate line that repeats on most pages in the body is kept", () => {
  // A question stem quoted again by a later section, and a source passage the exam repeats: both
  // sit in the page body, so they are content even when ten pages carry the same words.
  const stem = "Evaluate the extent to which Christianity changed societies in Latin America in the period 1500-1800.";
  const pages = [];
  for (let n = 1; n <= 10; n++) pages.push(page(n, [HEAD, line(stem, 300), FOOT_STAMP]));
  const furniture = pdf.repeatedFurniture(pages);
  const kept = pdf.withoutRepeatedFurniture(pages[3].textLines, furniture, PAGE_H, 4).map((l) => l.text);
  assert.deepEqual(kept, [stem], "a repeated line in the body is not furniture");
});

test("a heading shared by a few pages of a long document is kept", () => {
  const pages = [];
  for (let n = 1; n <= 21; n++) {
    const body = n <= 5 ? [line("Document 3", 200)] : [line(`Question ${n} directions`, 200)];
    pages.push(page(n, [HEAD, ...body, FOOT_STAMP]));
  }
  const furniture = pdf.repeatedFurniture(pages);
  assert.equal(furniture.has("document 3"), false, "five pages out of twenty-one is not most pages");
  const kept = pdf.withoutRepeatedFurniture(pages[0].textLines, furniture, PAGE_H, 1).map((l) => l.text);
  assert.ok(kept.includes("Document 3"), "the heading stays");
});

test("one- and two-page documents keep every line", () => {
  const one = [page(1, [HEAD, line("A Easing of tensions among European states", 200), FOOT_STAMP])];
  assert.equal(pdf.repeatedFurniture(one).size, 0, "a single page has no furniture to find");
  const two = [page(1, [HEAD, FOOT_STAMP]), page(2, [HEAD, FOOT_STAMP])];
  assert.equal(pdf.repeatedFurniture(two).size, 0, "two pages are not enough evidence");
});

test("a shared line is only dropped where it repeats, in its band", () => {
  const pages = [
    page(1, [HEAD, line(HEADER, 400), FOOT_STAMP]),
    page(2, [HEAD, line("2. A body line", 400), FOOT_STAMP]),
    page(3, [HEAD, line("3. Another body line", 400), FOOT_STAMP]),
  ];
  const furniture = pdf.repeatedFurniture(pages);
  const kept = pdf.withoutRepeatedFurniture(pages[0].textLines, furniture, PAGE_H, 1).map((l) => l.text);
  assert.deepEqual(kept, [HEADER], "the same words in the page body are content");
});

test("a printed page number is dropped on its own page only", () => {
  assert.equal(pdf.isPageNumberLine("Page 12 of 21", 12), true);
  assert.equal(pdf.isPageNumberLine("Page 12 of 21", 13), false, "another page's number is content");
  assert.equal(pdf.isPageNumberLine("12 / 21", 12), true);
  assert.equal(pdf.isPageNumberLine("- 7 -", 7), true);
  assert.equal(pdf.isPageNumberLine("page 3", 3), true);
  assert.equal(pdf.isPageNumberLine("25 pesos rent per year", 12), false);
  assert.equal(pdf.isPageNumberLine("A Easing of tensions among European states", 1), false);
  const pages = [page(1, [FOOT_STAMP]), page(2, [FOOT_STAMP]), page(3, [FOOT_STAMP])];
  const furniture = pdf.repeatedFurniture(pages);
  const kept = pdf.withoutRepeatedFurniture([line("Page 2 of 21", 770), FOOT_STAMP], furniture, PAGE_H, 2).map((l) => l.text);
  assert.deepEqual(kept, []);
});

test("the table lines are cleaned with the same furniture set", () => {
  const pages = [
    page(1, [FOOT_STAMP], [line(STAMP, 740), line("Term\tDefinition", 300)]),
    page(2, [FOOT_STAMP], [line(STAMP, 740), line("Cells\tThe smallest unit of life", 300)]),
    page(3, [FOOT_STAMP], [line(STAMP, 740), line("Enzyme\tA protein that speeds a reaction", 300)]),
  ];
  const furniture = pdf.repeatedFurniture(pages);
  const kept = pdf.withoutRepeatedFurniture(pages[1].lines, furniture, PAGE_H, 2).map((l) => l.text);
  assert.deepEqual(kept, ["Cells\tThe smallest unit of life"]);
});

/* ------------------------------------------------------------ cover preamble */

test("a cover block from a different publisher is stripped from the first page", () => {
  // A synthetic host that has nothing to do with the exam used for the real run: a repeated
  // tagline, a domain, a "visit …" line and a download slug.
  const lines = [
    line("ExamCloud Study Notes", 60),
    line("ExamCloud Study Notes", 74),
    line("examcloud.example.com", 88),
    line("Visit examcloud.example.com for more", 102),
    line("Download ID 4471902338 - Biology Unit 3 Midterm.pdf", 116),
    line("AP Biology Unit 3 Midterm", 130),
    line("Name: ______________________", 144),
    line("1. Which organelle produces most of a cell's ATP?", 160),
    line("A The nucleus", 174),
  ];
  const kept = pdf.withoutCoverPreamble(lines).map((one) => one.text);
  assert.deepEqual(kept, [
    "AP Biology Unit 3 Midterm",
    "Name: ______________________",
    "1. Which organelle produces most of a cell's ATP?",
    "A The nucleus",
  ]);
});

test("a single legitimate preamble line is kept in place", () => {
  const lines = [line("AP Biology Unit 3 Midterm", 80), line("1. Which organelle produces most of a cell's ATP?", 100)];
  assert.deepEqual(pdf.withoutCoverPreamble(lines).map((one) => one.text), [
    "AP Biology Unit 3 Midterm",
    "1. Which organelle produces most of a cell's ATP?",
  ]);
  const lone = [line("Teacher: Ms. Rivera, Period 4", 70), line("Source 1: A chart of wheat exports", 90)];
  assert.deepEqual(pdf.withoutCoverPreamble(lone).map((one) => one.text), [
    "Teacher: Ms. Rivera, Period 4",
    "Source 1: A chart of wheat exports",
  ]);
});

test("cover detection starts at the first real question, source or heading", () => {
  const lines = [
    line("1. Why did the Qin dynasty fall?", 80),
    line("ExamCloud Study Notes", 94),
    line("ExamCloud Study Notes", 108),
    line("examcloud.example.com", 122),
  ];
  const kept = pdf.withoutCoverPreamble(lines).map((one) => one.text);
  assert.deepEqual(kept, [
    "1. Why did the Qin dynasty fall?",
    "ExamCloud Study Notes",
    "ExamCloud Study Notes",
    "examcloud.example.com",
  ], "nothing past the first question is treated as a cover");
});

test("the cover rules only fire on the shapes they name", () => {
  assert.equal(pdf.isBareUrlLine("https://example.com/x"), true);
  assert.equal(pdf.isBareUrlLine("www.example.com"), true);
  assert.equal(pdf.isBareUrlLine("example.com"), true);
  assert.equal(pdf.isBareUrlLine("Visit example.com for more"), true);
  assert.equal(pdf.isBareUrlLine("The exam covers 1450-1750 C.E."), false);
  assert.equal(pdf.isIdentifierLine("682243944-APWorld Unit 4Exam-pdf AP World History"), true);
  assert.equal(pdf.isIdentifierLine("lOMoARcPSD|64937195"), true);
  assert.equal(pdf.isIdentifierLine("Unit 4 review.pdf"), true);
  assert.equal(pdf.isIdentifierLine("Question 1: What is 2 + 2?"), false);
  assert.equal(pdf.isIdentifierLine("The war lasted from 1754 until 1763."), false);
});

test("a page after the first keeps its own identifier-shaped line", async () => {
  const pages = [
    [
      { str: "ExamCloud Study Notes", y: 780 },
      { str: "ExamCloud Study Notes", y: 766 },
      { str: "1. Which organelle produces most of a cell's ATP?", y: 600 },
    ],
    [
      { str: "ExamCloud Study Notes", y: 770 },
      { str: "Chapter 4 review questions, Unit 4 review.pdf", y: 600 },
    ],
  ];
  provider = async () => ({
    getDocument() {
      return {
        promise: Promise.resolve({
          numPages: pages.length,
          async getPage(n) {
            return {
              async getTextContent() {
                return {
                  items: pages[n - 1].map((entry) => ({
                    str: entry.str,
                    transform: [1, 0, 0, 11, 40, entry.y],
                    width: entry.str.length * 5.5,
                    height: 11,
                    hasEOL: true,
                  })),
                };
              },
              getViewport() {
                return { width: PAGE_W, height: PAGE_H, scale: 1, transform: [1, 0, 0, -1, 0, PAGE_H] };
              },
            };
          },
          async destroy() {},
        }),
      };
    },
  });
  const read = await pdf.readPdfPages(Buffer.from("%PDF-1.4"), "", () => {});
  assert.deepEqual(read.pages[0].text.split("\n"), ["1. Which organelle produces most of a cell's ATP?"]);
  assert.deepEqual(
    read.pages[1].text.split("\n"),
    ["ExamCloud Study Notes", "Chapter 4 review questions, Unit 4 review.pdf"],
    "page 2 is not a cover: its own single lines stay, file-name shaped or not"
  );
});

test("readPdfPages drops the cover block of the first page only", async () => {
  const pages = [
    [
      { str: "ExamCloud Study Notes", y: 780 },
      { str: "ExamCloud Study Notes", y: 766 },
      { str: "examcloud.example.com", y: 752 },
      { str: "AP Biology Unit 3 Midterm", y: 700 },
      { str: "1. Which organelle produces most of a cell's ATP?", y: 640 },
    ],
    [
      { str: "2. A cell is placed in a hypotonic solution.", y: 700 },
      { str: "A It swells and may burst", y: 680 },
    ],
  ];
  provider = async () => ({
    getDocument() {
      return {
        promise: Promise.resolve({
          numPages: pages.length,
          async getPage(n) {
            return {
              async getTextContent() {
                return {
                  items: pages[n - 1].map((entry) => ({
                    str: entry.str,
                    transform: [1, 0, 0, 11, 40, entry.y],
                    width: entry.str.length * 5.5,
                    height: 11,
                    hasEOL: true,
                  })),
                };
              },
              getViewport() {
                return { width: PAGE_W, height: PAGE_H, scale: 1, transform: [1, 0, 0, -1, 0, PAGE_H] };
              },
            };
          },
          async destroy() {},
        }),
      };
    },
  });
  const read = await pdf.readPdfPages(Buffer.from("%PDF-1.4"), "", () => {});
  assert.deepEqual(read.pages[0].text.split("\n"), [
    "AP Biology Unit 3 Midterm",
    "1. Which organelle produces most of a cell's ATP?",
  ]);
  assert.deepEqual(read.pages[1].text.split("\n"), ["2. A cell is placed in a hypotonic solution.", "A It swells and may burst"]);
});

test("readPdfPages returns pages without stamps, headers, footers or page numbers", async () => {
  const pages = [
    [
      { str: HEADER, y: 780 },
      { str: WATERMARK, y: 767 },
      { str: "1. Which of the following best explains Europe's ability to gain trade?", y: 600 },
      { str: "A Easing of tensions among European states", y: 580 },
      { str: STAMP, y: 40 },
      { str: COPYRIGHT, y: 22 },
      { str: "Page 1 of 3", y: 8 },
    ],
    [
      { str: HEADER, y: 780 },
      { str: WATERMARK, y: 767 },
      { str: "B Adoption and improvement of maritime technologies by Europeans", y: 600 },
      { str: STAMP, y: 40 },
      { str: COPYRIGHT, y: 22 },
      { str: "Page 2 of 3", y: 8 },
    ],
    [
      { str: HEADER, y: 780 },
      { str: WATERMARK, y: 767 },
      { str: "2. The two interpretations differ most strongly concerning", y: 600 },
      { str: STAMP, y: 40 },
      { str: COPYRIGHT, y: 22 },
      { str: "Page 3 of 3", y: 8 },
    ],
  ];
  provider = async () => ({
    getDocument() {
      return {
        promise: Promise.resolve({
          numPages: pages.length,
          async getPage(n) {
            return {
              async getTextContent() {
                return {
                  items: pages[n - 1].map((entry) => ({
                    str: entry.str,
                    transform: [1, 0, 0, 11, 40, entry.y],
                    width: entry.str.length * 5.5,
                    height: 11,
                    hasEOL: true,
                  })),
                };
              },
              getViewport() {
                return { width: PAGE_W, height: PAGE_H, scale: 1, transform: [1, 0, 0, -1, 0, PAGE_H] };
              },
            };
          },
          async destroy() {},
        }),
      };
    },
  });
  const read = await pdf.readPdfPages(Buffer.from("%PDF-1.4"), "", () => {});
  assert.equal(read.pages.length, 3);
  assert.deepEqual(
    read.pages.map((one) => one.text.split("\n")),
    [
      ["1. Which of the following best explains Europe's ability to gain trade?", "A Easing of tensions among European states"],
      ["B Adoption and improvement of maritime technologies by Europeans"],
      ["2. The two interpretations differ most strongly concerning"],
    ],
    "only the questions are left, page by page"
  );
  const all = read.pages.map((one) => one.text).join("\n");
  for (const furniture of [STAMP, HEADER, WATERMARK, COPYRIGHT, "Page 1 of 3"]) {
    assert.equal(all.includes(furniture), false, `${furniture.slice(0, 40)} is gone`);
  }
});
