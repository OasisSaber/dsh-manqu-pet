// dsh-manqu-pet Node half：会话/任务情绪聚合 + assets 静态服务 + SSE 即时事件。
// 契约：官方 bundle 插件 Node half（Cordis 插件，仓库根 package.json 的 dsh.bundle/dsh.client）；
// 路由端点单一来源 src/routes.mjs；client 经 __ModuleLoader__ 挂载（.dsh-plugin/client.js）。
// 服务缺席（headless）时降级：无 webServer 则只记账不挂路由，插件照常跑。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STATE_PATH, ASSETS_PATH, EVENTS_PATH } from './src/routes.mjs'
import { sanitizeAssetPath, contentTypeFor } from './src/assets.mjs'
import { parseTurnEvent, parseApprovalEvent } from './src/session-events.mjs'
import { CELEBRATE_MS, FAILED_MS, READY_MS } from './src/state.mjs'

export const name = 'dsh-manqu-pet'
export const inject = ['jobs', 'agents', 'sessions', 'webServer']

function json(res, status, body, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra })
  res.end(JSON.stringify(body))
}

export function apply(ctx) {
  // ---- 情绪状态 ----
  let thinking = false
  let waiting = false
  let celebrateUntil = 0
  let failedUntil = 0
  let readyUntil = 0 // Ready（完成但有未读活动）：庆祝窗口结束后由 review 行接管，直至 client 单击已读或过期
  const titles = []
  const activeTurns = new Map() // sessionId → 未结束 turn 数
  const sseClients = new Set()

  const broadcast = () => {
    const line = 'data: {"type":"event"}\n\n'
    for (const res of sseClients) {
      try { res.write(line) } catch { sseClients.delete(res) }
    }
  }

  /** 单快照过滤：已见去重 + running/pending 过滤 + label 提取。 */
  const pushRunning = (out, seen, snapshot) => {
    if (seen.has(snapshot.id)) return
    seen.add(snapshot.id)
    if (snapshot.status === 'running' || snapshot.status === 'pending') {
      out.push(typeof snapshot.label === 'string' ? snapshot.label : snapshot.id)
    }
  }

  /** 从宿主 jobs 服务收集运行中任务标题（跨 agent + unowned，按 id 去重）。 */
  const collectRunningJobs = (ctxRef) => {
    const jobs = ctxRef.jobs
    const seen = new Set()
    const out = []
    if (jobs === undefined || typeof jobs.list !== 'function') return out
    try {
      for (const agent of (typeof ctxRef.agents?.list === 'function' ? ctxRef.agents.list() : [])) {
        for (const snapshot of jobs.list(agent)) pushRunning(out, seen, snapshot)
      }
      for (const snapshot of jobs.list()) pushRunning(out, seen, snapshot)
    } catch {
      // 聚合异常：保留上次值
    }
    return out
  }

  ctx.effect(() => {
    const disposers = []

    // 任务终态：完成 → 庆祝窗口；失败 → 失落窗口（即时广播，不等轮询）。
    if (typeof ctx.jobs?.onJobDone === 'function') {
      disposers.push(ctx.jobs.onJobDone((snapshot) => {
        const now = Date.now()
        if (snapshot.status === 'completed') {
          celebrateUntil = Math.max(celebrateUntil, now + CELEBRATE_MS)
          readyUntil = Math.max(readyUntil, now + READY_MS)
        } else if (snapshot.status === 'failed') {
          failedUntil = Math.max(failedUntil, now + FAILED_MS)
        }
        broadcast()
      }))
    }

    // 会话 turn 边沿：驱动 thinking / waiting / 回合完成庆祝。
    // 审批等待以 approval/asked → approval/decided 为主路径（宿主在等待批准时
    // turn 保持开启、不发 turn/end）；turn/end blocked 仅作兜底触发面。
    if (typeof ctx.on === 'function') {
      disposers.push(ctx.on('session/event', (session, event) => {
        const id = typeof session?.id === 'string' ? session.id : null
        if (id === null) return
        const approval = parseApprovalEvent(event)
        if (approval !== null) {
          if (approval.kind === 'asked') waiting = true
          else waiting = false
          broadcast()
          return
        }
        const parsed = parseTurnEvent(event)
        if (parsed === null) return
        if (parsed.kind === 'start') {
          activeTurns.set(id, (activeTurns.get(id) ?? 0) + 1)
          waiting = false
        } else {
          const n = (activeTurns.get(id) ?? 0) - 1
          if (n <= 0) activeTurns.delete(id)
          else activeTurns.set(id, n)
          if (parsed.blocked) {
            // 阻塞（等待批准/权限）：进入 waiting，不庆祝。
            waiting = true
          } else {
            waiting = false
            celebrateUntil = Math.max(celebrateUntil, Date.now() + CELEBRATE_MS)
            readyUntil = Math.max(readyUntil, Date.now() + READY_MS)
          }
        }
        broadcast()
      }))
    }

    // sessions 服务（可选）：随 /state 聚合运行中会话标题。
    const sessionsSvc = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined

    // webServer 存在时（web 模式）注册路由；headless 无 webServer 则降级。
    const webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (webServer !== undefined && typeof webServer.register === 'function') {
      disposers.push(webServer.register({
        kind: 'exact',
        path: STATE_PATH,
        handler: async (req, res) => {
          try {
            if (req.method !== 'GET') {
              json(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' })
              return
            }
            // 实时聚合：turn 计数 + 运行中任务 + 会话标题（events 记账是即时面，这里补兜底面）。
            let anyTurns = false
            for (const n of activeTurns.values()) {
              if (n > 0) { anyTurns = true; break }
            }
            const jobTitles = collectRunningJobs(ctx)
            thinking = anyTurns || jobTitles.length > 0
            titles.length = 0
            for (const t of jobTitles) titles.push(t)
            if (sessionsSvc !== undefined && typeof sessionsSvc.list === 'function') {
              try {
                for (const s of sessionsSvc.list()) {
                  if (s === null || typeof s !== 'object') continue
                  if ((activeTurns.get(s.id) ?? 0) > 0 && typeof s.displayTitle === 'string') {
                    titles.push(s.displayTitle)
                  }
                }
              } catch {
                // 会话列表异常：保留已有标题
              }
            }
            json(res, 200, {
              mood: {
                thinking,
                waiting,
                celebrateUntil,
                failedUntil,
                readyUntil,
                titles: titles.slice(0, 4),
              },
              ts: Date.now(),
            }, { 'cache-control': 'no-store' })
          } catch (error) {
            json(res, 500, { error: error instanceof Error ? error.message : String(error) })
          }
        },
      }))
      disposers.push(webServer.register({
        kind: 'prefix',
        path: ASSETS_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405)
            res.end()
            return
          }
          let pathname
          try {
            pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://dsh.internal').pathname)
          } catch {
            res.writeHead(400)
            res.end()
            return
          }
          const rel = sanitizeAssetPath(pathname)
          if (rel === null) {
            res.writeHead(403)
            res.end()
            return
          }
          try {
            const data = readFileSync(join(import.meta.dirname, 'assets', rel))
            res.writeHead(200, { 'content-type': contentTypeFor(rel), 'cache-control': 'no-cache' })
            res.end(data)
          } catch {
            res.writeHead(404)
            res.end()
          }
        },
      }))
      disposers.push(webServer.register({
        kind: 'exact',
        path: EVENTS_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') {
            res.writeHead(405)
            res.end()
            return
          }
          res.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
            'x-accel-buffering': 'no',
          })
          if (typeof res.flushHeaders === 'function') res.flushHeaders()
          res.write('retry: 3000\n\n')
          sseClients.add(res)
          let heartbeat = null
          if (typeof res.on === 'function') {
            res.on('close', () => {
              clearInterval(heartbeat)
              sseClients.delete(res)
            })
          }
          heartbeat = setInterval(() => {
            try { res.write(': ping\n\n') } catch { /* 断连由 close 清理 */ }
          }, 25000)
        },
      }))
    }

    return () => {
      for (const dispose of disposers) {
        try { dispose() } catch { /* 清理异常忽略 */ }
      }
      for (const res of sseClients) {
        try { res.end() } catch { /* 已断连 */ }
      }
      sseClients.clear()
    }
  }, 'dsh-manqu-pet: state/assets/events routes + mood aggregation')
}
