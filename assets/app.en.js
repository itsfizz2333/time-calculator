(() => {
  "use strict";

  const SITE = window.TIME_CHAIN_SITE || {
    name: "TimeCalc",
    product: "Time Chain",
    fullName: "TimeCalc · Time Chain",
    storagePrefix: "timecalc-time-chain-en-v1"
  };
  const MAX_MINUTES = 7 * 24 * 60;
  const MAX_STEPS = 50;
  const STORAGE_LAST = `${SITE.storagePrefix}:last`;
  const STORAGE_SAVED = `${SITE.storagePrefix}:saved`;
  const encoder = new TextEncoder();

  const uid = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const escapeHTML = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const clampMinutes = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(MAX_MINUTES, Math.max(0, Math.round(parsed)));
  };

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

  const roundToFive = (date = new Date()) => {
    const next = new Date(date);
    next.setSeconds(0, 0);
    const remainder = next.getMinutes() % 5;
    if (remainder) next.setMinutes(next.getMinutes() + (5 - remainder));
    return next;
  };

  const nextAt = (hours, minutes, from = new Date()) => {
    const result = new Date(from.getFullYear(), from.getMonth(), from.getDate(), hours, minutes, 0, 0);
    if (result.getTime() <= from.getTime()) result.setDate(result.getDate() + 1);
    return result;
  };

  const atToday = (hours, minutes, from = new Date()) => (
    new Date(from.getFullYear(), from.getMonth(), from.getDate(), hours, minutes, 0, 0)
  );

  const parseLocalDateTime = (value, fallback) => {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return new Date(fallback);
    const result = new Date(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(match[4]), Number(match[5]), 0, 0
    );
    return Number.isNaN(result.getTime()) ? new Date(fallback) : result;
  };

  const inputDateTime = (dateValue) => {
    const date = new Date(dateValue);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatClock = (dateValue) => {
    const date = new Date(dateValue);
    return new Intl.DateTimeFormat(SITE.locale || "en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(date).replace("24:", "00:");
  };

  const dayText = (dateValue, today = new Date()) => {
    const date = new Date(dateValue);
    const diff = Math.round((startOfDay(date) - startOfDay(today)) / 86400000);
    if (diff === -2) return "The day before yesterday";
    if (diff === -1) return "Yesterday";
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === 2) return "The day after tomorrow";
    return new Intl.DateTimeFormat(SITE.locale || "en-US", {
      month: "short", day: "numeric", weekday: "short"
    }).format(date);
  };

  const formatDateTime = (date) => `${dayText(date)} ${formatClock(date)}`;

  const formatDuration = (minutes) => {
    const total = Math.max(0, Math.round(minutes));
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const mins = total % 60;
    const parts = [];
    if (days) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
    if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    if (mins || !parts.length) parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);
    return parts.join(" ");
  };

  const step = (label, duration, range = null) => ({
    id: uid(),
    label,
    duration: clampMinutes(duration, 30),
    hasRange: Boolean(range),
    min: range ? clampMinutes(range[0], duration) : clampMinutes(duration, 30),
    max: range ? clampMinutes(range[1], duration) : clampMinutes(duration, 30)
  });

  const normalizeStep = (item, index) => {
    const duration = clampMinutes(item?.duration, 30);
    return {
      id: String(item?.id || uid()),
      label: String(item?.label || `Step ${index + 1}`).slice(0, 80),
      duration,
      hasRange: Boolean(item?.hasRange),
      min: clampMinutes(item?.min, duration),
      max: clampMinutes(item?.max, duration)
    };
  };

  const makeDefaultState = (preset = "home") => {
    const now = roundToFive();
    const evening = nextAt(17, 0, new Date(now.getTime() - 12 * 60 * 60000));
    const target = nextAt(19, 30);
    const base = {
      version: 1,
      mode: "forward",
      anchorMode: "custom",
      anchor: evening.getTime(),
      target: target.getTime(),
      title: "Today's plan",
      steps: [
        step("Swim", 45),
        step("Break", 15),
        step("Dinner", 60),
        step("Travel home", 30)
      ]
    };

    if (preset === "quick45") {
      return {
        ...base,
        anchorMode: "now",
        anchor: now.getTime(),
        title: "45 minutes from now",
        steps: [step("45 minutes", 45)]
      };
    }

    if (preset === "backward") {
      return {
        ...base,
        mode: "reverse",
        target: target.getTime(),
        title: "Arrive on time",
        steps: [step("Travel", 40), step("Parking", 10), step("Check-in", 30), step("Buffer", 15)]
      };
    }

    if (preset === "focus") {
      return {
        ...base,
        anchorMode: "now",
        anchor: now.getTime(),
        title: "Focus cycle",
        steps: [step("Focus", 50), step("Break", 10), step("Focus", 50)]
      };
    }

    return base;
  };

  const normalizeState = (candidate, fallback) => {
    if (!candidate || candidate.version !== 1 || !Array.isArray(candidate.steps)) return clone(fallback);
    const mode = candidate.mode === "reverse" ? "reverse" : "forward";
    const anchor = Number(candidate.anchor);
    const target = Number(candidate.target);
    if (!Number.isFinite(anchor) || !Number.isFinite(target)) return clone(fallback);
    return {
      version: 1,
      mode,
      anchorMode: candidate.anchorMode === "now" ? "now" : "custom",
      anchor,
      target,
      title: String(candidate.title || "My time plan").slice(0, 80),
      steps: candidate.steps.slice(0, MAX_STEPS).map(normalizeStep)
    };
  };

  const getRange = (item) => {
    if (!item.hasRange || item.min > item.max) {
      return { min: item.duration, expected: item.duration, max: item.duration, invalid: item.hasRange && item.min > item.max };
    }
    return {
      min: item.min,
      expected: Math.min(item.max, Math.max(item.min, item.duration)),
      max: item.max,
      invalid: false
    };
  };

  const calculate = (state) => {
    const ranges = state.steps.map(getRange);
    const totalMin = ranges.reduce((sum, item) => sum + item.min, 0);
    const totalExpected = ranges.reduce((sum, item) => sum + item.expected, 0);
    const totalMax = ranges.reduce((sum, item) => sum + item.max, 0);
    const anchor = new Date(state.anchor);
    const target = new Date(state.target);
    const expectedStart = state.mode === "reverse" ? addMinutes(target, -totalExpected) : anchor;
    let cursor = expectedStart;
    let cumulativeMin = 0;
    let cumulativeMax = 0;
    const rangeStart = state.mode === "reverse" ? addMinutes(target, -totalMax) : anchor;
    const entries = state.steps.map((item, index) => {
      const range = ranges[index];
      const start = cursor;
      const end = addMinutes(start, range.expected);
      cumulativeMin += range.min;
      cumulativeMax += range.max;
      const entry = {
        item,
        range,
        start,
        end,
        earliestBoundary: addMinutes(rangeStart, cumulativeMin),
        latestBoundary: addMinutes(rangeStart, cumulativeMax)
      };
      cursor = end;
      return entry;
    });

    if (state.mode === "forward") {
      return {
        entries,
        primary: addMinutes(anchor, totalExpected),
        earliest: addMinutes(anchor, totalMin),
        latest: addMinutes(anchor, totalMax),
        start: anchor,
        end: addMinutes(anchor, totalExpected),
        totalMin,
        totalExpected,
        totalMax
      };
    }

    return {
      entries,
      primary: expectedStart,
      earliest: addMinutes(target, -totalMax),
      latest: addMinutes(target, -totalMin),
      start: expectedStart,
      end: target,
      totalMin,
      totalExpected,
      totalMax
    };
  };

  const base64UrlEncode = (value) => {
    const bytes = encoder.encode(JSON.stringify(value));
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  };

  const base64UrlDecode = (value) => {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  };

  const storageGet = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const storageSet = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  };

  const getHashState = () => {
    if (!location.hash.startsWith("#p=")) return null;
    const payload = location.hash.slice(3);
    if (!payload || payload.length > 12000) return null;
    try { return base64UrlDecode(payload); } catch (_) { return null; }
  };

  const durationFromText = (segment) => {
    const normalized = String(segment || "").replace(/[—–~]/g, "-");
    const range = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i);
    if (range) {
      const unit = /^(?:hours?|hrs?|h)$/i.test(range[3]) ? 60 : 1;
      const min = clampMinutes(Number(range[1]) * unit);
      const max = clampMinutes(Number(range[2]) * unit);
      return { duration: Math.round((min + max) / 2), min, max, hasRange: true, matched: range[0] };
    }

    const halfHour = normalized.match(/\b(?:a\s+)?half\s+(?:an?\s+)?hour\b/i);
    if (halfHour) {
      return { duration: 30, min: 30, max: 30, hasRange: false, matched: halfHour[0] };
    }

    const quarterHour = normalized.match(/\b(?:a\s+)?quarter\s+(?:of\s+an?\s+|of\s+an?\s+|of\s+)?hour\b/i);
    if (quarterHour) {
      return { duration: 15, min: 15, max: 15, hasRange: false, matched: quarterHour[0] };
    }

    const hours = normalized.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i);
    const minutes = normalized.match(/\b(\d+(?:\.\d+)?)\s*(minutes?|mins?|m)\b/i);
    if (hours || minutes) {
      const value = clampMinutes((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
      const matched = [hours?.[0], minutes?.[0]].filter(Boolean).join(" ");
      return { duration: value, min: value, max: value, hasRange: false, matched };
    }

    return null;
  };

  const parseStartTime = (text, now = new Date()) => {
    const nowMatch = text.match(/\bnow\b/i);
    if (nowMatch) {
      return {
        date: roundToFive(now), matched: nowMatch[0], isNow: true,
        note: '"Now" has been fixed as the current time, so it will not keep moving.'
      };
    }

    const period = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b|\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i);
    if (!period) return null;
    let hour = Number(period[1] ?? period[4]);
    const minute = Number(period[2] ?? period[5] ?? 0);
    const marker = String(period[3] || "").replaceAll(".", "").toLowerCase();
    if (marker) {
      if (hour < 1 || hour > 12) {
        return { invalid: true, matched: period[0], note: `Could not understand the time "${period[0].trim()}".` };
      }
      if (marker === "pm" && hour < 12) hour += 12;
      if (marker === "am" && hour === 12) hour = 0;
    }
    if (hour > 23 || minute > 59) {
      return { invalid: true, matched: period[0], note: `Could not understand the time "${period[0].trim()}".` };
    }
    return { date: atToday(hour, minute, now), matched: period[0], isNow: false, note: "" };
  };

  const stripDurationText = (text) => String(text)
    .replace(/\b\d+(?:\.\d+)?\s*(?:-|to|—|–|~)\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/gi, "")
    .replace(/\b(?:a\s+)?half\s+(?:an?\s+)?hour\b/gi, "")
    .replace(/\b(?:a\s+)?quarter\s+(?:of\s+an?\s+|of\s+)?hour\b/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|h)\b/gi, "")
    .replace(/\b(?:and\s+)?\d+(?:\.\d+)?\s*(?:minutes?|mins?|m)\b/gi, "");

  const parseNaturalText = (text) => {
    const input = String(text || "").trim().slice(0, 3000);
    const start = parseStartTime(input);
    const rawSegments = input
      .split(/\s*(?:,|;|\n|→|->|\bthen\b)\s*/i)
      .map((part) => part.trim())
      .filter(Boolean);
    const parsedSteps = [];
    const unrecognized = [];

    rawSegments.forEach((segment) => {
      const segmentWithoutStart = segment.replace(start?.matched || "", "").trim();
      const duration = durationFromText(segmentWithoutStart);
      if (!duration) {
        const remaining = segmentWithoutStart
          .replace(/^(?:and\s+)?(?:start|starting|begin|beginning|at|for|do)\b\s*/i, "")
          .trim();
        if (remaining) unrecognized.push(segment);
        return;
      }
      let label = stripDurationText(segmentWithoutStart)
        .replace(/^(?:and\s+)?(?:start|starting|begin|beginning|at|for|do)\b\s*/i, "")
        .replace(/\s+(?:for|afterwards?|next)$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!label) label = `Step ${parsedSteps.length + 1}`;
      parsedSteps.push({
        id: uid(), label: label.slice(0, 80), duration: duration.duration,
        hasRange: duration.hasRange, min: duration.min, max: duration.max
      });
    });

    return { start, steps: parsedSteps.slice(0, MAX_STEPS), unrecognized };
  };

  const summaryText = (state) => {
    const result = calculate(state);
    const lines = [state.title || "My time plan"];
    if (state.mode === "forward") lines.push(`Starts: ${formatDateTime(result.start)}`);
    else lines.push(`Recommended start: ${formatDateTime(result.primary)} (target: ${formatDateTime(result.end)})`);
    result.entries.forEach((entry, index) => {
      const range = entry.item.hasRange && !entry.range.invalid
        ? `, range ${formatDuration(entry.range.min)} to ${formatDuration(entry.range.max)}` : "";
      lines.push(`${index + 1}. ${entry.item.label || `Step ${index + 1}`} | ${formatDateTime(entry.start)} - ${formatDateTime(entry.end)} | ${formatDuration(entry.range.expected)}${range}`);
    });
    lines.push(`Total: ${formatDuration(result.totalExpected)}`);
    if (result.totalMin !== result.totalMax) {
      if (state.mode === "forward") lines.push(`Finish window: earliest ${formatDateTime(result.earliest)}, latest ${formatDateTime(result.latest)}`);
      else lines.push(`Start window: safest ${formatDateTime(result.earliest)}, latest ${formatDateTime(result.latest)}`);
    }
    lines.push(state.mode === "forward" ? `Estimated finish: ${formatDateTime(result.primary)}` : `Estimated start: ${formatDateTime(result.primary)}`);
    lines.push(`— ${SITE.fullName}`);
    return lines.join("\n");
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      const success = document.execCommand("copy");
      area.remove();
      return success;
    }
  };

  const icsEscape = (value) => String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\r", "")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");

  const icsUtc = (dateValue) => {
    const date = new Date(dateValue);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  };

  const foldIcsLine = (line) => {
    const chunks = [];
    let current = "";
    let bytes = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (bytes + size > (chunks.length ? 74 : 75)) {
        chunks.push(current);
        current = ` ${char}`;
        bytes = 1 + size;
      } else {
        current += char;
        bytes += size;
      }
    }
    chunks.push(current);
    return chunks.join("\r\n");
  };

  const makeIcs = (state) => {
    const result = calculate(state);
    const stamp = icsUtc(new Date());
    let calendarHost = "timecalc.top";
    try { calendarHost = new URL(SITE.baseUrl || "https://timecalc.top/").hostname || calendarHost; } catch (_) { /* Keep the stable fallback host. */ }
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      `PRODID:-//${SITE.name}//Time Chain 1.0//EN`,
      `X-WR-CALNAME:${icsEscape(state.title || SITE.product)}`
    ];
    result.entries.forEach((entry, index) => {
      const rangeNote = entry.item.hasRange && !entry.range.invalid
        ? `Estimated duration: ${formatDuration(entry.range.expected)}; possible range: ${formatDuration(entry.range.min)} to ${formatDuration(entry.range.max)}. ` : "";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid()}@${calendarHost}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsUtc(entry.start)}`,
        `DTEND:${icsUtc(entry.end)}`,
        `SUMMARY:${icsEscape(entry.item.label || `Step ${index + 1}`)}`,
        `DESCRIPTION:${icsEscape(`${rangeNote}Generated by ${SITE.fullName}.`)}`,
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
  };

  const downloadText = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  class TimeChainApp {
    constructor(root) {
      this.root = root;
      this.preset = root.dataset.preset || "home";
      this.defaultState = makeDefaultState(this.preset);
      const hashState = getHashState();
      const lastState = storageGet(STORAGE_LAST, null);
      this.state = normalizeState(hashState || (this.preset === "home" ? lastState : null), this.defaultState);
      const savedPlans = storageGet(STORAGE_SAVED, []);
      this.saved = Array.isArray(savedPlans) ? savedPlans.slice(0, 8) : [];
      this.parseMessage = location.hash.startsWith("#p=") && !hashState
        ? "That share link is invalid, so the default plan has been opened."
        : "";
      this.announceMessage = "";
      this.draggedId = null;
      this.toastTimer = null;
      this.instanceId = uid().replaceAll("-", "");
      this.bind();
      this.render();
    }

    bind() {
      this.root.addEventListener("click", (event) => this.onClick(event));
      this.root.addEventListener("change", (event) => this.onChange(event));
      this.root.addEventListener("dragstart", (event) => this.onDragStart(event));
      this.root.addEventListener("dragover", (event) => this.onDragOver(event));
      this.root.addEventListener("dragleave", (event) => event.target.closest(".step-row")?.classList.remove("is-drag-over"));
      this.root.addEventListener("drop", (event) => this.onDrop(event));
      this.root.addEventListener("dragend", () => this.clearDrag());
    }

    commit(message = "") {
      this.announceMessage = message;
      const stored = storageSet(STORAGE_LAST, this.state);
      this.render();
      if (!stored) this.showToast("The calculation works, but this browser did not allow local saving.", true);
    }

    showToast(message) {
      const toast = this.root.querySelector(".toast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("is-visible");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
    }

    loadTemplate(name) {
      if (name === "afterwork") this.state = makeDefaultState("home");
      if (name === "airport") this.state = makeDefaultState("backward");
      if (name === "morning") {
        const start = nextAt(7, 0, new Date(Date.now() - 12 * 60 * 60000));
        this.state = {
          ...makeDefaultState("home"), anchor: start.getTime(), title: "Morning routine",
          steps: [step("Get ready", 20), step("Breakfast", 25), step("Pack and leave", 15)]
        };
      }
      if (name === "focus") this.state = makeDefaultState("focus");
      this.commit("Example loaded and the full timeline recalculated.");
    }

    onClick(event) {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      const index = this.state.steps.findIndex((item) => item.id === id);

      if (action === "mode-forward" || action === "mode-reverse") {
        this.state.mode = action === "mode-reverse" ? "reverse" : "forward";
        this.commit(this.state.mode === "reverse" ? "Switched to backward planning." : "Switched to forward planning.");
      }

      if (action === "set-now") {
        this.state.anchor = roundToFive().getTime();
        this.state.anchorMode = "now";
        this.commit("The current time has been fixed as the starting point.");
      }

      if (action === "shift") {
        const minutes = Number(button.dataset.minutes || 0);
        if (this.state.mode === "forward") this.state.anchor = addMinutes(new Date(this.state.anchor), minutes).getTime();
        else this.state.target = addMinutes(new Date(this.state.target), minutes).getTime();
        this.state.anchorMode = "custom";
        this.commit(`Shifted the whole plan ${Math.abs(minutes)} minutes ${minutes >= 0 ? "later" : "earlier"}.`);
      }

      if (action === "quick-add") {
        if (this.state.steps.length >= MAX_STEPS) return this.showToast(`You can add up to ${MAX_STEPS} steps.`);
        const minutes = clampMinutes(button.dataset.minutes, 30);
        this.state.steps.push(step(`Step ${this.state.steps.length + 1}`, minutes));
        this.commit(`Added ${minutes} minutes.`);
      }

      if (action === "add-step") {
        if (this.state.steps.length >= MAX_STEPS) return this.showToast(`You can add up to ${MAX_STEPS} steps.`);
        this.state.steps.push(step(`Step ${this.state.steps.length + 1}`, 30));
        this.commit("Added another step.");
        requestAnimationFrame(() => this.root.querySelector(`[data-id="${this.state.steps.at(-1).id}"] [data-field="label"]`)?.focus());
      }

      if (action === "delete-step" && index >= 0) {
        this.state.steps.splice(index, 1);
        this.commit("Step deleted and all following times updated.");
      }

      if (action === "duplicate-step" && index >= 0 && this.state.steps.length < MAX_STEPS) {
        const copy = { ...clone(this.state.steps[index]), id: uid(), label: `${this.state.steps[index].label} (copy)`.slice(0, 80) };
        this.state.steps.splice(index + 1, 0, copy);
        this.commit("Step duplicated.");
      }

      if ((action === "move-up" || action === "move-down") && index >= 0) {
        const nextIndex = action === "move-up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= this.state.steps.length) return;
        const [moved] = this.state.steps.splice(index, 1);
        this.state.steps.splice(nextIndex, 0, moved);
        this.commit(`${moved.label} moved to position ${nextIndex + 1}.`);
      }

      if (action === "template") this.loadTemplate(button.dataset.template);
      if (action === "parse") this.applyNaturalText();
      if (action === "copy") this.copySummary();
      if (action === "share") this.sharePlan();
      if (action === "export") this.exportCalendar();
      if (action === "print") window.print();

      if (action === "open-save") {
        const dialog = this.root.querySelector("dialog");
        const input = dialog?.querySelector("input");
        if (dialog && input) {
          input.value = this.state.title || "My time plan";
          dialog.showModal();
          requestAnimationFrame(() => input.select());
        }
      }

      if (action === "close-save") this.root.querySelector("dialog")?.close();
      if (action === "confirm-save") this.savePlan();

      if (action === "load-saved") {
        const saved = this.saved.find((item) => item.id === id);
        if (saved) {
          this.state = normalizeState(saved.state, this.defaultState);
          this.commit(`Loaded "${saved.name}".`);
        }
      }

      if (action === "delete-saved") {
        this.saved = this.saved.filter((item) => item.id !== id);
        storageSet(STORAGE_SAVED, this.saved);
        this.render();
        this.showToast("Saved plan deleted.");
      }
    }

    onChange(event) {
      const target = event.target;
      const field = target.dataset.field;
      if (!field) return;
      const id = target.closest("[data-id]")?.dataset.id;
      const item = this.state.steps.find((entry) => entry.id === id);

      if (field === "anchor") {
        this.state.anchor = parseLocalDateTime(target.value, this.state.anchor).getTime();
        this.state.anchorMode = "custom";
      } else if (field === "target") {
        this.state.target = parseLocalDateTime(target.value, this.state.target).getTime();
      } else if (item && field === "label") {
        item.label = String(target.value || "").trim().slice(0, 80) || "Untitled step";
      } else if (item && field === "duration") {
        item.duration = clampMinutes(target.value, item.duration);
        if (!item.hasRange) item.min = item.max = item.duration;
      } else if (item && field === "hasRange") {
        item.hasRange = target.checked;
        if (item.hasRange && item.min === item.max) {
          item.min = Math.max(0, item.duration - 10);
          item.max = Math.min(MAX_MINUTES, item.duration + 10);
        }
      } else if (item && field === "min") {
        item.min = clampMinutes(target.value, item.min);
      } else if (item && field === "max") {
        item.max = clampMinutes(target.value, item.max);
      } else {
        return;
      }
      this.commit("Timeline updated.");
    }

    onDragStart(event) {
      const row = event.target.closest(".step-row");
      if (!row) return;
      this.draggedId = row.dataset.id;
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", this.draggedId);
    }

    onDragOver(event) {
      const row = event.target.closest(".step-row");
      if (!row || row.dataset.id === this.draggedId) return;
      event.preventDefault();
      this.root.querySelectorAll(".step-row").forEach((item) => item.classList.remove("is-drag-over"));
      row.classList.add("is-drag-over");
    }

    onDrop(event) {
      const row = event.target.closest(".step-row");
      if (!row || !this.draggedId || row.dataset.id === this.draggedId) return this.clearDrag();
      event.preventDefault();
      const from = this.state.steps.findIndex((item) => item.id === this.draggedId);
      const to = this.state.steps.findIndex((item) => item.id === row.dataset.id);
      if (from >= 0 && to >= 0) {
        const [moved] = this.state.steps.splice(from, 1);
        this.state.steps.splice(to, 0, moved);
        this.clearDrag();
        this.commit(`${moved.label} moved to position ${to + 1}.`);
      }
    }

    clearDrag() {
      this.root.querySelectorAll(".step-row").forEach((item) => item.classList.remove("is-dragging", "is-drag-over"));
      this.draggedId = null;
    }

    applyNaturalText() {
      const textarea = this.root.querySelector("[data-natural-input]");
      const text = textarea?.value || "";
      if (!text.trim()) return this.showToast("Enter a plan first.");
      const parsed = parseNaturalText(text);
      if (parsed.start?.invalid) {
        this.parseMessage = parsed.start.note;
        this.render();
        return;
      }
      if (!parsed.steps.length) {
        this.parseMessage = 'No duration was found. Try "now, swim 45 minutes, then break 15 minutes".';
        this.render();
        return;
      }
      this.state.mode = "forward";
      if (parsed.start?.date) {
        this.state.anchor = parsed.start.date.getTime();
        this.state.anchorMode = parsed.start.isNow ? "now" : "custom";
      }
      this.state.steps = parsed.steps;
      const warnings = [];
      if (parsed.start?.note) warnings.push(parsed.start.note);
      if (parsed.unrecognized.length) warnings.push(`Not recognized: ${parsed.unrecognized.slice(0, 3).join(", ")}. The other items were added and can still be edited.`);
      this.parseMessage = warnings.join(" ") || `Recognized ${parsed.steps.length} ${parsed.steps.length === 1 ? "step" : "steps"}.`;
      this.commit("The written plan was converted into a timeline.");
    }

    async copySummary() {
      const success = await copyText(summaryText(this.state));
      this.showToast(success ? "The full timeline was copied." : "Copy failed. Please select the text manually.");
    }

    async sharePlan() {
      const payload = base64UrlEncode(this.state);
      const cleanUrl = location.protocol === "file:"
        ? location.href.split("#")[0]
        : `${location.origin}${location.pathname}`;
      const url = `${cleanUrl}#p=${payload}`;
      if (url.length > 7000) {
        await this.copySummary();
        this.showToast("This plan is too long for a share link, so its text was copied instead.");
        return;
      }
      const shareData = { title: this.state.title || SITE.fullName, text: `My time plan: ${formatDateTime(calculate(this.state).primary)}`, url };
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      const success = await copyText(url);
      this.showToast(success ? "Share link copied. Plan data stays after the # in the link." : "The share link could not be copied.");
    }

    exportCalendar() {
      if (!this.state.steps.length) return this.showToast("Add at least one step first.");
      const hasRanges = this.state.steps.some((item) => item.hasRange && item.min !== item.max);
      const safeTitle = (this.state.title || "time-plan").replace(/[\\/:*?"<>|]/g, "-").slice(0, 40);
      downloadText(makeIcs(this.state), `${safeTitle}.ics`, "text/calendar;charset=utf-8");
      this.showToast(hasRanges ? "Calendar exported using each step's estimated duration." : "Calendar file created.");
    }

    savePlan() {
      const dialog = this.root.querySelector("dialog");
      const name = String(dialog?.querySelector("input")?.value || "My time plan").trim().slice(0, 50) || "My time plan";
      this.state.title = name;
      this.saved = [{ id: uid(), name, savedAt: Date.now(), state: clone(this.state) }, ...this.saved].slice(0, 8);
      const success = storageSet(STORAGE_SAVED, this.saved);
      storageSet(STORAGE_LAST, this.state);
      dialog?.close();
      this.render();
      this.showToast(success ? `Saved "${name}".` : "The browser did not allow saving, but the current calculation still works.");
    }

    render() {
      const result = calculate(this.state);
      const hasRange = result.totalMin !== result.totalMax;
      const primaryLabel = this.state.mode === "forward" ? "Estimated finish" : "Recommended start";
      const anchorLabel = this.state.mode === "forward" ? "When do you start?" : "When must you finish?";
      const resultRange = hasRange
        ? (this.state.mode === "forward"
          ? `Finish window: earliest <strong>${formatDateTime(result.earliest)}</strong>, latest <strong>${formatDateTime(result.latest)}</strong>`
          : `Start window: safest <strong>${formatDateTime(result.earliest)}</strong>, latest <strong>${formatDateTime(result.latest)}</strong>`)
        : "";
      const invalidRanges = this.state.steps.some((item) => item.hasRange && item.min > item.max);

      this.root.classList.add("time-chain-app");
      this.root.innerHTML = `
        <div class="app-toolbar">
          <div class="app-title"><span>Time Chain workspace</span><span class="local-badge">Private on-device calculation</span></div>
          <div class="toolbar-actions">
            <button class="text-button button-small" type="button" data-action="open-save">♡ Save</button>
            <button class="text-button button-small" type="button" data-action="print">▤ Print</button>
          </div>
        </div>

        <div class="mode-switch" role="tablist" aria-label="Calculation direction">
          <button class="mode-button" type="button" role="tab" aria-selected="${this.state.mode === "forward"}" data-action="mode-forward">Start at a time</button>
          <button class="mode-button" type="button" role="tab" aria-selected="${this.state.mode === "reverse"}" data-action="mode-reverse">Finish by a time</button>
        </div>

        <section class="result-hero" aria-live="polite" aria-atomic="true">
          <p class="result-kicker">${primaryLabel}</p>
          <p class="result-time"><time datetime="${new Date(result.primary).toISOString()}">${formatClock(result.primary)}</time></p>
          <p class="result-day">${dayText(result.primary)} · ${this.state.mode === "forward" ? "everything finished" : "best time to start"}</p>
          <div class="result-meta">
            <span>Total <strong>${formatDuration(result.totalExpected)}</strong></span>
            <span>${this.state.steps.length} ${this.state.steps.length === 1 ? "step" : "steps"}</span>
            <span>${this.state.mode === "forward" ? "Starts" : "Target"} <strong>${formatDateTime(this.state.mode === "forward" ? result.start : result.end)}</strong></span>
          </div>
          ${resultRange ? `<p class="result-range">${resultRange}</p>` : ""}
          ${invalidRanges ? `<p class="result-range">A minimum duration is longer than its maximum. That step is temporarily using the estimated duration; correct it under "Duration range".</p>` : ""}
          <div class="result-actions">
            <button class="secondary-button button-small" type="button" data-action="copy">Copy timeline</button>
            <button class="secondary-button button-small" type="button" data-action="share">Share link</button>
            <button class="secondary-button button-small" type="button" data-action="export">Add to calendar</button>
          </div>
        </section>

        <div class="editor-layout">
          <main class="editor-main">
            <section class="anchor-card" aria-labelledby="anchor-${this.instanceId}">
              <h2 class="section-heading" id="anchor-${this.instanceId}">${anchorLabel}</h2>
              <div class="anchor-row">
                <label class="field">
                  <span class="field-label">${this.state.mode === "forward" ? "Start date and time" : "Target date and time"}</span>
                  <input class="input" type="datetime-local" data-field="${this.state.mode === "forward" ? "anchor" : "target"}" value="${inputDateTime(this.state.mode === "forward" ? this.state.anchor : this.state.target)}">
                </label>
                <div>
                  <div class="shift-actions" aria-label="Shift the entire plan">
                    <button class="secondary-button button-small" type="button" data-action="shift" data-minutes="-10">−10 min</button>
                    ${this.state.mode === "forward" ? `<button class="secondary-button button-small" type="button" data-action="set-now">Set to now</button>` : ""}
                    <button class="secondary-button button-small" type="button" data-action="shift" data-minutes="10">+10 min</button>
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="steps-${this.instanceId}">
              <h2 class="section-heading" id="steps-${this.instanceId}">Add each step in order</h2>
              <p class="section-description">Change one step and every later time updates automatically. Drag to reorder on a computer, or use the move buttons with touch and keyboards.</p>
              <div class="quick-duration" aria-label="Quickly add a duration">
                ${[15, 30, 45, 60, 90].map((minutes) => `<button class="chip${minutes === 45 ? " chip--strong" : ""}" type="button" data-action="quick-add" data-minutes="${minutes}">+${minutes} min</button>`).join("")}
              </div>
              <ol class="timeline">
                ${this.renderSteps(result.entries)}
              </ol>
              <button class="secondary-button add-step-button" type="button" data-action="add-step">+ Add another step</button>
            </section>

            <section class="natural-card" aria-labelledby="natural-${this.instanceId}">
              <h2 class="section-heading" id="natural-${this.instanceId}">Or write it in one line</h2>
              <p class="section-description">Example: now, swim 45 minutes, then break 15 minutes, then dinner 1.5 hours</p>
              <label class="field">
                <span class="sr-only">Enter your plan in one line</span>
                <textarea class="textarea" data-natural-input maxlength="3000" placeholder="Write your plan here..."></textarea>
              </label>
              <div class="natural-actions"><button class="primary-button" type="button" data-action="parse">Build timeline</button></div>
              ${this.parseMessage ? `<p class="parse-note${/invalid|could not|not recognized|no duration/i.test(this.parseMessage) ? " is-warning" : ""}">${escapeHTML(this.parseMessage)}</p>` : ""}
            </section>
          </main>

          <aside class="editor-side" aria-label="Examples and saved plans">
            <section class="side-section">
              <h2 class="section-heading">Start with an example</h2>
              <div class="template-grid">
                <button class="template-button" type="button" data-action="template" data-template="afterwork"><strong>After-work plan</strong><span>Swim · Break · Dinner · Travel home</span></button>
                <button class="template-button" type="button" data-action="template" data-template="airport"><strong>Airport countdown</strong><span>Work backward from the arrival time</span></button>
                <button class="template-button" type="button" data-action="template" data-template="morning"><strong>Morning routine</strong><span>Get ready · Breakfast · Pack</span></button>
              </div>
            </section>
            <section class="side-section">
              <h2 class="section-heading">Saved plans</h2>
              ${this.renderSaved()}
            </section>
            <section class="side-section">
              <p class="privacy-note">Plans are stored only on this device by default. Shared plan data stays after the # in the link, so it is not sent to the server or search engines as part of the page address.</p>
            </section>
          </aside>
        </div>

        <p class="sr-only" aria-live="polite">${escapeHTML(this.announceMessage)}</p>
        <div class="toast" role="status" aria-live="polite"></div>
        <dialog class="modal" aria-labelledby="save-title-${this.instanceId}">
          <form class="modal__inner" method="dialog" onsubmit="return false">
            <h2 id="save-title-${this.instanceId}">Save this timeline</h2>
            <p>Load it with one tap next time. Its contents stay in this browser.</p>
            <label class="field"><span class="field-label">Plan name</span><input class="input" maxlength="50" value="${escapeHTML(this.state.title)}"></label>
            <div class="modal__actions">
              <button class="secondary-button" type="button" data-action="close-save">Cancel</button>
              <button class="primary-button primary-button--accent" type="button" data-action="confirm-save">Save</button>
            </div>
          </form>
        </dialog>
      `;
    }

    renderSteps(entries) {
      if (!entries.length) return `<li class="empty-note">No steps yet. Use "Add another step" or one of the quick durations above.</li>`;
      return entries.map((entry, index) => {
        const item = entry.item;
        const invalid = item.hasRange && item.min > item.max;
        return `
          <li class="step-row" draggable="true" data-id="${escapeHTML(item.id)}">
            <span class="step-index" aria-hidden="true">${index + 1}</span>
            <article class="step-card">
              <div class="step-main-fields">
                <label class="field">
                  <span class="field-label">What happens in this step? (optional)</span>
                  <input class="input" type="text" maxlength="80" data-field="label" value="${escapeHTML(item.label)}" aria-label="Name of step ${index + 1}">
                </label>
                <label class="field duration-wrap">
                  <span class="field-label">Estimated duration</span>
                  <input class="input" type="number" inputmode="numeric" min="0" max="${MAX_MINUTES}" step="1" data-field="duration" value="${entry.range.expected}" aria-label="Estimated duration for ${escapeHTML(item.label)} in minutes">
                  <span class="duration-unit">min</span>
                </label>
              </div>
              <p class="step-time"><strong><time datetime="${entry.start.toISOString()}">${formatDateTime(entry.start)}</time> → <time datetime="${entry.end.toISOString()}">${formatDateTime(entry.end)}</time></strong> · ${formatDuration(entry.range.expected)}${item.hasRange && !invalid ? ` · range ${formatDuration(item.min)} to ${formatDuration(item.max)}` : ""}</p>
              <details class="advanced-panel"${item.hasRange ? " open" : ""}>
                <summary>Duration range (optional)</summary>
                <label class="range-toggle"><input type="checkbox" data-field="hasRange" ${item.hasRange ? "checked" : ""}> This step may take more or less time</label>
                ${item.hasRange ? `
                  <div class="range-fields">
                    <label class="field"><span class="field-label">Minimum (minutes)</span><input class="input" type="number" inputmode="numeric" min="0" max="${MAX_MINUTES}" data-field="min" value="${item.min}"></label>
                    <label class="field"><span class="field-label">Maximum (minutes)</span><input class="input" type="number" inputmode="numeric" min="0" max="${MAX_MINUTES}" data-field="max" value="${item.max}"></label>
                  </div>
                  ${invalid ? `<p class="validation-message">The minimum cannot be greater than the maximum.</p>` : ""}
                ` : ""}
              </details>
              <div class="step-actions">
                <div class="move-actions" aria-label="Change the order of step ${index + 1}">
                  <button class="icon-button button-small" type="button" data-action="move-up" data-id="${escapeHTML(item.id)}" aria-label="Move ${escapeHTML(item.label)} up" ${index === 0 ? "disabled" : ""}>↑</button>
                  <button class="icon-button button-small" type="button" data-action="move-down" data-id="${escapeHTML(item.id)}" aria-label="Move ${escapeHTML(item.label)} down" ${index === entries.length - 1 ? "disabled" : ""}>↓</button>
                  <button class="text-button button-small" type="button" data-action="duplicate-step" data-id="${escapeHTML(item.id)}">Duplicate</button>
                </div>
                <button class="text-button button-small" type="button" data-action="delete-step" data-id="${escapeHTML(item.id)}" aria-label="Delete ${escapeHTML(item.label)}">Delete</button>
              </div>
            </article>
          </li>
        `;
      }).join("");
    }

    renderSaved() {
      if (!Array.isArray(this.saved) || !this.saved.length) return `<p class="empty-note">Nothing saved yet. Finish your plan, then choose "Save" at the top.</p>`;
      return `<ul class="saved-list">${this.saved.map((saved) => `
        <li class="saved-item">
          <button class="saved-load" type="button" data-action="load-saved" data-id="${escapeHTML(saved.id)}"><strong>${escapeHTML(saved.name)}</strong><small>${new Intl.DateTimeFormat(SITE.locale || "en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(saved.savedAt))}</small></button>
          <button class="icon-button" type="button" data-action="delete-saved" data-id="${escapeHTML(saved.id)}" aria-label="Delete saved plan ${escapeHTML(saved.name)}">×</button>
        </li>
      `).join("")}</ul>`;
    }
  }

  const initTheme = () => {
    const saved = storageGet(`${SITE.storagePrefix}:theme`, "");
    const preferred = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = saved || preferred;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const updateLabel = () => {
        const isDark = document.documentElement.dataset.theme === "dark";
        button.textContent = isDark ? "☀" : "☾";
        button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      };
      updateLabel();
      button.addEventListener("click", () => {
        document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        storageSet(`${SITE.storagePrefix}:theme`, document.documentElement.dataset.theme);
        updateLabel();
      });
    });
  };

  document.querySelectorAll("[data-time-chain-app]").forEach((root) => new TimeChainApp(root));
  initTheme();
})();

