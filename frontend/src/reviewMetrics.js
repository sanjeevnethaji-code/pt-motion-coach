export const createRepRecorder = () => ({ rows: [], current: null })
const round = (number) => Math.round(number * 10) / 10

export function recordRepFrame(recorder, previous, next, value, now) {
  if (next.phase === 'start') { recorder.current = null; return }
  if (previous.phase === 'start' && next.phase === 'out') {
    recorder.current = { started: now, min: value, max: value, hold: null }
  }
  const current = recorder.current
  if (!current) return
  if (Number.isFinite(value)) {
    current.min = Math.min(current.min, value)
    current.max = Math.max(current.max, value)
  }
  if (previous.phase === 'hold' && next.phase === 'back' && previous.since !== null) {
    current.hold = round((now - previous.since) / 1000)
  }
  if (next.reps > previous.reps) {
    recorder.rows.push({ rep: next.reps, min_angle: round(current.min), max_angle: round(current.max),
      excursion_degrees: round(current.max - current.min), hold_seconds: current.hold,
      cycle_seconds: round((now - current.started) / 1000) })
    recorder.current = { started: now, min: value, max: value, hold: null }
  }
}

export function reviewEvidence(session) {
  const reps = session.rep_details ?? []
  const excursions = reps.map((row) => row.excursion_degrees).filter(Number.isFinite)
  const holds = reps.map((row) => row.hold_seconds).filter(Number.isFinite)
  const mean = excursions.length ? round(excursions.reduce((a, b) => a + b, 0) / excursions.length) : null
  const tracked = session.tracking_observed_seconds > 0
    ? Math.round(100 * session.tracking_visible_seconds / session.tracking_observed_seconds) : null
  return { measured_reps: reps.length, mean_excursion: mean,
    min_excursion: excursions.length ? Math.min(...excursions) : null,
    max_excursion: excursions.length ? Math.max(...excursions) : null,
    shortest_hold: holds.length ? Math.min(...holds) : null,
    visibility_percent: tracked === null ? null : Math.max(0, Math.min(100, tracked)) }
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
    row.session.rep_details?.length > 0 && session.rep_details?.length > 0 &&
    Number.isFinite(row.session.calibration_start) && Number.isFinite(session.calibration_start) &&
    Math.abs(row.session.calibration_start - session.calibration_start) <= 5 &&
    Math.abs(row.session.calibration_target - session.calibration_target) <= 5 &&
    row.session.hold_goal_seconds === session.hold_goal_seconds) ?? null
}
