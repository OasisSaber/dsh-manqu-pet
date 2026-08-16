// 会话事件边沿判定（与 whale-girl 同契约，独立实现）：从宿主 `session/event`
// 回调的第二个参数判定 turn 边沿。事件字段是 `type`（'turn/start' | 'turn/end'），
// blocked 仅 turn/end 有意义：reason.kind === 'blocked'。
//
// ⚠ 宿主契约实证（DSH rc.6 源码 dsh-agent-loop）：turn/end + reason.kind==='blocked'
// 只在 pre-step 被 reject 时发射（来源是 goal-round-driver 的轮次保留拒绝），
// 并非"等待批准"——审批等待（dsh-user-approval）期间 turn 保持开启、不发 turn/end，
// 而是发射 approval/asked（开始等待）与 approval/decided（结束等待）。
// 因此"等待批准"状态以 parseApprovalEvent 为主路径，turn/end blocked 仅作兜底。
export function parseTurnEvent(event) {
  if (event === null || typeof event !== 'object') return null
  const type = typeof event.type === 'string' ? event.type : null
  if (type === 'turn/start') return { kind: 'start', blocked: false }
  if (type === 'turn/end') {
    const reason = typeof event.data === 'object' && event.data !== null ? event.data.reason : null
    const blocked = typeof reason === 'object' && reason !== null && reason.kind === 'blocked'
    return { kind: 'end', blocked }
  }
  return null
}

/** 审批事件边沿：approval/asked（进入等待）→ approval/decided（结束等待）。 */
export function parseApprovalEvent(event) {
  if (event === null || typeof event !== 'object') return null
  const type = typeof event.type === 'string' ? event.type : null
  if (type === 'approval/asked') return { kind: 'asked' }
  if (type === 'approval/decided') return { kind: 'decided' }
  return null
}
