const ACL_SOURCE = 'https://www.cuh.nhs.uk/patient-information/knee-arthroscopy-post-operative-advice/'
const SHOULDER_SOURCE = 'https://www.boneandjoint.psu.edu/course/rotator_cuff/rc_recovery/rc_post_exercises.html'
export const COACHING = {
  'heel-slides': {
    kind: 'auto', metric: 'Knee bend', points: { left: [23, 25, 27], right: [24, 26, 28] }, bend: true,
    setup: 'Place the camera at your side, with your hip, knee, and ankle visible.',
    steps: ['Lie on your back with the leg supported on the bed or mat.', 'Keep your heel on the surface. Slide it toward your bottom to bend the knee within your prescribed range.', 'Pause only as instructed, then slide the heel away to straighten the leg back to its starting position.'],
    cameraSteps: ['Lie back. Keep your heel on the bed or mat.', 'Slide your heel toward your bottom. Bend the knee within your limit.', 'Slide the heel away to return. Do not lift the whole leg.'],
    calibration: ['Record the leg in its approved starting position.', 'Slide the heel toward you within your approved limit, then record the bent position.'],
    out: 'Slide your heel toward you, within your approved range.', back: 'Slide your heel away to the starting position.',
    limit: 'The camera estimates knee bend. It cannot verify heel contact or your prescribed limit.', source: ACL_SOURCE,
  },
  'heel-props': {
    kind: 'timed', metric: 'Knee bend', points: { left: [23, 25, 27], right: [24, 26, 28] }, bend: true,
    setup: 'Place the camera at your side. Keep the whole selected leg visible.',
    steps: ['Sit or lie with your leg supported and a rolled towel under the heel or ankle, as instructed.', 'Leave the knee unsupported so it can relax toward straight. Do not push it down.', 'Rest in this position for your prescribed time, then release the position.'],
    cameraSteps: ['Support the heel or ankle on your prescribed towel or prop.', 'Let the knee relax toward straight. Do not press it down.', 'Remain for your prescribed time. This is a hold, not a leg lift.'],
    out: 'Stay relaxed in your prescribed heel-prop position.',
    limit: 'Times are rehearsal settings. The camera cannot check support placement or approve knee extension.',
    source: 'https://www.myplannedcare.nhs.uk/wp-content/uploads/wpfd/preview_files/Knee-Arthroscopy%286915849303a3fe93657587cb9c469f00%29.pdf',
  },
  'ankle-pumps': {
    kind: 'auto', metric: 'Shin–foot angle', points: { left: [25, 27, 31], right: [26, 28, 32] },
    setup: 'Use a close side view showing your knee, ankle, heel, and toes. Keep the camera fixed.',
    steps: ['Sit or lie with your back and leg supported.', 'Keep the leg still and draw your toes toward your shin by bending the ankle.', 'Point the foot away from you, then repeat gently within your approved range.'],
    cameraSteps: ['Rest your leg. Move at the ankle, not the hip.', 'Pull your toes toward your shin.', 'Point the foot away, then bring it back.'],
    calibration: ['Bring the toes toward your shin within your approved range. Record this first position.', 'Point the foot away within your approved range. Record this second position.'],
    out: 'Point your foot away to the position you recorded.', back: 'Bring your toes back toward your shin to the first position.',
    limit: 'Experimental foot tracking. Small foot landmarks may be inaccurate; this is not a clinical ankle measurement.', source: ACL_SOURCE,
  },
  pendulum: {
    kind: 'timed', points: { left: [11, 13, 15], right: [12, 14, 16] },
    setup: 'Use a front or angled view with the hanging arm visible. Place support within reach.',
    steps: ['Lean forward with your non-operated hand supported on a stable table.', 'Let the operated arm hang loosely. Keep the shoulder relaxed.', 'Gently rock your body so the hanging arm swings a little forward and back. Do not actively lift the arm.'],
    cameraSteps: ['Lean forward. Support yourself with the other hand.', 'Let the exercise arm hang loose.', 'Gently rock your body to swing the arm. Do not lift it.'],
    out: 'Gently rock your body forward and back. Let the relaxed arm swing; do not lift it.',
    limit: 'Visibility and timing only. The camera cannot tell whether the shoulder muscles are relaxed or the movement is passive.', source: SHOULDER_SOURCE,
  },
  'elbow-wrist': {
    kind: 'auto', metric: 'Elbow bend', points: { left: [11, 13, 15], right: [12, 14, 16] }, bend: true,
    setup: 'Use a side view showing shoulder, elbow, and wrist. Keep the upper arm supported as instructed.',
    steps: ['Keep the upper arm supported as prescribed, without lifting the shoulder.', 'Bend the elbow to bring the hand toward you, then straighten it within your allowed range. Use assistance if prescribed.', 'For wrist mode, rest the forearm and bend the wrist gently up and down without moving the shoulder.'],
    cameraSteps: ['Support the upper arm. Keep the shoulder still.', 'Bend the elbow to bring your hand toward you.', 'Straighten the elbow to return. Use prescribed assistance.'],
    wristSteps: ['Rest your forearm on a support.', 'Bend the wrist so the hand moves upward.', 'Bend it gently downward, within your approved range.'],
    calibration: ['Record the elbow in your approved starting position.', 'Bend your elbow within your approved range and record the second position.'],
    out: 'Bend your elbow within your approved range.', back: 'Return your elbow to the starting position.',
    limit: 'Automatic counting measures elbow movement only. Wrist mode is guided and timed. If you also had a biceps repair, follow its specific assistance restrictions.', source: SHOULDER_SOURCE,
  },
  'external-rotation': {
    kind: 'guided', points: { left: [11, 13, 15], right: [12, 14, 16] },
    setup: 'Use the supported position and assistance demonstrated by your therapist.',
    steps: ['Lie on your back with the elbow supported on a rolled towel as shown by your therapist.', 'Keep the elbow bent and near your side. Use the other hand and a stick, only if prescribed, to guide the forearm outward.', 'Keep the operated shoulder relaxed. Stop at your prescribed limit and return with assistance.'],
    cameraSteps: ['Lie back. Support the elbow and keep it near your side.', 'Use prescribed assistance to guide the forearm outward.', 'Keep the shoulder relaxed. Return with assistance.'],
    out: 'Use your prescribed assistance to move outward within your limit.', back: 'Return with assistance to the starting position.',
    limit: 'Guided timing and manual confirmation only. A single webcam cannot reliably measure shoulder rotation or confirm that it is passive.', source: SHOULDER_SOURCE,
  },
}

