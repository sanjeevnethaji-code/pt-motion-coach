import { useEffect, useRef, useState } from 'react'
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
  const requestRef = useRef(0)
  const [status, setStatus] = useState('off')
  const [error, setError] = useState('')

  const stopCamera = () => {
    requestRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('off')
    setError('')
  }

  useEffect(() => () => {
    requestRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const startCamera = async () => {
    const request = ++requestRef.current
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
    } catch (err) {
      if (request !== requestRef.current) return
      stopCamera()
      setError(cameraError(err))
    }
  }

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
          {status !== 'on' && <div className="placeholder">
            <span className="camera-symbol" aria-hidden="true">◎</span>
            <h2>{status === 'starting' ? 'Waiting for your camera' : 'Ready when you are'}</h2>
            <p>{status === 'starting' ? 'Allow camera access if your browser asks.' : 'Select Start Camera to see your live preview.'}</p>
          </div>}
        </div>
        <div className="controls">
          <button className="primary" onClick={startCamera} disabled={status !== 'off'}>{status === 'starting' ? 'Connecting…' : 'Start Camera'}</button>
          <button className="secondary" onClick={stopCamera} disabled={status === 'off'}>Stop Camera</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="privacy">Video only. Your microphone is off. This preview is not recorded or uploaded.</p>
      </section>
    </main>
  )
}

export default App
