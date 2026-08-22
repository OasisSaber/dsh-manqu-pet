window.__ModuleLoader__.load({
	id: "dsh-manqu-pet",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// .dsh-plugin/client/index.mjs
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// .dsh-plugin/client/atlas.mjs
var CELL_WIDTH = 192;
var CELL_HEIGHT = 208;
var COLUMNS = 8;
var FALLBACK_DURATION = 140;
var DIRECTION_COUNT = 16;
var ANGLE_STEP = Math.PI * 2 / DIRECTION_COUNT;
var STATE_DEFINITIONS = [
  ["idle", 0, 6, [280, 110, 110, 140, 140, 320]],
  ["running-right", 1, 8, [120, 120, 120, 120, 120, 120, 120, 220]],
  ["running-left", 2, 8, [120, 120, 120, 120, 120, 120, 120, 220]],
  ["waving", 3, 4, [140, 140, 140, 280]],
  ["jumping", 4, 5, [140, 140, 140, 140, 280]],
  ["failed", 5, 8, [140, 140, 140, 140, 140, 140, 140, 240]],
  ["waiting", 6, 6, [150, 150, 150, 150, 150, 260]],
  ["running", 7, 6, [120, 120, 120, 120, 120, 220]],
  ["review", 8, 6, [150, 150, 150, 150, 150, 280]],
  ["look-a", 9, 8, null],
  ["look-b", 10, 8, null]
];
var STATES = Object.freeze(
  STATE_DEFINITIONS.map(([id, row, defaultFrames, durations]) => Object.freeze({
    id,
    row,
    defaultFrames,
    ...durations ? { durations: Object.freeze(durations) } : { v2: true }
  }))
);
var STATE_BY_ID = new Map(STATES.map((state) => [state.id, state]));
function stateById(id) {
  return STATE_BY_ID.get(id) ?? STATES[0];
}
function validDimension(value) {
  return Number.isInteger(value) && value > 0;
}
function cellHasVisiblePixels(pixels, imageWidth, row, col) {
  if (!pixels || !validDimension(imageWidth) || !Number.isInteger(row) || row < 0 || !Number.isInteger(col) || col < 0) {
    return false;
  }
  const stride = imageWidth * 4;
  const imageHeight = Math.floor(pixels.length / stride);
  const left = col * CELL_WIDTH;
  const top = row * CELL_HEIGHT;
  const right = Math.min(left + CELL_WIDTH, imageWidth);
  const bottom = Math.min(top + CELL_HEIGHT, imageHeight);
  if (left >= right || top >= bottom) return false;
  for (let y = top; y < bottom; y += 4) {
    for (let x = left; x < right; x += 4) {
      const alphaOffset = y * stride + x * 4 + 3;
      if ((pixels[alphaOffset] ?? 0) > 8) return true;
    }
  }
  return false;
}
function detectPopulatedFrames(pixels, imageWidth, rows, cols = COLUMNS) {
  const rowCount = Number.isInteger(rows) && rows > 0 ? rows : 0;
  const colCount = Number.isInteger(cols) && cols > 0 ? Math.min(cols, COLUMNS) : 0;
  return Array.from({ length: rowCount }, (_, row) => {
    const frames = [];
    for (let col = 0; col < colCount; col += 1) {
      if (cellHasVisiblePixels(pixels, imageWidth, row, col)) frames.push(col);
    }
    return frames;
  });
}
function availableColumns(pet) {
  return Number.isInteger(pet?.cols) && pet.cols > 0 ? Math.min(pet.cols, COLUMNS) : 0;
}
function frameIndexesFor(state, pet) {
  if (!state || !pet || !Number.isInteger(pet.rows) || state.row < 0 || state.row >= pet.rows) return [];
  const maxColumns = availableColumns(pet);
  const detected = pet.populatedByRow?.[state.row];
  if (Array.isArray(detected) && detected.length > 0) {
    const seen = /* @__PURE__ */ new Set();
    return detected.filter((frame) => {
      if (!Number.isInteger(frame) || frame < 0 || frame >= maxColumns || seen.has(frame)) return false;
      seen.add(frame);
      return true;
    });
  }
  const fallbackCount = Math.max(0, Math.min(state.defaultFrames ?? 0, maxColumns));
  return Array.from({ length: fallbackCount }, (_, index) => index);
}
function durationFor(state, position) {
  if (!Array.isArray(state?.durations) || state.durations.length === 0) return FALLBACK_DURATION;
  const safePosition = Number.isFinite(position) ? Math.max(0, Math.floor(position)) : 0;
  return state.durations[Math.min(safePosition, state.durations.length - 1)] ?? FALLBACK_DURATION;
}
function defaultDirection() {
  return { index: 0, row: 9, frame: 0 };
}
function directionFor(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dx === 0 && dy === 0) return defaultDirection();
  const angle = Math.atan2(dx, -dy);
  const index = (Math.round(angle / ANGLE_STEP) % DIRECTION_COUNT + DIRECTION_COUNT) % DIRECTION_COUNT;
  return {
    index,
    row: index < COLUMNS ? 9 : 10,
    frame: index % COLUMNS
  };
}

// .dsh-plugin/src/state.mjs
var READY_MS = 10 * 60 * 1e3;
function pickBaseState(mood, now = Date.now()) {
  if (mood.failedUntil > now) return "failed";
  if (mood.celebrateUntil > now) return "jumping";
  if (mood.waiting === true) return "waiting";
  if (mood.readyUntil > now) return "review";
  if (mood.thinking === true) return "running";
  return "idle";
}

// .dsh-plugin/src/routes.mjs
var ROUTE_PREFIX = "/manqu";
var STATE_PATH = `${ROUTE_PREFIX}/state`;
var ASSETS_PATH = `${ROUTE_PREFIX}/assets`;
var EVENTS_PATH = `${ROUTE_PREFIX}/events`;

// .dsh-plugin/client/index.mjs
var ASSETS_URL = ASSETS_PATH;
var PET_HEIGHT = 150;
var DPR = Math.min(window.devicePixelRatio || 1, 3);
var REDUCED_MOTION = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
var LOOK_RADIUS = 520;
var LOOK_DEADZONE = 36;
var POLL_MS = 2e3;
var WANDER_MIN_WAIT = 2e4;
var WANDER_MAX_WAIT = 42e3;
var WANDER_SPEED = 46;
var TRANSIENT_HOLD_MS = 500;
var CSS = `
[data-dsh-manqu-pet] { position: fixed; z-index: 2147483000; user-select: none; touch-action: none; font-family: system-ui, sans-serif; }
[data-dsh-manqu-pet] canvas.pet-canvas { display: block; width: 100%; height: 100%; pointer-events: none;
  image-rendering: auto; filter: drop-shadow(0 6px 10px rgba(0,0,0,.28)); }
[data-dsh-manqu-pet] .pet-hitarea { position: absolute; inset: 0; cursor: grab; z-index: 2; }
[data-dsh-manqu-pet] .pet-hitarea.dragging { cursor: grabbing; }
[data-dsh-manqu-pet] .pet-status { position: absolute; left: 50%; top: calc(100% + 10px); transform: translateX(-50%);
  width: max-content; max-width: 240px; padding: 5px 9px; border-radius: 10px; z-index: 3;
  background: rgba(24,28,38,.94); border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 12px 32px rgba(0,0,0,.38); color: #E8EBF2; font-size: 11px; line-height: 16px;
  pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity .15s ease-out, visibility 0s linear .2s; }
[data-dsh-manqu-pet]:hover .pet-status { opacity: 1; visibility: visible; transition: opacity .2s ease-out; }
[data-dsh-manqu-pet] .pet-status .st { color: #B7C8FE; font-weight: 600; }
[data-dsh-manqu-pet] .pet-status .tt { color: #9aa3b2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
[data-dsh-manqu-pet] .pet-menu { position: absolute; left: 50%; top: calc(100% + 10px); transform: translateX(-50%);
  display: none; flex-direction: column; align-items: stretch; gap: 6px; min-width: 190px; max-width: 280px; padding: 6px; border-radius: 10px; z-index: 4;
  background: rgba(24,28,38,.96); border: 1px solid rgba(255,255,255,.12); box-shadow: 0 12px 32px rgba(0,0,0,.4); }
[data-dsh-manqu-pet] .pet-menu.open { display: flex; }
[data-dsh-manqu-pet] .pet-menu-actions { display: flex; gap: 6px; }
[data-dsh-manqu-pet] .pet-activities { display: none; flex-direction: column; gap: 2px; margin-bottom: 2px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,.10); }
[data-dsh-manqu-pet] .pet-activities:not(:empty) { display: flex; }
[data-dsh-manqu-pet] .pet-act-row { display: flex; align-items: center; gap: 6px; padding: 3px 5px; border-radius: 6px; cursor: pointer; max-width: 100%; }
[data-dsh-manqu-pet] .pet-act-row:hover { background: rgba(255,255,255,.10); }
[data-dsh-manqu-pet] .pet-act-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
[data-dsh-manqu-pet] .pet-act-dot.running { background: #5b8cff; box-shadow: 0 0 6px rgba(91,140,255,.8); }
[data-dsh-manqu-pet] .pet-act-dot.waiting { background: #f5a623; box-shadow: 0 0 6px rgba(245,166,35,.85); }
[data-dsh-manqu-pet] .pet-act-title { font-size: 11px; line-height: 15px; color: #cfd6e4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
[data-dsh-manqu-pet] .pet-menu button { border: 0; border-radius: 6px; padding: 4px 9px; font-size: 11px; cursor: pointer;
  background: rgba(255,255,255,.14); color: #E8EBF2; font-family: system-ui, sans-serif; white-space: nowrap; }
[data-dsh-manqu-pet] .pet-menu button:hover { background: rgba(255,255,255,.28); }
[data-dsh-manqu-pet] .pet-bubble { position: absolute; left: 50%; top: -12px; transform: translate(-50%, -100%);
  background: rgba(24,28,38,.94); color: #E8EBF2; font-size: 11px; padding: 4px 9px; border-radius: 10px;
  white-space: nowrap; pointer-events: none; z-index: 5; }
[data-dsh-manqu-pet][data-hidden] { display: none; }
[data-dsh-manqu-pet] .pet-restore { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  padding: 6px 12px; border-radius: 999px; cursor: pointer;
  background: rgba(24,28,38,.9); border: 1px solid rgba(255,255,255,.14); color: #E8EBF2; font-size: 12px;
  font-family: system-ui, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
@media (prefers-reduced-motion: reduce) { [data-dsh-manqu-pet] .pet-bubble { animation: none; } }
`;
var STORE = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }
};
function apply(ctx = {}) {
  if (document.querySelector("[data-dsh-manqu-pet]") !== null) {
    console.warn("[dsh-manqu-pet] apply \u5DF2\u5B58\u5728\u5B9E\u4F8B\uFF0C\u8DF3\u8FC7\u91CD\u590D\u6302\u8F7D");
    return () => {
    };
  }
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const host = document.createElement("div");
  host.setAttribute("data-dsh-manqu-pet", "");
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", "\u6EE1\u533A Manqu \u684C\u9762\u5BA0\u7269");
  host.style.cssText = `width: ${PET_HEIGHT * (CELL_WIDTH / CELL_HEIGHT)}px; height: ${PET_HEIGHT}px;`;
  document.body.appendChild(host);
  const canvas = document.createElement("canvas");
  canvas.className = "pet-canvas";
  canvas.width = CELL_WIDTH * DPR;
  canvas.height = CELL_HEIGHT * DPR;
  const hitarea = document.createElement("div");
  hitarea.className = "pet-hitarea";
  hitarea.setAttribute("role", "button");
  hitarea.setAttribute("tabindex", "0");
  hitarea.setAttribute("aria-label", "\u6EE1\u533A\uFF1A\u70B9\u51FB\u6253\u62DB\u547C\uFF0C\u53CC\u51FB\u8DF3\u8DC3\uFF0C\u62D6\u62FD\u79FB\u52A8\uFF0C\u53F3\u952E\u83DC\u5355");
  const status = document.createElement("div");
  status.className = "pet-status";
  status.innerHTML = '<span class="st">\u6EE1\u533A</span> \xB7 <span class="stt">\u5F85\u673A</span><div class="tt"></div>';
  const statusState = status.querySelector(".stt");
  const statusTitle = status.querySelector(".tt");
  const menu = document.createElement("div");
  menu.className = "pet-menu";
  const actList = document.createElement("div");
  actList.className = "pet-activities";
  const actionsRow = document.createElement("div");
  actionsRow.className = "pet-menu-actions";
  const btnWave = document.createElement("button");
  btnWave.textContent = "\u{1F44B} \u6253\u62DB\u547C";
  const btnJump = document.createElement("button");
  btnJump.textContent = "\u{1F998} \u8DF3\u4E00\u4E0B";
  const btnHide = document.createElement("button");
  btnHide.textContent = "\u{1F648} \u9690\u85CF";
  actionsRow.append(btnWave, btnJump, btnHide);
  menu.append(actList, actionsRow);
  host.append(canvas, hitarea, status, menu);
  const restore = document.createElement("div");
  restore.className = "pet-restore";
  restore.textContent = "\u{1F41B} \u6EE1\u533A";
  restore.style.display = "none";
  document.body.appendChild(restore);
  const vw = () => window.innerWidth;
  const clampX = (x2) => Math.max(8, Math.min(vw() - host.offsetWidth - 8, x2));
  let x = STORE.get("dsh-manqu-pet:x", 24);
  let y = STORE.get("dsh-manqu-pet:y", null);
  const applyPos = () => {
    x = clampX(x);
    host.style.left = `${x}px`;
    host.style.bottom = y === null ? "16px" : "auto";
    host.style.top = y === null ? "auto" : `${y}px`;
  };
  applyPos();
  let pet = null;
  let assetsReady = false;
  let loadError = null;
  const loadAssets = async () => {
    try {
      const manifestRes = await fetch(`${ASSETS_URL}/pet.json`, { cache: "no-cache" });
      if (!manifestRes.ok) throw new Error(`pet.json ${manifestRes.status}`);
      const manifest = await manifestRes.json();
      const sheetPath = manifest.spritesheetPath || "spritesheet.webp";
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("spritesheet \u52A0\u8F7D\u5931\u8D25"));
        img.src = `${ASSETS_URL}/${sheetPath}`;
      });
      const rows = Math.round(image.naturalHeight / CELL_HEIGHT);
      const cols = Math.round(image.naturalWidth / CELL_WIDTH);
      let populatedByRow = null;
      try {
        const probe = document.createElement("canvas");
        probe.width = image.naturalWidth;
        probe.height = image.naturalHeight;
        const pctx = probe.getContext("2d", { willReadFrequently: true });
        pctx.drawImage(image, 0, 0);
        const pixels = pctx.getImageData(0, 0, probe.width, probe.height).data;
        populatedByRow = detectPopulatedFrames(pixels, probe.width, rows, cols);
      } catch {
      }
      pet = { rows, cols, populatedByRow, image, displayName: manifest.displayName || "\u6EE1\u533A" };
      assetsReady = true;
      welcomeOnce();
    } catch (error) {
      loadError = error;
      console.warn("[dsh-manqu-pet] \u8D44\u4EA7\u52A0\u8F7D\u5931\u8D25\uFF1A", error);
    }
  };
  let mood = { thinking: false, waiting: false, celebrateUntil: 0, failedUntil: 0, readyUntil: 0, titles: [] };
  let seenReadyUntil = 0;
  let readyUnread = false;
  let shownBubbleKey = "";
  let refreshTimer = null;
  let refreshBusy = false;
  let eventSource = null;
  let welcomed = false;
  const welcomeOnce = () => {
    if (!welcomed && assetsReady) {
      welcomed = true;
      transient = { id: "waving", at: performance.now(), held: false };
    }
  };
  const refresh = async () => {
    if (refreshBusy) return;
    refreshBusy = true;
    try {
      const res = await fetch(STATE_PATH, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      if (body && typeof body === "object" && body.mood) {
        const m = body.mood;
        mood = {
          thinking: m.thinking === true,
          waiting: m.waiting === true,
          celebrateUntil: typeof m.celebrateUntil === "number" ? m.celebrateUntil : 0,
          failedUntil: typeof m.failedUntil === "number" ? m.failedUntil : 0,
          readyUntil: typeof m.readyUntil === "number" ? m.readyUntil : 0,
          titles: Array.isArray(m.titles) ? m.titles : []
        };
        if (mood.readyUntil > seenReadyUntil) {
          seenReadyUntil = mood.readyUntil;
          readyUnread = true;
        }
        renderActivities(Array.isArray(body.activities) ? body.activities : []);
        const b = body.bubble;
        if (b !== null && typeof b === "object" && typeof b.until === "number" && b.until > Date.now()) {
          const key = `${b.kind}:${b.text}:${b.until}`;
          if (key !== shownBubbleKey) {
            shownBubbleKey = key;
            bubble(b.text, 3600);
          }
        }
        if (m.thinking === true && m.waiting !== true && m.celebrateUntil <= Date.now() && m.failedUntil <= Date.now()) {
          if (mood.titles.length) {
            statusTitle.textContent = mood.titles[0];
            statusTitle.style.display = "";
          } else {
            statusTitle.textContent = "";
          }
        } else {
          statusTitle.textContent = "";
          statusTitle.style.display = "none";
        }
        welcomeOnce();
      }
    } catch {
    } finally {
      refreshBusy = false;
    }
  };
  let dragging = false;
  let dragDir = 1;
  let look = null;
  let transient = null;
  let wander = null;
  let framePos = 0;
  let frameAt = 0;
  let playbackId = null;
  const baseMood = () => readyUnread ? mood : { ...mood, readyUntil: 0 };
  const resolvePlayback = (now) => {
    if (!assetsReady || pet === null) return null;
    if (dragging) {
      const id = dragDir >= 0 ? "running-right" : "running-left";
      const st2 = stateById(id);
      const frames2 = frameIndexesFor(st2, pet);
      if (!frames2.length) return null;
      return { id, row: st2.row, frames: frames2, once: false, hold: false };
    }
    if (look !== null && look.row < pet.rows) {
      return { id: "look", row: look.row, frames: [look.frame], once: false, hold: true };
    }
    if (transient !== null) {
      const st2 = stateById(transient.id);
      const frames2 = frameIndexesFor(st2, pet);
      if (!frames2.length) return null;
      const once = true;
      return { id: transient.id, row: st2.row, frames: frames2, once, hold: false };
    }
    let base = pickBaseState(baseMood(), now);
    if (base === "idle" && wander !== null && wander.until > now && y === null) {
      const id = wander.dir >= 0 ? "running-right" : "running-left";
      const st2 = stateById(id);
      const frames2 = frameIndexesFor(st2, pet);
      if (frames2.length) return { id, row: st2.row, frames: frames2, once: false, hold: false };
      base = "idle";
    }
    const st = stateById(base);
    const frames = frameIndexesFor(st, pet);
    if (!frames.length) return null;
    return { id: base, row: st.row, frames, once: false, hold: false };
  };
  const ctx2d = canvas.getContext("2d");
  ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
  const drawFrame = (row, frame) => {
    if (!assetsReady || pet === null) return;
    ctx2d.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
    ctx2d.drawImage(pet.image, frame * CELL_WIDTH, row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
  };
  const stateLabel = (id) => ({ idle: "\u5F85\u673A", running: "\u5DE5\u4F5C\u4E2D", waiting: "\u7B49\u4F60\u6279\u51C6", jumping: "\u5E86\u795D", failed: "\u5931\u843D", review: "\u6709\u672A\u8BFB\u6D3B\u52A8", waving: "\u6253\u62DB\u547C", "running-right": "\u5411\u53F3\u8815\u52A8", "running-left": "\u5411\u5DE6\u8815\u52A8", look: "\u770B\u7740\u4F60" })[id] || id;
  const tick = (ts) => {
    requestAnimationFrame(tick);
    const now = Date.now();
    if (transient !== null && (REDUCED_MOTION || transient.held && now > transient.at + TRANSIENT_HOLD_MS)) transient = null;
    const pb = resolvePlayback(now);
    if (pb === null) return;
    const label = pb.id === "look" ? look !== null ? "\u770B\u7740\u4F60" : "\u5F85\u673A" : stateLabel(pb.id);
    if (statusState.textContent !== label) statusState.textContent = label;
    if (REDUCED_MOTION) {
      drawFrame(pb.row, pb.frames[0]);
      return;
    }
    if (playbackId !== pb.id + ":" + pb.row + ":" + pb.frames.join(",")) {
      playbackId = pb.id + ":" + pb.row + ":" + pb.frames.join(",");
      framePos = 0;
      frameAt = ts;
    }
    const elapsed = ts - frameAt;
    const duration = durationFor(stateById(pb.id === "look" ? "idle" : pb.id), framePos);
    let frame = pb.frames[framePos];
    if (elapsed >= duration) {
      frameAt = ts;
      if (pb.once) {
        if (framePos < pb.frames.length - 1) {
          framePos += 1;
          frame = pb.frames[framePos];
        } else if (transient !== null && !transient.held) {
          transient.held = true;
          transient.at = now;
        }
      } else {
        framePos = (framePos + 1) % pb.frames.length;
        frame = pb.frames[framePos];
      }
    }
    drawFrame(pb.row, frame);
  };
  let wanderTimer = null;
  const scheduleWander = () => {
    clearTimeout(wanderTimer);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const wait = WANDER_MIN_WAIT + Math.random() * (WANDER_MAX_WAIT - WANDER_MIN_WAIT);
    wanderTimer = setTimeout(() => {
      if (dragging || transient !== null || look !== null) {
        scheduleWander();
        return;
      }
      const base = pickBaseState(baseMood(), Date.now());
      if (base !== "idle" || y !== null) {
        scheduleWander();
        return;
      }
      const dir = Math.random() < 0.5 ? -1 : 1;
      const dur = 2500 + Math.random() * 2500;
      wander = { dir, until: Date.now() + dur };
      const step = () => {
        if (wander === null) return;
        if (Date.now() >= wander.until || dragging || look !== null) {
          wander = null;
          scheduleWander();
          return;
        }
        const delta = dir * WANDER_SPEED * 0.1;
        x = clampX(x + delta);
        applyPos();
        wanderStepTimer = setTimeout(step, 100);
      };
      clearTimeout(wanderStepTimer);
      wanderStepTimer = setTimeout(step, 100);
    }, wait);
  };
  let wanderStepTimer = null;
  let press = null;
  const onPointerDown = (e) => {
    if (e.button !== void 0 && e.button !== 0) return;
    const rect = host.getBoundingClientRect();
    press = { px: e.clientX, py: e.clientY, moved: false, startX: e.clientX, startY: e.clientY, startT: Date.now(), startLeft: rect.left, startTop: rect.top };
    e.preventDefault();
    hitarea.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (press !== null) {
      const dx = e.clientX - press.px;
      const dy = e.clientY - press.py;
      if (!press.moved && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) > 6) press.moved = true;
      if (press.moved) {
        if (!dragging) {
          dragging = true;
          hitarea.classList.add("dragging");
          closeMenu();
          dragDir = e.clientX >= press.startX ? 1 : -1;
        } else {
          dragDir = dx >= 0 ? 1 : -1;
        }
        x = clampX(e.clientX - host.offsetWidth / 2);
        const ny = e.clientY - host.offsetHeight / 2;
        y = Math.max(4, Math.min(window.innerHeight - host.offsetHeight - 4, ny));
        applyPos();
      }
      press.px = e.clientX;
      press.py = e.clientY;
      return;
    }
    if (dragging || transient !== null) {
      look = null;
      return;
    }
    const rect = host.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dxp = e.clientX - cx;
    const dyp = e.clientY - cy;
    const dist = Math.hypot(dxp, dyp);
    const base = pickBaseState(baseMood(), Date.now());
    if (dist < LOOK_DEADZONE || dist > LOOK_RADIUS || base !== "idle" || wander !== null) {
      look = null;
      return;
    }
    const d = directionFor(dxp, dyp);
    if (d.row < pet?.rows) look = { row: d.row, frame: d.frame };
  };
  const onPointerUp = (e) => {
    if (press === null) return;
    const wasDrag = dragging;
    const moved = press.moved;
    const startT = press.startT;
    press = null;
    if (wasDrag) {
      dragging = false;
      hitarea.classList.remove("dragging");
      STORE.set("dsh-manqu-pet:x", x);
      STORE.set("dsh-manqu-pet:y", y);
      return;
    }
    readyUnread = false;
    const now = Date.now();
    if (moved) return;
    if (now - startT > 500) return;
    if (now - lastClickAt < 400) {
      clearTimeout(clickTimer);
      lastClickAt = 0;
      transient = { id: "jumping", at: Date.now(), held: false };
      bubble("\u8036\uFF01");
      return;
    }
    lastClickAt = now;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      transient = { id: "waving", at: Date.now(), held: false };
      bubble("\u55E8\uFF5E");
    }, 400);
  };
  const onContextMenu = (e) => {
    e.preventDefault();
    const open = !menu.classList.contains("open");
    if (open) {
      menu.classList.add("open");
      menu.style.display = "flex";
    } else {
      closeMenu();
    }
  };
  const closeMenu = () => {
    menu.classList.remove("open");
    menu.style.display = "none";
  };
  const onDocPointerDown = (e) => {
    if (menu.classList.contains("open") && !menu.contains(e.target) && e.target !== hitarea) closeMenu();
  };
  let lastClickAt = 0;
  let clickTimer = null;
  const bubble = (text, ms = 1600) => {
    const old = host.querySelector(".pet-bubble");
    if (old) old.remove();
    const b = document.createElement("div");
    b.className = "pet-bubble";
    b.textContent = text;
    host.appendChild(b);
    setTimeout(() => b.remove(), ms);
  };
  const renderActivities = (rows) => {
    actList.replaceChildren();
    for (const row of rows.slice(0, 6)) {
      if (row === null || typeof row !== "object") continue;
      const item = document.createElement("div");
      item.className = "pet-act-row";
      const dot = document.createElement("span");
      dot.className = `pet-act-dot ${row.state === "waiting" ? "waiting" : "running"}`;
      const label = document.createElement("span");
      label.className = "pet-act-title";
      label.textContent = typeof row.title === "string" && row.title ? row.title : typeof row.sessionId === "string" ? row.sessionId : "\u4EFB\u52A1";
      item.title = label.textContent;
      item.append(dot, label);
      item.addEventListener("click", () => {
        readyUnread = false;
        closeMenu();
      });
      actList.appendChild(item);
    }
  };
  btnWave.addEventListener("click", () => {
    closeMenu();
    transient = { id: "waving", at: Date.now(), held: false };
    bubble("\u55E8\uFF5E");
  });
  btnJump.addEventListener("click", () => {
    closeMenu();
    transient = { id: "jumping", at: Date.now(), held: false };
    bubble("\u8036\uFF01");
  });
  btnHide.addEventListener("click", () => {
    closeMenu();
    host.setAttribute("data-hidden", "");
    restore.style.display = "";
    STORE.set("dsh-manqu-pet:hidden", true);
  });
  restore.addEventListener("click", () => {
    host.removeAttribute("data-hidden");
    restore.style.display = "none";
    STORE.set("dsh-manqu-pet:hidden", false);
    transient = { id: "waving", at: Date.now(), held: false };
  });
  const onKeyDown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (document.activeElement !== hitarea) return;
    e.preventDefault();
    readyUnread = false;
    transient = { id: "waving", at: Date.now(), held: false };
    bubble("\u55E8\uFF5E");
  };
  const clearLook = () => {
    look = null;
  };
  hitarea.addEventListener("pointerdown", onPointerDown);
  hitarea.addEventListener("pointermove", onPointerMove);
  hitarea.addEventListener("pointerup", onPointerUp);
  hitarea.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointerdown", onDocPointerDown);
  hitarea.addEventListener("contextmenu", onContextMenu);
  hitarea.addEventListener("keydown", onKeyDown);
  document.documentElement.addEventListener("mouseleave", clearLook);
  window.addEventListener("blur", clearLook);
  if (STORE.get("dsh-manqu-pet:hidden", false) === true) {
    host.setAttribute("data-hidden", "");
    restore.style.display = "";
  }
  const onResize = () => {
    x = clampX(x);
    if (y !== null) y = Math.max(4, Math.min(window.innerHeight - host.offsetHeight - 4, y));
    applyPos();
  };
  window.addEventListener("resize", onResize);
  refreshTimer = setInterval(refresh, POLL_MS);
  try {
    eventSource = new EventSource(EVENTS_PATH);
    eventSource.onmessage = () => refresh();
  } catch {
  }
  loadAssets();
  refresh();
  requestAnimationFrame(tick);
  scheduleWander();
  return () => {
    clearInterval(refreshTimer);
    clearTimeout(wanderTimer);
    clearTimeout(wanderStepTimer);
    eventSource?.close();
    host.remove();
    restore.remove();
    style.remove();
    document.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointerdown", onDocPointerDown);
    document.documentElement.removeEventListener("mouseleave", clearLook);
    window.removeEventListener("blur", clearLook);
    window.removeEventListener("resize", onResize);
  };
}
var name = "dsh-manqu-pet";
		return module.exports;
	}
});
