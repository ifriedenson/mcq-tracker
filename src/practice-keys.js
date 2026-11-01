"use strict";
/*
 * The approved minimal Practice keyboard map (plan.md D2):
 * Space/Enter activates the primary action, Esc ends the session.
 * There are deliberately no 1/2/3 self-grade or U undo keys: MCQ already
 * auto-grades, so those would invent answer semantics that do not exist.
 *
 * The caller is responsible for checking that the Practice view is active and
 * that the event came from inside it. Text fields and focused controls keep
 * their native keyboard behaviour.
 */

function tagName(target) {
  return String((target && target.tagName) || "").toLowerCase();
}

function isTextEntry(target) {
  const tag = tagName(target);
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target && target.isContentEditable === true) return true;
  if (!target || typeof target.getAttribute !== "function") return false;
  const editable = target.getAttribute("contenteditable");
  return editable === "" || editable === "true";
}

function isControl(target) {
  const tag = tagName(target);
  if (tag === "button" || tag === "a" || tag === "summary") return true;
  const role = target && typeof target.getAttribute === "function" ? target.getAttribute("role") : "";
  return role === "button" || role === "link" || role === "tab";
}

/** Returns submit, reveal, next-study, next, end, or an empty string. */
function practiceKeyboardAction(event, context) {
  const ctx = context || {};
  if (!event || ctx.active === false) return "";
  if (event.isComposing || event.repeat) return "";
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return "";

  const target = event.target;
  if (isTextEntry(target)) return "";

  const key = String(event.key || "");
  if (key === "Escape") return "end";
  if (isControl(target)) return "";
  if (key !== " " && key !== "Spacebar" && key !== "Enter") return "";

  if (ctx.state === "question") return ctx.submitReady ? "submit" : "";
  if (ctx.state === "study") {
    if (!ctx.revealed) return "reveal";
    return ctx.recorded ? "next-study" : "";
  }
  if (ctx.state === "result") return "next";
  return "";
}

module.exports = { practiceKeyboardAction };
