export const ARM_POINTS = { left: [23, 11, 13], right: [24, 12, 14] }

export function shoulderAngle(landmarks, arm, width, height) {
  const points = ARM_POINTS[arm].map((index) => landmarks?.[index])
  if (!points.every((p) => p && (p.visibility ?? 0) >= 0.6 &&
    Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) return null
  const [hip, shoulder, elbow] = points
  const a = [(hip.x - shoulder.x) * width, (hip.y - shoulder.y) * height]
  const b = [(elbow.x - shoulder.x) * width, (elbow.y - shoulder.y) * height]
  const length = Math.hypot(...a) * Math.hypot(...b)
  if (length < 1) return null
  return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / length))) * 180 / Math.PI
}

export const newMovement = () => ({ phase: 'begin', holdStart: null, reps: 0 })

export function advanceMovement(previous, angle, now, target) {
  const next = { ...previous }
  if (angle === null) {
    // A lost view invalidates an unfinished rep, preventing unseen movements from counting.
    next.phase = 'begin'
    next.holdStart = null
    return next
  }
  if (next.phase === 'begin' && angle < 25) next.phase = 'raise'
  else if (next.phase === 'raise' && angle >= target) {
    next.phase = 'hold'
    next.holdStart = now
  } else if (next.phase === 'hold') {
    if (angle < target) {
      next.phase = 'raise'
      next.holdStart = null
    } else if (now - next.holdStart >= 1000) {
      next.phase = 'lower'
      next.holdStart = null
    }
  } else if (next.phase === 'lower' && angle < 25) {
    next.reps += 1
    next.phase = 'raise'
  }
  return next
}

export const MOVEMENT_CUES = {
  begin: 'Lower arm to begin', raise: 'Raise arm',
  hold: 'Hold', lower: 'Lower arm to finish',
}
