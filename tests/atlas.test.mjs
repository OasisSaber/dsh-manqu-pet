import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CELL_WIDTH, CELL_HEIGHT, stateById, frameIndexesFor, directionFor, durationFor, detectPopulatedFrames } from '../.dsh-plugin/client/atlas.mjs'

test('状态表行号契约（v2 图集）', () => {
  assert.equal(stateById('idle').row, 0)
  assert.equal(stateById('running-right').row, 1)
  assert.equal(stateById('running-left').row, 2)
  assert.equal(stateById('waving').row, 3)
  assert.equal(stateById('jumping').row, 4)
  assert.equal(stateById('failed').row, 5)
  assert.equal(stateById('waiting').row, 6)
  assert.equal(stateById('running').row, 7)
  assert.equal(stateById('review').row, 8)
  assert.equal(stateById('look-a').row, 9)
  assert.equal(stateById('look-b').row, 10)
  assert.equal(stateById('unknown').id, 'idle')
})

test('frameIndexesFor：像素检测优先，缺检测用 defaultFrames 截断', () => {
  const pet = { rows: 11, cols: 8, populatedByRow: [[0, 2, 4], null, null, null, null, null, null, null, null, null, null] }
  assert.deepEqual(frameIndexesFor(stateById('idle'), pet), [0, 2, 4])
  assert.deepEqual(frameIndexesFor(stateById('running'), pet), [0, 1, 2, 3, 4, 5])
  const small = { rows: 9, cols: 4, populatedByRow: null }
  assert.deepEqual(frameIndexesFor(stateById('idle'), small), [0, 1, 2, 3])
  assert.deepEqual(frameIndexesFor(stateById('look-a'), small), [])
})

test('frameIndexesFor：检测结果只保留图集内的唯一帧', () => {
  const pet = { rows: 11, cols: 4, populatedByRow: [[3, 3, 7, -1, 1], null, null, null, null, null, null, null, null, null, null] }
  assert.deepEqual(frameIndexesFor(stateById('idle'), pet), [3, 1])
})

test('directionFor：16 方向映射到 look 行/帧', () => {
  const up = directionFor(0, -100)
  assert.equal(up.index, 0); assert.equal(up.row, 9); assert.equal(up.frame, 0)
  const right = directionFor(100, 0)
  assert.equal(right.index, 4); assert.equal(right.row, 9); assert.equal(right.frame, 4)
  const down = directionFor(0, 100)
  assert.equal(down.index, 8); assert.equal(down.row, 10); assert.equal(down.frame, 0)
  const left = directionFor(-100, 0)
  assert.equal(left.index, 12); assert.equal(left.row, 10); assert.equal(left.frame, 4)
})

test('directionFor：零向量或非有限输入退回向上方向', () => {
  assert.deepEqual(directionFor(0, 0), { index: 0, row: 9, frame: 0 })
  assert.deepEqual(directionFor(Number.NaN, 10), { index: 0, row: 9, frame: 0 })
})

test('durationFor：逐帧时长与兜底', () => {
  assert.equal(durationFor(stateById('idle'), 0), 280)
  assert.equal(durationFor(stateById('idle'), 5), 320)
  assert.equal(durationFor(stateById('look-a'), 3), 140)
  assert.equal(durationFor(stateById('idle'), -1), 280)
})

test('detectPopulatedFrames：空帧剔除', () => {
  const w = CELL_WIDTH * 8
  const h = CELL_HEIGHT * 11
  const pixels = new Uint8ClampedArray(w * h * 4)
  const idx = (0 * w + 0) * 4 + 3
  pixels[idx] = 255
  const idx2 = ((7 * CELL_HEIGHT) * w + (1 * CELL_WIDTH)) * 4 + 3
  pixels[idx2] = 255
  const populated = detectPopulatedFrames(pixels, w, 11, 8)
  assert.deepEqual(populated[0], [0])
  assert.deepEqual(populated[7], [1])
  assert.deepEqual(populated[1], [])
})
