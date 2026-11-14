import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import './App.css'

const cameraError = (error) => {
  if (['NotAllowedError', 'SecurityError'].includes(error.name)) return 'Camera access was blocked. Allow camera access in your browser’s site settings, then try again.'
  if (error.name === 'NotFoundError') return 'No camera was found. Connect a camera and try again.'
  if (['NotReadableError', 'AbortError'].includes(error.name)) return 'The camera could not start. Close other apps using it, then try again.'
  return 'We could not open your camera. Check your browser and camera settings, then try again.'
}

function App() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const poseRef = useRef(null)
  const frameRef = useRef(null)
  const [tracking, setTracking] = useState('Tracking off')

  const releaseTracking = () => {
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
            setTracking(landmarks?.length ? 'Tracking ready' : 'Move into view')
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
            }
          }
          frameRef.current = requestAnimationFrame(render)
        } catch {
          releaseTracking()
          setTracking('Tracking unavailable')
          setError('Body tracking stopped. Stop and restart the camera to try again. Your camera preview still works.')
        }
      }
      frameRef.current = requestAnimationFrame(render)
    } catch {
      if (request !== requestRef.current) return
      detector?.close()
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

  return (
    <main className="app">
      <header>
        <p className="eyebrow">YOUR MOVEMENT SPACE</p>
        <h1>Motion Coach</h1>
        <p className="intro">Get comfortable. Start your camera when you’re ready.</p>
      </header>
      <section className="camera-card" aria-label="Webcam preview">
        <div className="camera-heading">
          <h2>Camera preview</h2>
          <span className={`badge ${status === 'on' ? 'live' : ''}`} role="status">
            <span aria-hidden="true">●</span> {status === 'on' ? 'Camera on' : status === 'starting' ? 'Connecting…' : 'Camera off'}
          </span>
        </div>
        <div className="video-area">
          <video ref={videoRef} autoPlay muted playsInline aria-label="Mirrored live webcam preview" />
          <canvas ref={canvasRef} className="pose-overlay" aria-hidden="true" />
          {status !== 'on' && <div className="placeholder">
            <span className="camera-symbol" aria-hidden="true">◎</span>
            <h2>{status === 'starting' ? 'Waiting for your camera' : 'Ready when you are'}</h2>
            <p>{status === 'starting' ? 'Allow camera access if your browser asks.' : 'Select Start Camera to see your live preview.'}</p>
          </div>}
        </div>
        <p className="tracking-status" role="status">{tracking}</p>
        <div className="controls">
          <button className="primary" onClick={startCamera} disabled={status !== 'off'}>{status === 'starting' ? 'Connecting…' : 'Start Camera'}</button>
          <button className="secondary" onClick={stopCamera} disabled={status === 'off'}>Stop Camera</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="privacy">Video only. Your microphone is off. Body tracking runs on this device. Video is not recorded or uploaded.</p>
      </section>
    </main>
  )
}

export default App
