import { useEffect, useRef, useState } from 'react'
import { requestSessionSummary } from './sessionSummary'

export default function SessionResults({ result, onNext }) {
  const [state, setState] = useState('idle')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const controllerRef = useRef(null)
  useEffect(() => () => controllerRef.current?.abort(), [])

  async function generate() {
    if (controllerRef.current) return
    const controller = new AbortController()
    controllerRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 40000)
    setState('loading'); setError('')
    try {
      const response = await requestSessionSummary(result.session, controller.signal)
      setSummary(response.summary); setState('done')
    } catch (err) {
      setError(err.name === 'AbortError' ? 'The summary took too long. Your results are still available. Try again.' : err.message)
      setState('error')
    } finally {
      clearTimeout(timeout)
      controllerRef.current = null
    }
  }

  const session = result.session
  const timed = session.measurement_method === 'visibility-assisted timer'
  return <section className="camera-card session-results">
    <p className="eyebrow">YOUR SESSION</p><h2>{session.exercise}</h2>
    <p className="intro">{result.side === 'left' ? 'Left' : 'Right'} side · {result.completedGoal ? 'Selected goal reached' : 'Session ended early'}</p>
    <div className="result-grid">
      {!timed && <div><span>{session.measurement_method === 'manual confirmation' ? 'Confirmed reps' : 'Counted reps'}</span><strong>{session.completed_reps}<small> / {session.planned_reps}</small></strong></div>}
      <div><span>Tracked active time</span><strong>{session.duration_seconds}<small> sec</small></strong></div>
      <div><span>Tracking interruptions</span><strong>{session.tracking_interruptions}</strong></div>
    </div>
    <p className="session-note">{timed ? `Visible time goal: ${result.timeGoal} seconds. This timer records visibility, not movement quality.` : session.measurement_method === 'manual confirmation' ? 'These reps were confirmed manually, not automatically measured.' : 'Movement counts are experimental webcam estimates, not a clinical form assessment.'}</p>
    <section className="aws-summary-card" aria-label="AWS session summary">
      <span className="badge">Amazon Bedrock · Nova Lite</span>
      <h3>Understand your session</h3>
      <p>Generate a plain-language summary from the numbers above. This sends the session numbers and exercise name to AWS. No video or images are sent.</p>
      <button className="primary" disabled={state === 'loading' || state === 'done'} onClick={generate}>{state === 'loading' ? 'Generating summary…' : state === 'done' ? 'Summary ready ✓' : 'Generate AWS AI Summary'}</button>
      {state === 'loading' && <p role="status">Requesting your summary from Amazon Bedrock…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {summary && <div className="summary-output" aria-live="polite">
        {summary.split('\n').filter((line) => line.trim()).map((line, index) => {
          const plain = line.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '')
          return /^\*\*[^*]+\*\*\s*$/.test(line.trim()) || /^#{1,6}\s/.test(line) ? <h4 key={index}>{plain}</h4> : <p key={index}>{plain}</p>
        })}
        <p className="privacy">AI-generated explanation. Check it against the recorded results. It does not diagnose or prescribe treatment.</p>
      </div>}
    </section>
    <div className="controls"><button className="secondary" onClick={onNext}>Choose another exercise →</button></div>
    <p className="privacy">These results stay in this tab until you leave the results screen or refresh. Long-term session storage is not enabled.</p>
  </section>
}
