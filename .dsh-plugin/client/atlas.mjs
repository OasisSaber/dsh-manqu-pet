// CodexPet v2 图集纯逻辑（无 DOM、无宿主依赖，可单测）。
// 图集约定：每格 192×208，共 8 列；v2 使用 11 行，最后两行承载 16 个视线方向。

export const CELL_WIDTH = 192
export const CELL_HEIGHT = 208
export const COLUMNS = 8
export const V2_ROWS = 11

const FALLBACK_DURATION = 140
const DIRECTION_COUNT = 16
const ANGLE_STEP = (Math.PI * 2) / DIRECTION_COUNT

const STATE_DEFINITIONS = [
  ['idle', 0, 6, [280, 110, 110, 140, 140, 320]],
  ['running-right', 1, 8, [120, 120, 120, 120, 120, 120, 120, 220]],
  ['running-left', 2, 8, [120, 120, 120, 120, 120, 120, 120, 220]],
  ['waving', 3, 4, [140, 140, 140, 280]],
  ['jumping', 4, 5, [140, 140, 140, 140, 280]],
  ['failed', 5, 8, [140, 140, 140, 140, 140, 140, 140, 240]],
  ['waiting', 6, 6, [150, 150, 150, 150, 150, 260]],
  ['running', 7, 6, [120, 120, 120, 120, 120, 220]],
  ['review', 8, 6, [150, 150, 150, 150, 150, 280]],
  ['look-a', 9, 8, null],
  ['look-b', 10, 8, null],
]

/** 状态表：每项为 [id, 图集行, 默认帧数, 播放时长]。 */
export const STATES = Object.freeze(
  STATE_DEFINITIONS.map(([id, row, defaultFrames, durations]) => Object.freeze({
    id,
    row,
    defaultFrames,
    ...(durations ? { durations: Object.freeze(durations) } : { v2: true }),
  })),
)

const STATE_BY_ID = new Map(STATES.map((state) => [state.id, state]))

export function stateById(id) {
  return STATE_BY_ID.get(id) ?? STATES[0]
}

function validDimension(value) {
  return Number.isInteger(value) && value > 0
}

/** 判断一个图集格子是否包含超过透明阈值的像素。 */
export function cellHasVisiblePixels(pixels, imageWidth, row, col) {
  if (!pixels || !validDimension(imageWidth) || !Number.isInteger(row) || row < 0 || !Number.isInteger(col) || col < 0) {
    return false
  }

  const stride = imageWidth * 4
  const imageHeight = Math.floor(pixels.length / stride)
  const left = col * CELL_WIDTH
  const top = row * CELL_HEIGHT
  const right = Math.min(left + CELL_WIDTH, imageWidth)
  const bottom = Math.min(top + CELL_HEIGHT, imageHeight)
  if (left >= right || top >= bottom) return false

  for (let y = top; y < bottom; y += 4) {
    for (let x = left; x < right; x += 4) {
      const alphaOffset = y * stride + x * 4 + 3
      if ((pixels[alphaOffset] ?? 0) > 8) return true
    }
  }
  return false
}

/** 返回每一行中包含可见像素的帧列号。 */
export function detectPopulatedFrames(pixels, imageWidth, rows, cols = COLUMNS) {
  const rowCount = Number.isInteger(rows) && rows > 0 ? rows : 0
  const colCount = Number.isInteger(cols) && cols > 0 ? Math.min(cols, COLUMNS) : 0

  return Array.from({ length: rowCount }, (_, row) => {
    const frames = []
    for (let col = 0; col < colCount; col += 1) {
      if (cellHasVisiblePixels(pixels, imageWidth, row, col)) frames.push(col)
    }
    return frames
  })
}

function availableColumns(pet) {
  return Number.isInteger(pet?.cols) && pet.cols > 0 ? Math.min(pet.cols, COLUMNS) : 0
}

/** 选择状态帧：优先使用检测结果，否则按状态默认帧数生成连续帧。 */
export function frameIndexesFor(state, pet) {
  if (!state || !pet || !Number.isInteger(pet.rows) || state.row < 0 || state.row >= pet.rows) return []

  const maxColumns = availableColumns(pet)
  const detected = pet.populatedByRow?.[state.row]
  if (Array.isArray(detected) && detected.length > 0) {
    const seen = new Set()
    return detected.filter((frame) => {
      if (!Number.isInteger(frame) || frame < 0 || frame >= maxColumns || seen.has(frame)) return false
      seen.add(frame)
      return true
    })
  }

  const fallbackCount = Math.max(0, Math.min(state.defaultFrames ?? 0, maxColumns))
  return Array.from({ length: fallbackCount }, (_, index) => index)
}

/** 按播放位置选择帧时长；越界位置使用首帧或末帧时长。 */
export function durationFor(state, position) {
  if (!Array.isArray(state?.durations) || state.durations.length === 0) return FALLBACK_DURATION
  const safePosition = Number.isFinite(position) ? Math.max(0, Math.floor(position)) : 0
  return state.durations[Math.min(safePosition, state.durations.length - 1)] ?? FALLBACK_DURATION
}

function defaultDirection() {
  return { index: 0, row: 9, frame: 0 }
}

/** 将屏幕位移量映射到 v2 图集的 16 个视线方向。 */
export function directionFor(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return defaultDirection()

  // 以正上方为 0，顺时针每 22.5° 一个方向。
  const angle = Math.atan2(dx, -dy)
  const index = ((Math.round(angle / ANGLE_STEP) % DIRECTION_COUNT) + DIRECTION_COUNT) % DIRECTION_COUNT
  return {
    index,
    row: index < COLUMNS ? 9 : 10,
    frame: index % COLUMNS,
  }
}
