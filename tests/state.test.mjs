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
