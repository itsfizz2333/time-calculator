(() => {
  "use strict";

  const SITE = window.TIME_CHAIN_SITE || {
    name: "算到几点",
    product: "时间接龙",
    fullName: "算到几点 · 时间接龙",
    storagePrefix: "time-chain-prototype-v1"
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
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit", minute: "2-digit", hour12: false
    }).format(date).replace("24:", "00:");
  };

  const dayText = (dateValue, today = new Date()) => {
    const date = new Date(dateValue);
    const diff = Math.round((startOfDay(date) - startOfDay(today)) / 86400000);
    if (diff === -2) return "前天";
    if (diff === -1) return "昨天";
    if (diff === 0) return "今天";
    if (diff === 1) return "明天";
    if (diff === 2) return "后天";
    return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(date);
  };

  const formatDateTime = (date) => `${dayText(date)} ${formatClock(date)}`;

  const formatDuration = (minutes) => {
    const total = Math.max(0, Math.round(minutes));
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const mins = total % 60;
    const parts = [];
    if (days) parts.push(`${days}天`);
    if (hours) parts.push(`${hours}小时`);
    if (mins || !parts.length) parts.push(`${mins}分钟`);
    return parts.join("");
  };

  const chineseNumber = (text) => {
    const digits = { "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
    if (text.includes("百")) {
      const [hundreds, rest = ""] = text.split("百");
      return (digits[hundreds] || 1) * 100 + (rest ? chineseNumber(rest) : 0);
    }
    if (text.includes("十")) {
      const [tens, ones] = text.split("十");
      return (tens ? digits[tens] : 1) * 10 + (ones ? digits[ones] : 0);
    }
    return [...text].reduce((value, char) => value * 10 + (digits[char] ?? 0), 0);
  };

  const normalizeChineseNumbers = (text) => String(text).replace(
    /([零〇一二两三四五六七八九十百]+)(?=\s*(?:点|时|小时|分钟|分|个?半小时))/g,
    (match) => String(chineseNumber(match))
  );

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
      label: String(item?.label || `步骤 ${index + 1}`).slice(0, 80),
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
      title: "今天的安排",
      steps: [
        step("游泳", 45),
        step("休息", 15),
        step("吃晚饭", 60),
        step("回家", 30)
      ]
    };

    if (preset === "quick45") {
      return {
        ...base,
        anchorMode: "now",
        anchor: now.getTime(),
        title: "45分钟后",
        steps: [step("45分钟", 45)]
      };
    }

    if (preset === "backward") {
      return {
        ...base,
        mode: "reverse",
        target: target.getTime(),
        title: "准时到达",
        steps: [step("路程", 40), step("停车", 10), step("办理手续", 30), step("预留", 15)]
      };
    }

    if (preset === "focus") {
      return {
        ...base,
        anchorMode: "now",
        anchor: now.getTime(),
        title: "专注循环",
        steps: [step("专注", 50), step("休息", 10), step("专注", 50)]
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
      title: String(candidate.title || "我的时间计划").slice(0, 80),
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
    const normalized = normalizeChineseNumbers(segment).replaceAll("个", "").replace(/[—–~～]/g, "-");
    const range = normalized.match(/(\d+(?:\.\d+)?)\s*(?:到|至|-)\s*(\d+(?:\.\d+)?)\s*(小时|时|h|分钟|分|min)/i);
    if (range) {
      const unit = /小时|时|h/i.test(range[3]) ? 60 : 1;
      const min = clampMinutes(Number(range[1]) * unit);
      const max = clampMinutes(Number(range[2]) * unit);
      return { duration: Math.round((min + max) / 2), min, max, hasRange: true, matched: range[0] };
    }

    const halfHours = normalized.match(/(\d+(?:\.\d+)?)\s*半小时/);
    if (halfHours) {
      const value = clampMinutes(Number(halfHours[1]) * 60 + 30);
      return { duration: value, min: value, max: value, hasRange: false, matched: halfHours[0] };
    }

    if (/半小时/.test(normalized)) {
      return { duration: 30, min: 30, max: 30, hasRange: false, matched: "半小时" };
    }

    if (/一刻钟/.test(normalized)) {
      return { duration: 15, min: 15, max: 15, hasRange: false, matched: "一刻钟" };
    }

    const hours = normalized.match(/(\d+(?:\.\d+)?)\s*(?:小时|时|h)/i);
    const minutes = normalized.match(/(\d+(?:\.\d+)?)\s*(?:分钟|分|min)/i);
    if (hours || minutes) {
      const value = clampMinutes((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
      const matched = `${hours?.[0] || ""}${minutes?.[0] || ""}`;
      return { duration: value, min: value, max: value, hasRange: false, matched };
    }

    return null;
  };

  const parseStartTime = (text, now = new Date()) => {
    if (/现在(?:开始)?/.test(text)) return { date: roundToFive(now), matched: text.match(/现在(?:开始)?/)?.[0], note: "已把“现在”冻结为当前时间，之后不会自动漂移。" };
    const period = text.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2})\s*(?:[:：点时])\s*(\d{1,2})?\s*分?/);
    if (!period) return null;
    let hour = Number(period[2]);
    const minute = Number(period[3] || 0);
    if (hour > 23 || minute > 59) return { invalid: true, matched: period[0], note: `无法识别时间“${period[0].trim()}”。` };
    const marker = period[1] || "";
    if (/下午|傍晚|晚上/.test(marker) && hour < 12) hour += 12;
    if (/凌晨/.test(marker) && hour === 12) hour = 0;
    if (/中午/.test(marker) && hour < 11) hour += 12;
    let date = atToday(hour, minute, now);
    let note = "";
    if (!marker && hour <= 12) {
      if (date <= now) date = addMinutes(date, 12 * 60);
      if (date <= now) date = addMinutes(date, 12 * 60);
      note = `“${period[0].trim()}”按下一次出现的 ${formatDateTime(date)} 处理，可在上方修改。`;
    }
    return { date, matched: period[0], note };
  };

  const stripDurationText = (text) => String(text)
    .replace(/\d+(?:\.\d+)?\s*(?:到|至|-|—|–|~|～)\s*\d+(?:\.\d+)?\s*(?:小时|时|h|分钟|分|min)/gi, "")
    .replace(/\d+(?:\.\d+)?\s*个?半(?:个)?小时/gi, "")
    .replace(/半小时|一刻钟/g, "")
    .replace(/\d+(?:\.\d+)?\s*(?:小时|时|h)/gi, "")
    .replace(/\d+(?:\.\d+)?\s*(?:分钟|分|min)/gi, "");

  const parseNaturalText = (text) => {
    const input = normalizeChineseNumbers(String(text || "").trim().slice(0, 3000));
    const start = parseStartTime(input);
    const rawSegments = input.split(/[，,、；;。\n]|(?:\s*(?:→|->)\s*)/).map((part) => part.trim()).filter(Boolean);
    const parsedSteps = [];
    const unrecognized = [];

    rawSegments.forEach((segment) => {
      const segmentWithoutStart = segment.replace(start?.matched || "", "").trim();
      const duration = durationFromText(segmentWithoutStart);
      if (!duration) {
        const remaining = segmentWithoutStart.replace(/^(再过|然后|再|后|开始|去)+/, "").trim();
        if (remaining) unrecognized.push(segment);
        return;
      }
      let label = stripDurationText(segmentWithoutStart)
        .replace(/^(现在开始|开始|再过|然后|接着|随后|再|去|要|做)+/, "")
        .replace(/(?:以后|之后|后|结束|完成)$/g, "")
        .trim();
      if (!label || /^(分钟|小时|时)$/.test(label)) label = `步骤 ${parsedSteps.length + 1}`;
      parsedSteps.push({
        id: uid(), label: label.slice(0, 80), duration: duration.duration,
        hasRange: duration.hasRange, min: duration.min, max: duration.max
      });
    });

    return { start, steps: parsedSteps.slice(0, MAX_STEPS), unrecognized };
  };

  const summaryText = (state) => {
    const result = calculate(state);
    const lines = [state.title || "我的时间计划"];
    if (state.mode === "forward") lines.push(`开始：${formatDateTime(result.start)}`);
    else lines.push(`最晚开始：${formatDateTime(result.primary)}（目标 ${formatDateTime(result.end)}）`);
    result.entries.forEach((entry, index) => {
      const range = entry.item.hasRange && !entry.range.invalid
        ? `，范围 ${formatDuration(entry.range.min)}–${formatDuration(entry.range.max)}` : "";
      lines.push(`${index + 1}. ${entry.item.label || `步骤 ${index + 1}`}｜${formatDateTime(entry.start)}–${formatDateTime(entry.end)}｜${formatDuration(entry.range.expected)}${range}`);
    });
    lines.push(`总计：${formatDuration(result.totalExpected)}`);
    if (result.totalMin !== result.totalMax) {
      if (state.mode === "forward") lines.push(`完成范围：最早 ${formatDateTime(result.earliest)}，最晚 ${formatDateTime(result.latest)}`);
      else lines.push(`开始窗口：稳妥 ${formatDateTime(result.earliest)}，最晚 ${formatDateTime(result.latest)}`);
    }
    lines.push(state.mode === "forward" ? `预计结束：${formatDateTime(result.primary)}` : `预计开始：${formatDateTime(result.primary)}`);
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
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      `PRODID:-//${SITE.name}//Time Chain 1.0//ZH-CN`,
      `X-WR-CALNAME:${icsEscape(state.title || SITE.product)}`
    ];
    result.entries.forEach((entry, index) => {
      const rangeNote = entry.item.hasRange && !entry.range.invalid
        ? `预计 ${formatDuration(entry.range.expected)}；可能 ${formatDuration(entry.range.min)} 至 ${formatDuration(entry.range.max)}。` : "";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid()}@timecalc.top`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsUtc(entry.start)}`,
        `DTEND:${icsUtc(entry.end)}`,
        `SUMMARY:${icsEscape(entry.item.label || `步骤 ${index + 1}`)}`,
        `DESCRIPTION:${icsEscape(`${rangeNote}由 ${SITE.fullName} 生成。`)}`,
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
      this.parseMessage = hashState || !location.hash ? "" : "分享链接无效，已打开默认计划。";
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
      if (!stored) this.showToast("计算正常，但浏览器未允许保存。", true);
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
          ...makeDefaultState("home"), anchor: start.getTime(), title: "早晨出门",
          steps: [step("洗漱", 20), step("早餐", 25), step("收拾出门", 15)]
        };
      }
      if (name === "focus") this.state = makeDefaultState("focus");
      this.commit("已载入示例，整条时间线已重新计算。 ");
    }

    onClick(event) {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      const index = this.state.steps.findIndex((item) => item.id === id);

      if (action === "mode-forward" || action === "mode-reverse") {
        this.state.mode = action === "mode-reverse" ? "reverse" : "forward";
        this.commit(this.state.mode === "reverse" ? "已切换为倒推模式。" : "已切换为正向模式。");
      }

      if (action === "set-now") {
        this.state.anchor = roundToFive().getTime();
        this.state.anchorMode = "now";
        this.commit("已把现在的时间固定为起点。 ");
      }

      if (action === "shift") {
        const minutes = Number(button.dataset.minutes || 0);
        if (this.state.mode === "forward") this.state.anchor = addMinutes(new Date(this.state.anchor), minutes).getTime();
        else this.state.target = addMinutes(new Date(this.state.target), minutes).getTime();
        this.state.anchorMode = "custom";
        this.commit(`整体${minutes >= 0 ? "延后" : "提前"}${Math.abs(minutes)}分钟。`);
      }

      if (action === "quick-add") {
        if (this.state.steps.length >= MAX_STEPS) return this.showToast(`最多添加 ${MAX_STEPS} 段。`);
        const minutes = clampMinutes(button.dataset.minutes, 30);
        this.state.steps.push(step(`步骤 ${this.state.steps.length + 1}`, minutes));
        this.commit(`已添加 ${minutes} 分钟。`);
      }

      if (action === "add-step") {
        if (this.state.steps.length >= MAX_STEPS) return this.showToast(`最多添加 ${MAX_STEPS} 段。`);
        this.state.steps.push(step(`步骤 ${this.state.steps.length + 1}`, 30));
        this.commit("已添加下一段。 ");
        requestAnimationFrame(() => this.root.querySelector(`[data-id="${this.state.steps.at(-1).id}"] [data-field="label"]`)?.focus());
      }

      if (action === "delete-step" && index >= 0) {
        this.state.steps.splice(index, 1);
        this.commit("已删除一段，后面的时间已更新。 ");
      }

      if (action === "duplicate-step" && index >= 0 && this.state.steps.length < MAX_STEPS) {
        const copy = { ...clone(this.state.steps[index]), id: uid(), label: `${this.state.steps[index].label}（副本）`.slice(0, 80) };
        this.state.steps.splice(index + 1, 0, copy);
        this.commit("已复制一段。 ");
      }

      if ((action === "move-up" || action === "move-down") && index >= 0) {
        const nextIndex = action === "move-up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= this.state.steps.length) return;
        const [moved] = this.state.steps.splice(index, 1);
        this.state.steps.splice(nextIndex, 0, moved);
        this.commit(`${moved.label}已移动到第 ${nextIndex + 1} 段。`);
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
          input.value = this.state.title || "我的时间计划";
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
          this.commit(`已载入“${saved.name}”。`);
        }
      }

      if (action === "delete-saved") {
        this.saved = this.saved.filter((item) => item.id !== id);
        storageSet(STORAGE_SAVED, this.saved);
        this.render();
        this.showToast("已删除保存的计划。 ");
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
        item.label = String(target.value || "").trim().slice(0, 80) || "未命名步骤";
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
      this.commit("时间线已更新。 ");
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
        this.commit(`${moved.label}已移动到第 ${to + 1} 段。`);
      }
    }

    clearDrag() {
      this.root.querySelectorAll(".step-row").forEach((item) => item.classList.remove("is-dragging", "is-drag-over"));
      this.draggedId = null;
    }

    applyNaturalText() {
      const textarea = this.root.querySelector("[data-natural-input]");
      const text = textarea?.value || "";
      if (!text.trim()) return this.showToast("先输入一段安排。 ");
      const parsed = parseNaturalText(text);
      if (parsed.start?.invalid) {
        this.parseMessage = parsed.start.note;
        this.render();
        return;
      }
      if (!parsed.steps.length) {
        this.parseMessage = "没有找到可计算的时长。试试“游泳45分钟，休息15分钟”。";
        this.render();
        return;
      }
      this.state.mode = "forward";
      if (parsed.start?.date) {
        this.state.anchor = parsed.start.date.getTime();
        this.state.anchorMode = /现在/.test(parsed.start.matched || "") ? "now" : "custom";
      }
      this.state.steps = parsed.steps;
      const warnings = [];
      if (parsed.start?.note) warnings.push(parsed.start.note);
      if (parsed.unrecognized.length) warnings.push(`未识别：${parsed.unrecognized.slice(0, 3).join("、")}。其余内容已加入，可继续编辑。`);
      this.parseMessage = warnings.join(" ") || `已识别 ${parsed.steps.length} 段安排。`;
      this.commit("自然语言安排已转换成时间线。 ");
    }

    async copySummary() {
      const success = await copyText(summaryText(this.state));
      this.showToast(success ? "完整时间线已复制。" : "复制失败，请手动选择内容。 ");
    }

    async sharePlan() {
      const payload = base64UrlEncode(this.state);
      const cleanUrl = location.protocol === "file:"
        ? location.href.split("#")[0]
        : `${location.origin}${location.pathname}`;
      const url = `${cleanUrl}#p=${payload}`;
      if (url.length > 7000) {
        await this.copySummary();
        this.showToast("计划较长，已改为复制文字。 ");
        return;
      }
      const shareData = { title: this.state.title || SITE.fullName, text: `我的时间计划：${formatDateTime(calculate(this.state).primary)}`, url };
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error?.name === "AbortError") return;
        }
      }
      const success = await copyText(url);
      this.showToast(success ? "分享链接已复制；活动内容只保存在链接的 # 后。" : "无法复制分享链接。 ");
    }

    exportCalendar() {
      if (!this.state.steps.length) return this.showToast("先添加至少一段安排。 ");
      const hasRanges = this.state.steps.some((item) => item.hasRange && item.min !== item.max);
      const safeTitle = (this.state.title || "time-plan").replace(/[\\/:*?"<>|]/g, "-").slice(0, 40);
      downloadText(makeIcs(this.state), `${safeTitle}.ics`, "text/calendar;charset=utf-8");
      this.showToast(hasRanges ? "已按每段的预计时长导出日历。" : "日历文件已生成。 ");
    }

    savePlan() {
      const dialog = this.root.querySelector("dialog");
      const name = String(dialog?.querySelector("input")?.value || "我的时间计划").trim().slice(0, 50) || "我的时间计划";
      this.state.title = name;
      this.saved = [{ id: uid(), name, savedAt: Date.now(), state: clone(this.state) }, ...this.saved].slice(0, 8);
      const success = storageSet(STORAGE_SAVED, this.saved);
      storageSet(STORAGE_LAST, this.state);
      dialog?.close();
      this.render();
      this.showToast(success ? `已保存“${name}”。` : "浏览器未允许保存，但当前计算不受影响。 ");
    }

    render() {
      const result = calculate(this.state);
      const hasRange = result.totalMin !== result.totalMax;
      const primaryLabel = this.state.mode === "forward" ? "预计结束" : "建议开始";
      const anchorLabel = this.state.mode === "forward" ? "从什么时候开始" : "必须在什么时候完成";
      const resultRange = hasRange
        ? (this.state.mode === "forward"
          ? `完成窗口：最早 <strong>${formatDateTime(result.earliest)}</strong>，最晚 <strong>${formatDateTime(result.latest)}</strong>`
          : `开始窗口：稳妥 <strong>${formatDateTime(result.earliest)}</strong>，最晚 <strong>${formatDateTime(result.latest)}</strong>`)
        : "";
      const invalidRanges = this.state.steps.some((item) => item.hasRange && item.min > item.max);

      this.root.classList.add("time-chain-app");
      this.root.innerHTML = `
        <div class="app-toolbar">
          <div class="app-title"><span>时间链工作台</span><span class="local-badge">本地计算 · 免登录</span></div>
          <div class="toolbar-actions">
            <button class="text-button button-small" type="button" data-action="open-save">♡ 保存</button>
            <button class="text-button button-small" type="button" data-action="print">▤ 打印</button>
          </div>
        </div>

        <div class="mode-switch" role="tablist" aria-label="计算方式">
          <button class="mode-button" type="button" role="tab" aria-selected="${this.state.mode === "forward"}" data-action="mode-forward">从几点开始</button>
          <button class="mode-button" type="button" role="tab" aria-selected="${this.state.mode === "reverse"}" data-action="mode-reverse">在几点前完成</button>
        </div>

        <section class="result-hero" aria-live="polite" aria-atomic="true">
          <p class="result-kicker">${primaryLabel}</p>
          <p class="result-time"><time datetime="${new Date(result.primary).toISOString()}">${formatClock(result.primary)}</time></p>
          <p class="result-day">${dayText(result.primary)} · ${this.state.mode === "forward" ? "全部完成" : "开始最合适"}</p>
          <div class="result-meta">
            <span>总时长 <strong>${formatDuration(result.totalExpected)}</strong></span>
            <span>${this.state.steps.length} 段安排</span>
            <span>${this.state.mode === "forward" ? "起点" : "目标"} <strong>${formatDateTime(this.state.mode === "forward" ? result.start : result.end)}</strong></span>
          </div>
          ${resultRange ? `<p class="result-range">${resultRange}</p>` : ""}
          ${invalidRanges ? `<p class="result-range">有一段的最短时间大于最长时间；该段暂按预计时长计算，请在“时间范围”中修正。</p>` : ""}
          <div class="result-actions">
            <button class="secondary-button button-small" type="button" data-action="copy">复制时间线</button>
            <button class="secondary-button button-small" type="button" data-action="share">分享链接</button>
            <button class="secondary-button button-small" type="button" data-action="export">加入日历</button>
          </div>
        </section>

        <div class="editor-layout">
          <main class="editor-main">
            <section class="anchor-card" aria-labelledby="anchor-${this.instanceId}">
              <h2 class="section-heading" id="anchor-${this.instanceId}">${anchorLabel}</h2>
              <div class="anchor-row">
                <label class="field">
                  <span class="field-label">${this.state.mode === "forward" ? "开始日期与时间" : "目标日期与时间"}</span>
                  <input class="input" type="datetime-local" data-field="${this.state.mode === "forward" ? "anchor" : "target"}" value="${inputDateTime(this.state.mode === "forward" ? this.state.anchor : this.state.target)}">
                </label>
                <div>
                  <div class="shift-actions" aria-label="整体调整时间">
                    <button class="secondary-button button-small" type="button" data-action="shift" data-minutes="-10">−10 分</button>
                    ${this.state.mode === "forward" ? `<button class="secondary-button button-small" type="button" data-action="set-now">设为现在</button>` : ""}
                    <button class="secondary-button button-small" type="button" data-action="shift" data-minutes="10">+10 分</button>
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="steps-${this.instanceId}">
              <h2 class="section-heading" id="steps-${this.instanceId}">按顺序添加每一段</h2>
              <p class="section-description">改一段，后面全部自动更新。电脑可拖动排序，手机和键盘可用上下移动。</p>
              <div class="quick-duration" aria-label="快速添加时长">
                ${[15, 30, 45, 60, 90].map((minutes) => `<button class="chip${minutes === 45 ? " chip--strong" : ""}" type="button" data-action="quick-add" data-minutes="${minutes}">+${minutes} 分</button>`).join("")}
              </div>
              <ol class="timeline">
                ${this.renderSteps(result.entries)}
              </ol>
              <button class="secondary-button add-step-button" type="button" data-action="add-step">＋ 添加下一段</button>
            </section>

            <section class="natural-card" aria-labelledby="natural-${this.instanceId}">
              <h2 class="section-heading" id="natural-${this.instanceId}">也可以粘贴一句话</h2>
              <p class="section-description">例如：下午5点游泳45分钟，休息15分钟，晚饭1小时，回家半小时</p>
              <label class="field">
                <span class="sr-only">用一句话输入安排</span>
                <textarea class="textarea" data-natural-input maxlength="3000" placeholder="把你的安排写在这里……"></textarea>
              </label>
              <div class="natural-actions"><button class="primary-button" type="button" data-action="parse">转换成时间线</button></div>
              ${this.parseMessage ? `<p class="parse-note${/无法|未识别|无效/.test(this.parseMessage) ? " is-warning" : ""}">${escapeHTML(this.parseMessage)}</p>` : ""}
            </section>
          </main>

          <aside class="editor-side" aria-label="示例和已保存计划">
            <section class="side-section">
              <h2 class="section-heading">一键套用场景</h2>
              <div class="template-grid">
                <button class="template-button" type="button" data-action="template" data-template="afterwork"><strong>下班后的安排</strong><span>游泳 · 休息 · 晚饭 · 回家</span></button>
                <button class="template-button" type="button" data-action="template" data-template="airport"><strong>赶飞机倒推</strong><span>从到达时间反推最晚开始</span></button>
                <button class="template-button" type="button" data-action="template" data-template="morning"><strong>早晨出门</strong><span>洗漱 · 早餐 · 收拾</span></button>
              </div>
            </section>
            <section class="side-section">
              <h2 class="section-heading">保存的计划</h2>
              ${this.renderSaved()}
            </section>
            <section class="side-section">
              <p class="privacy-note">计划默认只保存在这台设备。分享状态写在链接的 # 后，不会作为普通页面地址提交给服务器或搜索引擎。</p>
            </section>
          </aside>
        </div>

        <p class="sr-only" aria-live="polite">${escapeHTML(this.announceMessage)}</p>
        <div class="toast" role="status" aria-live="polite"></div>
        <dialog class="modal" aria-labelledby="save-title-${this.instanceId}">
          <form class="modal__inner" method="dialog" onsubmit="return false">
            <h2 id="save-title-${this.instanceId}">保存这条时间线</h2>
            <p>下次打开时可以一键载入。内容只保存在当前浏览器。</p>
            <label class="field"><span class="field-label">计划名称</span><input class="input" maxlength="50" value="${escapeHTML(this.state.title)}"></label>
            <div class="modal__actions">
              <button class="secondary-button" type="button" data-action="close-save">取消</button>
              <button class="primary-button primary-button--accent" type="button" data-action="confirm-save">保存</button>
            </div>
          </form>
        </dialog>
      `;
    }

    renderSteps(entries) {
      if (!entries.length) return `<li class="empty-note">还没有安排。点击“添加下一段”或上方快捷时长开始。</li>`;
      return entries.map((entry, index) => {
        const item = entry.item;
        const invalid = item.hasRange && item.min > item.max;
        return `
          <li class="step-row" draggable="true" data-id="${escapeHTML(item.id)}">
            <span class="step-index" aria-hidden="true">${index + 1}</span>
            <article class="step-card">
              <div class="step-main-fields">
                <label class="field">
                  <span class="field-label">这段做什么（可不填）</span>
                  <input class="input" type="text" maxlength="80" data-field="label" value="${escapeHTML(item.label)}" aria-label="第 ${index + 1} 段名称">
                </label>
                <label class="field duration-wrap">
                  <span class="field-label">预计时长</span>
                  <input class="input" type="number" inputmode="numeric" min="0" max="${MAX_MINUTES}" step="1" data-field="duration" value="${entry.range.expected}" aria-label="${escapeHTML(item.label)}预计时长（分钟）">
                  <span class="duration-unit">分钟</span>
                </label>
              </div>
              <p class="step-time"><strong><time datetime="${entry.start.toISOString()}">${formatDateTime(entry.start)}</time> → <time datetime="${entry.end.toISOString()}">${formatDateTime(entry.end)}</time></strong> · ${formatDuration(entry.range.expected)}${item.hasRange && !invalid ? ` · 可用 ${formatDuration(item.min)}–${formatDuration(item.max)}` : ""}</p>
              <details class="advanced-panel"${item.hasRange ? " open" : ""}>
                <summary>时间范围（可选）</summary>
                <label class="range-toggle"><input type="checkbox" data-field="hasRange" ${item.hasRange ? "checked" : ""}> 这段时间可能有浮动</label>
                ${item.hasRange ? `
                  <div class="range-fields">
                    <label class="field"><span class="field-label">最短（分钟）</span><input class="input" type="number" inputmode="numeric" min="0" max="${MAX_MINUTES}" data-field="min" value="${item.min}"></label>
                    <label class="field"><span class="field-label">最长（分钟）</span><input class="input" type="number" inputmode="numeric" min="0" max="${MAX_MINUTES}" data-field="max" value="${item.max}"></label>
                  </div>
                  ${invalid ? `<p class="validation-message">最短时间不能大于最长时间。</p>` : ""}
                ` : ""}
              </details>
              <div class="step-actions">
                <div class="move-actions" aria-label="调整第 ${index + 1} 段顺序">
                  <button class="icon-button button-small" type="button" data-action="move-up" data-id="${escapeHTML(item.id)}" aria-label="上移${escapeHTML(item.label)}" ${index === 0 ? "disabled" : ""}>↑</button>
                  <button class="icon-button button-small" type="button" data-action="move-down" data-id="${escapeHTML(item.id)}" aria-label="下移${escapeHTML(item.label)}" ${index === entries.length - 1 ? "disabled" : ""}>↓</button>
                  <button class="text-button button-small" type="button" data-action="duplicate-step" data-id="${escapeHTML(item.id)}">复制</button>
                </div>
                <button class="text-button button-small" type="button" data-action="delete-step" data-id="${escapeHTML(item.id)}" aria-label="删除${escapeHTML(item.label)}">删除</button>
              </div>
            </article>
          </li>
        `;
      }).join("");
    }

    renderSaved() {
      if (!Array.isArray(this.saved) || !this.saved.length) return `<p class="empty-note">还没有保存。调整好后点击顶部“保存”。</p>`;
      return `<ul class="saved-list">${this.saved.map((saved) => `
        <li class="saved-item">
          <button class="saved-load" type="button" data-action="load-saved" data-id="${escapeHTML(saved.id)}"><strong>${escapeHTML(saved.name)}</strong><small>${new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(saved.savedAt))}</small></button>
          <button class="icon-button" type="button" data-action="delete-saved" data-id="${escapeHTML(saved.id)}" aria-label="删除保存的${escapeHTML(saved.name)}">×</button>
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
        button.setAttribute("aria-label", isDark ? "切换到浅色模式" : "切换到深色模式");
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

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
})();
