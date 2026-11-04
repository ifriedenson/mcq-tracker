"use strict";
/*
 * Setup guidance for offline local model servers.
 *
 * The plugin does not bundle a model or a runtime. These are OpenAI-compatible
 * servers the user runs on the same computer; once the model is on disk the
 * chat works with the network off. Nothing here makes a request.
 */
const { str } = require("./util");

const LOCAL_GUIDES = {
  ollama: {
    title: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    commands: ["ollama pull gemma4:12b", "ollama run gemma4:12b"],
    steps: [
      "Install Ollama from ollama.com and start it.",
      "Pull a chat model once while online; it is stored on this computer.",
      "Type the tag you pulled as the model name, for example gemma4:12b.",
    ],
    notes: [
      "Set OLLAMA_CONTEXT_LENGTH=32768 before starting Ollama so long passages are not cut to its 4096-token default.",
      "Set OLLAMA_NO_CLOUD=1 to keep Ollama local; cloud tags such as gemma4:31b-cloud are not offline.",
    ],
  },
  lmstudio: {
    title: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    commands: ["lms server start"],
    steps: [
      "Install LM Studio, download a chat model (a Gemma 4 GGUF or MLX build) and load it.",
      "Open the Developer tab and press Start server, or run lms server start.",
      "Type the model identifier LM Studio shows as the model name.",
    ],
    notes: ["The default address is http://localhost:1234/v1; change the base URL if you use another port."],
  },
  llamacpp: {
    title: "llama.cpp server",
    baseUrl: "http://localhost:9931/v1",
    commands: ["llama-server -hf ggml-org/gemma-4-E4B-it-GGUF:Q4_0 --port 9931"],
    steps: [
      "Download a GGUF model, or let llama-server fetch one with -hf.",
      "Start llama-server with --port 9931. Older builds default to 8080, so use the port you pass.",
      "Type the model name you loaded as the model name.",
    ],
    notes: ["Add --offline to refuse network access once the model is on disk."],
  },
  jan: {
    title: "Jan",
    baseUrl: "http://127.0.0.1:1337/v1",
    commands: [],
    steps: [
      "Install Jan, download a model and load it.",
      "Open Settings, Local API Server and start it.",
      "Type the model identifier Jan shows as the model name.",
    ],
    notes: ["Jan's server needs a loaded local model before it starts."],
  },
};

const LOCAL_MODEL_NOTES = [
  "The server must run on the same computer as Obsidian. A phone cannot reach your computer's localhost address.",
  "Downloading the model needs a connection once; after that, replies are generated on your computer and the network can stay off.",
  "Gemma 4 is Apache 2.0. Older Gemma 2/3/3n models use the Gemma Terms of Use, so prefer Gemma 4 for anything you share.",
];

function isLocalProvider(id) {
  return !!LOCAL_GUIDES[str(id).trim()];
}

function localProviderIds() {
  return Object.keys(LOCAL_GUIDES);
}

/** Plain text for the settings hint, with no markup and no request. */
function localModelGuide(provider) {
  const key = str(provider).trim();
  const guide = LOCAL_GUIDES[key];
  if (!guide) {
    return {
      ok: false,
      provider: key,
      title: "",
      baseUrl: "",
      commands: [],
      steps: [],
      notes: [],
      description: "Choose a local provider to see its setup steps.",
    };
  }
  const description = [
    `Runs on this computer through ${guide.title} at ${guide.baseUrl}.`,
    "The server must run on the same computer as Obsidian.",
    ...guide.steps,
    ...(guide.commands.length ? [`Commands: ${guide.commands.join("  ·  ")}`] : []),
    ...guide.notes,
  ].join(" ");
  return {
    ok: true,
    provider: key,
    title: guide.title,
    baseUrl: guide.baseUrl,
    commands: guide.commands.slice(),
    steps: guide.steps.slice(),
    notes: guide.notes.slice(),
    description,
  };
}

module.exports = { LOCAL_GUIDES, LOCAL_MODEL_NOTES, isLocalProvider, localModelGuide, localProviderIds };
