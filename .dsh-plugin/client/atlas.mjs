// CodexPet v2 图集纯逻辑（无 DOM、无宿主依赖，可单测）。
// 契约：图集 = 8 列 × N 行，每格 192×208；v2 = 11 行（行 0-8 动作，行 9-10 视线方向）。
// 行/帧时长与 noir-hedgehog/PetViewer 同源（其 app.js STATES 表）。

export const CELL_WIDTH = 192
export const CELL_HEIGHT = 208
export const COLUMNS = 8
export const V2_ROWS = 11

/** 状态表（row = 图集行号；durations = 逐帧时长 ms；defaultFrames = 无像素分析时的帧数）。 */
export const STATES = [
  { id: 'idle', row: 0, defaultFrames: 6, durations: [280, 110, 110, 140, 140, 320] },
  { id: 'running-right', row: 1, defaultFrames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: 'running-left', row: 2, defaultFrames: 8, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  { id: 'waving', row: 3, defaultFrames: 4, durations: [140, 140, 140, 280] },
  { id: 'jumping', row: 4, defaultFrames: 5, durations: [140, 140, 140, 140, 280] },
  { id: 'failed', row: 5, defaultFrames: 8, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  { id: 'waiting', row: 6, defaultFrames: 6, durations: [150, 150, 150, 150, 150, 260] },
  { id: 'running', row: 7, defaultFrames: 6, durations: [120, 120, 120, 120, 120, 220] },
  // review 是 v2 图集契约行（官方 STATES 表保留），本插件没有对应情绪/触发入口，
  // 保留以对齐图集行号（row 8），避免帧检测与未来映射错位。
  { id: 'review', row: 8, defaultFrames: 6, durations: [150, 150, 150, 150, 150, 280] },
  { id: 'look-a', row: 9, defaultFrames: 8, v2: true },
  { id: 'look-b', row: 10, defaultFrames: 8, v2: true },
]

export function stateById(id) {
  return STATES.find((s) => s.id === id) || STATES[0]
}

/** 像素级检测：该格是否有可见像素（步进 4px 采样，alpha > 8 即认为有内容）。 */
export function cellHasVisiblePixels(pixels, imageWidth, row, col) {
  const startX = col * CELL_WIDTH
  const startY = row * CELL_HEIGHT
  for (let y = startY; y < startY + CELL_HEIGHT; y += 4) {
    for (let x = startX; x < startX + CELL_WIDTH; x += 4) {
      if (pixels[(y * imageWidth + x) * 4 + 3] > 8) return true
    }
  }
  return false
}

/** 逐行检测已填充帧（返回每行的非空列号数组；cols 上限 8）。 */
export function detectPopulatedFrames(pixels, imageWidth, rows, cols = COLUMNS) {
  const populated = []
  for (let row = 0; row < rows; row += 1) {
    const frameIndexes = []
    for (let col = 0; col < Math.min(cols, COLUMNS); col += 1) {
      if (cellHasVisiblePixels(pixels, imageWidth, row, col)) frameIndexes.push(col)
    }
    populated.push(frameIndexes)
  }
  return populated
}

/**
 * 某状态的播放帧集合：优先像素检测结果，缺则用 defaultFrames（截断到图集边界）。
 * 状态行超出图集行数 → 空数组（该状态不可播）。
 */
export function frameIndexesFor(state, pet) {
  if (state.row >= pet.rows) return []
  const detected = pet.populatedByRow?.[state.row]
  if (Array.isArray(detected) && detected.length > 0) return detected
  return Array.from({ length: Math.min(state.defaultFrames, pet.cols, COLUMNS) }, (_, i) => i)
}

/** 当前帧时长：状态 durations 按播放位置取；无 durations 用 140ms。 */
export function durationFor(state, position) {
  if (!state.durations?.length) return 140
  return state.durations[Math.min(position, state.durations.length - 1)]
}

/**
 * 鼠标方向 → 视线状态（v2 专属：行 9/10，每行 8 帧 = 16 方向）。
 * @returns {{ index: number, row: number, frame: number }} index=16 方向号
 */
export function directionFor(dx, dy) {
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  const norm = ((degrees % 360) + 360) % 360
  const index = Math.round(norm / 22.5) % 16
  return { index, row: index < 8 ? 9 : 10, frame: index % 8 }
}
