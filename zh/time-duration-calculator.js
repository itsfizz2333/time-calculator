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
    const match = /^(\d{2}):(\d{2})$/.exec(value || "");
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
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const formatDuration = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes}分钟`;
    }

    if (minutes === 0) {
      return `${hours}小时`;
    }

    return `${hours}小时${minutes}分钟`;
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
      resultOutput.textContent = "请填写两个时间";
      summaryOutput.textContent = "需要有效的开始和结束时间。";
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

    const endNote = crossesMidnight ? "（次日）" : "";
    const breakNote = breakMinutes > 0 ? `，扣除${breakMinutes}分钟休息` : "";
    summaryOutput.textContent = `${formatClockTime(start)} 到 ${formatClockTime(end)}${endNote}${breakNote}`;

    if (breakMinutes > elapsedMinutes) {
      warningOutput.textContent = "休息时间超过了整个时段，因此结果按零计算。请检查输入。";
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
    const text = `${resultOutput.textContent}（${minutesOutput.textContent}分钟，${decimalOutput.textContent}十进制小时）`;
    const label = copyButton?.querySelector(".copy-label");

    try {
      await navigator.clipboard.writeText(text);
      if (label) {
        label.textContent = "已复制";
        window.setTimeout(() => {
          label.textContent = "复制结果";
        }, 1600);
      }
    } catch {
      window.prompt("复制以下结果：", text);
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
