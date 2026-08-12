(() => {
  "use strict";

  const durationList = document.querySelector("#duration-list");
  const addDurationButton = document.querySelector("#add-duration");
  const resetButton = document.querySelector("#reset-durations");
  const copyButton = document.querySelector("#copy-duration-result");
  const resultHmm = document.querySelector("#duration-result-hmm");
  const resultMinutes = document.querySelector("#duration-result-minutes");
  const resultDecimal = document.querySelector("#duration-result-decimal");
  const quickButtons = document.querySelectorAll("[data-quick-hours]");

  if (!durationList || !addDurationButton || !resetButton || !copyButton) {
    return;
  }

  const MAX_VALUE = 999999;
  const MAX_ROWS = 50;
  let nextId = 3;
  let durations = [
    { id: 1, sign: 1, hours: 1, minutes: 0 },
    { id: 2, sign: 1, hours: 0, minutes: 30 }
  ];
  let holdDelay = null;
  let holdInterval = null;

  function cleanNumber(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.min(parsed, MAX_VALUE);
  }

  function getDuration(id) {
    return durations.find((duration) => duration.id === Number(id));
  }

  function totalMinutes() {
    return durations.reduce((total, duration) => {
      const rowMinutes = cleanNumber(duration.hours) * 60 + cleanNumber(duration.minutes);
      return total + duration.sign * rowMinutes;
    }, 0);
  }

  function formatHoursMinutes(minutes) {
    const sign = minutes < 0 ? "−" : "";
    const absoluteMinutes = Math.abs(minutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const remainder = absoluteMinutes % 60;
    return `${sign}${hours}:${String(remainder).padStart(2, "0")}`;
  }

  function updateResult() {
    const minutes = totalMinutes();
    resultHmm.textContent = formatHoursMinutes(minutes);
    resultMinutes.textContent = String(minutes);
    resultDecimal.textContent = (minutes / 60).toFixed(2);
  }

  function rowMarkup(duration, index) {
    const isAdd = duration.sign === 1;
    const signText = isAdd ? "Add +" : "Subtract −";
    const nextSign = isAdd ? "subtract" : "add";

    return `
      <div class="duration-row" data-duration-id="${duration.id}">
        <div class="duration-row-header">
          <span class="duration-row-label">Duration ${index + 1}</span>
          <div class="duration-row-actions">
            <button class="duration-sign${isAdd ? " is-add" : " is-subtract"}" type="button" data-action="toggle-sign" data-id="${duration.id}" aria-label="Change duration ${index + 1} to ${nextSign}">${signText}</button>
            <button class="duration-remove" type="button" data-action="remove" data-id="${duration.id}" aria-label="Remove duration ${index + 1}">Remove</button>
          </div>
        </div>
        <div class="duration-row-fields">
          <div class="duration-field">
            <label class="duration-field-label" for="duration-${duration.id}-hours">Hours</label>
            <span class="duration-stepper">
              <button type="button" data-action="step" data-id="${duration.id}" data-field="hours" data-delta="-1" aria-label="Remove one hour from duration ${index + 1}">−</button>
              <input id="duration-${duration.id}-hours" type="number" inputmode="numeric" min="0" max="${MAX_VALUE}" step="1" value="${duration.hours}" data-id="${duration.id}" data-field="hours" aria-label="Hours in duration ${index + 1}">
              <button type="button" data-action="step" data-id="${duration.id}" data-field="hours" data-delta="1" aria-label="Add one hour to duration ${index + 1}">+</button>
            </span>
          </div>
          <div class="duration-field">
            <label class="duration-field-label" for="duration-${duration.id}-minutes">Minutes</label>
            <span class="duration-stepper">
              <button type="button" data-action="step" data-id="${duration.id}" data-field="minutes" data-delta="-5" aria-label="Remove five minutes from duration ${index + 1}">−</button>
              <input id="duration-${duration.id}-minutes" type="number" inputmode="numeric" min="0" max="${MAX_VALUE}" step="1" value="${duration.minutes}" data-id="${duration.id}" data-field="minutes" aria-label="Minutes in duration ${index + 1}">
              <button type="button" data-action="step" data-id="${duration.id}" data-field="minutes" data-delta="5" aria-label="Add five minutes to duration ${index + 1}">+</button>
            </span>
          </div>
        </div>
      </div>`;
  }

  function renderRows() {
    durationList.innerHTML = durations.map(rowMarkup).join("");
    addDurationButton.disabled = durations.length >= MAX_ROWS;
    addDurationButton.setAttribute("aria-disabled", String(durations.length >= MAX_ROWS));
    updateResult();
  }

  function addDuration(hours = 0, minutes = 0) {
    const cleanHours = cleanNumber(hours);
    const cleanMinutes = cleanNumber(minutes);
    const onlyRow = durations.length === 1 ? durations[0] : null;

    if (onlyRow && onlyRow.hours === 0 && onlyRow.minutes === 0 && onlyRow.sign === 1) {
      onlyRow.hours = cleanHours;
      onlyRow.minutes = cleanMinutes;
    } else if (durations.length < MAX_ROWS) {
      durations.push({ id: nextId, sign: 1, hours: cleanHours, minutes: cleanMinutes });
      nextId += 1;
    }

    renderRows();
  }

  function adjustValue(button) {
    const duration = getDuration(button.dataset.id);
    const field = button.dataset.field;
    const delta = Number(button.dataset.delta);

    if (!duration || !["hours", "minutes"].includes(field) || !Number.isFinite(delta)) {
      return;
    }

    duration[field] = Math.min(MAX_VALUE, Math.max(0, cleanNumber(duration[field]) + delta));
    const input = durationList.querySelector(`input[data-id="${duration.id}"][data-field="${field}"]`);
    if (input) {
      input.value = String(duration[field]);
    }
    updateResult();
  }

  function stopHolding() {
    window.clearTimeout(holdDelay);
    window.clearInterval(holdInterval);
    holdDelay = null;
    holdInterval = null;
  }

  durationList.addEventListener("input", (event) => {
    const input = event.target.closest("input[data-id][data-field]");
    if (!input) {
      return;
    }

    const duration = getDuration(input.dataset.id);
    if (!duration) {
      return;
    }

    duration[input.dataset.field] = cleanNumber(input.value);
    updateResult();
  });

  durationList.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-id][data-field]");
    if (!input) {
      return;
    }
    const duration = getDuration(input.dataset.id);
    if (duration) {
      input.value = String(duration[input.dataset.field]);
    }
  });

  durationList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const duration = getDuration(button.dataset.id);

    if (action === "toggle-sign" && duration) {
      duration.sign *= -1;
      renderRows();
      durationList.querySelector(`[data-action="toggle-sign"][data-id="${duration.id}"]`)?.focus();
    }

    if (action === "remove" && duration) {
      const removedIndex = durations.findIndex((item) => item.id === duration.id);
      if (durations.length === 1) {
        duration.sign = 1;
        duration.hours = 0;
        duration.minutes = 0;
      } else {
        durations = durations.filter((item) => item.id !== duration.id);
      }
      renderRows();
      const focusIndex = Math.min(Math.max(removedIndex, 0), durations.length - 1);
      const focusDuration = durations[focusIndex];
      const nextControl = focusDuration
        ? durationList.querySelector(`[data-action="toggle-sign"][data-id="${focusDuration.id}"]`)
        : addDurationButton;
      nextControl?.focus();
    }

    if (action === "step" && event.detail === 0) {
      adjustValue(button);
    }
  });

  durationList.addEventListener("pointerdown", (event) => {
    const button = event.target.closest('button[data-action="step"]');
    if (!button || event.button !== 0) {
      return;
    }

    event.preventDefault();
    stopHolding();
    adjustValue(button);
    holdDelay = window.setTimeout(() => {
      holdInterval = window.setInterval(() => adjustValue(button), 90);
    }, 420);
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    durationList.addEventListener(eventName, stopHolding);
  });

  quickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      addDuration(button.dataset.quickHours, button.dataset.quickMinutes);
    });
  });

  addDurationButton.addEventListener("click", () => addDuration());

  resetButton.addEventListener("click", () => {
    durations = [{ id: nextId, sign: 1, hours: 0, minutes: 0 }];
    nextId += 1;
    renderRows();
  });

  copyButton.addEventListener("click", async () => {
    const minutes = totalMinutes();
    const text = `${formatHoursMinutes(minutes)} | ${minutes} total minutes | ${(minutes / 60).toFixed(2)} decimal hours`;
    const label = copyButton.querySelector(".copy-label");

    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    label.textContent = "Copied";
    window.setTimeout(() => {
      label.textContent = "Copy result";
    }, 1600);
  });

  const currentYear = document.querySelector("#current-year");
  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  renderRows();
})();
