"use strict";
/*
 * API keys live in Obsidian's Secret Storage when the app provides it
 * (desktop and mobile 1.11.4+). Older apps fall back to the plugin's
 * data.json, which is plain text and syncs with the vault.
 */
const { str } = require("./util");

function secretStorageOf(app) {
  const store = app && app.secretStorage;
  return store && typeof store.getSecret === "function" && typeof store.setSecret === "function" ? store : null;
}

function hasSecretStorage(app) {
  return !!secretStorageOf(app);
}

const OPENCODE_PASSWORD_SECRET = "mcq-tracker-opencode-password";

function readSecretValue(app, name) {
  return readSecret(secretStorageOf(app), name);
}

/** Returns false when Secret Storage is unavailable or the write failed. */
function storeSecretValue(app, name, value) {
  const store = secretStorageOf(app);
  if (!store || !name) return false;
  try {
    store.setSecret(name, str(value));
    return true;
  } catch (e) {
    return false;
  }
}

function secretName(api, provider) {
  return str(((api && api.secrets) || {})[provider]).trim();
}

function plainKey(api, provider) {
  return str(((api && api.keys) || {})[provider]).trim();
}

function readSecret(store, name) {
  if (!store || !name) return "";
  try {
    return str(store.getSecret(name)).trim();
  } catch (e) {
    return "";
  }
}

/** The key the request should use: Secret Storage first, then legacy plain text. */
function resolveApiKey(app, api) {
  const provider = str(api && api.provider).trim();
  const secret = readSecret(secretStorageOf(app), secretName(api, provider));
  return secret || plainKey(api, provider);
}

function randomSuffix() {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    }
  } catch (e) {
    /* fall through */
  }
  return Math.random().toString(36).slice(2, 10);
}

function newSecretName(provider) {
  const safe = str(provider || "api").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `mcq-tracker-${safe}-${randomSuffix()}`;
}

/**
 * Save one key. Returns { stored: "secret" | "plain", name }. With Secret
 * Storage the value never enters data.json; without it, the legacy field is
 * used so older Obsidian versions keep working.
 */
function storeApiKey(app, api, provider, key) {
  const value = str(key).trim();
  const store = secretStorageOf(app);
  if (!store) {
    api.keys = api.keys || {};
    api.keys[provider] = value;
    return { stored: "plain", name: "" };
  }
  const name = secretName(api, provider) || newSecretName(provider);
  store.setSecret(name, value);
  api.secrets = api.secrets || {};
  api.secrets[provider] = name;
  if (api.keys) delete api.keys[provider];
  return { stored: "secret", name };
}

/**
 * Record a chosen password secret name and drop the legacy plain-text copy.
 * Works for the OpenCode server password and the CouchDB password, which both
 * keep `passwordSecret` plus an older `password` field.
 */
function selectPasswordSecret(target, name) {
  if (!target) return "";
  const value = str(name).trim();
  target.passwordSecret = value;
  target.password = "";
  return value;
}

/** Read a named secret, then fall back to the legacy stored value. */
function resolveSecretValue(app, name, fallback) {
  return readSecret(secretStorageOf(app), name) || str(fallback);
}

/**
 * Move a legacy plain-text password into Secret Storage and keep only its
 * name. Idempotent; leaves the plain-text value untouched when Secret Storage
 * is unavailable or the write throws.
 */
function migratePasswordSecret(app, target, defaultName) {
  const store = secretStorageOf(app);
  if (!store || !target) return 0;
  const legacy = str(target.password);
  const current = str(target.passwordSecret).trim();
  const fallbackName = str(defaultName).trim();
  const name = current || fallbackName;
  if (legacy.trim()) {
    try {
      if (!readSecret(store, name)) store.setSecret(name, legacy);
      target.passwordSecret = name;
      target.password = "";
      return 1;
    } catch (e) {
      return 0;
    }
  }
  // Older releases used a fixed secret name without recording it in settings.
  if (!current && fallbackName && readSecret(store, fallbackName)) {
    target.passwordSecret = fallbackName;
    return 1;
  }
  return 0;
}

/**
 * Record the chosen secret name in settings and remove any legacy plain-text
 * copy for that provider. Settings never receive the secret value.
 */
function selectApiSecret(api, provider, name) {
  if (!api) return "";
  const value = str(name).trim();
  api.secrets = api.secrets || {};
  if (value) api.secrets[provider] = value;
  else delete api.secrets[provider];
  if (api.keys) delete api.keys[provider];
  return value;
}

/**
 * Move any legacy plain-text keys into Secret Storage. Idempotent. Existing
 * selected secrets win; the plain-text copy is still removed so it cannot
 * remain in a synced data.json.
 */
function migrateApiKeys(app, api) {
  const store = secretStorageOf(app);
  if (!store || !api || !api.keys) return 0;
  let moved = 0;
  for (const provider of Object.keys(api.keys)) {
    const key = plainKey(api, provider);
    if (!key) {
      delete api.keys[provider];
      continue;
    }
    try {
      const current = secretName(api, provider);
      if (!readSecret(store, current)) {
        const name = current || newSecretName(provider);
        store.setSecret(name, key);
        api.secrets = api.secrets || {};
        api.secrets[provider] = name;
      }
      delete api.keys[provider];
      moved++;
    } catch (e) {
      /* keep the legacy key rather than losing it */
    }
  }
  return moved;
}

module.exports = {
  OPENCODE_PASSWORD_SECRET,
  hasSecretStorage,
  readSecretValue,
  storeSecretValue,
  migrateApiKeys,
  newSecretName,
  migratePasswordSecret,
  resolveApiKey,
  resolveSecretValue,
  secretName,
  selectApiSecret,
  selectPasswordSecret,
  storeApiKey,
};
