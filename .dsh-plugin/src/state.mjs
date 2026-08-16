// 情绪 → CodexPet 状态 的纯函数映射（无 DOM、无宿主依赖，可单测）。
// mood 由 Node half 聚合（thinking/waiting/celebrateUntil/failedUntil/welcomeUntil），
// 本地交互（拖拽/视线/瞬发）由 client 在更高优先级覆盖。

export const CELEBRATE_MS = 4000
export const FAILED_MS = 5000
export const WELCOME_MS = 4000

/**
 * 基础状态选择（不含本地交互覆盖）。
 * 优先级：失败 > 庆祝 > 等待 > 思考 > 待机。
 * @returns {'failed'|'jumping'|'waiting'|'running'|'idle'}
 */
export function pickBaseState(mood, now = Date.now()) {
  if (mood.failedUntil > now) return 'failed'
  if (mood.celebrateUntil > now) return 'jumping'
  if (mood.waiting === true) return 'waiting'
  if (mood.thinking === true) return 'running'
  return 'idle'
}
