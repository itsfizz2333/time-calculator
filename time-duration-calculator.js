(() => {
  "use strict";

  const startInput = document.querySelector("#duration-start-time");
  const endInput = document.querySelector("#duration-end-time");
  const breakInput = document.querySelector("#duration-break-minutes");
  const resultOutput = document.querySelector("#time-duration-result");
  const summaryOutput = document.querySelector("#time-duration-summary");
  const minutesOutput = document.querySelector("#time-duration-minutes");
  const decimalOutput = document.querySelector("#time-duration-decimal");
  const warningOutput = document.querySelector("#time-duration-warning");
  const resetButton = document.querySelector("#reset-time-duration");
  const copyButton = document.querySelector("#copy-time-duration");
  const presetButtons = [...document.querySelectorAll("[data-start][data-end]")];
  const currentYear = document.querySelector("#current-year");

  if (!startInput || !endInput || !breakInput || !resultOutput) {
    return;
  }

  const parseClockTime = (value) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      return null;
    }

    return (hours * 60) + minutes;
  };

  const formatClockTime = (totalMinutes) => {
    const date = new Date(2000, 0, 1, 0, totalMinutes);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };

  const formatDuration = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hourLabel = hours === 1 ? "hour" : "hours";
    const minuteLabel = minutes === 1 ? "minute" : "minutes";

    if (hours === 0) {
      return `${minutes} ${minuteLabel}`;
    }

    if (minutes === 0) {
      return `${hours} ${hourLabel}`;
    }

    return `${hours} ${hourLabel} ${minutes} ${minuteLabel}`;
  };

  const readBreakMinutes = () => {
    const value = Number.parseInt(breakInput.value, 10);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(1440, Math.max(0, value));
  };

  const calculate = () => {
    const start = parseClockTime(startInput.value);
    const end = parseClockTime(endInput.value);

    if (start === null || end === null) {
      resultOutput.textContent = "Enter both times";
      summaryOutput.textContent = "A valid start and end time are required.";
      minutesOutput.textContent = "—";
      decimalOutput.textContent = "—";
      warningOutput.hidden = true;
      return;
    }

    const crossesMidnight = end < start;
    const elapsedMinutes = (end + (crossesMidnight ? 1440 : 0)) - start;
    const breakMinutes = readBreakMinutes();
    const netMinutes = Math.max(0, elapsedMinutes - breakMinutes);

    resultOutput.textContent = formatDuration(netMinutes);
    minutesOutput.textContent = String(netMinutes);
    decimalOutput.textContent = (netMinutes / 60).toFixed(2);

    const endNote = crossesMidnight ? " next day" : "";
    const breakNote = breakMinutes > 0 ? `, less a ${breakMinutes}-minute break` : "";
    summaryOutput.textContent = `${formatClockTime(start)} to ${formatClockTime(end)}${endNote}${breakNote}`;

    if (breakMinutes > elapsedMinutes) {
      warningOutput.textContent = "The break is longer than the elapsed time, so the result is limited to zero.";
      warningOutput.hidden = false;
    } else {
      warningOutput.hidden = true;
    }
  };

  const applyPreset = (button) => {
    startInput.value = button.dataset.start;
    endInput.value = button.dataset.end;
    breakInput.value = button.dataset.break || "0";
    calculate();
  };

  const reset = () => {
    startInput.value = "09:00";
    endInput.value = "17:30";
    breakInput.value = "0";
    calculate();
  };

  const copyResult = async () => {
    const text = `${resultOutput.textContent} (${minutesOutput.textContent} minutes, ${decimalOutput.textContent} decimal hours)`;
    try {
      await navigator.clipboard.writeText(text);
      const label = copyButton.querySelector(".copy-label");
      if (label) {
        label.textContent = "Copied";
        window.setTimeout(() => {
          label.textContent = "Copy result";
        }, 1600);
      }
    } catch {
      window.prompt("Copy this result:", text);
    }
  };

  const loadQueryParameters = () => {
    const params = new URLSearchParams(window.location.search);
    const start = params.get("start");
    const end = params.get("end");
    const breakMinutes = params.get("break");

    if (parseClockTime(start) !== null) {
      startInput.value = start;
    }
    if (parseClockTime(end) !== null) {
      endInput.value = end;
    }
    if (breakMinutes !== null && /^\d{1,4}$/.test(breakMinutes)) {
      breakInput.value = String(Math.min(1440, Number(breakMinutes)));
    }
  };

  [startInput, endInput, breakInput].forEach((input) => {
    input.addEventListener("input", calculate);
    input.addEventListener("change", calculate);
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => applyPreset(button));
  });

  resetButton?.addEventListener("click", reset);
  copyButton?.addEventListener("click", copyResult);

  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  loadQueryParameters();
  calculate();
})();
