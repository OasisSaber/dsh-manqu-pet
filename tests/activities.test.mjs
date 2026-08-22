import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildActivities, bubbleFromJob } from '../.dsh-plugin/src/activities.mjs'

test('buildActivities：会话行优先，审批等待覆盖为 waiting', () => {
  const rows = buildActivities({
    sessions: [
      { id: 's1', displayTitle: '修复登录 bug' },
      { id: 's2' }, // 无 displayTitle → 回落 id
      { id: 's3', displayTitle: '空闲会话（无 turn，不出现）' },
    ],
    activeTurns: new Map([['s1', 2], ['s2', 1]]),
    waitingSessions: new Set(['s1']),
  })
  assert.deepEqual(rows, [
    { sessionId: 's1', title: '修复登录 bug', state: 'waiting' },
    { sessionId: 's2', title: 's2', state: 'running' },
  ])
})

test('buildActivities：任务行补位，ownerSession 已出现的跳过，limit 截断', () => {
  const rows = buildActivities({
    jobs: [
      { id: 'job-1', label: '跑评测矩阵', status: 'running', ownerSession: 's1' }, // s1 已有会话行 → 跳过
      { id: 'job-2', label: '独立后台任务', status: 'running', ownerSession: undefined }, // 无主 → 收录
      { id: 'job-3', label: '已完成任务', status: 'completed' }, // 非运行态 → 跳过
      { id: 'job-4', label: '', status: 'pending', ownerSession: 's9' }, // 空label回落id；pending收录
    ],
    sessions: [{ id: 's1', displayTitle: '已有行' }],
    activeTurns: new Map([['s1', 1]]),
    limit: 3,
  })
  assert.deepEqual(rows, [
    { sessionId: 's1', title: '已有行', state: 'running' },
    { sessionId: null, jobId: 'job-2', title: '独立后台任务', state: 'running' },
    { sessionId: 's9', jobId: 'job-4', title: 'job-4', state: 'running' },
  ])
})

test('buildActivities：空输入与非对象元素容错', () => {
  assert.deepEqual(buildActivities(), [])
  assert.deepEqual(buildActivities({ jobs: [null, 'x'], sessions: [null, 42] }), [])
})

test('bubbleFromJob：detail 优先、折叠空白、截断、kind 区分', () => {
  const now = 1000
  assert.deepEqual(
    bubbleFromJob({ status: 'completed', detail: '  修复了\n 登录  bug  ', label: '任务标题' }, now),
    { text: '修复了 登录 bug', kind: 'done', until: now + 6000 },
  )
  const long = bubbleFromJob({ status: 'failed', detail: 'x'.repeat(200) }, now)
  assert.equal(long.text.length, 96)
  assert.equal(long.kind, 'failed')
  // detail 缺失回落 label
  assert.equal(bubbleFromJob({ status: 'completed', label: '只有标题' }, now).text, '只有标题')
  // 全空 → null
  assert.equal(bubbleFromJob({ status: 'completed', detail: '   ', label: '' }, now), null)
  assert.equal(bubbleFromJob(null), null)
})
