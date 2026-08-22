// dsh-manqu-pet 浏览器 half：CodexPet v2 图集宠物渲染层（纯 DOM 自渲染，A 模式——GUI 内悬浮宠物）。
// 标准 bundle client 形态（0811）：exports { name, apply } 经 __ModuleLoader__.load 注册，
// 由 client 内核挂载时调用 apply(ctx)。ctx 仅作占位（情绪经 /manqu/state 轮询 + SSE 获取）。
//
// 玩法（忠实 CodexPet 移植）：
// - 待机眨眼（idle 行，Codex 官方逐帧时长表）
// - 会话思考 → running（工作行）；等待批准 → waiting；回合/任务完成 → jumping 庆祝，庆祝后未读活动 → review（单击已读）；失败 → failed 失落
// - 鼠标靠近 → 视线跟随（look-a/look-b 行，16 方向）；点击 → 挥手；双击 → 跳跃
// - 拖拽 → 一拱一拱地蠕动（running-left/right 快放，方向随拖拽）；放下回待机
// - 空闲时随机散步（running-left/right 横移）；右键菜单（活动托盘 + 打招呼/跳一下/隐藏）
// - 任务完成/失败 → 气泡显示结果摘要（jobs detail，label 兜底）
// 状态选择：本地交互（拖拽 > 视线 > 瞬发）覆盖基础情绪状态（失败 > 庆祝 > 等待 > 未读 > 思考 > 待机）。

import { CELL_WIDTH, CELL_HEIGHT, COLUMNS, stateById, frameIndexesFor, durationFor, directionFor, detectPopulatedFrames } from './atlas.mjs'
import { pickBaseState } from '../src/state.mjs'
import { STATE_PATH, ASSETS_PATH, EVENTS_PATH } from '../src/routes.mjs'

const ASSETS_URL = ASSETS_PATH
const PET_HEIGHT = 150 // 显示高度 px（192×208 格按比例缩放）
const DPR = Math.min(window.devicePixelRatio || 1, 3) // 物理像素倍率（上限 3，防高 DPI 内存失控）
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const LOOK_RADIUS = 520 // 视线跟随半径 px
const LOOK_DEADZONE = 36 // 光标极近 → 中性（不看）
const POLL_MS = 2000
const WANDER_MIN_WAIT = 20000
const WANDER_MAX_WAIT = 42000
const WANDER_SPEED = 46 // px/s
const DRAG_FRAME_MS = 90 // 拖拽蠕动帧间隔
const TRANSIENT_HOLD_MS = 500 // once 播完保持末帧再回基础态

const CSS = `
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
`

const STORE = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch { return fallback }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 存储不可用时仅本次有效 */ }
  },
}

