import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTurnEvent } from '../.dsh-plugin/src/session-events.mjs'

test('turn/start 边沿', () => {
  assert.deepEqual(parseTurnEvent({ type: 'turn/start' }), { kind: 'start', blocked: false })
})

test('turn/end blocked（等待批准）', () => {
  assert.deepEqual(parseTurnEvent({ type: 'turn/end', data: { reason: { kind: 'blocked' } } }), { kind: 'end', blocked: true })
  assert.deepEqual(parseTurnEvent({ type: 'turn/end', data: { reason: { kind: 'completed' } } }), { kind: 'end', blocked: false })
})

test('非 turn 事件返回 null', () => {
  assert.equal(parseTurnEvent({ type: 'step/start' }), null)
  assert.equal(parseTurnEvent(null), null)
  assert.equal(parseTurnEvent('x'), null)
})
