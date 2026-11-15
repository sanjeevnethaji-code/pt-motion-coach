import test from 'node:test'
import assert from 'node:assert/strict'
import { newSignalFilter, filterMeasurement, repQuality } from '../src/measurementQuality.js'
import { measureExercise, COACHING, advanceCoach } from '../src/coaching.js'
import { createRepRecorder, recordRepFrame, reviewEvidence, previousComparable, saveReviewHistory, loadReviewHistory } from '../src/reviewMetrics.js'
import { requestSessionSummary } from '../src/sessionSummary.js'

const session = (rows) => ({ quality_version: 3, exercise_id: 'elbow-wrist', movement_part: 'elbow', side: 'right', measurement_method: 'experimental webcam estimates', completed_reps: rows.length, rep_details: rows, calibration_start: 10, calibration_target: 60, hold_goal_seconds: 1, rejected_angle_samples: 0, tracking_observed_seconds: 20, tracking_visible_seconds: 18 })
const row = { rep: 1, start_angle: 10, held_angle: 60, return_angle: 10, min_angle: 10, max_angle: 60, excursion_degrees: 50, hold_seconds: 1, cycle_seconds: 5, rejected_samples: 0, tracking_gaps: 0 }

test('a single 180-degree spike is rejected and never becomes a measured endpoint', () => {
  const f = newSignalFilter()
  const read = (value, time) => filterMeasurement(f, { visible: true, value, lengths: [100, 100] }, time, { start: 10, target: 60, lengths: [100, 100] })
  read(10, 0); read(10, 100); assert.equal(read(10, 200).value, 10)
  assert.equal(read(180, 300).quality, 'rejected')
  read(10, 400); read(11, 500); assert.equal(read(10, 600).value, 10)
})

test('camera-scale changes block measurement until explicit recalibration', () => {
  const f = newSignalFilter()
  const result = filterMeasurement(f, { visible: true, value: 30, lengths: [30, 100] }, 0, { start: 10, target: 60, lengths: [100, 100] })
  assert.equal(result.visible, false); assert.match(result.reason, /view/)
})

test('a gradual full movement counts once and produces stable endpoint evidence', () => {
  const f = newSignalFilter(); const r = createRepRecorder()
  let state = { phase: 'start', since: null, reps: 0 }; let now = 0
  const frame = (value) => { now += 100; const m = filterMeasurement(f, { visible: true, value, lengths: [100, 100] }, now, { start: 10, target: 60, lengths: [100, 100] }); const before = state; state = advanceCoach(before, m.value, now, 10, 60, 1000); recordRepFrame(r, before, state, m.value, now, m.quality) }
  for (let rep = 0; rep < 3; rep++) {
    for (let i = 0; i < 10; i++) frame(10)
    for (let a = 15; a <= 60; a += 5) frame(a)
    for (let i = 0; i < 18; i++) frame(60)
    for (let a = 55; a >= 10; a -= 5) frame(a)
    for (let i = 0; i < 8; i++) frame(10)
    assert.equal(state.reps, rep + 1)
  }
  assert.equal(r.rows.length, 3)
  for (const measured of r.rows) { assert.ok(Math.abs(measured.excursion_degrees - 50) < 1); assert.ok(measured.hold_seconds >= 1); assert.equal(repQuality(measured, session(r.rows)).length, 0) }
})

test('holding the target alone cannot create reps; missing tracking interrupts a hold', () => {
  let s = { phase: 'start', since: null, reps: 0 }
  for (let t = 0; t < 5000; t += 100) s = advanceCoach(s, 60, t, 10, 60, 1000)
  assert.equal(s.reps, 0)
  s = { phase: 'hold', since: 0, reps: 1 }
  s = advanceCoach(s, null, 400, 10, 60, 1000)
  assert.equal(s.phase, 'out'); assert.equal(s.reps, 1)
})

test('reported 179-degree legacy excursions are excluded, not interpreted as actual ROM', () => {
  const raw = [{ ...row, min_angle: .9, max_angle: 180, excursion_degrees: 179.1 }, { ...row, rep: 2, min_angle: .7, max_angle: 180, excursion_degrees: 179.3 }, { ...row, rep: 3, min_angle: 144, max_angle: 179.3, excursion_degrees: 35.3 }]
  const ev = reviewEvidence({ ...session(raw), quality_version: 2 })
  assert.equal(ev.included_reps, 0); assert.equal(ev.mean_excursion, null); assert.ok(ev.warnings.length > 0)
})

test('flagged reps never affect range statistics or cross-session comparisons', () => {
  const rows = [row, { ...row, rep: 2, excursion_degrees: 170, rejected_samples: 2 }]
  const current = session(rows)
  const ev = reviewEvidence(current)
  assert.equal(ev.included_reps, 1); assert.equal(ev.mean_excursion, 50)
  const history = [{ id: 'old', profile: 'A', session: session([row]) }]
  assert.equal(previousComparable(history, current, 'A', 'new'), null)
  assert.equal(previousComparable(history, session([row]), 'B', 'new'), null)
  assert.equal(previousComparable(history, { ...session([row]), side: 'left' }, 'A', 'new'), null)
  assert.equal(previousComparable(history, session([row]), 'A', 'new').id, 'old')
})

test('near-overlap elbow geometry is not reported as a usable angle', () => {
  const p = []; p[12] = {x: .5,y: .3,visibility: 1}; p[14] = {x: .5,y: .7,visibility: 1}; p[16] = {x: .5,y: .1,visibility: 1}
  const result = measureExercise(p, COACHING['elbow-wrist'], 'right', 1280, 720)
  assert.equal(result.visible, false)
})

test('storage failures are tolerated and history remains capped', () => {
  assert.deepEqual(loadReviewHistory({getItem: () => {throw new Error('blocked')}}), [])
  let saved = '[]'; const storage = {getItem: () => saved, setItem: (_, value) => {saved = value}}
  for (let i = 0; i < 25; i++) saveReviewHistory(storage, {id: String(i), profile: 'A', session: session([row])})
  assert.equal(loadReviewHistory(storage).length, 20)
})

test('old AWS review code cannot be mistaken for the quality-aware review', async () => {
  await assert.rejects(requestSessionSummary(session([row]), undefined, async () => ({ ok: true, json: async () => ({ summary: 'Old review', review_version: 2 }) })), /earlier review/)
  const data = await requestSessionSummary(session([row]), undefined, async (_, options) => { assert.equal(JSON.parse(options.body).review_version, 4); return {ok: true,json: async () => ({summary: 'Checked evidence',review_version: 4})} })
  assert.equal(data.review_version, 4)
})
