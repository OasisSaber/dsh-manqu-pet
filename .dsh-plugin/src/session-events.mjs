// 会话事件边沿判定（与 whale-girl 同契约，独立实现）：从宿主 `session/event`
// 回调的第二个参数判定 turn 边沿。事件字段是 `type`（'turn/start' | 'turn/end'），
// blocked 仅 turn/end 有意义：reason.kind === 'blocked'（等待用户批准/权限）。
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
