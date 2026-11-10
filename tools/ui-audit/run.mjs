import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const port = process.env.CDP_PORT || "9222";
const jobsFile = process.argv[2];
if (!jobsFile) throw new Error("usage: node run.mjs <jobs.json> [filter]");
const filter = process.argv[3] || "";
const only = process.argv[4] || "";
const outRoot = path.join(process.cwd(), "artifacts/ui-quality/runs");
fs.mkdirSync(outRoot, { recursive: true });

const jobs = JSON.parse(fs.readFileSync(jobsFile, "utf8")).filter((job) => {
  if (only && !job.name.includes(only)) return false;
  if (filter && (job.theme || "light") !== filter) return false;
  return true;
});

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find((t) => t.type === "page" && /app:\/\/obsidian\.md/.test(t.url));
if (!target) throw new Error("no Obsidian main page target");
const ws = new WebSocket(target.webSocketDebuggerUrl);
let next = 1;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = next++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.text + "\n" + (result.exceptionDetails.exception?.description || "")
    );
  }
  return result.result?.value;
}

async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 480,
  });
  await sleep(250);
}

async function setTheme(theme) {
  await evaluate(`(() => {
    document.body.classList.toggle("theme-dark", ${theme === "dark"});
    document.body.classList.toggle("theme-light", ${theme !== "dark"});
    document.documentElement.style.colorScheme = ${JSON.stringify(theme)};
    document.body.classList.add("qt-audit");
    let style = document.getElementById("qt-audit-layout");
    if (!style) {
      style = document.createElement("style");
      style.id = "qt-audit-layout";
      style.textContent = \`
        body.qt-audit .workspace-ribbon,
        body.qt-audit .workspace-split.mod-left-split,
        body.qt-audit .workspace-split.mod-right-split,
        body.qt-audit .status-bar,
        body.qt-audit .titlebar { display: none !important; }
        body.qt-audit .workspace,
        body.qt-audit .workspace-split.mod-root,
        body.qt-audit .workspace-split.mod-root .workspace-tabs,
        body.qt-audit .workspace-leaf,
        body.qt-audit .workspace-leaf-content { width: 100%; }
        body.qt-audit .workspace-split.mod-root { flex: 1 1 auto; }
      \`;
      document.head.appendChild(style);
    }
    return true;
  })()`);
  await sleep(250);
}

async function key(key, code, keyCode) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
}

async function cleanup() {
  try {
    await evaluate(`(() => { try { app.setting.close(); } catch (error) {} return true; })()`);
  } catch (error) {}
  await evaluate(`(() => {
    const open = [...document.querySelectorAll(".modal-container")].filter((el) => el.getBoundingClientRect().width > 0);
    for (const modal of open) {
      const close = modal.querySelector(".modal-close-button, .modal-header-button.mod-raised");
      if (close) close.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }
    return open.length;
  })()`);
  await key("Escape", "Escape", 27);
  await sleep(300);
  const remaining = await evaluate(`document.querySelectorAll(".modal-container").length`);
  if (remaining) {
    await evaluate(`(() => {
      document.querySelectorAll(".modal-container").forEach((el) => el.remove());
      document.querySelectorAll(".modal-bg").forEach((el) => el.remove());
      document.body.classList.remove("mod-settings");
      return true;
    })()`);
  }
}

