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
        focus: '.workspace-leaf-content[data-type="question-tracker-task-list"] .qt-task-list-new',
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
        focus: '.workspace-leaf-content[data-type="question-tracker-task-list"] .qt-task-list-row .qt-task-check',
        press: "Space",
        wait: 800,
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
