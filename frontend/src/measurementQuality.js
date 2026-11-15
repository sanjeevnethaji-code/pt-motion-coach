export const QUALITY_VERSION = 3
export const median = (values) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
export const newSignalFilter = () => ({ samples: [], last: null, time: null })

export function filterMeasurement(filter, reading, now, calibration = null) {
  if (!reading.visible || reading.value === null) {
    filter.samples = []
    return { ...reading, quality: reading.quality ?? 'unavailable' }
  }
  const reject = (reason) => {
    filter.samples = []
    return { ...reading, value: null, visible: false, quality: 'rejected', reason }
  }
  if (calibration?.lengths && reading.lengths) {
    if (reading.lengths.some((length, index) => length / calibration.lengths[index] < 0.60 || length / calibration.lengths[index] > 1.65)) {
      return reject('The camera view or projected limb length changed. Keep the camera fixed and use a side view; recalibrate if needed.')
    }
  }
  if (filter.last !== null && now - filter.time < 1200) {
    const allowance = Math.max(15, 260 * (now - filter.time) / 1000)
    if (Math.abs(reading.value - filter.last) > allowance) return reject('A sudden angle jump was rejected. Keep the selected joints in view; do not change your exercise range to satisfy the app.')
  }
  if (calibration?.start !== null && calibration?.target !== null && Number.isFinite(calibration?.start) && Number.isFinite(calibration?.target)) {
    const low = Math.min(calibration.start, calibration.target)
    const high = Math.max(calibration.start, calibration.target)
    const margin = Math.max(10, (high - low) * 0.20)
    if (reading.value < low - margin || reading.value > high + margin) return reject('The measured angle is outside the recorded reference range. Check the view and reference positions; do not stretch farther.')
  }
  filter.samples = [...filter.samples.slice(-2), reading.value]
  // A minimum of three consistent observations prevents one frame from driving a rep.
  if (filter.samples.length < 3) return { ...reading, value: null, visible: false, quality: 'settling', reason: 'Checking a stable angle. Keep the joints visible for a moment.' }
  const value = median(filter.samples)
  filter.last = value
  filter.time = now
  return { ...reading, value, quality: 'accepted' }
}

export function repQuality(row, session) {
  const flags = []
  if (session.quality_version !== QUALITY_VERSION) flags.push('Older session without measurement-quality checks')
  if ((row.rejected_samples ?? 0) > 0) flags.push('Angle samples were rejected during this rep')
  if ((row.tracking_gaps ?? 0) > 0) flags.push('Tracking was lost during this rep')
  if (!Number.isFinite(row.start_angle) || !Number.isFinite(row.held_angle) || !Number.isFinite(row.return_angle)) flags.push('Stable endpoint measurements are missing')
  if (session.movement_part === 'elbow' && row.held_angle >= 175) flags.push('Near-overlap elbow geometry in the camera view')
  if (row.hold_seconds === null) flags.push('Completed hold was not measured')
  if (Number.isFinite(session.calibration_start) && Number.isFinite(session.calibration_target) && Number.isFinite(row.excursion_degrees)) {
    const referenceSpan = Math.abs(session.calibration_target - session.calibration_start)
    if (Math.abs(row.excursion_degrees - referenceSpan) > Math.max(10, referenceSpan * 0.30)) flags.push('Observed excursion differs substantially from the recorded reference span')
  }
  return flags
}
