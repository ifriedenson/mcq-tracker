"use strict";
/*
 * Small URL checks shared by the optional network features.
 *
 * API keys, OpenCode passwords and calendar feed URLs must never travel over
 * plain HTTP to another computer. Loopback HTTP stays available because local
 * model servers and a locally started OpenCode use it on purpose.
 */

const MAX_CALENDAR_BYTES = 2 * 1024 * 1024;

function parseHttpUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || "").trim());
  } catch (e) {
    return null;
  }
  return url.protocol === "https:" || url.protocol === "http:" ? url : null;
}

function isLoopbackHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "::1" || /^127\./.test(host);
}

function cleanUrl(url) {
  return url.toString().replace(/\/+$/, "");
}

/** An API/OpenCode base URL. Remote endpoints must use HTTPS. */
function safeApiBase(raw) {
  const url = parseHttpUrl(raw);
  if (!url) throw new Error("Enter a valid http:// or https:// address.");
  if (url.username || url.password) throw new Error("Do not put a username or password in the address; use the separate fields.");
  if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
    throw new Error("Remote API and OpenCode addresses must use https://. Plain http:// is allowed only for localhost, 127.0.0.1 or ::1.");
  }
  return cleanUrl(url);
}

/** A calendar feed URL. Public feeds must use HTTPS; local files never come through here. */
function safeCalendarFeedUrl(raw) {
  const url = parseHttpUrl(raw);
  if (!url) throw new Error("Enter a valid https:// or webcal:// calendar link.");
  if (url.username || url.password) throw new Error("A calendar feed link must not contain a username or password.");
  if (url.protocol !== "https:") {
    throw new Error("Calendar feeds must use https://. A webcal:// link is converted automatically; plain http:// is not accepted.");
  }
  return url.toString();
}

function calendarText(response) {
  const text = String((response && response.text) || "");
  if (text.length > MAX_CALENDAR_BYTES) throw new Error("That calendar feed is too large (over 2 MB).");
  return text;
}

module.exports = {
  MAX_CALENDAR_BYTES,
  isLoopbackHost,
  safeApiBase,
  safeCalendarFeedUrl,
  calendarText,
};
