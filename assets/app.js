(() => {
  "use strict";

  const SITE = window.TIME_CHAIN_SITE || {
    name: "ç®—åˆ°å‡ ç‚¹",
    product: "æ—¶é—´æŽ¥é¾™",
    fullName: "ç®—åˆ°å‡ ç‚¹ Â· æ—¶é—´æŽ¥é¾™",
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
    if (diff === -2) return "å‰å¤©";
    if (diff === -1) return "æ˜¨å¤©";
    if (diff === 0) return "ä»Šå¤©";
    if (diff === 1) return "æ˜Žå¤©";
    if (diff === 2) return "åŽå¤©";
    return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(date);
  };

  const formatDateTime = (date) => `${dayText(date)} ${formatClock(date)}`;

  const formatDuration = (minutes) => {
    const total = Math.max(0, Math.round(minutes));
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const mins = total % 60;
    const parts = [];
    if (days) parts.push(`${days}å¤©`);
    if (hours) parts.push(`${hours}å°æ—¶`);
    if (mins || !parts.length) parts.push(`${mins}åˆ†é’Ÿ`);
    return parts.join("");
  };

  const chineseNumber = (text) => {
    const digits = { "é›¶": 0, "ã€‡": 0, "ä¸€": 1, "äºŒ": 2, "ä¸¤": 2, "ä¸‰": 3, "å››": 4, "äº”": 5, "å…­": 6, "ä¸ƒ": 7, "å…«": 8, "ä¹": 9 };
    if (text.includes("ç™¾")) {
      const [hundreds, rest = ""] = text.split("ç™¾");
      return (digits[hundreds] || 1) * 100 + (rest ? chineseNumber(rest) : 0);
    }
    if (text.includes("å")) {
      const [tens, ones] = text.split("å");
      return (tens ? digits[tens] : 1) * 10 + (ones ? digits[ones] : 0);
    }
    return [...text].reduce((value, char) => value * 10 + (digits[char] ?? 0), 0);
  };

  const normalizeChineseNumbers = (text) => String(text).replace(
    /([é›¶ã€‡ä¸€äºŒä¸¤ä¸‰å››äº”å…­ä¸ƒå…«ä¹åç™¾]+)(?=\s*(?:ç‚¹|æ—¶|å°æ—¶|åˆ†é’Ÿ|åˆ†|ä¸ª?åŠå°æ—¶))/g,
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
      label: String(item?.label || `æ­¥éª¤ ${index + 1}`).slice(0, 80),
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
      title: "ä»Šå¤©çš„å®‰æŽ’",
      steps: [
        step("æ¸¸æ³³", 45),
        step("ä¼‘æ¯", 15),
        step("åƒæ™šé¥­", 60),
        step("å›žå®¶", 30)
      ]
    };

    if (preset === "quick45") {
      return {
        ...base,
        anchorMode: "now",
        anchor: now.getTime(),
        title: "45åˆ†é’ŸåŽ",
        steps: [step("45åˆ†é’Ÿ", 45)]
      };
    }

    if (preset === "backward") {
      return {
        ...base,
        mode: "reverse",
        target: target.getTime(),
        title: "å‡†æ—¶åˆ°è¾¾",
        steps: [step("è·¯ç¨‹", 40), step("åœè½¦", 10), step("åŠžç†æ‰‹ç»­", 30), step("é¢„ç•™", 15)]
      };
    }

    if (preset === "focus") {
      return {
        ...base,
        anchorMode: "now",
        anchor: now.getTime(),
        title: "ä¸“æ³¨å¾ªçŽ¯",
        steps: [step("ä¸“æ³¨", 50), step("ä¼‘æ¯", 10), step("ä¸“æ³¨", 50)]
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
      title: String(candidate.title || "æˆ‘çš„æ—¶é—´è®¡åˆ’").slice(0, 80),
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
    const anchor = new Date(}yïMt¶‰žËkºwµçwšâš–kž~—¦OžVg’ê–’k–ÂGžòO–ËŽ‰õô°(€€€€€ì‰ÑåÁ”ˆè‰EÕ•ÍÑ¥½¸ˆ°‰¹…µ”ˆè‹–Kš:£žîOšzs–>¿’î—¢Þ£–"Ã–&7’â–’§–B_¾ò|ˆ°‰…•ÁÑ•‘¹ÍÝ•Èˆéì‰ÑåÁ”ˆè‰¹ÍÝ•Èˆ°‰Ñ•áÐˆè‹–>¿’î—Ž¢.—žn»š‚š^Û¦^Ó¢úš^§Žš&¦rš^Û¦Vÿ¢ú¦Vÿ¾ò3žîOšzs’òkšb;ž†»š‚¢ºÃ’âëšb£–’§š"[šnÓš^§š^—šrŽ‰õô(€€€uô(€uô(€€ð½ÍÉ¥ÁÐø(ð½¡•…ø(ñ‰½‘äø(€€ñ„±…ÍÌô‰Í­¥Àµ±¥¹¬ˆ¡É•˜ôˆ…±Õ±…Ñ½Èˆû¢ÞÏ–"Ã¢º‡žº_–f ð½„ø(€€ñ¡•…‘•È±…ÍÌô‰Í¥Ñ”µ¡•…‘•Èˆøñ‘¥Ø±…ÍÌô‰Í¥Ñ”µ¡•…‘•É}}¥¹¹•Èˆøñ„±…ÍÌô‰‰É…¹ˆ¡É•˜ôˆ¸¸¼ˆøñÍÁ…¸±…ÍÌô‰‰É…¹‘}}µ…É¬ˆ…É¥„µ¡¥‘‘•¸ô‰ÑÉÕ”ˆûŠ^Üð½ÍÁ…¸øñÍÁ…¸ûžº_–"Ã–ƒž
ä€ñÍÁ…¸±…ÍÌô‰‰É…¹‘}}ÍÕ™™¥àˆû
Üƒš^Û¦^Óš:—¦údð½ÍÁ…¸øð½ÍÁ…¸øð½„øñ¹…Ø±…ÍÌô‰Í¥Ñ”µ¹…Øˆ…É¥„µ±…‰•°ô‹’âï¢š–¾ó¢"¨ˆøñ„¡É•˜ôˆ¸¸¼ÐÔµµ¥¹ÕÑ•Ìµ±…Ñ•È¼ˆûš^Û¦^Ó–*ƒ–<ð½„øñ„¡É•˜ôˆ¸¸½Ñ¥µ”µ¡…¥¸µ…±Õ±…Ñ½È¼ˆû–’kšº×žÒ¿¢º„ð½„øñ„±…ÍÌô‰¹…ØµÁÉ¥½É¥Ñäˆ…É¥„µÕÉÉ•¹Ðô‰Á…”ˆ¡É•˜ôˆ¸¼ˆû–Kš:£š^Û¦^Ðð½„øñ‰ÕÑÑ½¸±…ÍÌô‰Ñ¡•µ”µÑ½±”ˆÑåÁ”ô‰‰ÕÑÑ½¸ˆ‘…Ñ„µÑ¡•µ”µÑ½±”…É¥„µ±…‰•°ô‹–"š6‹šÞÇ¢&Ëš¢‡–ò<ˆûŠbøð½‰ÕÑÑ½¸øð½¹…Øøð½‘¥Øøð½¡•…‘•Èø(€€ñ‘¥Ø±…ÍÌô‰Á…”µÍ¡•±°ˆø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰¡•É¼ˆøñÀ±…ÍÌô‰•å•‰É½Üˆû–Kš:£š^Û¦^Ó¢º‡žº_–f ð½Àøñ Äû–þ¦†ï–ƒž
ç–"Ã¾ò–Kš:£–ƒž
ç–ò–ž,ð½ ÄøñÀû–#–†¯–g–þ¦†ï–"Ã¢úûš"[žîOšvžjš^Û¦^Ó¾ò3–7š2'–º{¦f¦†ë–ê?šÞï–*ƒ––’Ž¢Þ¿ž¢/–J3¦ŠžVgš^Û¦VÿŽžöGž®g’òk’î;žn»š‚š^Û¦^Ó–>7š:£–º3šVÓ¢º‡–"KŽð½ÀøñÀ±…ÍÌô‰¡•É½}}•á…µÁ±”ˆøÄäèÌÃ–"Ã¢úøƒŠ"Hƒ¢Þ¿ž¢,ÐÃ–"ƒŠ"Hƒ–s¢ö˜ÄÃ–"ƒŠ"Hƒš&/žî´ÌÃ–"ƒŠ"Hƒ¦ŠžVdÄ×–"€ô€ÄÜèÔ×–ò–ž,ð½Àøð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰Ñ½½°µ™É…µ”ˆ¥ô‰…±Õ±…Ñ½Èˆ…É¥„µ±…‰•°ô‹–Kš:£š^Û¦^Ó¢º‡žº_–f ˆøñ‘¥Ø‘…Ñ„µÑ¥µ”µ¡…¥¸µ…ÁÀ‘…Ñ„µÁÉ•Í•Ðô‰‰…­Ý…Éˆøð½‘¥Øøñ¹½ÍÉ¥ÁÐøñÀ±…ÍÌô‰¹½ÍÉ¥ÁÐµ¹½Ñ”ˆû¢º‡žº_–f£¦r¢š–ò–B¼)…Ù…MÉ¥ÁÓŽž’ë’ú/¾òhÄäèÌÃ–&7–"Ã¢úû¾ò3šïžR£š^Øä×–"¦J¾ò3šršfhÄÜèÔ×–ò–ž/Žð½Àøð½¹½ÍÉ¥ÁÐøð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰½¹Ñ•¹ÐµÍ•Ñ¥½¸ˆøñÀ±…ÍÌô‰•å•‰É½Üˆû–>7–BG–º'š:Hð½Àøñ Èû’î;’â7¢÷¢þ–"Ãžj¦
’â–"ï–ú–n{žº\ð½ ÈøñÀû–ššzpÄäèÌÃ–þ¦†ï–"Ã¢úû¾ò3¢Þ¿ž¢,ÐÃ–"¦JŽ–s¢ö˜ÄÃ–"¦JŽ–*{žBš&/žî´ÌÃ–"¦J¾ò3–7¦ŠžVdÄ×–"¦J¾ò3šï–Ç¦r¢šÇ–Â?š^ØÌ×–"¦J¾ò3–nƒš¶ÄÜèÔ×–êS¢¾—–ò–ž/Ž’þ»šRç’îïš?’âšº×¾ò3žîOšzs’òkž®/–6ÏšnÓšZÃŽð½Àøñ‘¥Ø±…ÍÌô‰•á…µÁ±”µÉ¥ˆøñ…ÉÑ¥±”±…ÍÌô‰•á…µÁ±”µ…Éˆøñ Ìûžn»š‚š^Û¦^Ðð½ ÌøñÀû–þ¦†ï–"Ã¢úûš"[–º3š"Cžjš^Û¦^Ðð½ÀøñÀ±…ÍÌô‰•á…µÁ±”µÉ•ÍÕ±ÐˆøÄäèÌÀð½Àøð½…ÉÑ¥±”øñ…ÉÑ¥±”±…ÍÌô‰•á…µÁ±”µ…Éˆøñ Ìû–£¦£žR£š^Øð½ ÌøñÀøÐÀ€¬€ÄÀ€¬€ÌÀ€¬€Ä×–"¦J|ð½ÀøñÀ±…ÍÌô‰•á…µÁ±”µÉ•ÍÕ±ÐˆøÇ–Â?š^ØÌ×–"ð½Àøð½…ÉÑ¥±”øñ…ÉÑ¥±”±…ÍÌô‰•á…µÁ±”µ…Éˆøñ Ìû–îë¢º»–ò–ž,ð½ ÌøñÀûžn»š‚š^Û¦^Ó–?–:ï–£¦£žR£š^Øð½ÀøñÀ±…ÍÌô‰•á…µÁ±”µÉ•ÍÕ±ÐˆøÄÜèÔÔð½Àøð½…ÉÑ¥±”øð½‘¥Øøð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰½¹Ñ•¹ÐµÍ•Ñ¥½¸ˆøñÀ±…ÍÌô‰•å•‰É½ÜˆûžVg–ë’ög¦<ð½Àøñ Èûš*+Šs¦ŠžVgš^Û¦^ÓŠw–6Wž.³–g–ëšv”ð½ ÈøñÀûšršfkš^Û¦^Ó–>«’þw¢¾–"k––÷–º3š"CŽ¢ÖÛ¦Ž{šrëŽ¢ÖÓžê›–J3¦7¢š¢¾ûž¢/šr––÷š*+–‚×¢ö›Žš:K¦bš"[’âÓš^Û–>c–2[’ös’âëž.³ž®/žj’âšº×¾ò3¢þgš‚ß¢÷šâš–kžr/¢ž¢«–ÞÇ–"Ã–êWžVg’ê–’k–ÂG’ög¦?Žð½ÀøñÀû–ššzsš~Cšº×¢Þ¿ž¢/–>¿¢÷¦r¢šÌÃ–"ÀÔÃ–"¦J¾ò3–>¿’î—š&O–òŠsš^Û¦^Ó¢2–nÓŠwŽ–Kš:£žîOšzs’òk–B3š^Ûšbûž’ëž¢Ï–š—–ò–ž/’â;šršfk–ò–ž/¾ò3¢3’â7šb¿žîg’â’â«žr/’òóžÊûž†»žjšVÃ–¶_Žð½Àøð½Í•Ñ¥½¸ø(€€€€ñÍ•Ñ¥½¸±…ÍÌô‰½¹Ñ•¹ÐµÍ•Ñ¥½¸ˆøñÀ±…ÍÌô‰•å•‰É½Üˆû–âã¢ž¦^»¦Š`ð½Àøñ Èû–Kš:£š^Û¦^Ó¦^»¦Š`ð½ Èøñ‘¥Ø±…ÍÌô‰™…Äµ±¥ÍÐˆøñ‘•Ñ…¥±ÌøñÍÕµµ…Éäû–Kš:£š^Û¦^Ó–J3–K¢º‡š^Ûšr'’î’æ#–2ë–"¯¾ò|ð½ÍÕµµ…ÉäøñÀû–K¢º‡š^Ûšbûž’ë¢Þwžšïš~C’â«š^Û–"ï¢þcšr'–’k’æ¾òo–Kš:£¢º‡žº_š‚çš6»–’k’â«š¶—¦ª“žjš^Û¦Vÿ¾ò3žº_–ëšršfk–êS¢¾—’öWš^Û–ò–ž/Žð½Àøð½‘•Ñ…¥±Ìøñ‘•Ñ…¥±ÌøñÍÕµµ…Éäû¦ŠžVgš^Û¦^Ó–êS¢¾—–*ƒ–r£–N«¦3¾ò|ð½ÍÕµµ…ÉäøñÀû–>¿’î—š*+¦ŠžVgš^Û¦^Ó’ös’âëž.³ž®/žj’âšº×–*ƒ–—Ž¢þgš‚ßš^‹¢÷žr/–"Ã–þ¢šžR£š^Û¾ò3’æ¢÷šâš–kž~—¦OžVg’ê–’k–ÂGžòO–ËŽð½Àøð½‘•Ñ…¥±Ìøñ‘•Ñ…¥±ÌøñÍÕµµ…Éäû–Kš:£žîOšzs–>¿’î—¢Þ£–"Ã–&7’â–’§–B_¾ò|ð½ÍÕµµ…ÉäøñÀû–>¿’î—Ž¢.—žn»š‚š^Û¦^Ó¢úš^§Žš&¦rš^Û¦Vÿ¢ú¦Vÿ¾ò3žîOšzs’òkšb;ž†»š‚¢ºÃ’âëšb£–’§š"[šnÓš^§š^—šrŽð½Àøð½‘•Ñ…¥±Ìøð½‘¥Øøð½Í•Ñ¥½¸ø(€€ð½‘¥Øø(€€ñ™½½Ñ•È±…ÍÌô‰Í¥Ñ”µ™½½Ñ•Èˆøñ‘¥Ø±…ÍÌô‰Í¥Ñ”µ™½½Ñ•É}}¥¹¹•Èˆøñ‘¥ØøñÍÑÉ½¹œûžº_–"Ã–ƒž
äð½ÍÑÉ½¹œøñ‰Èû–7¢Òçš^Û¦^Ó¢º‡žº_–Þ—–Üð½‘¥Øøñ‘¥Ø±…ÍÌô‰™½½Ñ•Èµ±¥¹­Ìˆøñ„¡É•˜ôˆ¸¸¼ˆû¦š[¦†Ôð½„øñ„¡É•˜ôˆ¸¸¼ÐÔµµ¥¹ÕÑ•Ìµ±…Ñ•È¼ˆûš^Û¦^Ó–*ƒ–<ð½„øñ„¡É•˜ôˆ¸¸½Ñ¥µ”µ¡…¥¸µ…±Õ±…Ñ½È¼ˆû–’kšº×žÒ¿¢º„ð½„øð½‘¥Øøñ‘¥Øû
¤€ÈÀÈØƒ
Üƒ–:–z/ž& ð½‘¥Øøð½‘¥Øøð½™½½Ñ•Èø(€€ñÍÉ¥ÁÐÍÉŒôˆ¸¸½…ÍÍ•ÑÌ½½¹™¥œ¹©Ìˆøð½ÍÉ¥ÁÐøñÍÉ¥ÁÐÍÉŒôˆ¸¸½…ÍÍ•ÑÌ½…ÁÀ¹©Ìˆøð½ÍÉ¥ÁÐø(ð½‰½‘äø(ð½¡Ñµ°ø(