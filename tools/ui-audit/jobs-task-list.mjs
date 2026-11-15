// Task-list audit jobs. Every job pins the plugin's own view type so the
// runner can never fall back to a neighbouring Obsidian surface, and each
// state is a real interaction against the rendered view.
const VIEW = "question-tracker-task-list";

const page = (body) => `(async () => {
  const plugin = app.plugins.getPlugin("mcq-tracker");
  const leaf = app.workspace.getLeavesOfType(${JSON.stringify(VIEW)})[0];
  const view = leaf.view;
  const host = document.querySelector('.workspace-leaf-content[data-type="${VIEW}"]');
  const q = (selector) => host.querySelector(selector);
  const qa = (selector) => [...host.querySelectorAll(selector)];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  ${body}
  return true;
})()`;

const checks = `(() => {
  const host = document.querySelector('.workspace-leaf-content[data-type="${VIEW}"]');
  const content = host && host.querySelector(".view-content");
  const rows = content ? [...content.querySelectorAll(".qt-task-list-row")] : [];
  const unique = (list) => [...new Set(list)];
  const rect = (el) => el.getBoundingClientRect();
  const heights = rows.map((row) => Math.round(rect(row).height));
  const buttons = rows.map((row) => [...row.querySelectorAll("button")]);
  const rightEdges = buttons.map((list) => (list.length ? Math.round(rect(list[list.length - 1]).right) : null));
  const centers = rows.map((row) => {
    const box = row.querySelector(".qt-task-check");
    const title = row.querySelector(".qt-task-list-title");
    if (!box || !title) return null;
    const delta = rect(box).top + rect(box).height / 2 - (rect(title).top + rect(title).height / 2);
    return Math.round(delta * 10) / 10;
  });
  const metas = rows.map((row) => {
    const meta = row.querySelector(".qt-task-list-meta");
    return meta ? Math.round(rect(meta).height) : null;
  });
  const titleStyles = rows.map((row) => {
    const title = row.querySelector(".qt-task-list-title");
    if (!title) return null;
    const style = getComputedStyle(title);
    return {
      overflow: style.overflow,
      ellipsis: style.textOverflow,
      whiteSpace: style.whiteSpace,
      clipped: title.scrollWidth > title.clientWidth + 1,
    };
  });
  const empty = content && content.querySelector(".qt-task-list-empty");
  const filter = content && content.querySelector(".qt-task-filter.is-active");
  const badge = content && content.querySelector(".qt-task-list-badge");
  const count = content && content.querySelector(".qt-task-list-count");

  const plugin = app.plugins.getPlugin("mcq-tracker");
  const persisted = (plugin.settings.studyTasks.tasks || []).map((task) => ({
    title: task.title,
    priority: task.priority || "",
    repeat: task.repeat || "",
    tags: String(task.tags || ""),
    due: task.due || "",
  }));

  const active = document.activeElement;
  const activeStyle = active ? getComputedStyle(active) : null;
  const activeBox = active && active !== document.body ? active.getBoundingClientRect() : null;
  const focusState = activeStyle
    ? {
        el: active.tagName.toLowerCase() + (typeof active.className === "string" && active.className ? "." + active.className.trim().split(/\\s+/).slice(0, 2).join(".") : ""),
        outline: activeStyle.outlineStyle + " " + activeStyle.outlineWidth,
        offset: activeStyle.outlineOffset,
        width: Math.round(activeBox ? activeBox.width : 0),
        height: Math.round(activeBox ? activeBox.height : 0),
        sameAsField: !!(active.closest && active.closest(".qt-task-list-date")),
      }
    : null;

  const parseColor = (value) => {
    const match = String(value).match(/rgba?\\(([^)]+)\\)/);
    if (!match) return null;
    const parts = match[1].split(/[,/ ]+/).filter(Boolean);
    const alpha = parts[3] === undefined ? 1 : String(parts[3]).endsWith("%") ? Number(String(parts[3]).slice(0, -1)) / 100 : Number(parts[3]);
    return [Number(parts[0]) || 0, Number(parts[1]) || 0, Number(parts[2]) || 0, alpha];
  };
  const blend = (fg, bg) => [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3]), 1];
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (rgb) => 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const background = (el) => {
    let current = el;
    let color = [255, 255, 255, 1];
    while (current) {
      const style = getComputedStyle(current);
      const bg = parseColor(style.backgroundColor);
      if (bg && bg[3] > 0) {
        color = blend(bg, color);
        if (bg[3] >= 0.999) break;
      }
      current = current.parentElement;
    }
    return color;
  };
  const ratioFor = (el) => {
    if (!el) return null;
    const fg = parseColor(getComputedStyle(el).color);
    const bg = background(el);
    if (!fg || !bg) return null;
    const front = blend(fg, bg);
    const l1 = lum(front);
    const l2 = lum(bg);
    return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
  };

  const notice = document.querySelector(".notice-container .notice");
  const noticeUndo = notice && notice.querySelector(".qt-notice-undo");
  const noticeState = notice
    ? {
        text: String(notice.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120),
        textContrast: ratioFor(notice),
        undo: noticeUndo
          ? {
              text: String(noticeUndo.textContent || "").trim(),
              contrast: ratioFor(noticeUndo),
              width: Math.round(rect(noticeUndo).width),
              height: Math.round(rect(noticeUndo).height),
            }
          : null,
      }
    : null;

  return {
    rows: rows.length,
    doneRows: rows.filter((row) => row.classList.contains("is-done")).length,
    overdueRows: rows.filter((row) => row.classList.contains("is-overdue")).length,
    rowHeights: heights,
    rowHeightsConsistent: unique(heights).length <= 1,
    rightEdgeAligned: unique(rightEdges.filter((edge) => edge !== null)).length <= 1,
    rightEdges,
    checkboxTitleCenterDelta: centers,
    metaHeights: metas,
    metaHeightsConsistent: unique(metas.filter((height) => height !== null)).length <= 1,
    titleTruncation: titleStyles,
    activeFilter: filter ? filter.textContent.trim() : "",
    emptyText: empty ? empty.textContent.trim() : "",
    badge: badge ? badge.getAttribute("aria-label") : "",
    count: count ? count.textContent.trim() : "",
    persisted,
    focusState,
    notice: noticeState,
    tagEditorOpen: !!(content && content.querySelector(".qt-task-tag-input")),
  };
})()`;

