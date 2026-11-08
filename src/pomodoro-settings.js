"use strict";
const { Setting } = require("obsidian");
const { normalizePomodoroSettings } = require("./pomodoro");

function numberSetting(container, name, description, value, min, max, onChange) {
  new Setting(container)
    .setName(name)
    .setDesc(description)
    .addText((t) => {
      t.inputEl.type = "number";
      t.inputEl.min = String(min);
      t.inputEl.max = String(max);
      t.setValue(String(value));
      t.onChange(onChange);
    });
}

function renderPomodoroSettings(containerEl, plugin, redisplay) {
  const st = plugin.settings;
  st.pomodoro = normalizePomodoroSettings(st.pomodoro);
  containerEl.createEl("h2", { text: "Pomodoro" });
  containerEl.createEl("p", {
    cls: "setting-item-description",
    text: "A local focus timer with work, short-break and long-break phases. It is separate from the practice timer and stores only timer state in plugin data.",
  });
  new Setting(containerEl)
    .setName("Enable Pomodoro")
    .setDesc("Adds a timer view, ribbon button, status-bar clock and commands.")
    .addToggle((t) =>
      t.setValue(plugin.pomodoroEnabled()).onChange(async (v) => {
        st.pomodoro.enabled = v;
        await plugin.save();
        plugin.onPomodoroToggled();
        redisplay();
      })
    );
  numberSetting(containerEl, "Focus minutes", "Length of one work phase.", st.pomodoro.workMinutes, 1, 180, async (v) => {
    st.pomodoro.workMinutes = v;
    st.pomodoro = normalizePomodoroSettings(st.pomodoro);
    plugin.resetPomodoro(false);
    await plugin.save();
    plugin.refreshPomodoro();
  });
  numberSetting(containerEl, "Short break minutes", "Break after a normal focus session.", st.pomodoro.shortBreakMinutes, 1, 60, async (v) => {
    st.pomodoro.shortBreakMinutes = v;
    st.pomodoro = normalizePomodoroSettings(st.pomodoro);
    await plugin.save();
    plugin.refreshPomodoro();
  });
  numberSetting(containerEl, "Long break minutes", "Break after the configured number of focus sessions.", st.pomodoro.longBreakMinutes, 1, 120, async (v) => {
    st.pomodoro.longBreakMinutes = v;
    st.pomodoro = normalizePomodoroSettings(st.pomodoro);
    await plugin.save();
    plugin.refreshPomodoro();
  });
  numberSetting(containerEl, "Long break every", "Focus sessions before a long break.", st.pomodoro.longBreakEvery, 2, 12, async (v) => {
    st.pomodoro.longBreakEvery = v;
    st.pomodoro = normalizePomodoroSettings(st.pomodoro);
    await plugin.save();
    plugin.refreshPomodoro();
  });
  new Setting(containerEl)
    .setName("Start breaks automatically")
    .setDesc("When a focus phase ends, start the break without pressing Start.")
    .addToggle((t) =>
      t.setValue(st.pomodoro.autoStartBreaks).onChange(async (v) => {
        st.pomodoro.autoStartBreaks = v;
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Start focus automatically")
    .setDesc("When a break ends, start the next focus phase automatically.")
    .addToggle((t) =>
      t.setValue(st.pomodoro.autoStartWork).onChange(async (v) => {
        st.pomodoro.autoStartWork = v;
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Sound when a phase ends")
    .setDesc("Play a short local chime when a focus or break phase completes. It uses the system audio output; no sound file is downloaded.")
    .addToggle((t) =>
      t.setValue(st.pomodoro.soundEnabled !== false).onChange(async (v) => {
        st.pomodoro.soundEnabled = v;
        await plugin.save();
      })
    );
  new Setting(containerEl)
    .setName("Open the timer")
    .setDesc("The status-bar clock and ribbon button open the same view.")
    .addButton((b) => b.setButtonText("Open Pomodoro").onClick(() => plugin.activatePomodoro()));
}

module.exports = { renderPomodoroSettings };
