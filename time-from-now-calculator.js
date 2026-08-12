(() => {
  "use strict";

  const calculator = document.querySelector("#from-now-calculator");
  if (!calculator) {
    return;
  }

  const selectOne = (selector) => calculator.querySelector(selector);
  const selectAll = (selector) => Array.from(calculator.querySelectorAll(selector));
  const browserLanguage = typeof navigator.language === "string" ? navigator.language : "en-US";
  const locale = /^en(?:-|$)/i.test(browserLanguage) ? browserLanguage : "en-US";
  const MAX_VALUE = 9999;

  const state = {
    days: 0,
    hours: 0,
    minutes: 90,
    activePreset: "0:0:90"
  };

  let lastStart = null;
  let lastResult = null;

  const currentMinute = () => {
    const date = new Date();
    date.setSeconds(0, 0);
    return date;
  };

  const cleanNumber = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.min(parsed, MAX_VALUE);
  };

  const formatTime = (date) => new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);

  const formatFullDateTime = (date) => new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);

  const startOfCalendarDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const calendarDayDifference = (left, right) => Math.round(
    (startOfCalendarDay(left) - startOfCalendarDay(right)) / 86400000
  );

  const calculateResult = (start) => {
    const result = new Date(start);
    result.setDate(result.getDate() + state.days);
    result.setHours(result.getHours() + state.hours);
    result.setMinutes(result.getMinutes() + state.minutes);
    return result;
  };

  const durationText = () => {
    const parts = [];
    if (state.days) parts.push(`${state.days} ${state.days === 1 ? "day" : "days"}`);
    if (state.hours) parts.push(`${state.hours} ${state.hours === 1 ? "hour" : "hours"}`);
    if (state.minutes) parts.push(`${state.minutes} ${state.minutes === 1 ? "minute" : "minutes"}`);

    if (!parts.length) return "0 minutes";
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  };

  const primaryResultText = (result, start) => {
    const difference = calendarDayDifference(result, start);
    let dayLabel;

    if (difference === 0) dayLabel = "Today";
    else if (difference === 1) dayLabel = "Tomorrow";
    else dayLabel = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(result);

    return `${dayLabel} at ${formatTime(result)}`;
  };

  const dayWord = (result, start) => {
    const difference = calendarDayDifference(result, start);
    if (difference === 0) return "today";
    if (difference === 1) return "tomorrow";
    return `on ${new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric"
    }).format(result)}`;
  };

  const syncInputs = () => {
    [
      ["#from-now-days", "days"],
      ["#from-now-hours", "hours"],
      ["#from-now-minutes", "minutes"]
    ].forEach(([selector, unit]) => {
      const input = selectOne(selector);
      if (document.activeElement !== input) {
        input.value = String(state[unit]);
      }
    });
  };

  const syncPresets = () => {
    selectAll("[data-from-days]").forEach((button) => {
      const key = `${button.dataset.fromDays}:${button.dataset.fromHours}:${button.dataset.fromMinutes}`;
      const active = key === state.activePreset;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const render = () => {
    const start = currentMinute();
    const result = calculateResult(start);
    const amount = durationText();
    lastStart = start;
    lastResult = result;

    selectOne("#from-now-start-time").textContent = `Now · ${formatTime(start)}`;
    selectOne("#from-now-result-heading").textContent = `${amount} from now`;
    selectOne("#from-now-result-primary").textContent = primaryResultText(result, start);
    selectOne("#from-now-result-full").textContent = formatFullDateTime(result);
    selectOne("#from-now-explanation").textContent =
      `${amount} from ${formatTime(start)} is ${formatTime(result)} ${dayWord(result, start)}.`;

    syncInputs();
    syncPresets();
  };

  const applyDuration = (days, hours, minutes, presetKey = null) => {
    state.days = cleanNumber(days);
    state.hours = cleanNumber(hours);
    state.minutes = cleanNumber(minutes);
    state.activePreset = presetKey;
    render();
  };

  const readQueryDuration = () => {
    const params = new URLSearchParams(window.location.search);
    const days = params.get("days");
    const hours = params.get("hours");
    const minutes = params.get("minutes");
    if (days === null && hours === null && minutes === null) {
      return;
    }
    applyDuration(days || 0, hours || 0, minutes || 0);
  };

  selectAll("[data-from-days]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = `${button.dataset.fromDays}:${button.dataset.fromHours}:${button.dataset.fromMinutes}`;
      applyDuration(
        button.dataset.fromDays,
        button.dataset.fromHours,
        button.dataset.fromMinutes,
        key
      );
    });
  });

  selectAll(".from-now-input").forEach((input) => {
    input.addEventListener("input", () => {
      state[input.dataset.fromUnit] = cleanNumber(input.value);
      state.activePreset = null;
      render();
    });

    input.addEventListener("blur", () => {
      input.value = String(state[input.dataset.fromUnit]);
    });
  });

  const applyStep = (button) => {
    const stepper = button.closest(".stepper");
    const input = stepper?.querySelector("[data-from-unit]");
    if (!input) {
      return;
    }

    const unit = input.dataset.fromUnit;
    const step = Number(button.dataset.fromStep);
    state[unit] = Math.min(MAX_VALUE, Math.max(0, state[unit] + step));
    state.activePreset = null;
    render();
  };

  selectAll("[data-from-step]").forEach((button) => {
    let holdDelay;
    let repeatTimer;
    let repeated = false;

    const stopRepeating = () => {
      window.clearTimeout(holdDelay);
      window.clearInterval(repeatTimer);
    };

    button.addEventListener("pointerdown", () => {
      repeated = false;
      holdDelay = window.setTimeout(() => {
        repeated = true;
        applyStep(button);
        repeatTimer = window.setInterval(() => applyStep(button), 105);
      }, 430);
    });

    button.addEventListener("pointerup", stopRepeating);
    button.addEventListener("pointercancel", stopRepeating);
    button.addEventListener("pointerleave", stopRepeating);
    button.addEventListener("click", () => {
      if (repeated) {
        repeated = false;
        return;
      }
      applyStep(button);
    });
  });

  selectOne("#clear-from-now").addEventListener("click", () => {
    applyDuration(0, 0, 0);
  });

  selectOne("#refresh-from-now").addEventListener("click", render);

  document.querySelectorAll("[data-from-example]").forEach((button) => {
    button.addEventListener("click", () => {
      const minutes = cleanNumber(button.dataset.fromExample);
      applyDuration(0, 0, minutes, `0:0:${minutes}`);
      calculator.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const copyFallback = (text) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  };

  selectOne("#copy-from-now").addEventListener("click", async () => {
    if (!lastStart || !lastResult) {
      render();
    }

    const text = `${durationText()} from ${formatFullDateTime(lastStart)} is ${formatFullDateTime(lastResult)}.`;
    const label = selectOne("#copy-from-now .copy-label");

    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      copyFallback(text);
    }

    label.textContent = "Copied!";
    window.setTimeout(() => {
      label.textContent = "Copy result";
    }, 1500);
  });

  const currentYear = document.querySelector("#current-year");
  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  render();
  readQueryDuration();
  window.setInterval(render, 60000);
})();

