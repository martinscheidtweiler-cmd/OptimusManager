import assert from 'node:assert/strict'
import test from 'node:test'
import { brusselsDayRange, entryOverlapMs } from './staffAnalytics.ts'

test('Brussels calendar days account for spring DST', () => {
  const range = brusselsDayRange('2026-03-29')
  assert.equal(range.end - range.start, 23 * 60 * 60 * 1000)
})

test('Brussels calendar days account for autumn DST', () => {
  const range = brusselsDayRange('2026-10-25')
  assert.equal(range.end - range.start, 25 * 60 * 60 * 1000)
})

test('a task crossing midnight is split across the two local dates', () => {
  const entry = {
    id: 'test', shift_id: 'test', task_id: 1,
    started_at: '2026-06-01T21:00:00.000Z', // 23:00 in Brussels
    ended_at: '2026-06-01T23:00:00.000Z', // 01:00 the following date
  }
  assert.equal(entryOverlapMs(entry, '2026-06-01'), 60 * 60 * 1000)
  assert.equal(entryOverlapMs(entry, '2026-06-02'), 60 * 60 * 1000)
})

test('an ongoing task is capped at the selected calendar day boundary', () => {
  const entry = {
    id: 'test', shift_id: 'test', task_id: 1,
    started_at: '2026-06-01T21:00:00.000Z', ended_at: null,
  }
  const endOfDay = brusselsDayRange('2026-06-01').end
  assert.equal(entryOverlapMs(entry, '2026-06-01', endOfDay + 3 * 60 * 60 * 1000), 60 * 60 * 1000)
})
