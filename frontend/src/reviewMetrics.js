import { median, repQuality, QUALITY_VERSION } from './measurementQuality.js'
export const createRepRecorder = () => ({ rows: [], current: null })
const round = (number) => Math.round(number * 10) / 10
const newRep = (value, now) => ({ started: now, start: value, held: [], returning: [], hold: null, rejected: 0, gaps: 0, missing: false })

export function recordRepFrame(recorder, previous, next, value, now, quality = 'accepted') {
  if (next.phase === 'start') { recorder.current = null; return }
  if (previous.phase === 'start' && next.phase === 'out' && Number.isFinite(value)) recorder.current = newRep(value, now)
  const current = recorder.current
  if (!current) return
  if (!Number.isFinite(value)) {
    if (quality === 'rejected') current.rejected += 1
    if (!current.missing) current.gaps += 1
    current.missing = true
    return
  }
  current.missing = false
  if (next.phase === 'hold') current.held = [...current.held.slice(-9), value]
  if (previous.phase === 'hold' && next.phase === 'out') current.held = []
  if (previous.phase === 'hold' && next.phase === 'back' && previous.since !== null) {
    current.hold = round((now - previous.since) / 1000)
    current.held = [...current.held.slice(-9), value]
  }
  if (next.phase === 'back') current.returning = [...current.returning.slice(-2), value]
  if (next.reps > previous.reps) {
    current.returning = [...current.returning.slice(-2), value]
    const held = median(current.held)
    const returned = median(current.returning)
    const start = current.start
    if (held !== null && returned !== null) recorder.rows.push({
      rep: next.reps, start_angle: round(start), held_angle: round(held), return_angle: round(returned),
      min_angle: round(Math.min(start, held)), max_angle: round(Math.max(start, held)),
      excursion_degrees: round(Math.abs(held - start)), hold_seconds: current.hold,
      cycle_seconds: round((now - current.started) / 1000), rejected_samples: current.rejected, tracking_gaps: current.gaps,
    })
    recorder.current = newRep(value, now)
  }
}

export function reviewEvidence(session) {
  const reps = session.rep_details ?? []
  const included = reps.filter((row) => repQuality(row, session).length === 0)
  const excursions = included.map((row) => row.excursion_degrees).filter(Number.isFinite)
  const holds = included.map((row) => row.hold_seconds).filter(Number.isFinite)
  const mean = excursions.length ? round(excursions.reduce((a, b) => a + b, 0) / excursions.length) : null
  const tracked = session.tracking_observed_seconds > 0 ? Math.round(100 * session.tracking_visible_seconds / session.tracking_observed_seconds) : null
  const warnings = []
  if (session.measurement_method === 'experimental webcam estimates' && session.completed_reps > 0 && included.length === 0) warnings.push('No completed rep measurements are usable for angle interpretation. The rep count alone does not verify movement quality.')
  if (reps.length > included.length) warnings.push(`${reps.length - included.length} measured rep(s) have tracking flags and are excluded from excursion statistics and comparisons.`)
  if ((session.rejected_angle_samples ?? 0) > 0) warnings.push(`${session.rejected_angle_samples} angle sample(s) were rejected by camera-quality checks.`)
  if (session.calibration_start === null || session.calibration_target === null) {
    if (session.measurement_method === 'experimental webcam estimates') warnings.push('Reference positions are missing.')
  }
  if (excursions.length > 1 && Math.max(...excursions) - Math.min(...excursions) > Math.max(10, mean * .35)) warnings.push('Large observed differences between reps. Verify the camera and tracking before interpreting this as a movement difference.')
  return { measured_reps: reps.length, included_reps: included.length, excluded_reps: reps.length - included.length,
    mean_excursion: mean, min_excursion: excursions.length ? Math.min(...excursions) : null,
    max_excursion: excursions.length ? Math.max(...excursions) : null,
    shortest_hold: holds.length ? Math.min(...holds) : null,
    visibility_percent: tracked === null ? null : Math.max(0, Math.min(100, tracked)), warnings,
    quality_version: QUALITY_VERSION }
}

const HISTORY_KEY = 'pt-form-coach-review-history-v1'
export function loadReviewHistory(storage) {
  try {
    const value = JSON.parse(storage.getItem(HISTORY_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item) => item?.session && typeof item.profile === 'string') : []
  } catch { return [] }
}
export function saveReviewHistory(storage, record) {
  const history = loadReviewHistory(storage).filter((item) => item.id !== record.id)
  storage.setItem(HISTORY_KEY, JSON.stringify([record, ...history].slice(0, 20)))
}
export function previousComparable(history, session, profile, currentId) {
  if (!profile.trim()) return null
  return history.find((row) => row.id !== currentId && row.profile === profile.trim() &&
    row.session.exercise_id === session.exercise_id && row.session.movement_part === session.movement_part &&
    row.session.side === session.side && row.session.measurement_method === session.measurement_method &&
    row.session.quality_version === QUALITY_VERSION && session.quality_version === QUALITY_VERSION &&
    reviewEvidence(row.session).included_reps > 0 && reviewEvidence(session).included_reps > 0 &&
    reviewEvidence(row.session).warnings.length === 0 && reviewEvidence(session).warnings.length === 0 &&
    Number.isFinite(row.session.calibration_start) && Number.isFinite(session.calibration_start) &&
    Math.abs(row.session.calibration_start - session.calibration_start) <= 5 &&
    Math.abs(row.session.calibration_target - session.calibration_target) <= 5 &&
    row.session.hold_goal_seconds === session.hold_goal_seconds) ?? null
}