const metricsExpression = `(() => {
  const root = (() => {
    const modals = [...document.querySelectorAll(".modal-container")].filter((el) => el.getBoundingClientRect().width > 0);
    if (modals.length) return modals[modals.length - 1].querySelector(".modal") || modals[modals.length - 1];
    const visibleViews = [...document.querySelectorAll(".workspace-leaf.mod-active .view-content, .workspace-leaf .view-content")].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return visibleViews[visibleViews.length - 1] || document.querySelector(".workspace-leaf.mod-active") || document.body;
  })();
  const rootRect = root.getBoundingClientRect();
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
  };
  const label = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".") : "";
    return el.tagName.toLowerCase() + (cls ? "." + cls : "");
  };
  const textOf = (el) => String(el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80);
  const all = [...root.querySelectorAll("*")].filter(visible);
  const wide = all.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.right > rootRect.right + 1 || rect.left < rootRect.left - 1;
  }).map((el) => ({ el: label(el), text: textOf(el), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right) })).slice(0, 30);
  const scrollers = all.filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1).map((el) => ({ el: label(el), text: textOf(el), delta: el.scrollWidth - el.clientWidth })).slice(0, 20);
  const clipped = all.filter((el) => {
    const style = getComputedStyle(el);
    return el.scrollHeight > el.clientHeight + 1 && /hidden|clip/.test(style.overflowY) && style.textOverflow !== "ellipsis" && textOf(el);
  }).map((el) => ({ el: label(el), text: textOf(el), delta: el.scrollHeight - el.clientHeight })).slice(0, 30);
  const tiny = all.filter((el) => {
    if (![...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) return false;
    const style = getComputedStyle(el);
    return parseFloat(style.fontSize) < 10;
  }).map((el) => ({ el: label(el), text: textOf(el), size: getComputedStyle(el).fontSize })).slice(0, 20);
  const controls = all.filter((el) => /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) || el.getAttribute("role") === "button");
  const touch = controls.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.height < 44 && (innerWidth <= 760 || rect.width < 32);
  }).map((el) => {
    const rect = el.getBoundingClientRect();
    return { el: label(el), text: textOf(el) || el.getAttribute("aria-label") || el.getAttribute("title") || "", w: Math.round(rect.width), h: Math.round(rect.height) };
  }).slice(0, 30);

  const parse = (value) => {
    const str = String(value);
    if (str.startsWith("color(srgb")) {
      const body = str.slice(str.indexOf("(") + 1, str.lastIndexOf(")")).trim().replace(/^srgb\s+/, "");
      const [channelText, alphaText] = body.split("/");
      const [r, g, b] = channelText.trim().split(/\s+/).map(Number);
      return [r * 255, g * 255, b * 255, alphaText === undefined ? 1 : Number(alphaText)];
    }
    const match = str.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(/[,/ ]+/).filter(Boolean);
    const alpha = parts[3] && String(parts[3]).endsWith("%") ? Number(String(parts[3]).slice(0, -1)) / 100 : Number(parts[3]);
    return [Number(parts[0]) || 0, Number(parts[1]) || 0, Number(parts[2]) || 0, parts[3] === undefined ? 1 : alpha];
  };
  const blend = (fg, bg) => [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3]), 1];
  const lum = (rgb) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  };
  const contrast = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const background = (el) => {
    let current = el;
    let color = [255, 255, 255, 1];
    while (current) {
      const style = getComputedStyle(current);
      if (style.backgroundImage !== "none") return null;
      const bg = parse(style.backgroundColor);
      if (bg && bg[3] > 0) {
        color = blend(bg, color);
        if (bg[3] >= 0.999) break;
      }
      current = current.parentElement;
    }
    return color;
  };
  const contrastFailures = [];
  for (const el of all) {
    if (![...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) continue;
    if (el.closest("[disabled], [aria-disabled='true']")) continue;
    const style = getComputedStyle(el);
    if (Number(style.opacity) < 0.99) continue;
    const fg = parse(style.color);
    const bg = background(el);
    if (!fg || !bg) continue;
    const blended = blend(fg, bg);
    const size = parseFloat(style.fontSize);
    const weight = Number(style.fontWeight) || 400;
    const threshold = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const ratio = contrast(blended, bg);
    if (ratio + 0.01 < threshold) {
      contrastFailures.push({ el: label(el), text: textOf(el), size: Math.round(size), ratio: Math.round(ratio * 100) / 100, need: threshold });
    }
  }
  const rootStyle = getComputedStyle(root);
  return {
    theme: document.body.classList.contains("theme-dark") ? "dark" : "light",
    viewport: { width: innerWidth, height: innerHeight },
    root: label(root),
    rootBox: { x: Math.round(rootRect.x), y: Math.round(rootRect.y), w: Math.round(rootRect.width), h: Math.round(rootRect.height) },
    documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    rootOverflowX: root.scrollWidth - root.clientWidth,
    rootOverflowY: root.scrollHeight - root.clientHeight,
    rootOverflowStyle: { x: rootStyle.overflowX, y: rootStyle.overflowY },
    wide,
    scrollers,
    clipped,
    tiny,
    controls: controls.length,
    touch,
    contrastFailures: contrastFailures.slice(0, 30),
    contrastFailureCount: contrastFailures.length,
    text: textOf(root),
  };
})()`;

