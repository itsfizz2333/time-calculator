(() => {
  const calculator = document.getElementById('calculator');
  if (!calculator) return;

  const selectOne = (selector) => calculator.querySelector(selector);
  const selectAll = (selector) => Array.from(calculator.querySelectorAll(selector));
  const browserLanguage = typeof navigator.language === 'string' ? navigator.language : 'en-US';
  const locale = /^en(?:-|$)/i.test(browserLanguage) ? browserLanguage : 'en-US';

  const currentMinute = () => {
    const date = new Date();
    date.setSeconds(0, 0);
    return date;
  };

  const state = {
    mode: 'add',
    startMode: 'now',
    customStart: currentMinute(),
    days: 0,
    hours: 1,
    minutes: 0,
    activePreset: '0:60'
  };

  const pad = (value) => String(value).padStart(2, '0');
  const dateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timeInputValue = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  const formatTime = (date) => new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);

  const formatShortDate = (date) => new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);

  const formatFullDateTime = (date) => new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);

  const startOfCalendarDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const calendarDayDifference = (left, right) => Math.round(
    (startOfCalendarDay(left) - startOfCalendarDay(right)) / 86400000
  );

  const getStart = () => state.startMode === 'now' ? currentMinute() : new Date(state.customStart);

  const calculateResult = (start = getStart()) => {
    const result = new Date(start);
    const direction = state.mode === 'add' ? 1 : -1;
    result.setDate(result.getDate() + (direction * state.days));
    result.setHours(result.getHours() + (direction * state.hours));
    result.setMinutes(result.getMinutes() + (direction * state.minutes));
    return result;
  };

  const durationText = () => {
    const parts = [];
    if (state.days) parts.push(`${state.days} ${state.days === 1 ? 'day' : 'days'}`);
    if (state.hours) parts.push(`${state.hours} ${state.hours === 1 ? 'hour' : 'hours'}`);
    if (state.minutes) parts.push(`${state.minutes} ${state.minutes === 1 ? 'minute' : 'minutes'}`);

    if (!parts.length) return 'No time';
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  };

  const primaryResultText = (result) => {
    const difference = calendarDayDifference(result, new Date());
    let dayLabel;

    if (difference === 0) dayLabel = 'Today';
    else if (difference === 1) dayLabel = 'Tomorrow';
    else if (difference === -1) dayLabel = 'Yesterday';
    else dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(result);

    return `${dayLabel} at ${formatTime(result)}`;
  };

  const setPressedGroup = (buttons, activeButton) => {
    buttons.forEach((button) => {
      const isActive = button === activeButton;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  const syncDateTimeFields = (date = state.customStart) => {
    selectOne('#start-date').value = dateInputValue(date);
    selectOne('#start-time').value = timeInputValue(date);
  };

  const render = () => {
    const start = getStart();
    const result = calculateResult(start);
    const amount = durationText();
    const relationship = state.mode === 'add' ? 'from' : 'before';
    const startingPoint = state.startMode === 'now' ? 'now' : formatFullDateTime(start);

    selectOne('#start-summary').textContent = state.startMode === 'now'
      ? `Now · ${formatTime(start)}`
      : `${formatShortDate(start)} · ${formatTime(start)}`;
    [
      ['#days-value', 'days'],
      ['#hours-value', 'hours'],
      ['#minutes-value', 'minutes']
    ].forEach(([selector, unit]) => {
      const input = selectOne(selector);
      if (document.activeElement !== input) input.value = state[unit];
    });
    selectOne('#result-heading').textContent = amount === 'No time'
      ? 'Same date and time'
      : `${amount} ${relationship} ${startingPoint}`;
    selectOne('#result-primary').textContent = primaryResultText(result);
    selectOne('#result-full').textContent = formatFullDateTime(result);

    const modeButtons = selectAll('[data-mode]');
    setPressedGroup(modeButtons, modeButtons.find((button) => button.dataset.mode === state.mode));

    const startButtons = [selectOne('#start-now'), selectOne('#start-custom')];
    setPressedGroup(startButtons, state.startMode === 'now' ? startButtons[0] : startButtons[1]);
    selectOne('#date-time-fields').hidden = state.startMode === 'now';

    selectAll('.quick-button').forEach((button) => {
      const presetKey = `${button.dataset.days}:${button.dataset.minutes}`;
      const isActive = presetKey === state.activePreset;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  selectAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      render();
    });
  });

  selectOne('#start-now').addEventListener('click', () => {
    state.startMode = 'now';
    render();
  });

  selectOne('#start-custom').addEventListener('click', () => {
    if (state.startMode === 'now') state.customStart = currentMinute();
    state.startMode = 'custom';
    syncDateTimeFields();
    render();
  });

  const updateCustomStart = () => {
    const dateParts = selectOne('#start-date').value.split('-').map(Number);
    const timeParts = selectOne('#start-time').value.split(':').map(Number);
    const isValid = dateParts.length === 3
      && timeParts.length >= 2
      && !dateParts.some(Number.isNaN)
      && !timeParts.some(Number.isNaN);

    if (!isValid) return;

    state.customStart = new Date(
      dateParts[0],
      dateParts[1] - 1,
      dateParts[2],
      timeParts[0],
      timeParts[1],
      0,
      0
    );
    state.startMode = 'custom';
    render();
  };

  selectOne('#start-date').addEventListener('change', updateCustomStart);
  selectOne('#start-time').addEventListener('change', updateCustomStart);

  selectAll('.quick-button').forEach((button) => {
    button.addEventListener('click', () => {
      const totalMinutes = Number(button.dataset.minutes);
      state.days = Number(button.dataset.days);
      state.hours = Math.floor(totalMinutes / 60);
      state.minutes = totalMinutes % 60;
      state.activePreset = `${button.dataset.days}:${button.dataset.minutes}`;
      render();
    });
  });

  selectAll('.duration-input').forEach((input) => {
    input.addEventListener('input', () => {
      const parsedValue = Number.parseInt(input.value, 10);
      state[input.dataset.unit] = Number.isFinite(parsedValue)
        ? Math.min(9999, Math.max(0, parsedValue))
        : 0;
      state.activePreset = null;
      render();
    });

    input.addEventListener('blur', () => {
      input.value = state[input.dataset.unit];
    });
  });

  const applyStep = (button) => {
    const stepper = button.closest('.stepper');
    const unit = stepper.dataset.unit;
    const step = Number(button.dataset.step);
    state[unit] = Math.min(9999, Math.max(0, state[unit] + step));
    state.activePreset = null;
    render();
  };

  selectAll('.stepper-controls button').forEach((button) => {
    let holdDelay;
    let repeatTimer;
    let repeated = false;

    const stopRepeating = () => {
      window.clearTimeout(holdDelay);
      window.clearInterval(repeatTimer);
    };

    button.addEventListener('pointerdown', () => {
      repeated = false;
      holdDelay = window.setTimeout(() => {
        repeated = true;
        applyStep(button);
        repeatTimer = window.setInterval(() => applyStep(button), 105);
      }, 430);
    });

    button.addEventListener('pointerup', stopRepeating);
    button.addEventListener('pointercancel', () => {
      stopRepeating();
      repeated = false;
    });
    button.addEventListener('pointerleave', () => {
      stopRepeating();
      repeated = false;
    });

    button.addEventListener('click', () => {
      if (repeated) {
        repeated = false;
        return;
      }
      applyStep(button);
    });
  });

  const copyFallback = (text) => {
    const temporaryField = document.createElement('textarea');
    temporaryField.value = text;
    temporaryField.setAttribute('readonly', '');
    temporaryField.style.position = 'fixed';
    temporaryField.style.opacity = '0';
    document.body.appendChild(temporaryField);
    temporaryField.select();
    document.execCommand('copy');
    temporaryField.remove();
  };

  selectOne('#copy-result').addEventListener('click', async () => {
    const text = formatFullDateTime(calculateResult());
    const copyLabel = selectOne('.copy-label');

    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
    } catch (error) {
      copyFallback(text);
    }

    copyLabel.textContent = 'Copied!';
    window.setTimeout(() => {
      copyLabel.textContent = 'Copy result';
    }, 1500);
  });

  selectOne('#continue-result').addEventListener('click', () => {
    state.customStart = calculateResult();
    state.startMode = 'custom';
    state.days = 0;
    state.hours = 0;
    state.minutes = 0;
    state.activePreset = null;
    syncDateTimeFields();
    render();
  });

  document.querySelectorAll('[data-popular-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const totalMinutes = Number(button.dataset.popularMinutes);
      state.mode = button.dataset.popularMode;
      state.startMode = 'now';
      state.days = Number(button.dataset.popularDays);
      state.hours = Math.floor(totalMinutes / 60);
      state.minutes = totalMinutes % 60;
      state.activePreset = `${button.dataset.popularDays}:${button.dataset.popularMinutes}`;
      render();
      calculator.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const year = document.getElementById('current-year');
  if (year) year.textContent = new Date().getFullYear();

  syncDateTimeFields();
  render();

  window.setInterval(() => {
    if (state.startMode === 'now') render();
  }, 60000);
})();