export function apply(ctx = {}) {
  if (document.querySelector('[data-dsh-manqu-pet]') !== null) {
    console.warn('[dsh-manqu-pet] apply 已存在实例，跳过重复挂载')
    return () => {}
  }

  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const host = document.createElement('div')
  host.setAttribute('data-dsh-manqu-pet', '')
  host.setAttribute('role', 'group')
  host.setAttribute('aria-label', '满区 Manqu 桌面宠物')
  host.style.cssText = `width: ${PET_HEIGHT * (CELL_WIDTH / CELL_HEIGHT)}px; height: ${PET_HEIGHT}px;`
  document.body.appendChild(host)

  const canvas = document.createElement('canvas')
  canvas.className = 'pet-canvas'
  canvas.width = CELL_WIDTH * DPR
  canvas.height = CELL_HEIGHT * DPR
  const hitarea = document.createElement('div')
  hitarea.className = 'pet-hitarea'
  hitarea.setAttribute('role', 'button')
  hitarea.setAttribute('tabindex', '0')
  hitarea.setAttribute('aria-label', '满区：点击打招呼，双击跳跃，拖拽移动，右键菜单')
  const status = document.createElement('div')
  status.className = 'pet-status'
  status.innerHTML = '<span class="st">满区</span> · <span class="stt">待机</span><div class="tt"></div>'
  const statusState = status.querySelector('.stt')
  const statusTitle = status.querySelector('.tt')
  const menu = document.createElement('div')
  menu.className = 'pet-menu'
  const actList = document.createElement('div')
  actList.className = 'pet-activities'
  const actionsRow = document.createElement('div')
  actionsRow.className = 'pet-menu-actions'
  const btnWave = document.createElement('button'); btnWave.textContent = '👋 打招呼'
  const btnJump = document.createElement('button'); btnJump.textContent = '🦘 跳一下'
  const btnHide = document.createElement('button'); btnHide.textContent = '🙈 隐藏'
  actionsRow.append(btnWave, btnJump, btnHide)
  menu.append(actList, actionsRow)
  host.append(canvas, hitarea, status, menu)
  const restore = document.createElement('div')
  restore.className = 'pet-restore'
  restore.textContent = '🐛 满区'
  restore.style.display = 'none'
  document.body.appendChild(restore)

  // ---- 位置 ----
  const vw = () => window.innerWidth
  const clampX = (x) => Math.max(8, Math.min(vw() - host.offsetWidth - 8, x))
  let x = STORE.get('dsh-manqu-pet:x', 24)
  let y = STORE.get('dsh-manqu-pet:y', null) // null = 贴底
  const applyPos = () => {
    x = clampX(x)
    host.style.left = `${x}px`
    host.style.bottom = y === null ? '16px' : 'auto'
    host.style.top = y === null ? 'auto' : `${y}px`
  }
  applyPos()

  // ---- 资产加载与帧分析 ----
  let pet = null // { rows, cols, populatedByRow, image }
  let assetsReady = false
  let loadError = null
  const loadAssets = async () => {
    try {
      const manifestRes = await fetch(`${ASSETS_URL}/pet.json`, { cache: 'no-cache' })
      if (!manifestRes.ok) throw new Error(`pet.json ${manifestRes.status}`)
      const manifest = await manifestRes.json()
      const sheetPath = manifest.spritesheetPath || 'spritesheet.webp'
      const image = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('spritesheet 加载失败'))
        img.src = `${ASSETS_URL}/${sheetPath}`
      })
      const rows = Math.round(image.naturalHeight / CELL_HEIGHT)
      const cols = Math.round(image.naturalWidth / CELL_WIDTH)
      // 像素分析：检测每行已填充帧（透明空帧不播放，与官方 Codex 播放器一致）。
      let populatedByRow = null
      try {
        const probe = document.createElement('canvas')
        probe.width = image.naturalWidth
        probe.height = image.naturalHeight
        const pctx = probe.getContext('2d', { willReadFrequently: true })
        pctx.drawImage(image, 0, 0)
        const pixels = pctx.getImageData(0, 0, probe.width, probe.height).data
        populatedByRow = detectPopulatedFrames(pixels, probe.width, rows, cols)
      } catch { /* 像素分析不可用 → 用 defaultFrames */ }
      pet = { rows, cols, populatedByRow, image, displayName: manifest.displayName || '满区' }
      assetsReady = true
      welcomeOnce() // 资产就绪后挥手一次
    } catch (error) {
      loadError = error
      console.warn('[dsh-manqu-pet] 资产加载失败：', error)
    }
  }

  // ---- 情绪（/state 轮询 + SSE）----
  let mood = { thinking: false, waiting: false, celebrateUntil: 0, failedUntil: 0, readyUntil: 0, titles: [] }
  let seenReadyUntil = 0 // 已读水位：见过的最大 readyUntil（新完成事件会推高它）
  let readyUnread = false // Ready 未读标记；单击宠物即视为已读
  let shownBubbleKey = '' // 已展示过的气泡载荷键（避免轮询重复弹）
  let refreshTimer = null
  let refreshBusy = false
  let eventSource = null
  let welcomed = false
  const welcomeOnce = () => {
    if (!welcomed && assetsReady) {
      welcomed = true
      transient = { id: 'waving', at: performance.now(), held: false }
    }
  }
  const refresh = async () => {
    if (refreshBusy) return
    refreshBusy = true
    try {
      const res = await fetch(STATE_PATH, { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json()
      if (body && typeof body === 'object' && body.mood) {
        const m = body.mood
        mood = {
          thinking: m.thinking === true,
          waiting: m.waiting === true,
          celebrateUntil: typeof m.celebrateUntil === 'number' ? m.celebrateUntil : 0,
          failedUntil: typeof m.failedUntil === 'number' ? m.failedUntil : 0,
          readyUntil: typeof m.readyUntil === 'number' ? m.readyUntil : 0,
          titles: Array.isArray(m.titles) ? m.titles : [],
        }
        if (mood.readyUntil > seenReadyUntil) {
          seenReadyUntil = mood.readyUntil
          readyUnread = true
        }
        // 活动托盘 + 完成气泡（/state 顶层字段）
        renderActivities(Array.isArray(body.activities) ? body.activities : [])
        const b = body.bubble
        if (b !== null && typeof b === 'object' && typeof b.until === 'number' && b.until > Date.now()) {
          const key = `${b.kind}:${b.text}:${b.until}`
          if (key !== shownBubbleKey) {
            shownBubbleKey = key
            bubble(b.text, 3600)
          }
        }
        if (m.thinking === true && m.waiting !== true && m.celebrateUntil <= Date.now() && m.failedUntil <= Date.now()) {
          if (mood.titles.length) {
            statusTitle.textContent = mood.titles[0]
            statusTitle.style.display = ''
          } else {
            statusTitle.textContent = ''
          }
        } else {
          statusTitle.textContent = ''
          statusTitle.style.display = 'none'
        }
        welcomeOnce()
      }
    } catch { /* 瞬态错误：下轮重试 */ } finally {
      refreshBusy = false
    }
  }

  // ---- 播放引擎 ----
  let dragging = false
  let dragDir = 1 // 1 = 右
  let look = null // { row, frame } 或 null
  let transient = null // { id, at, held }
  let wander = null // { dir, until, targetX }
  let framePos = 0 // 当前帧在 frames 里的位置
  let frameAt = 0
  let playbackId = null // 当前播放标识（每次换状态重置帧位置）

  // 基础情绪态（失败 > 庆祝 > 等待 > 未读 > 思考 > 待机）由 src/state.mjs pickBaseState 单一来源提供。

  // 「已读」裁决：未读时原样进入 pickBaseState（Ready→review 生效）；已读则把 readyUntil 折算为 0。
  const baseMood = () => (readyUnread ? mood : { ...mood, readyUntil: 0 })

  // 解析当前播放目标（返回 { id, row, frames, once }；null = 不播）。
  const resolvePlayback = (now) => {
    if (!assetsReady || pet === null) return null
    if (dragging) {
      const id = dragDir >= 0 ? 'running-right' : 'running-left'
      const st = stateById(id)
      const frames = frameIndexesFor(st, pet)
      if (!frames.length) return null
      return { id, row: st.row, frames, once: false, hold: false }
    }
    if (look !== null && look.row < pet.rows) {
      return { id: 'look', row: look.row, frames: [look.frame], once: false, hold: true }
    }
    if (transient !== null) {
      const st = stateById(transient.id)
      const frames = frameIndexesFor(st, pet)
      if (!frames.length) return null
      const once = true
      return { id: transient.id, row: st.row, frames, once, hold: false }
    }
    let base = pickBaseState(baseMood(), now)
    // 散步：仅基础态为 idle 且贴底时
    if (base === 'idle' && wander !== null && wander.until > now && y === null) {
      const id = wander.dir >= 0 ? 'running-right' : 'running-left'
      const st = stateById(id)
      const frames = frameIndexesFor(st, pet)
      if (frames.length) return { id, row: st.row, frames, once: false, hold: false }
      base = 'idle'
    }
    const st = stateById(base)
    const frames = frameIndexesFor(st, pet)
    if (!frames.length) return null
    return { id: base, row: st.row, frames, once: false, hold: false }
  }

  const ctx2d = canvas.getContext('2d')
  ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0) // 绘制逻辑坐标保持 192×208
  const drawFrame = (row, frame) => {
    if (!assetsReady || pet === null) return
    ctx2d.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
    ctx2d.drawImage(pet.image, frame * CELL_WIDTH, row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT)
  }

  const stateLabel = (id) => ({ idle: '待机', running: '工作中', waiting: '等你批准', jumping: '庆祝', failed: '失落', review: '有未读活动', waving: '打招呼', 'running-right': '向右蠕动', 'running-left': '向左蠕动', look: '看着你' })[id] || id

  const tick = (ts) => {
    requestAnimationFrame(tick)
    const now = Date.now()
    // 瞬发超时复位（once 播完保持后回基础态）；定格模式不播瞬发动作
    if (transient !== null && (REDUCED_MOTION || (transient.held && now > transient.at + TRANSIENT_HOLD_MS))) transient = null
    const pb = resolvePlayback(now)
    if (pb === null) return
    const label = pb.id === 'look' ? (look !== null ? '看着你' : '待机') : stateLabel(pb.id)
    if (statusState.textContent !== label) statusState.textContent = label
    // reduced-motion：对齐官方语义——静帧替代动画，定格当前状态首帧、不推进帧
    if (REDUCED_MOTION) {
      drawFrame(pb.row, pb.frames[0])
      return
    }
    if (playbackId !== pb.id + ':' + pb.row + ':' + pb.frames.join(',')) {
      playbackId = pb.id + ':' + pb.row + ':' + pb.frames.join(',')
      framePos = 0
      frameAt = ts
    }
    const elapsed = ts - frameAt
    const duration = durationFor(stateById(pb.id === 'look' ? 'idle' : pb.id), framePos)
    let frame = pb.frames[framePos]
    if (elapsed >= duration) {
      frameAt = ts
      if (pb.once) {
        if (framePos < pb.frames.length - 1) {
          framePos += 1
          frame = pb.frames[framePos]
        } else if (transient !== null && !transient.held) {
          transient.held = true
          transient.at = now
        }
      } else {
        framePos = (framePos + 1) % pb.frames.length
        frame = pb.frames[framePos]
      }
    }
    drawFrame(pb.row, frame)
  }

  // ---- 散步调度 ----
  let wanderTimer = null
  const scheduleWander = () => {
    clearTimeout(wanderTimer)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const wait = WANDER_MIN_WAIT + Math.random() * (WANDER_MAX_WAIT - WANDER_MIN_WAIT)
    wanderTimer = setTimeout(() => {
      if (dragging || transient !== null || look !== null) { scheduleWander(); return }
      const base = pickBaseState(baseMood(), Date.now())
      if (base !== 'idle' || y !== null) { scheduleWander(); return }
      const dir = Math.random() < 0.5 ? -1 : 1
      const dur = 2500 + Math.random() * 2500
      wander = { dir, until: Date.now() + dur }
      const step = () => {
        if (wander === null) return
        if (Date.now() >= wander.until || dragging || look !== null) { wander = null; scheduleWander(); return }
        const delta = dir * WANDER_SPEED * 0.1
        x = clampX(x + delta)
        applyPos()
        wanderStepTimer = setTimeout(step, 100)
      }
      clearTimeout(wanderStepTimer)
      wanderStepTimer = setTimeout(step, 100)
    }, wait)
  }
  let wanderStepTimer = null

  // ---- 交互 ----
  let press = null // { px, py, moved, dragging, startX, startY, startT }
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    const rect = host.getBoundingClientRect()
    press = { px: e.clientX, py: e.clientY, moved: false, startX: e.clientX, startY: e.clientY, startT: Date.now(), startLeft: rect.left, startTop: rect.top }
    e.preventDefault()
    hitarea.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (press !== null) {
      const dx = e.clientX - press.px
      const dy = e.clientY - press.py
      if (!press.moved && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) > 6) press.moved = true
      if (press.moved) {
        if (!dragging) {
          dragging = true
          hitarea.classList.add('dragging')
          closeMenu()
          dragDir = e.clientX >= press.startX ? 1 : -1
        } else {
          dragDir = dx >= 0 ? 1 : -1
        }
        x = clampX(e.clientX - host.offsetWidth / 2)
        const ny = e.clientY - host.offsetHeight / 2
        y = Math.max(4, Math.min(window.innerHeight - host.offsetHeight - 4, ny))
        applyPos()
      }
      press.px = e.clientX
      press.py = e.clientY
      return
    }
    // 视线跟随（非拖拽时）
    if (dragging || transient !== null) { look = null; return }
    const rect = host.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dxp = e.clientX - cx
    const dyp = e.clientY - cy
    const dist = Math.hypot(dxp, dyp)
    const base = pickBaseState(baseMood(), Date.now())
    if (dist < LOOK_DEADZONE || dist > LOOK_RADIUS || base !== 'idle' || wander !== null) {
      look = null
      return
    }
    const d = directionFor(dxp, dyp)
    if (d.row < pet?.rows) look = { row: d.row, frame: d.frame }
  }
  const onPointerUp = (e) => {
    if (press === null) return
    const wasDrag = dragging
    const moved = press.moved
    const startT = press.startT
    press = null
    if (wasDrag) {
      dragging = false
      hitarea.classList.remove('dragging')
      STORE.set('dsh-manqu-pet:x', x)
      STORE.set('dsh-manqu-pet:y', y)
      return
    }
    // 单击已读：非拖拽的按下-抬起视为查看过当前活动（Ready→review 沉降）
    readyUnread = false
    // 单击 → 挥手（延迟确认无双击）；双击（400ms 内两次）→ 跳跃
    const now = Date.now()
    if (moved) return
    if (now - startT > 500) return
    if (now - lastClickAt < 400) {
      // 双击：取消已排队的挥手，改跳
      clearTimeout(clickTimer)
      lastClickAt = 0
      transient = { id: 'jumping', at: Date.now(), held: false }
      bubble('耶！')
      return
    }
    lastClickAt = now
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      transient = { id: 'waving', at: Date.now(), held: false }
      bubble('嗨～')
    }, 400)
  }
  const onContextMenu = (e) => {
    e.preventDefault()
    const open = !menu.classList.contains('open')
    if (open) { menu.classList.add('open'); menu.style.display = 'flex' } else { closeMenu() }
  }
  const closeMenu = () => {
    menu.classList.remove('open')
    menu.style.display = 'none'
  }
  const onDocPointerDown = (e) => {
    if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== hitarea) closeMenu()
  }
  let lastClickAt = 0
  let clickTimer = null
  const bubble = (text, ms = 1600) => {
    const old = host.querySelector('.pet-bubble')
    if (old) old.remove()
    const b = document.createElement('div')
    b.className = 'pet-bubble'
    b.textContent = text
    host.appendChild(b)
    setTimeout(() => b.remove(), ms)
  }
  // 活动托盘：状态点 + 标题（宿主暂无会话导航 API，点击仅视为已读并关闭菜单）。
  const renderActivities = (rows) => {
    actList.replaceChildren()
    for (const row of rows.slice(0, 6)) {
      if (row === null || typeof row !== 'object') continue
      const item = document.createElement('div')
      item.className = 'pet-act-row'
      const dot = document.createElement('span')
      dot.className = `pet-act-dot ${row.state === 'waiting' ? 'waiting' : 'running'}`
      const label = document.createElement('span')
      label.className = 'pet-act-title'
      label.textContent = typeof row.title === 'string' && row.title ? row.title : (typeof row.sessionId === 'string' ? row.sessionId : '任务')
      item.title = label.textContent
      item.append(dot, label)
      item.addEventListener('click', () => { readyUnread = false; closeMenu() })
      actList.appendChild(item)
    }
  }
  btnWave.addEventListener('click', () => { closeMenu(); transient = { id: 'waving', at: Date.now(), held: false }; bubble('嗨～') })
  btnJump.addEventListener('click', () => { closeMenu(); transient = { id: 'jumping', at: Date.now(), held: false }; bubble('耶！') })
  btnHide.addEventListener('click', () => {
    closeMenu()
    host.setAttribute('data-hidden', '')
    restore.style.display = ''
    STORE.set('dsh-manqu-pet:hidden', true)
  })
  restore.addEventListener('click', () => {
    host.removeAttribute('data-hidden')
    restore.style.display = 'none'
    STORE.set('dsh-manqu-pet:hidden', false)
    transient = { id: 'waving', at: Date.now(), held: false }
  })
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    if (document.activeElement !== hitarea) return
    e.preventDefault()
    readyUnread = false
    transient = { id: 'waving', at: Date.now(), held: false }
    bubble('嗨～')
  }

  // 光标离开窗口 / 窗口失焦时清除视线跟随（避免僵持在某个朝向）
  const clearLook = () => { look = null }

  hitarea.addEventListener('pointerdown', onPointerDown)
  hitarea.addEventListener('pointermove', onPointerMove)
  hitarea.addEventListener('pointerup', onPointerUp)
  hitarea.addEventListener('pointercancel', onPointerUp)
  document.addEventListener('pointermove', onPointerMove, true)
  window.addEventListener('pointerup', onPointerUp)
  document.addEventListener('pointerdown', onDocPointerDown)
  hitarea.addEventListener('contextmenu', onContextMenu)
  hitarea.addEventListener('keydown', onKeyDown)
  document.documentElement.addEventListener('mouseleave', clearLook)
  window.addEventListener('blur', clearLook)

  // ---- 初始化 ----
  if (STORE.get('dsh-manqu-pet:hidden', false) === true) {
    host.setAttribute('data-hidden', '')
    restore.style.display = ''
  }
  const onResize = () => {
    x = clampX(x)
    if (y !== null) y = Math.max(4, Math.min(window.innerHeight - host.offsetHeight - 4, y))
    applyPos()
  }
  window.addEventListener('resize', onResize)
  refreshTimer = setInterval(refresh, POLL_MS)
  try {
    eventSource = new EventSource(EVENTS_PATH)
    eventSource.onmessage = () => refresh()
  } catch { /* SSE 不可用 → 纯轮询兜底 */ }
  loadAssets()
  refresh()
  requestAnimationFrame(tick)
  scheduleWander()

  return () => {
    clearInterval(refreshTimer)
    clearTimeout(wanderTimer)
    clearTimeout(wanderStepTimer)
    eventSource?.close()
    host.remove()
    restore.remove()
    style.remove()
    document.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointerdown', onDocPointerDown)
    document.documentElement.removeEventListener('mouseleave', clearLook)
    window.removeEventListener('blur', clearLook)
    window.removeEventListener('resize', onResize)
  }
}

// 标准 bundle client 形态：exports { name, apply }。
export const name = 'dsh-manqu-pet'