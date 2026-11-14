import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { shoulderAngle, newMovement, advanceMovement, MOVEMENT_CUES } from './movement'
import { SURGERIES } from './exercises'
import { COACHING } from './coaching'
import { ARM_POINTS } from './movement'
import { drawTargetGuide } from './targetGuide'
import ExerciseSession from './ExerciseSession'
import ExercisePreview from './ExercisePreview'
import './App.css'

const cameraError = (error) => {
  if (['NotAllowedError', 'SecurityError'].includes(error.name)) return 'Camera access was blocked. Allow camera access in your browser’s site settings, then try again.'
  if (error.name === 'NotFoundError') return 'No camera was found. Connect a camera and try again.'
  if (['NotReadableError', 'AbortError'].includes(error.name)) return 'The camera could not start. Close other apps using it, then try again.'
  return 'We could not open your camera. Check your browser and camera settings, then try again.'
}

function App() {
  const coachActionsRef = useRef(null)
  const poseSampleRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const poseRef = useRef(null)
  const frameRef = useRef(null)
  const [liveCoach, setLiveCoach] = useState(null)
  const liveCoachRef = useRef(null)
  const updateCoach = useCallback((value) => {
    liveCoachRef.current = value
    setLiveCoach(value)
  }, [])
  const [screen, setScreen] = useState('welcome')
  const [surgeryId, setSurgeryId] = useState(null)
  const [exerciseId, setExerciseId] = useState(null)
  const exerciseRef = useRef(null)
  const surgery = SURGERIES.find((item) => item.id === surgeryId)
  const selectedExercise = surgery?.exercises.find((item) => item.id === exerciseId)
  const shoulderDemo = surgeryId === 'demo'
  const settingsRef = useRef({ arm: 'right', target: 80 })
  const movementRef = useRef(newMovement())
  const [arm, setArm] = useState('right')
  const [target, setTarget] = useState(80)
  const [angle, setAngle] = useState(null)
  const [movement, setMovement] = useState(newMovement)

  const resetSession = () => {
    movementRef.current = newMovement()
    setMovement(movementRef.current)
    setAngle(null)
  }

  const pauseMovement = () => {
    movementRef.current = advanceMovement(movementRef.current, null, 0, settingsRef.current.target)
    setMovement(movementRef.current)
    setAngle(null)
  }

  const [tracking, setTracking] = useState('Tracking off')

  const releaseTracking = () => {
    poseSampleRef.current = null
    cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    poseRef.current?.close()
    poseRef.current = null
    const canvas = canvasRef.current
    canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  const startTracking = async (request) => {
    setTracking('Loading body tracking…')
    let detector
    try {
      const base = import.meta.env.BASE_URL
      const vision = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`)
      if (request !== requestRef.current) return
      detector = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `${base}mediapipe/models/pose_landmarker_lite.task` },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      if (request !== requestRef.current) {
        detector.close()
        return
      }
      poseRef.current = detector
      let lastTime = -1
      let lastRun = -Infinity
      const render = (now) => {
        if (request !== requestRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        try {
          if (video.readyState >= 2 && video.currentTime !== lastTime && now - lastRun >= 50) {
            lastTime = video.currentTime
            lastRun = now
            const result = detector.detectForVideo(video, now)
            const context = canvas.getContext('2d')
            const width = video.videoWidth
            const height = video.videoHeight
            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width
              canvas.height = height
            }
            context.clearRect(0, 0, width, height)
            const landmarks = result.landmarks[0]
            poseSampleRef.current = { landmarks, width, height, time: now }
            const settings = settingsRef.current
            const demoActive = exerciseRef.current === 'shoulder-demo'
            const currentAngle = demoActive ? shoulderAngle(landmarks, settings.arm, width, height) : null
            setAngle(currentAngle)
            movementRef.current = advanceMovement(movementRef.current, currentAngle, now, settings.target)
            setMovement(movementRef.current)
            setTracking(!landmarks?.length ? 'Move into view' : demoActive && currentAngle === null
              ? 'Show your selected hip, shoulder, and elbow' : 'Tracking ready')
            if (landmarks) {
              const visible = (point) => (point.visibility ?? 1) >= 0.5
              context.strokeStyle = '#72f3c4'
              context.lineWidth = Math.max(2, width / 300)
              for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
                const a = landmarks[start]
                const b = landmarks[end]
                if (!visible(a) || !visible(b)) continue
                context.beginPath()
                context.moveTo(a.x * width, a.y * height)
                context.lineTo(b.x * width, b.y * height)
                context.stroke()
              }
              for (const point of landmarks) {
                if (!visible(point)) continue
                context.beginPath()
                context.arc(point.x * width, point.y * height, Math.max(3, width / 180), 0, Math.PI * 2)
                context.fillStyle = '#ffffff'
                context.fill()
                context.strokeStyle = '#146f5b'
                context.stroke()
                context.strokeStyle = '#72f3c4'
              }
              if (demoActive && currentAngle !== null) {
                const demoTarget = movementRef.current.phase === 'lower' ? 15 : settings.target
                drawTargetGuide(context, landmarks, ARM_POINTS[settings.arm], demoTarget, width, height,
                  movementRef.current.phase === 'lower' ? currentAngle < 25 : Math.abs(currentAngle - settings.target) <= 5,
                  settings.arm === 'left' ? 15 : 16)
              } else {
                const live = liveCoachRef.current
                const config = COACHING[exerciseRef.current]
                if (live?.exerciseId === exerciseRef.current && live.automatic && config && live.target !== null && live.phase !== 'complete') {
                  const geometricAngle = config.bend ? 180 - live.target : live.target
                  drawTargetGuide(context, landmarks, config.points[live.side], geometricAngle, width, height, live.matching)
                }
              }
            }
          }
          frameRef.current = requestAnimationFrame(render)
        } catch {
          releaseTracking()
          pauseMovement()
          setTracking('Tracking unavailable')
          setError('Body tracking stopped. Stop and restart the camera to try again. Your camera preview still works.')
        }
      }
      frameRef.current = requestAnimationFrame(render)
    } catch {
      if (request !== requestRef.current) return
      detector?.close()
      pauseMovement()
      setTracking('Tracking unavailable')
      setError('The body-tracking model could not load. Stop and restart the camera. If this continues, check that the model and MediaPipe files are available in the project.')
    }
  }
  const requestRef = useRef(0)
  const [status, setStatus] = useState('off')
  const [error, setError] = useState('')

  const stopCamera = () => {
    requestRef.current += 1
    releaseTracking()
    pauseMovement()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('off')
    setTracking('Tracking off')
    setError('')
  }


  const startCamera = async () => {
    requestRef.current += 1
    const request = requestRef.current
    setError('')
    setStatus('starting')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable. Open this app in Chrome using localhost or a secure HTTPS address.')
      setStatus('off')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      if (request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (request !== requestRef.current) return
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (request !== requestRef.current) return
          stopCamera()
          setError('The camera disconnected. Reconnect it and select Start Camera.')
        }
      })
      setStatus('on')
      void startTracking(request)
    } catch (err) {
      if (request !== requestRef.current) return
      stopCamera()
      setError(cameraError(err))
    }
  }

  useEffect(() => () => {
    requestRef.current += 1
    releaseTracking()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const navigate = (next) => {
    if (screen === 'camera') stopCamera()
    setScreen(next)
    window.scrollTo(0, 0)
  }
  const activeCoach = liveCoach?.exerciseId === exerciseId ? liveCoach : null
  const shortMoves = {
    'heel-slides': ['Slide heel toward you', 'Slide heel away'],
    'ankle-pumps': ['Point foot away', 'Bring toes toward you'],
    'elbow-wrist': ['Bend your elbow', 'Return to start'],
    'external-rotation': ['Move with assistance', 'Return with assistance'],
    pendulum: ['Gently swing relaxed arm', 'Rest'],
    'heel-props': ['Relax knee toward straight', 'Rest'],
  }
  let bigCue = shoulderDemo ? angle === null ? 'Move into view' : MOVEMENT_CUES[movement.phase] : 'Get ready'
  if (activeCoach) {
    const moves = shortMoves[exerciseId]
    bigCue = activeCoach.finished ? 'Set finished ✓'
      : !activeCoach.visible ? 'Move into view'
      : activeCoach.automatic && !activeCoach.firstRecorded ? 'Record starting position'
      : activeCoach.automatic && !activeCoach.secondRecorded ? 'Record movement target'
      : !activeCoach.running ? 'Press START COUNTING'
      : activeCoach.holdRemaining !== null ? `HOLD · ${activeCoach.holdRemaining}s`
      : activeCoach.phase === 'start' ? 'Return to start · steady'
      : activeCoach.phase === 'back' ? moves[1]
      : !activeCoach.automatic ? activeCoach.cue
      : moves[0]
  }
  const titles = {
    welcome: 'Welcome to PT Form Coach', surgery: 'Choose your surgery',
    exercise: 'Choose your exercise', ready: 'Ready to begin?',
    camera: selectedExercise?.name ?? 'Shoulder tracking demo',
  }

  return (
    <main className={`app ${screen === 'camera' ? 'camera-screen' : ''}`}>
      <div className="brand-row"><span className="brand-mark">PT</span> PT Form Coach</div>
      {screen !== 'welcome' && <nav className="screen-nav" aria-label="Session navigation">
        <button className="back-button" onClick={() => navigate(screen === 'surgery' ? 'welcome' : screen === 'exercise' ? 'surgery' : screen === 'ready' ? (shoulderDemo ? 'surgery' : 'exercise') : 'ready')}>← Back</button>
        <span>{surgery?.name ?? (shoulderDemo ? 'General demo' : 'Your session')}{selectedExercise ? ` / ${selectedExercise.name}` : ''}</span>
      </nav>}
      <header><p className="eyebrow">YOUR MOVEMENT SPACE</p><h1>{titles[screen]}</h1></header>

      {screen === 'welcome' && <section className="welcome-panel camera-card">
        <span className="welcome-symbol" aria-hidden="true">↗</span>
        <p className="welcome-copy">A simple space for your exercise session.</p>
        <p className="intro">Choose your surgery, pick an exercise, and open the camera when you’re ready.</p>
        <button className="primary next-button" onClick={() => navigate('surgery')}>Next →</button>
      </section>}

      {screen === 'surgery' && <section aria-label="Surgery options">
        <p className="intro">Select a category to see its three exercises.</p>
        <div className="surgery-options">
          {SURGERIES.map((item, index) => <button key={item.id} className="choice-card" onClick={() => {
            setSurgeryId(item.id); setExerciseId(null); exerciseRef.current = null; resetSession(); navigate('exercise')
          }}><span className="choice-number">0{index + 1}</span><strong>{item.name}</strong><span>3 exercises →</span></button>)}
        </div>
        <button className="back-button demo-link" onClick={() => {
          setSurgeryId('demo'); setExerciseId(null); exerciseRef.current = 'shoulder-demo'; resetSession(); navigate('ready')
        }}>Open general shoulder tracking demo →</button>
      </section>}

      {screen === 'exercise' && surgery && <section aria-label={`${surgery.name} exercises`}>
        <p className="intro">Pick the exercise for this session.</p>
        <div className="exercise-choice-grid">
          {surgery.exercises.map((item, index) => <button key={item.id} className="choice-card" onClick={() => {
            setExerciseId(item.id); exerciseRef.current = item.id; resetSession(); navigate('ready')
          }}><span className="choice-number">0{index + 1}</span><strong>{item.name}</strong><span>Guided coaching →</span></button>)}
        </div>
      </section>}

      {screen === 'ready' && <section className="camera-card ready-panel">
        <p className="eyebrow">YOUR SELECTED EXERCISE</p>
        <h2>{selectedExercise?.name ?? 'Shoulder tracking demo'}</h2>
        {selectedExercise && <ExercisePreview key={selectedExercise.id} exercise={selectedExercise} />}
        {!selectedExercise && <ul className="ready-list">
          <li>Place your laptop on a stable surface.</li>
          <li>Leave enough space for the camera to see your movement.</li>
          <li>Allow camera access when your browser asks.</li>
        </ul>}
        <p className="session-note">Follow the instructions and limits provided by your care team.</p>
        <p className="manual-note">{shoulderDemo ? 'General movement demo with automatic shoulder-angle estimation and rep counting. Separate from the surgery exercises.' : 'Exercise instructions, spoken cues, and session coaching. Tracking capabilities depend on the exercise. Use only the movements and limits cleared by your care team.'}</p>
        <button className="primary next-button" onClick={() => { setScreen('camera'); void startCamera() }}>I’m Ready — Open Camera →</button>
        <p className="privacy">Your camera stays off until you choose to open it. No microphone is requested.</p>
      </section>}

      <section hidden={screen !== 'camera'} className="camera-card" aria-label="Webcam preview">
        <div className="camera-heading">
          <h2>Camera preview</h2>
          <span className={`badge ${status === 'on' ? 'live' : ''}`} role="status">
            <span aria-hidden="true">●</span> {status === 'on' ? 'Camera on' : status === 'starting' ? 'Connecting…' : 'Camera off'}
          </span>
        </div>
        {shoulderDemo && <>
        <section className="exercise-settings" aria-label="Shoulder movement settings">
          <div>
            <h2>Shoulder raise</h2>
            <p>Face the camera. Keep your hip, shoulder, and elbow visible. Raise your arm out to the side.</p>
          </div>
          <label>Arm
            <select value={arm} onChange={(event) => {
              const value = event.target.value
              settingsRef.current = { ...settingsRef.current, arm: value }
              setArm(value)
              resetSession()
            }}>
              <option value="left">Left Arm</option>
              <option value="right">Right Arm</option>
            </select>
          </label>
          <label>Target: {target}°
            <input type="range" min="30" max="120" step="5" value={target}
              onChange={(event) => {
                const value = Number(event.target.value)
                settingsRef.current = { ...settingsRef.current, target: value }
                setTarget(value)
                resetSession()
              }} />
          </label>
          <p className="setting-note">Use your own left or right arm. The preview is mirrored.<br />Demo target — not a prescribed exercise. Move only within a comfortable range.</p>
        </section>
        <div className="movement-stats demo-duplicate-stats">
          <div><span>Estimated shoulder angle</span><strong>{angle === null ? '—' : `${Math.round(angle)}°`}</strong></div>
          <div><span>Completed reps</span><strong>{movement.reps}</strong></div>
          <div className="cue" role="status"><span>Next step</span><strong>{status !== 'on' ? 'Start camera to begin' : angle === null ? 'Counting paused — move into view' : MOVEMENT_CUES[movement.phase]}</strong></div>
        </div>
        </>}
        <div className="camera-workspace">
          <div className="camera-main">
            <div className="video-area clean-video">
              <video ref={videoRef} autoPlay muted playsInline aria-label="Mirrored live webcam preview" />
              <canvas ref={canvasRef} className="pose-overlay" aria-hidden="true" />
              {status === 'on' && <div className={`clean-overlay ${(shoulderDemo ? angle !== null && movement.phase === 'hold' : activeCoach?.matching) ? 'matching' : ''}`}>
                <div className="clean-angle">{shoulderDemo ? angle === null ? '—' : `${Math.round(angle)}°` : activeCoach?.metric ? activeCoach.angle === null ? '—' : `${Math.round(activeCoach.angle)}°` : ''}
                  <small>{shoulderDemo ? `Target ${target}°` : activeCoach?.target !== null && activeCoach?.target !== undefined ? `Target ${Math.round(activeCoach.target)}°` : ''}</small>
                </div>
                <div className="clean-count"><small>{activeCoach?.timer ? 'TIME' : 'REPS'}</small><strong>{shoulderDemo ? movement.reps : activeCoach?.timer ?? activeCoach?.reps ?? '—'}</strong>{activeCoach && !activeCoach.timer && <small>of {activeCoach.goal}</small>}</div>
                <div className="clean-live-cue" role="status">{bigCue}</div>
              </div>}
              {status !== 'on' && <div className="placeholder"><span className="camera-symbol" aria-hidden="true">◎</span><h2>{status === 'starting' ? 'Opening camera…' : 'Camera off'}</h2><p>Select Start Camera below.</p></div>}
            </div>
            {activeCoach?.automatic && <div className="clean-progress" aria-label="Movement progress"><span style={{ width: `${activeCoach.progress ?? 0}%` }} /></div>}
          </div>
          <aside className="camera-sidebar" aria-label="Exercise instructions and controls">
            <h2>{selectedExercise?.name ?? 'Shoulder demo'}</h2>
            {activeCoach && <>
              <p className="sidebar-side">{activeCoach.side === 'left' ? 'LEFT' : 'RIGHT'} SIDE · {activeCoach.running ? 'COUNTING ON' : 'COUNTING PAUSED'}</p>
              <div className="sidebar-controls">
                {activeCoach.automatic && !activeCoach.running && <>
                  <button className="secondary" disabled={!activeCoach.visible} onClick={() => coachActionsRef.current?.recordStart()}>1. Record start {activeCoach.firstRecorded ? '✓' : ''}</button>
                  <button className="secondary" disabled={!activeCoach.visible || !activeCoach.firstRecorded} onClick={() => coachActionsRef.current?.recordTarget()}>2. Record target {activeCoach.secondRecorded ? '✓' : ''}</button>
                </>}
                <button className="primary start-counting-button" disabled={!activeCoach.visible || activeCoach.finished || (activeCoach.automatic && !activeCoach.secondRecorded)} onClick={() => activeCoach.running ? coachActionsRef.current?.pause() : coachActionsRef.current?.start()}>{activeCoach.running ? 'PAUSE' : 'START COUNTING'}</button>
                <button className="secondary" onClick={() => coachActionsRef.current?.reset()}>Reset reps</button>
              </div>
              <div className="sidebar-counting-check"><strong>Counting check</strong><p>{activeCoach.blocker}</p></div>
              <details className="sidebar-details" open><summary>How to move</summary><ol>{activeCoach.steps?.map((step) => <li key={step}>{step}</li>)}</ol></details>
              <details className="sidebar-details"><summary>Camera and posture</summary><p>{activeCoach.setup}</p><p>{activeCoach.postureReminder}</p><small>Posture reminders are not fully verified by camera.</small></details>
              {activeCoach.message && <p className="sidebar-message" role="status">{activeCoach.message}</p>}
              {activeCoach.automatic && <p className="sidebar-legend">Yellow dotted guide: target position.<br />Green: measured angle matches.</p>}
            </>}
            {shoulderDemo && <p>Raise your arm out to the side. Hold at the demo target, then lower to complete the rep.</p>}
          </aside>
        </div>
        <p className="tracking-status" role="status">{tracking}</p>
        <div className="controls">
          <button className="primary" onClick={startCamera} disabled={status !== 'off'}>{status === 'starting' ? 'Connecting…' : 'Start Camera'}</button>
          <button className="secondary" onClick={stopCamera} disabled={status === 'off'}>Stop Camera</button>
          {shoulderDemo && <button className="secondary" onClick={resetSession}>Reset Session</button>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="privacy">Video only. Your microphone is off. Body tracking runs on this device. Video is not recorded or uploaded.</p>
        {screen === 'camera' && selectedExercise && <details className="advanced-session"><summary>Exercise settings, voice, and manual confirmation</summary><ExerciseSession key={selectedExercise.id} exercise={selectedExercise} poseSampleRef={poseSampleRef} cameraOn={status === 'on'} onCoachUpdate={updateCoach} actionsRef={coachActionsRef} /></details>}
        {selectedExercise && <button className="primary next-button" onClick={() => navigate('exercise')}>Next exercise →</button>}
      </section>
    </main>
  )
}

export default App