const TODAY = new Date().toISOString().slice(0, 10);

function job(theme) {
  return {
    name: "task-list",
    command: "mcq-tracker:open-task-list",
    viewType: VIEW,
    placement: "main",
    expectClass: ".qt-task-list",
    theme,
    width: 1280,
    height: 900,
    checks,
    states: [
      {
        name: "empty",
        script: page(`
  for (const task of [...plugin.settings.studyTasks.tasks]) await plugin.removeStudyTask(task.id);
  view.render();
  await sleep(400);`),
      },
      {
        name: "keyboard-add",
        script: page(`await sleep(50);`),
        focus: `.workspace-leaf-content[data-type="${VIEW}"] .qt-task-list-new`,
        type: "Read chapter 4 tomorrow #bio",
        press: "Enter",
        wait: 900,
      },
      {
        name: "long-text",
        script: page(`
  const tags = q(".qt-task-list-new-tags");
  if (tags) { tags.value = "#bio, #exam"; tags.dispatchEvent(new window.Event("input", { bubbles: true })); }
  q(".qt-task-list-new").focus();`),
        type: "Explain how the lock-and-key model of enzyme action accounts for substrate specificity, competitive inhibition and allosteric regulation across metabolic pathways",
        press: "Enter",
        wait: 900,
      },
      {
        name: "checked",
        script: page(`
  const boxes = qa(".qt-task-check");
  if (boxes[0]) boxes[0].click();
  await sleep(700);`),
      },
      {
        name: "filtered",
        script: page(`
  const chip = q(".qt-task-filter");
  if (chip) chip.click();
  await sleep(600);`),
      },
      {
        name: "filter-cleared",
        script: page(`
  const active = q(".qt-task-filter.is-active");
  if (active) active.click();
  await sleep(600);`),
      },
      {
        name: "keyboard-complete",
        script: page(`await sleep(50);`),
        focus: `.workspace-leaf-content[data-type="${VIEW}"] .qt-task-list-row .qt-task-check`,
        press: "Space",
        wait: 800,
      },
      {
        name: "star-on",
        script: page(`
  const star = q(".qt-task-list-star");
  if (star) star.click();
  await sleep(700);`),
      },
      {
        name: "star-off",
        script: page(`
  const star = q(".qt-task-list-star");
  if (star) star.click();
  await sleep(700);`),
      },
      {
        name: "repeat-daily",
        script: page(`
  const repeat = q(".qt-task-list-repeat");
  if (repeat) repeat.click();
  await sleep(700);`),
      },
      {
        name: "repeat-weekday",
        script: page(`
  const repeat = q(".qt-task-list-repeat");
  if (repeat) repeat.click();
  await sleep(700);`),
      },
      {
        name: "repeat-weekly",
        script: page(`
  const repeat = q(".qt-task-list-repeat");
  if (repeat) repeat.click();
  await sleep(700);`),
      },
      {
        name: "repeat-off",
        script: page(`
  const repeat = q(".qt-task-list-repeat");
  if (repeat) repeat.click();
  await sleep(700);`),
      },
      {
        name: "date-focus",
        script: page(`await sleep(50);`),
        focus: `.workspace-leaf-content[data-type="${VIEW}"] .qt-task-list-date`,
        wait: 500,
      },
      {
        name: "tag-editor",
        script: page(`
  const tagged = qa(".qt-task-list-row").find((row) => row.textContent.includes("Explain how"));
  const edit = tagged && tagged.querySelector(".qt-task-tag-edit");
  if (edit) edit.click();
  await sleep(600);`),
      },
      {
        name: "tag-saved",
        script: page(`
  const input = q(".qt-task-tag-input");
  if (input) {
    input.value = "#bio, #exam, #chem";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  }
  await sleep(1200);`),
      },
      {
        name: "deleted",
        script: page(`
  const rows = qa(".qt-task-list-row");
  window.__qtDeletedTitle = rows[0] ? rows[0].querySelector(".qt-task-list-title").textContent : "";
  const remove = q(".qt-task-list-remove");
  if (remove) remove.click();
  await sleep(900);`),
      },
      {
        name: "undo-restored",
        script: page(`
  const undo = document.querySelector(".notice-container .qt-notice-undo");
  if (undo) undo.click();
  await sleep(1200);`),
      },
      {
        name: "mixed",
        script: page(`
  for (const task of [...plugin.settings.studyTasks.tasks]) await plugin.removeStudyTask(task.id);
  await plugin.addStudyTask({ title: "Overdue lab write-up", due: "2026-11-02", course: "Biology" });
  await plugin.addStudyTask({ title: "Flashcards for the unit test", due: "${TODAY}", tags: "#bio" });
  await plugin.addStudyTask({ title: "Read the rubric", course: "English", priority: "high" });
  await plugin.addStudyTask({ title: "Weekly review", repeat: "weekly", tags: "#exam" });
  await plugin.addStudyTask({ title: "Finish paper 2", due: "2026-11-20", time: "15:00", repeat: "daily" });
  view.render();
  await sleep(600);`),
      },
    ],
  };
}

export default [job("light"), job("dark")];
