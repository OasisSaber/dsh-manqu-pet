import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickBaseState } from '../.dsh-plugin/src/state.mjs'

test('pickBaseState 优先级：失败 > 庆祝 > 等待 > 思考 > 待机', () => {
  const now = 1000
  assert.equal(pickBaseState({ thinking: true, waiting: false, celebrateUntil: 0, failedUntil: 0 }, now), 'running')
  assert.equal(pickBaseState({ thinking: true, waiting: true, celebrateUntil: 0, failedUntil: 0 }, now), 'waiting')
  assert.equal(pickBaseState({ thinking: false, waiting: false, celebrateUntil: 5000, failedUntil: 0 }, now), 'jumping')
  assert.equal(pickBaseState({ thinking: false, waiting: false, celebrateUntil: 0, failedUntil: 5000 }, now), 'failed')
  assert.equal(pickBaseState({ thinking: false, waiting: false, celebrateUntil: 0, failedUntil: 0 }, now), 'idle')
  assert.equal(pickBaseState({ thinking: false, waiting: false, celebrateUntil: 500, failedUntil: 0 }, now), 'idle')
})

test('pickBaseState Ready（review）：位于等待之下、思考之上，过期/缺失回落', () => {
  const now = 1000
  // 未读活动生效 → review
  assert.equal(pickBaseState({ thinking: false, waiting: false, celebrateUntil: 0, failedUntil: 0, readyUntil: 5000 }, now), 'review')
  // 等待压过未读
  assert.equal(pickBaseState({ thinking: false, waiting: true, celebrateUntil: 0, failedUntil: 0, readyUntil: 5000 }, now), 'waiting')
  // 庆祝窗口压过未读
  assert.equal(pickBaseState({ thinking: false, waiting: false, celebrateUntil: 5000, failedUntil: 0, readyUntil: 9000 }, now), 'jumping')
  // 未读压过思考
  assert.equal(pickBaseState({ thinking: true, waiting: false, celebrateUntil: 0, failedUntil: 0, readyUntil: 5000 }, now), 'review')
  // 已读折算（readyUntil=0）→ 思考
  assert.equal(pickBaseState({ thinking: true, waiting: false, celebrateUntil: 0, failedUntil: 0, readyUntil: 0 }, now), 'running')
  // 过期回落
  assert.equal(pickBaseState({ thinking: true, waiting: false, celebrateUntil: 0, failedUntil: 0, readyUntil: 500 }, now), 'running')
  // 旧 payload 无 readyUntil 字段 → 不报错、回落
  assert.equal(pickBaseState({ thinking: true, waiting: false, celebrateUntil: 0, failedUntil: 0 }, now), 'running')
  assert.equal(pickBaseState({ thinking: false, waiting: false, celebrateUntil: 0, failedUntil: 0 }, now), 'idle')
})
