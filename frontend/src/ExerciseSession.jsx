import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createRepRecorder, recordRepFrame } from './reviewMetrics'
import { buildSessionPayload } from './sessionSummary'
import { COACHING, measureExercise, advanceCoach, positionProgress } from './coaching'

export default function ExerciseSession({ exercise, poseSampleRef, cameraOn, onCoachUpdate, actionsRef, onReview }) {
  const config = COACHING[exercise.id]
  const [side, setSide] = useState('right')
  const [part, setPart] = useState('elbow')
  const kind = part === 'wrist' ? 'guided' : config.kind
  const [voice, setVoice] = useState(true)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [goal, setGoal] = useState(3)
  const [hold, setHold] = useState(2)
  const [duration, setDuration] = useState(20)
  const [first, setFirst] = useState(null)
  const [second, setSecond] = useState(null)
  const [reading, setReading] = useState({ visible: false, value: null })
  const [coach, setCoach] = useState({ phase: 'start', since: null, reps: 0 })
  const [seconds, setSeconds] = useState(0)
  const [clock, setClock] = useState(0)
  const [heldSeconds, setHeldSeconds] = useState(0)
  const [message, setMessage] = useState('')
  const coachRef = useRef({ phase: 'start', since: null, reps: 0 })
  const elapsedRef = useRef(0)
  const heldRef = useRef(0)
  const lastTickRef = useRef(null)
  const lastPoseRef = useRef(null)
  const samplesRef = useRef([])
  const lastSpokenRef = useRef('')
  const interruptionsRef = useRef(0)
  const wasVisibleRef = useRef(null)
  const repRecorderRef = useRef(createRepRecorder())
  const observedRef = useRef(0)
  const visibleTimeRef = useRef(0)

  function say(text) {
    if (!voice || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now()
      setClock(now)
      const sample = poseSampleRef.current
      const fresh = cameraOn && sample && now - sample.time < 600 && !document.hidden
      const next = fresh ? measureExercise(sample.landmarks, config, side, sample.width, sample.height) : { visible: false, value: null, reason: cameraOn ? 'Waiting for a fresh tracking frame. Keep the app visible.' : 'Start the camera first.' }
      setReading(next)
      if (next.value !== null) samplesRef.current = [...samplesRef.current.slice(-9), next.value]
      else samplesRef.current = []
      const dt = lastTickRef.current === null ? 0 : Math.min(0.2, (now - lastTickRef.current) / 1000)
      lastTickRef.current = now
      if (!running) return
      observedRef.current += dt
      if (next.visible) visibleTimeRef.current += dt
      if (wasVisibleRef.current === true && !next.visible) interruptionsRef.current += 1
      wasVisibleRef.current = next.visible
      if (!next.visible) {
        const before = coachRef.current
        coachRef.current = kind === 'auto' ? advanceCoach(coachRef.current, null, now, first, second, hold * 1000) : { ...coachRef.current, phase: 'start', since: null }
        if (kind === 'auto') recordRepFrame(repRecorderRef.current, before, coachRef.current, null, now)
        setCoach(coachRef.current)
        return
      }
      elapsedRef.current += dt
      setSeconds(Math.floor(elapsedRef.current))
      if (kind === 'auto' && sample.time !== lastPoseRef.current) {
        const before = coachRef.current
        coachRef.current = advanceCoach(coachRef.current, next.value, now, first, second, hold * 1000)
        setCoach(coachRef.current)
        recordRepFrame(repRecorderRef.current, before, coachRef.current, next.value, now)
        lastPoseRef.current = sample.time
        if (coachRef.current.reps >= goal) { setRunning(false); setFinished(true) }
      } else if (kind === 'guided' && coachRef.current.phase === 'hold') {
        if (now - coachRef.current.since >= hold * 1000) {
          coachRef.current = { ...coachRef.current, phase: 'back', since: null }
          setCoach(coachRef.current)
        }
      } else if (kind === 'timed') {
        heldRef.current += dt
        setHeldSeconds(Math.floor(heldRef.current))
        if (heldRef.current >= duration) { setRunning(false); setFinished(true) }
      }
    }, 100)
    return () => clearInterval(id)
  }, [running, cameraOn, config, side, kind, first, second, hold, goal, duration, poseSampleRef])

  const cameraSteps = part === 'wrist' ? config.wristSteps : config.cameraSteps
  const calibrationCue = first === null ? config.calibration?.[0] : config.calibration?.[1]
  let cue = `${cameraSteps[0]} Then start coaching below.`
  if (kind === 'auto' && (first === null || second === null)) cue = calibrationCue
  if (running) {
    if (!reading.visible) cue = 'Tracking paused. Show the selected body parts to the camera.'
    else if (kind === 'timed') cue = config.out
    else if (kind === 'guided') cue = coach.phase === 'hold'
      ? `Hold within your prescribed limit for ${hold} seconds.`
      : coach.phase === 'back'
        ? part === 'wrist' ? 'Return your wrist to its starting position, then confirm the rep.' : `${config.back} Then confirm the rep.`
        : part === 'wrist' ? 'Keep the forearm supported. Gently bend your wrist upward within your limit, then confirm.' : config.out
    else cue = {
      start: `${cameraSteps[0]} Return to your recorded starting position and stay still briefly.`,
      out: config.out,
      hold: `Recorded angle reached. Hold still for ${hold} seconds.`,
      back: config.back,
    }[coach.phase]
  }
  if (finished) cue = 'Session complete. Rest. Choose Next exercise when you are ready.'
  const spokenCue = running && coach.phase === 'out' && coach.reps > 0 ? `Rep ${coach.reps} complete. Next rep: ${cue}` : cue
  const desiredPosition = coach.phase === 'start' || coach.phase === 'back' ? first : second
  const progress = positionProgress(reading.value, first, second)
  const matching = running && kind === 'auto' && progress !== null &&
    (coach.phase === 'start' || coach.phase === 'back' ? progress <= 0.15 : progress >= (coach.phase === 'hold' ? 0.70 : 0.85))
  const feedback = !cameraOn ? 'Camera off' : !reading.visible ? 'Move into view — counting paused'
    : finished ? 'Session complete'
    : kind !== 'auto' ? 'Visible · form requires confirmation'
    : first === null || second === null ? 'Record your two approved positions below'
    : !running ? 'Ready · start coaching below'
    : matching ? coach.phase === 'hold' ? 'Recorded angle reached · hold here' : coach.phase === 'back' ? 'Return position reached · stay still briefly' : 'Starting angle matched'
    : 'Position not matched yet · follow the movement cue'
  const holdRemaining = running && coach.phase === 'hold' && coach.since !== null
    ? Math.max(0, Math.ceil((hold * 1000 - (clock - coach.since)) / 1000)) : null

  const postureReminder = part === 'wrist' ? 'Support the forearm. Move the wrist without lifting the shoulder.' : {
    'heel-slides': 'Lie back. Keep the heel on the surface; bend the knee instead of lifting the whole leg.',
    'heel-props': 'Support the heel or ankle as prescribed. Let the knee relax; do not push it down.',
    'ankle-pumps': 'Support the leg. Keep the knee still and move at the ankle.',
    pendulum: 'Support yourself with the other hand. Let the exercise arm hang loose; move your body gently.',
    'elbow-wrist': 'Support the upper arm. Move at the elbow without lifting the shoulder; use prescribed assistance.',
    'external-rotation': 'Support the elbow near your side. Use prescribed assistance and keep the shoulder relaxed.',
  }[exercise.id]
  const blocker = finished ? 'Session ended. Reset to start another set.'
    : !cameraOn ? 'Camera is off.'
    : !reading.visible ? reading.reason ?? 'Selected joints are not clearly visible.'
    : kind === 'timed' ? 'This exercise records time, not automatic reps.'
    : kind === 'guided' ? 'Manual confirmation is required for this movement. Use the confirmation button below.'
    : first === null ? 'Record your starting position using button 1.'
    : second === null ? 'Record your second position using button 2.'
    : !running ? 'Camera is on, but counting is paused. Click Start counting / coaching.'
    : coach.phase === 'start' ? 'The starting position has not been held steady yet.'
    : coach.phase === 'out' ? 'The recorded movement position has not been reached yet. Stay within your approved range.'
    : coach.phase === 'hold' ? 'The movement position is reached. Finish the hold before returning.'
    : 'The hold is done. Return to the starting position and steady briefly to count the rep.'

  useEffect(() => {
    onCoachUpdate?.({
      exerciseId: exercise.id, name: exercise.name, cue, feedback, matching,
      steps: cameraSteps, side, setup: config.setup,
      metric: part === 'wrist' ? null : config.metric,
      angle: reading.value, target: kind === 'auto' ? desiredPosition : null,
      reps: coach.reps, goal, holdRemaining,
      timer: kind === 'timed' ? `${heldSeconds} / ${duration}s` : null,
      automatic: kind === 'auto',
      phase: finished ? 'complete' : !running ? 'ready' : !reading.visible ? 'paused' : kind === 'timed' ? 'timed' : coach.phase,
      remaining: Math.max(0, goal - coach.reps),
      blocker, postureReminder, message, running, finished, firstRecorded: first !== null, secondRecorded: second !== null, visible: reading.visible,
      progress: progress === null ? null : Math.round(Math.max(0, Math.min(1, progress)) * 100),
    })
  }, [onCoachUpdate, exercise.id, exercise.name, cue, feedback, matching, part, config.metric,
    reading.value, kind, desiredPosition, coach.reps, goal, holdRemaining, heldSeconds, duration, cameraSteps, side, config.setup, finished, running, reading.visible, coach.phase, first, second, progress, message, blocker, postureReminder])


  useEffect(() => {
    if (lastSpokenRef.current === spokenCue) return
    lastSpokenRef.current = spokenCue
    if (voice && (running || finished) && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(spokenCue)
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }, [spokenCue, voice, running, finished])

  useEffect(() => () => { window.speechSynthesis?.cancel() }, [])

  function reset(clearCalibration = false) {
    setRunning(false); setFinished(false); setSeconds(0); setHeldSeconds(0); setMessage('')
    elapsedRef.current = 0; heldRef.current = 0; lastTickRef.current = null
    interruptionsRef.current = 0; wasVisibleRef.current = null
    repRecorderRef.current = createRepRecorder(); observedRef.current = 0; visibleTimeRef.current = 0
    coachRef.current = { phase: 'start', since: null, reps: 0 }
    setCoach(coachRef.current)
    window.speechSynthesis?.cancel()
    if (clearCalibration) { setFirst(null); setSecond(null); samplesRef.current = [] }
  }

  function capture(which) {
    const values = samplesRef.current
    if (!reading.visible || values.length < 5 || Math.max(...values) - Math.min(...values) > 6) {
      setMessage('Keep the selected joints visible and still for a moment, then try again.'); return
    }
    const value = values.reduce((a, b) => a + b, 0) / values.length
    reset(false)
    if (which === 'second' && Math.abs(value - first) < 8) {
      setMessage('The camera cannot distinguish these two positions. Do not increase your range for the app; use the guided exercise options or ask for help.'); return
    }
    if (which === 'first') { setFirst(value); setSecond(null) } else setSecond(value)
    setMessage('Position recorded. These are demo reference positions, not prescribed targets.')
  }

  const canStart = cameraOn && reading.visible && (kind !== 'auto' || (first !== null && second !== null))
  function startCoaching() {
    if (!canStart || finished) return
    lastTickRef.current = null
    wasVisibleRef.current = null
    lastPoseRef.current = null
    lastSpokenRef.current = ''
    setRunning(true)
  }
  function reviewResults() {
    setRunning(false)
    window.speechSynthesis?.cancel()
    onReview?.({
      session: {
        ...buildSessionPayload(exercise, kind, part, coachRef.current.reps, goal, elapsedRef.current, interruptionsRef.current),
        exercise_id: exercise.id, side, movement_part: exercise.id === 'elbow-wrist' ? part : 'primary',
        rep_details: kind === 'auto' ? repRecorderRef.current.rows : [],
        tracking_observed_seconds: Math.round(observedRef.current * 10) / 10,
        tracking_visible_seconds: Math.round(visibleTimeRef.current * 10) / 10,
        calibration_start: kind === 'auto' ? first : null,
        calibration_target: kind === 'auto' ? second : null,
        hold_goal_seconds: kind === 'timed' ? null : hold,
        time_goal_seconds: kind === 'timed' ? duration : null,
      },
      side, timeGoal: duration,
      completedGoal: kind === 'timed' ? heldRef.current >= duration : coachRef.current.reps >= goal,
    })
  }
  useImperativeHandle(actionsRef, () => ({
    recordStart: () => capture('first'), recordTarget: () => capture('second'),
    start: startCoaching,
    pause: () => { setRunning(false); coachRef.current = { ...coachRef.current, phase: 'start', since: null, lostAt: null }; setCoach(coachRef.current); window.speechSynthesis?.cancel() },
    reset: () => reset(), review: reviewResults,
  }))

  return <section id="exercise-coach" className="exercise-session" aria-label={`${exercise.name} coach`}>
    <div className="session-heading"><h2>Your exercise coach</h2><span className="badge">{kind === 'auto' ? 'Experimental automatic reps' : kind === 'timed' ? 'Visibility-assisted timer' : 'Guided · confirm reps yourself'}</span></div>
    <p className="session-note">Only do exercises cleared for your recovery stage. Use your care team’s range, assistance, repetitions, and times. Stop for pain. The camera does not establish safety.</p>
    <p><strong>Camera setup:</strong> {config.setup}</p>
    <ol className="ready-list">{config.steps.map((step) => <li key={step}>{step}</li>)}</ol>
    <div className="controls">
      <button className="secondary" onClick={() => say(cameraSteps.join(' '))}>Read instructions aloud</button>
      <button className="secondary" aria-pressed={voice} onClick={() => { setVoice(!voice); window.speechSynthesis?.cancel() }}>Voice {voice ? 'On' : 'Off'}</button>
    </div>
    <div className="coach-settings">
      <label>Body side<select disabled={running} value={side} onChange={(e) => { reset(true); setSide(e.target.value) }}><option value="left">Left</option><option value="right">Right</option></select></label>
      {exercise.id === 'elbow-wrist' && <label>Movement<select value={part} disabled={running} onChange={(e) => { reset(true); setPart(e.target.value) }}><option value="elbow">Elbow · automatic reps</option><option value="wrist">Wrist · guided reps</option></select></label>}
      {kind !== 'timed' && <label>Reps<input type="number" min="1" max="50" value={goal} disabled={running} onChange={(e) => { reset(); setGoal(Math.max(1, Math.min(50, Number(e.target.value) || 1))) }} /></label>}
      {kind !== 'timed' && <label>Hold seconds<input type="number" min="1" max="30" value={hold} disabled={running} onChange={(e) => { reset(); setHold(Math.max(1, Math.min(30, Number(e.target.value) || 1))) }} /></label>}
      {kind === 'timed' && <label>Session seconds<input type="number" min="1" max="600" value={duration} disabled={running} onChange={(e) => { reset(); setDuration(Math.max(1, Math.min(600, Number(e.target.value) || 1))) }} /></label>}
    </div>
    <p className="privacy">Initial numbers are demo rehearsal settings, not a treatment prescription.</p>
    {kind === 'auto' && <div className="calibration-panel">
      <p><strong>First:</strong> {config.calibration?.[0]}<br /><strong>Second:</strong> {config.calibration?.[1]}<br />Hold still briefly before recording. Keep the camera fixed; do not exceed your prescribed range.</p>
      <div className="controls">
        <button className="secondary" disabled={running || !reading.visible} onClick={() => capture('first')}>1. Record start {first !== null ? '✓' : ''}</button>
        <button className="secondary" disabled={running || !reading.visible || first === null} onClick={() => capture('second')}>2. Record second position {second !== null ? '✓' : ''}</button>
      </div>
    </div>}
    {message && <p role="status">{message}</p>}
    <div className="coach-cue" role="status"><span>COACH</span><strong>{cue}</strong>{kind === 'auto' && first !== null && second !== null && <p>Start: {Math.round(first)}° → Move: {Math.round(second)}° → Hold {hold}s → Return: {Math.round(first)}°. One complete cycle counts as one rep.</p>}</div>
    <div className="movement-stats">
      {config.metric && part !== 'wrist' && <div><span>{config.metric} · estimated 2D</span><strong>{reading.value === null ? '—' : `${Math.round(reading.value)}°`}</strong></div>}
      <div><span>{kind === 'timed' ? 'Visible time / goal' : 'Reps / goal'}</span><strong>{kind === 'timed' ? `${heldSeconds} / ${duration}s` : `${coach.reps} / ${goal}`}</strong></div>
      <div><span>Tracked session time</span><strong>{seconds}s</strong></div>
    </div>
    <p className="manual-note"><strong>Why a rep has not counted:</strong> {blocker}<br /><strong>Posture reminder:</strong> {postureReminder}<br />{config.limit}</p>
    <div className="controls">
      <button className="primary" disabled={running || finished || !canStart} onClick={startCoaching}>Start / Resume Coaching</button>
      <button className="secondary" disabled={!running} onClick={() => { setRunning(false); coachRef.current = { ...coachRef.current, phase: 'start', since: null }; setCoach(coachRef.current); window.speechSynthesis?.cancel() }}>Pause</button>
      {kind === 'guided' && <button className="secondary" disabled={!running || !reading.visible} onClick={() => {
        if (coachRef.current.phase === 'hold') return
        if (coachRef.current.phase !== 'back') {
          coachRef.current = { ...coachRef.current, phase: 'hold', since: performance.now() }
          setCoach(coachRef.current)
          return
        }
        const next = { phase: 'start', since: null, reps: coachRef.current.reps + 1 }
        coachRef.current = next; setCoach(next)
        if (next.reps >= goal) { setRunning(false); setFinished(true) }
      }}>{coach.phase === 'hold' ? 'Hold…' : coach.phase === 'back' ? 'I returned — complete rep' : 'I reached my approved position'}</button>}
      <button className="primary" onClick={reviewResults}>Finish &amp; Review Results</button>
      <button className="secondary" onClick={() => reset()}>Reset Session</button>
    </div>
    <p className="privacy">Tracking loss pauses timing and cancels an unfinished rep. Results stay on this screen only.</p>
    <a href={config.source} target="_blank" rel="noreferrer">Exercise information source</a>
  </section>
}
