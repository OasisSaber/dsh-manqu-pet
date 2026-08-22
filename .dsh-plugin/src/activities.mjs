// 多会话活动聚合纯逻辑（无 DOM、无宿主依赖，可单测）。
// jobs/sessions 快照由 Node half 从宿主服务收集，这里只做筛选、映射、去重与截断。

/**
 * 构建活动托盘行（state: 'waiting' | 'running'）。
 * 会话行优先（有未结束 turn 的会话；审批等待覆盖为 waiting），
 * 任务行补位运行中/排队任务（ownerSession 已出现的跳过，避免同源重复）。
 */
export function buildActivities({
  jobs = [],
  sessions = [],
  activeTurns = new Map(),
  waitingSessions = new Set(),
  limit = 6,
} = {}) {
  const rows = []
  const seenSessions = new Set()
  for (const s of sessions) {
    if (s === null || typeof s !== 'object') continue
    if (typeof s.id !== 'string' || seenSessions.has(s.id)) continue
    if ((activeTurns.get(s.id) ?? 0) <= 0) continue
    seenSessions.add(s.id)
    rows.push({
      sessionId: s.id,
      title: typeof s.displayTitle === 'string' && s.displayTitle ? s.displayTitle : s.id,
      state: waitingSessions.has(s.id) ? 'waiting' : 'running',
    })
  }
  for (const job of jobs) {
    if (rows.length >= limit) break
    if (job === null || typeof job !== 'object') continue
    if (job.status !== 'running' && job.status !== 'pending') continue
    const sid = typeof job.ownerSession === 'string' ? job.ownerSession : null
    if (sid !== null && seenSessions.has(sid)) continue
    if (sid !== null) seenSessions.add(sid)
    const label = typeof job.label === 'string' && job.label ? job.label : null
    rows.push({
      sessionId: sid,
      jobId: typeof job.id === 'string' ? job.id : null,
      title: label ?? (typeof job.id === 'string' ? job.id : 'task'),
      state: 'running',
    })
  }
  return rows.slice(0, limit)
}

/**
 * 任务终态的气泡载荷：detail 优先（契约：生产者提供的终态摘要），label 兜底；
 * 空白折叠 + 截断；kind 区分 done/failed。无可用文本时返回 null。
 */
export function bubbleFromJob(snapshot, now = Date.now(), { durationMs = 6000, maxLength = 96 } = {}) {
  if (snapshot === null || typeof snapshot !== 'object') return null
  const detail = typeof snapshot.detail === 'string' ? snapshot.detail.trim() : ''
  const label = typeof snapshot.label === 'string' ? snapshot.label.trim() : ''
  const text = (detail || label).replace(/\s+/g, ' ').slice(0, maxLength).trim()
  if (!text) return null
  return {
    text,
    kind: snapshot.status === 'failed' ? 'failed' : 'done',
    until: now + durationMs,
  }
}
