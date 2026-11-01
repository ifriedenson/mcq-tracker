"use strict";
/*
 * Local reading library: books, shelves, page progress and captured quotes.
 * Adapted from Verso's library/bookshelf/quote idea (MIT) as original,
 * dependency-free code. Nothing here calls a provider or writes a note.
 */
const { hashString, localDate, str } = require("./util");

const MAX_BOOKS = 300;
const MAX_QUOTES = 100;
const MAX_TITLE = 200;
const MAX_AUTHOR = 160;
const MAX_QUOTE = 2000;
const BOOK_STATUSES = ["want", "reading", "finished"];
const STATUS_LABELS = { want: "Want to read", reading: "Reading", finished: "Finished" };

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function enabledValue(value) {
  if (value === false) return false;
  if (value && typeof value === "object" && value.enabled === false) return false;
  return true;
}

function textValue(value, max) {
  return str(value).replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function numberValue(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(value) {
  const text = str(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : text;
}

function normalizeQuote(value, index) {
  const source = asObject(value);
  const text = textValue(source.text, MAX_QUOTE);
  if (!text) return null;
  return {
    id: str(source.id).trim() || `quote-${hashString(`${text}|${index}`)}`,
    text,
    page: clamp(numberValue(source.page, 0), 0, 20000),
    addedOn: normalizeDate(source.addedOn),
  };
}

function normalizeBook(value, index) {
  const source = asObject(value);
  const title = textValue(source.title, MAX_TITLE);
  if (!title) return null;
  const totalPages = clamp(numberValue(source.totalPages, 0), 0, 20000);
  const rawPage = clamp(numberValue(source.currentPage, 0), 0, 20000);
  const currentPage = totalPages > 0 ? Math.min(totalPages, rawPage) : rawPage;
  const status = BOOK_STATUSES.includes(source.status) ? source.status : "want";
  const quotes = [];
  for (const raw of Array.isArray(source.quotes) ? source.quotes : []) {
    const quote = normalizeQuote(raw, quotes.length);
    if (!quote || quotes.some((entry) => entry.id === quote.id)) continue;
    quotes.push(quote);
    if (quotes.length >= MAX_QUOTES) break;
  }
  return {
    id: str(source.id).trim() || `book-${hashString(`${title}|${index}`)}`,
    title,
    author: textValue(source.author, MAX_AUTHOR),
    totalPages,
    currentPage,
    status,
    rating: clamp(numberValue(source.rating, 0), 0, 5),
    startedOn: normalizeDate(source.startedOn),
    finishedOn: normalizeDate(source.finishedOn),
    quotes,
  };
}

function normalizeLibrary(value) {
  const source = asObject(value);
  const books = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.books) ? source.books : []) {
    const book = normalizeBook(raw, books.length);
    if (!book || seen.has(book.id)) continue;
    seen.add(book.id);
    books.push(book);
    if (books.length >= MAX_BOOKS) break;
  }
  return {
    enabled: enabledValue(value),
    hideFinished: source.hideFinished === true,
    books,
  };
}

/** Creates one book. `input.today` (YYYY-MM-DD) keeps the function testable. */
function createBook(input, today) {
  const source = asObject(input);
  const title = textValue(source.title, MAX_TITLE);
  if (!title) return null;
  const day = normalizeDate(source.today) || normalizeDate(today) || localDate();
  const status = BOOK_STATUSES.includes(source.status) ? source.status : "want";
  const totalPages = clamp(numberValue(source.totalPages, 0), 0, 20000);
  const currentPage = clamp(numberValue(source.currentPage, 0), 0, totalPages || 20000);
  const id = str(source.id).trim() || `book-${hashString(`${title}|${textValue(source.author, MAX_AUTHOR)}|${day}|${str(source.seed)}`)}`;
  const book = normalizeBook(
    {
      ...source,
      id,
      title,
      status,
      totalPages,
      currentPage,
      startedOn: status === "reading" ? normalizeDate(source.startedOn) || day : normalizeDate(source.startedOn),
      finishedOn: status === "finished" ? normalizeDate(source.finishedOn) || day : "",
    },
    0
  );
  if (book && status === "finished" && book.totalPages > 0) book.currentPage = book.totalPages;
  return book;
}

/** Applies a patch and handles the status transitions (start, finish, reopen). */
function updateBook(books, id, patch, today) {
  const list = normalizeLibrary({ books }).books;
  const index = list.findIndex((book) => book.id === id);
  if (index < 0) return list;
  const before = list[index];
  const change = asObject(patch);
  const day = normalizeDate(change.today) || normalizeDate(today) || localDate();
  const merged = { ...before, ...change, id: before.id, quotes: before.quotes };
  if (change.status && BOOK_STATUSES.includes(change.status)) {
    merged.status = change.status;
    if (change.status === "finished") {
      merged.finishedOn = normalizeDate(change.finishedOn) || before.finishedOn || day;
      if (before.status !== "finished" && merged.totalPages > 0) merged.currentPage = merged.totalPages;
    } else if (change.status === "reading") {
      merged.finishedOn = "";
      merged.startedOn = before.startedOn || day;
    } else {
      merged.finishedOn = "";
    }
  }
  const next = normalizeBook(merged, index);
  if (!next) return list;
  list[index] = next;
  return list;
}

function removeBook(books, id) {
  return normalizeLibrary({ books }).books.filter((book) => book.id !== id);
}

function addQuote(books, bookId, input, today) {
  const list = normalizeLibrary({ books }).books;
  const index = list.findIndex((book) => book.id === bookId);
  if (index < 0) return { books: list, quote: null };
  const source = asObject(input);
  const day = normalizeDate(source.addedOn) || normalizeDate(today) || localDate();
  const text = textValue(source.text, MAX_QUOTE);
  if (!text) return { books: list, quote: null };
  const quote = normalizeQuote(
    {
      id: str(source.id).trim() || `quote-${hashString(`${bookId}|${text}|${source.page || 0}|${day}|${str(source.seed)}`)}`,
      text,
      page: source.page,
      addedOn: day,
    },
    list[index].quotes.length
  );
  if (!quote || list[index].quotes.some((entry) => entry.id === quote.id)) return { books: list, quote: null };
  list[index] = { ...list[index], quotes: list[index].quotes.concat(quote).slice(-MAX_QUOTES) };
  return { books: list, quote };
}

function removeQuote(books, bookId, quoteId) {
  const list = normalizeLibrary({ books }).books;
  const index = list.findIndex((book) => book.id === bookId);
  if (index < 0) return list;
  list[index] = { ...list[index], quotes: list[index].quotes.filter((quote) => quote.id !== quoteId) };
  return list;
}

function bookProgress(book) {
  const value = asObject(book);
  const total = Math.max(0, numberValue(value.totalPages, 0));
  const page = Math.max(0, Math.min(total || 20000, numberValue(value.currentPage, 0)));
  return {
    known: total > 0,
    percent: total > 0 ? Math.min(100, Math.round((page / total) * 100)) : 0,
    pagesLeft: total > 0 ? Math.max(0, total - page) : 0,
  };
}

function librarySummary(books, today) {
  const list = normalizeLibrary({ books }).books;
  const day = normalizeDate(today) || localDate();
  const rated = list.filter((book) => book.status === "finished" && book.rating > 0);
  const ratingTotal = rated.reduce((sum, book) => sum + book.rating, 0);
  return {
    total: list.length,
    want: list.filter((book) => book.status === "want").length,
    reading: list.filter((book) => book.status === "reading").length,
    finished: list.filter((book) => book.status === "finished").length,
    pagesRead: list.reduce((sum, book) => sum + Math.max(0, Number(book.currentPage) || 0), 0),
    quotes: list.reduce((sum, book) => sum + book.quotes.length, 0),
    finishedToday: list.filter((book) => book.finishedOn === day).length,
    averageRating: rated.length ? Math.round((ratingTotal / rated.length) * 10) / 10 : 0,
  };
}

/** Shelf filter used by the view: all, want, reading or finished. */
function shelfBooks(books, filter, hideFinished) {
  const list = normalizeLibrary({ books }).books;
  const key = ["want", "reading", "finished"].includes(filter) ? filter : "all";
  return list.filter((book) => {
    if (key === "all" && hideFinished && book.status === "finished") return false;
    return key === "all" || book.status === key;
  });
}

function quoteRows(books) {
  const rows = [];
  for (const book of normalizeLibrary({ books }).books) {
    for (const quote of book.quotes) {
      rows.push({ ...quote, bookId: book.id, bookTitle: book.title, author: book.author });
    }
  }
  return rows.sort((a, b) => String(b.addedOn).localeCompare(String(a.addedOn)) || a.bookTitle.localeCompare(b.bookTitle));
}

module.exports = {
  BOOK_STATUSES,
  MAX_BOOKS,
  MAX_QUOTES,
  STATUS_LABELS,
  addQuote,
  bookProgress,
  createBook,
  librarySummary,
  normalizeBook,
  normalizeLibrary,
  normalizeQuote,
  quoteRows,
  removeBook,
  removeQuote,
  shelfBooks,
  updateBook,
};
