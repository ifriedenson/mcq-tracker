"use strict";
/*
 * Obsidian's command palette owns Ctrl/Cmd+P. A custom hotkey on an MCQ
 * command with the same chord can make both actions run, so a Cards-off
 * "Open cards" command can pull the user into settings. Remove only that
 * exact chord from the named command; the command itself stays in the
 * palette and every other binding is preserved.
 */

const PALETTE_KEY = "p";
const PALETTE_MODIFIERS = new Set(["mod", "ctrl", "meta", "cmd", "command", "control"]);

/** True for a Ctrl/Cmd+P binding, but not Shift/Alt variants or other keys. */
function stealsCommandPalette(hotkey) {
  if (!hotkey || typeof hotkey !== "object") return false;
  if (String(hotkey.key || "").toLowerCase() !== PALETTE_KEY) return false;
  const modifiers = Array.isArray(hotkey.modifiers) ? hotkey.modifiers : [];
  if (!modifiers.length) return false;
  const names = modifiers.map((modifier) => String(modifier || "").toLowerCase());
  if (names.some((name) => name === "shift" || name === "alt")) return false;
  return names.every((name) => PALETTE_MODIFIERS.has(name));
}

/**
 * Remove Ctrl/Cmd+P from one command's custom hotkeys. Returns true only when
 * Obsidian reports a binding and the write succeeds. Missing APIs are a no-op
 * so older hosts and the test harness keep working.
 */
function releaseCommandPaletteShortcut(app, commandId) {
  const manager = app && app.hotkeyManager;
  if (!manager || typeof manager.getHotkeys !== "function" || !commandId) return false;
  let current = null;
  try {
    current = manager.getHotkeys(commandId);
  } catch (e) {
    return false;
  }
  if (!Array.isArray(current) || !current.length) return false;
  const blocked = current.filter(stealsCommandPalette);
  if (!blocked.length) return false;
  const kept = current.filter((hotkey) => !stealsCommandPalette(hotkey));
  try {
    if (typeof manager.removeHotkeys === "function") {
      manager.removeHotkeys(commandId, blocked);
      return true;
    }
  } catch (e) {
    /* fall through to replacing the list */
  }
  try {
    if (typeof manager.setHotkeys !== "function") return false;
    manager.setHotkeys(commandId, kept);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { releaseCommandPaletteShortcut, stealsCommandPalette };
