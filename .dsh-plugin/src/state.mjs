// 情绪 → CodexPet 基础状态 的纯函数映射（无 DOM、无宿主依赖，可单测）。
// mood 由 Node half 聚合（thinking/waiting/celebrateUntil/failedUntil/readyUntil），
// 只覆盖 6 个基础态；look/挥手/蠕动/散步等本地交互态由 client 以更高优先级覆盖。

export const CELEBRATE_MS = 4000
export const FAILED_MS = 5000
export const READY_MS = 10 * 60 * 1000

/**
 * 基础状态选择（不含本地交互覆盖）。
 * 优先级：失败 > 庆祝 > 等待 > 未读活动（Ready，播 review 行）> 思考 > 待机。
 * Ready 位于 Needs input(waiting) 之下、Running 之上，对齐官方四态仲裁语义；
 * 「已读」由 client 本地水位裁决（把 readyUntil 折算为 0 后再进入本函数）。
 * @returns {'failed'|'jumping'|'waiting'|'review'|'running'|'idle'}
 */
export function pickBaseState(mood, now = Date.now()) {
  if (mood.failedUntil > now) return 'failed'
  if (mood.celebrateUntil > now) return 'jumping'
  if (mood.waiting === true) return 'waiting'
  if (mood.readyUntil > now) return 'review'
  if (mood.thinking === true) return 'running'
  return 'idle'
}
