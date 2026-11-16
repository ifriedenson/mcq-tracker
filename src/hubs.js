"use strict";
/*
 * The three ribbon hubs. Each one groups views that answer the same question,
 * so the ribbon can stay short without losing a single surface:
 *
 *   Today — what is happening now: Today, Study statistics, Pomodoro.
 *   Plan  — when it happens: one merged calendar (classes, planned blocks,
 *           local events, review due and dated tasks) with layer chips.
 *   Study — the workflow tools: Study Workspace, Study Tools.
 *
 * A tab's `enabled` reads the same module getters the ribbon uses, so a hub
 * never offers a section whose module is off.
 */
const {
  VIEW_TYPE_HUB_PLAN,
  VIEW_TYPE_HUB_STUDY,
  VIEW_TYPE_HUB_TODAY,
} = require("./constants");

function todayView(leaf, plugin) {
  return new (require("./today-view").TodayView)(leaf, plugin);
}

function studyStatsView(leaf, plugin) {
  return new (require("./study-stats-view").StudyStatsView)(leaf, plugin);
}

function pomodoroView(leaf, plugin) {
  return new (require("./pomodoro-view").PomodoroView)(leaf, plugin);
}

function calendarView(leaf, plugin) {
  return new (require("./calendar-view").CalendarView)(leaf, plugin);
}

function studyWorkspaceView(leaf, plugin) {
  return new (require("./study-workspace-view").StudyWorkspaceView)(leaf, plugin);
}

function studyToolsView(leaf, plugin) {
  return new (require("./study-tools-view").StudyToolsView)(leaf, plugin);
}

const HUB_SPECS = [
  {
    id: "today",
    type: VIEW_TYPE_HUB_TODAY,
    title: "Today",
    icon: "sun",
    tabs: [
      { id: "today", label: "Today", create: todayView, enabled: (plugin) => plugin.mcqEnabled() },
      { id: "stats", label: "Statistics", create: studyStatsView, enabled: (plugin) => plugin.studyStatsEnabled() },
      { id: "pomodoro", label: "Pomodoro", create: pomodoroView, enabled: (plugin) => plugin.pomodoroEnabled() },
    ],
  },
  {
    id: "plan",
    type: VIEW_TYPE_HUB_PLAN,
    title: "Plan",
    icon: "calendar-days",
    tabs: [
      // One merged calendar: classes, planned blocks, local events, review due
      // and dated tasks share the same days, with layer chips to hide any of them.
      { id: "calendar", label: "Calendar", create: calendarView, enabled: () => true },
    ],
  },
  {
    id: "study",
    type: VIEW_TYPE_HUB_STUDY,
    title: "Study",
    icon: "workflow",
    tabs: [
      { id: "workspace", label: "Workspace", create: studyWorkspaceView, enabled: (plugin) => plugin.studyWorkspaceEnabled() },
      { id: "tools", label: "Study Tools", create: studyToolsView, enabled: (plugin) => plugin.studyToolsEnabled() },
    ],
  },
];

function hubSpec(id) {
  return HUB_SPECS.find((spec) => spec.id === id) || null;
}

function hubSpecByType(type) {
  return HUB_SPECS.find((spec) => spec.type === type) || null;
}

/** The tabs a hub would actually offer for this plugin's current modules. */
function enabledTabs(spec, plugin) {
  if (!spec) return [];
  return (spec.tabs || []).filter((tab) => {
    try {
      return typeof tab.enabled === "function" ? !!tab.enabled(plugin) : true;
    } catch (error) {
      return false;
    }
  });
}

module.exports = {
  HUB_SPECS,
  enabledTabs,
  hubSpec,
  hubSpecByType,
};
