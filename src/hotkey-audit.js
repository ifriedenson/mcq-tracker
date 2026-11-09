"use strict";
/*
 * Read-only hotkey audit. It compares the effective bindings of this plugin's
 * commands with Obsidian's own commands and never writes a hotkey.
 *
 * Obsidian stores custom overrides in hotkeyManager.customKeys and command
 * defaults in hotkeyManager.defaultKeys or Command.hotkeys. A custom key for a
 * command replaces its defaults; an empty custom list means the user removed
 * all bindings, so defaults must not leak back in.
 */

const MODIFIER_ORDER = { ctrl: 0, meta: 1, alt: 2, shift: 3 };
const KEY_ALIASES = {
  " ": "space",
  spacebar: "space",
  esc: "escape",
  return: "enter",
  del: "delete",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
};

function text(value) {
  return String(value == null ? "" : value).trim();
}

function commandList(app) {
  const map = app && app.commands && app.commands.commands;
  if (!map) return [];
  if (Array.isArray(map)) return map.filter((command) => command && command.id);
  if (typeof map === "object") {
    return Object.keys(map)
      .map((id) => map[id])
      .filter((command) => command && command.id);
  }
  return [];
}

function communityPluginIds(app, ownId) {
  const ids = new Set([ownId]);
  const plugins = app && app.plugins && app.plugins.plugins;
  if (plugins && typeof plugins === "object") {
    for (const id of Object.keys(plugins)) ids.add(id);
  }
  const manifests = app && app.plugins && app.plugins.manifests;
  if (manifests && typeof manifests === "object") {
    for (const id of Object.keys(manifests)) ids.add(id);
  }
  return ids;
}

function isOwnCommand(id, ownId) {
  return id === ownId || id.startsWith(`${ownId}:`);
}

/** Core commands are the ones not owned by an enabled community plugin. */
function isCoreCommand(id, communityIds, ownId) {
  if (isOwnCommand(id, ownId)) return false;
  const colon = id.indexOf(":");
  const prefix = colon >= 0 ? id.slice(0, colon) : id;
  return !communityIds.has(prefix);
}

function customFor(manager, commandId) {
  const custom = manager && manager.customKeys;
  if (!custom || typeof custom !== "object" || !Object.prototype.hasOwnProperty.call(custom, commandId)) {
    return null;
  }
  return Array.isArray(custom[commandId]) ? custom[commandId] : [];
}

function defaultsFor(manager, command) {
  const defaults = manager && manager.defaultKeys;
  if (defaults && typeof defaults === "object" && Object.prototype.hasOwnProperty.call(defaults, command.id)) {
    return Array.isArray(defaults[command.id]) ? defaults[command.id] : [];
  }
  return Array.isArray(command.hotkeys) ? command.hotkeys : [];
}

/** Custom bindings win, including an explicitly empty list. */
function effectiveHotkeys(manager, command) {
  const custom = customFor(manager, command.id);
  if (custom !== null) return custom;
  if (manager && typeof manager.getHotkeys === "function") {
    try {
      const keys = manager.getHotkeys(command.id);
      if (Array.isArray(keys) && keys.length) return keys;
    } catch (e) {
      /* fall through to the default table */
    }
  }
  return defaultsFor(manager, command);
}

function normalizeKey(value) {
  const raw = String(value == null ? "" : value);
  if (raw === " ") return "space";
  const lower = text(raw).toLowerCase();
  return KEY_ALIASES[lower] || lower;
}

function modifierName(value) {
  const name = text(value).toLowerCase();
  if (name === "cmd" || name === "command" || name === "meta") return "meta";
  if (name === "ctrl" || name === "control") return "ctrl";
  if (name === "alt" || name === "option") return "alt";
  if (name === "shift") return "shift";
  return name;
}

function compareModifiers(left, right) {
  const a = Object.prototype.hasOwnProperty.call(MODIFIER_ORDER, left) ? MODIFIER_ORDER[left] : 9;
  const b = Object.prototype.hasOwnProperty.call(MODIFIER_ORDER, right) ? MODIFIER_ORDER[right] : 9;
  return a - b || left.localeCompare(right);
}

function modifierLabel(modifier, isMac) {
  if (modifier === "ctrl") return "Ctrl";
  if (modifier === "meta") return isMac ? "Cmd" : "Meta";
  if (modifier === "alt") return "Alt";
  if (modifier === "shift") return "Shift";
  return modifier.charAt(0).toUpperCase() + modifier.slice(1);
}