const JOINT_NAMES = { 11: 'shoulder', 12: 'shoulder', 13: 'elbow', 14: 'elbow', 15: 'wrist', 16: 'wrist', 23: 'hip', 24: 'hip', 25: 'knee', 26: 'knee', 27: 'ankle', 28: 'ankle', 31: 'toes', 32: 'toes' }

export function measureExercise(landmarks, config, side, width, height) {
  const points = config.points[side].map((index) => landmarks?.[index])
  const valid = width > 0 && height > 0 && points.every((p) => p && (p.visibility ?? 0) >= 0.65 &&
    Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
  if (!valid) {
    const missing = config.points[side].filter((index) => {
      const p = landmarks?.[index]
      return !p || (p.visibility ?? 0) < 0.65 || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1
    }).map((index) => JOINT_NAMES[index])
    return { visible: false, value: null, reason: missing.length ? `Cannot reliably see your ${side} ${missing.join(', ')}. Adjust the camera or select the side you are using.` : 'Camera image is not ready.' }
  }
  if (!config.metric) return { visible: true, value: null }
  const [a, vertex, c] = points
  const u = [(a.x - vertex.x) * width, (a.y - vertex.y) * height]
  const v = [(c.x - vertex.x) * width, (c.y - vertex.y) * height]
  const denominator = Math.hypot(...u) * Math.hypot(...v)
  const lengths = [Math.hypot(...u), Math.hypot(...v)]
  if (lengths.some((length) => length < Math.max(12, width * 0.018))) return { visible: false, value: null, reason: 'The limb is too small or foreshortened in this view. Adjust the camera for a clear side view of all three joints.' }
  if (Math.hypot((a.x - c.x) * width, (a.y - c.y) * height) < Math.max(10, Math.min(...lengths) * 0.15)) return { visible: false, value: null, reason: 'The outer joints overlap in this view, making the angle ambiguous. Use the demonstrated side view.' }
  if (denominator < 1) return { visible: false, value: null, reason: 'The selected joints overlap in this camera view. Use the side view shown in the setup.' }
  const angle = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / denominator))) * 180 / Math.PI
  if (config.bend && angle < 5) return { visible: false, value: null, quality: 'rejected', reason: 'The limb segments nearly overlap in this 2D view. That angle is ambiguous; use a clear side view or guided manual logging.' }
  return { visible: true, value: config.bend ? 180 - angle : angle, lengths }
}

export function positionProgress(value, first, second) {
  if (![value, first, second].every(Number.isFinite) || Math.abs(second - first) < 8) return null
  return (value - first) / (second - first)
}

export function advanceCoach(state, value, now, first, second, holdMs) {
  const progress = positionProgress(value, first, second)
  if (progress === null) {
    const lostAt = state.lostAt ?? now
    // A brief missed detection must not discard a completed hold or whole rep.
    // It still interrupts a hold, and time out of view never earns hold credit.
    return { ...state, lostAt, since: null,
      phase: now - lostAt >= 1000 ? 'start' : state.phase === 'hold' ? 'out' : state.phase }
  }
  const next = { ...state, lostAt: null }
  const atFirst = progress <= 0.15
  const atSecond = progress >= 0.85
  if (next.phase === 'start') {
    if (!atFirst) return { ...next, since: null }
    if (next.since === null) return { ...next, since: now }
    return now - next.since >= 250 ? { ...next, phase: 'out', since: null } : next
  }
  if (next.phase === 'out') return atSecond ? { ...next, phase: 'hold', since: now } : next
  if (next.phase === 'hold') {
    // Hysteresis avoids resetting the timer on a tiny angle fluctuation.
    if (progress < 0.70) return { ...next, phase: 'out', since: null }
    return now - next.since >= holdMs ? { ...next, phase: 'back', since: null } : next
  }
  if (next.phase === 'back') {
    if (!atFirst) return { ...next, since: null }
    if (next.since === null) return { ...next, since: now }
    return now - next.since >= 250 ? { ...next, phase: 'out', since: null, reps: next.reps + 1 } : next
  }
  return next
}
