// All coordinates use source-video pixels. CSS mirrors video and canvas together.
export function targetGeometry(landmarks, indices, degrees, width, height) {
  if (!Number.isFinite(degrees) || degrees < 0 || degrees > 180) return null
  const points = indices.map((index) => landmarks?.[index])
  if (!points.every((p) => p && (p.visibility ?? 0) >= 0.65 &&
    Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) return null
  const [a, pivot, end] = points.map((p) => ({ x: p.x * width, y: p.y * height }))
  const refAngle = Math.atan2(a.y - pivot.y, a.x - pivot.x)
  const currentAngle = Math.atan2(end.y - pivot.y, end.x - pivot.x)
  const radius = Math.hypot(end.x - pivot.x, end.y - pivot.y)
  if (radius < 8 || Math.hypot(a.x - pivot.x, a.y - pivot.y) < 8) return null
  const radians = degrees * Math.PI / 180
  const options = [refAngle + radians, refAngle - radians]
  const wrap = (value) => Math.atan2(Math.sin(value), Math.cos(value))
  // Follow the currently demonstrated movement plane, rather than flipping the target across the joint.
  const targetAngle = options.sort((x, y) => Math.abs(wrap(x - currentAngle)) - Math.abs(wrap(y - currentAngle)))[0]
  const rotation = wrap(targetAngle - currentAngle)
  return { pivot, end, target: { x: pivot.x + Math.cos(targetAngle) * radius, y: pivot.y + Math.sin(targetAngle) * radius }, radius, rotation, currentAngle, targetAngle }
}

export function drawTargetGuide(context, landmarks, indices, degrees, width, height, matched, wristIndex = null) {
  const g = targetGeometry(landmarks, indices, degrees, width, height)
  if (!g) return
  const color = matched ? '#6dffb5' : '#ffd478'
  const thickness = Math.max(3, width / 220)
  context.save()
  context.strokeStyle = color
  context.fillStyle = matched ? '#6dffb52e' : '#ffd4782e'
  context.lineWidth = thickness
  context.shadowColor = '#000000'
  context.shadowBlur = 5
  context.setLineDash([width / 65, width / 100])
  context.beginPath()
  context.moveTo(g.pivot.x, g.pivot.y)
  context.lineTo(g.target.x, g.target.y)
  let target = g.target
  const wrist = wristIndex === null ? null : landmarks[wristIndex]
  if (wrist && wrist.visibility >= 0.65 && wrist.x >= 0 && wrist.x <= 1 && wrist.y >= 0 && wrist.y <= 1) {
    const dx = wrist.x * width - g.end.x
    const dy = wrist.y * height - g.end.y
    target = { x: g.target.x + dx * Math.cos(g.rotation) - dy * Math.sin(g.rotation), y: g.target.y + dx * Math.sin(g.rotation) + dy * Math.cos(g.rotation) }
    context.lineTo(target.x, target.y)
  }
  context.stroke()
  context.setLineDash([])
  const marker = Math.max(12, width / 38)
  context.beginPath(); context.arc(target.x, target.y, marker, 0, Math.PI * 2); context.fill(); context.stroke()
  context.beginPath(); context.moveTo(target.x - marker * 0.45, target.y); context.lineTo(target.x + marker * 0.45, target.y)
  context.moveTo(target.x, target.y - marker * 0.45); context.lineTo(target.x, target.y + marker * 0.45); context.stroke()
  // A short arc indicates the direction from the actual limb toward its target.
  context.setLineDash([5, 5])
  context.beginPath()
  context.arc(g.pivot.x, g.pivot.y, g.radius * 0.55, g.currentAngle, g.currentAngle + g.rotation, g.rotation < 0)
  context.stroke()
  context.restore()
}