function keyLabel(key) {
  if (key === "space") return "Space";
  if (key === "escape") return "Esc";
  if (key === "enter") return "Enter";
  if (key === "delete") return "Delete";
  if (key === "backspace") return "Backspace";
  if (key === "tab") return "Tab";
  if (key === "up" || key === "down" || key === "left" || key === "right") {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
  if (key.length === 1) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Normalize one Obsidian Hotkey for comparison and display. */
function normalizeBinding(hotkey, isMac) {
  if (!hotkey || typeof hotkey !== "object") return null;
  const rawKey = String(hotkey.key == null ? "" : hotkey.key);
  if (!rawKey || (text(rawKey) === "" && rawKey !== " ")) return null;
  const modifiers = Array.isArray(hotkey.modifiers) ? hotkey.modifiers : [];
  const normalized = new Set();
  for (const raw of modifiers) {
    const name = text(raw).toLowerCase();
    if (!name) continue;
    if (name === "mod") normalized.add(isMac ? "meta" : "ctrl");
    else normalized.add(modifierName(name));
  }
  const ordered = [...normalized].sort(compareModifiers);
  const key = normalizeKey(rawKey);
  return {
    id: ordered.concat(key).join("+"),
    key,
    modifiers: ordered,
    label: ordered.map((modifier) => modifierLabel(modifier, isMac)).concat(keyLabel(key)).join("+"),
  };
}

function emptyReport(reason) {
  return {
    available: false,
    reason,
    conflicts: [],
    pluginCommandCount: 0,
    pluginBindingCount: 0,
    coreCommandCount: 0,
    coreBindingCount: 0,
  };
}

function auditHotkeys(app, options) {
  const opts = options || {};
  const manager = app && app.hotkeyManager;
  if (!manager) return emptyReport("Obsidian's hotkey manager is not available in this window.");
  const commands = commandList(app);
  if (!commands.length) return emptyReport("Obsidian did not expose any commands to audit.");

  const ownId = text(opts.pluginId) || "mcq-tracker";
  const isMac = opts.isMac === true;
  const communityIds = communityPluginIds(app, ownId);
  const own = [];
  const core = [];

  for (const command of commands) {
    const id = text(command.id);
    if (!id) continue;
    const target = isOwnCommand(id, ownId) ? own : isCoreCommand(id, communityIds, ownId) ? core : null;
    if (!target) continue;
    const seen = new Set();
    for (const raw of effectiveHotkeys(manager, command)) {
      const binding = normalizeBinding(raw, isMac);
      if (!binding || seen.has(binding.id)) continue;
      seen.add(binding.id);
      target.push({ command, binding });
    }
  }

  const coreByKey = new Map();
  for (const item of core) {
    if (!coreByKey.has(item.binding.id)) coreByKey.set(item.binding.id, []);
    const list = coreByKey.get(item.binding.id);
    if (!list.some((entry) => entry.command.id === item.command.id)) list.push(item);
  }

  const conflicts = [];
  const seen = new Set();
  for (const item of own) {
    const matches = coreByKey.get(item.binding.id) || [];
    if (!matches.length) continue;
    const coreIds = matches.map((entry) => entry.command.id).sort();
    const signature = `${item.command.id}|${item.binding.id}|${coreIds.join(",")}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    conflicts.push({
      shortcut: item.binding.label,
      shortcutId: item.binding.id,
      command: {
        id: item.command.id,
        name: text(item.command.name) || item.command.id,
      },
      core: matches
        .slice()
        .sort((left, right) => (text(left.command.name) || left.command.id).localeCompare(text(right.command.name) || right.command.id))
        .map((entry) => ({
          id: entry.command.id,
          name: text(entry.command.name) || entry.command.id,
        })),
    });
  }

  conflicts.sort((left, right) => left.shortcutId.localeCompare(right.shortcutId) || left.command.name.localeCompare(right.command.name));
  return {
    available: true,
    conflicts,
    pluginCommandCount: new Set(own.map((entry) => entry.command.id)).size,
    pluginBindingCount: own.length,
    coreCommandCount: new Set(core.map((entry) => entry.command.id)).size,
    coreBindingCount: core.length,
  };
}

module.exports = {
  auditHotkeys,
  commandList,
  effectiveHotkeys,
  isCoreCommand,
  normalizeBinding,
  normalizeKey,
};