async function focusPass() {
  await evaluate(`(() => {
    const modal = [...document.querySelectorAll(".modal-container")].filter((el) => el.getBoundingClientRect().width > 0).pop();
    const views = [...document.querySelectorAll(".workspace-leaf .view-content")].filter((el) => { const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; });
    const root = (modal && (modal.querySelector(".modal-content") || modal)) || views[views.length - 1] || document.body;
    const first = root.querySelector("button, a, input, select, textarea, [tabindex]");
    if (first) first.focus({ preventScroll: true });
    return true;
  })()`);
  const rows = [];
  for (let index = 0; index < 16; index += 1) {
    await key("Tab", "Tab", 9);
    await sleep(30);
    const row = await evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return {
        el: el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : ""),
        text: String(el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 50) || el.getAttribute("aria-label") || "",
        outline: style.outlineStyle + " " + style.outlineWidth + " " + style.outlineColor,
        offset: style.outlineOffset,
        shadow: style.boxShadow === "none" ? "" : style.boxShadow.slice(0, 60),
        border: style.borderColor,
        bg: style.backgroundColor,
        matched: (() => {
          const found = [];
          const walk = (rules) => {
            for (const rule of rules || []) {
              if (rule.selectorText && rule.selectorText.includes("focus")) {
                try { if (el.matches(rule.selectorText)) found.push(rule.selectorText + " { " + rule.style.cssText + " }"); } catch (error) {}
              }
              if (rule.cssRules) walk(rule.cssRules);
            }
          };
          for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch (error) {} }
          return found.slice(-8);
        })(),
      };
    })()`);
    if (row) rows.push(row);
  }
  return rows;
}

for (const job of jobs) {
  const width = job.width || 1280;
  const height = job.height || 900;
  const theme = job.theme || "light";
  const dir = path.join(outRoot, job.name);
  fs.mkdirSync(dir, { recursive: true });
  await viewport(width, height);
  await setTheme(theme);
  await cleanup();

  if (job.kind === "settings") {
    await evaluate(`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      app.setting.open();
      await sleep(500);
      app.setting.openTabById("mcq-tracker");
      await sleep(900);
      return true;
    })()`);
  } else if (job.kind === "settings-click") {
    await evaluate(`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      app.setting.open();
      await sleep(500);
      app.setting.openTabById("mcq-tracker");
      await sleep(900);
      const pick = (selector, text) => [...document.querySelectorAll(selector)].find((el) => el.textContent.trim() === text);
      const module = pick(".qt-settings-module", ${JSON.stringify(job.module || "")});
      if (module) { module.click(); await sleep(500); }
      const tab = pick(".qt-settings-tab", ${JSON.stringify(job.tab || "")});
      if (tab) { tab.click(); await sleep(700); }
      return { module: !!module, tab: !!tab };
    })()`);
  } else if (job.command) {
    await evaluate(`(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const main = [...document.querySelectorAll(".workspace-split.mod-root .workspace-leaf")].find((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      let leaf = main && app.workspace.getLeafById ? app.workspace.getLeafById(main.id) : null;
      if (!leaf) leaf = app.workspace.getLeaf(false);
      app.workspace.setActiveLeaf(leaf, { focus: true });
      await sleep(150);
      app.commands.executeCommandById(${JSON.stringify(job.command)});
      await sleep(${job.wait || 900});
      return true;
    })()`);
  }

  const metrics = await evaluate(metricsExpression);
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  const focus = job.focus === false ? [] : await focusPass();
  await evaluate(`(() => { const active = document.activeElement; if (active && active.blur) active.blur(); return true; })()`);
  const prefix = `${job.name}-${width}-${theme}`;
  fs.writeFileSync(path.join(dir, `${prefix}.png`), Buffer.from(shot.data, "base64"));
  fs.writeFileSync(path.join(dir, `${prefix}.json`), JSON.stringify({ job, metrics, focus }, null, 2));
  console.log(
    JSON.stringify({
      name: prefix,
      root: metrics.root,
      box: metrics.rootBox,
      overflow: [metrics.documentOverflowX, metrics.rootOverflowX, metrics.rootOverflowY],
      wide: metrics.wide.length,
      clipped: metrics.clipped.length,
      tiny: metrics.tiny.length,
      touch: metrics.touch.length,
      contrast: metrics.contrastFailureCount,
      focus: focus.length,
    })
  );
}

ws.close();
