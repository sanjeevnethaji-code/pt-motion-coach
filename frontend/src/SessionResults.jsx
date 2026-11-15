import { useEffect, useRef, useState } from 'react'
import { requestSessionSummary } from './sessionSummary'
import { repQuality } from './measurementQuality'
import { reviewEvidence, loadReviewHistory, saveReviewHistory, previousComparable } from './reviewMetrics'

const REASONS = {
  not_answered: 'Not answered', goal_reached: 'Reached my selected goal',
  discomfort: 'Discomfort', fatigue: 'Fatigue', camera_problem: 'Camera / tracking problem',
  practice_only: 'Just testing the app', other: 'Another reason',
}

export default function SessionResults({ result, onNext }) {
  const [state, setState] = useState('idle')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [reason, setReason] = useState('not_answered')
  const [difficulty, setDifficulty] = useState('not_answered')
  const [profile, setProfile] = useState('')
  const [sameSetup, setSameSetup] = useState(false)
  const [history, setHistory] = useState(() => { try { return loadReviewHistory(window.localStorage) } catch { return [] } })
  const [savedMessage, setSavedMessage] = useState('')
  const controllerRef = useRef(null)
  const [sessionId] = useState(() => crypto.randomUUID())
  useEffect(() => () => controllerRef.current?.abort(), [])
  const session = result.session
  const evidence = reviewEvidence(session)
  const timed = session.measurement_method === 'visibility-assisted timer'
  const previous = previousComparable(history, session, profile, sessionId)
  const previousEvidence = previous ? reviewEvidence(previous.session) : null
  const comparison = previous && sameSetup ? {
    completed_reps: previous.session.completed_reps,
    planned_reps: previous.session.planned_reps,
    duration_seconds: previous.session.duration_seconds,
    tracking_interruptions: previous.session.tracking_interruptions,
    mean_excursion: previousEvidence.mean_excursion,
    visibility_percent: previousEvidence.visibility_percent,
    hold_goal_seconds: previous.session.hold_goal_seconds,
    calibration_start: previous.session.calibration_start,
    calibration_target: previous.session.calibration_target,
  } : null

  function changed() { setSummary(''); setState('idle'); setError('') }
  function payload() { return { ...session, stop_reason: reason, perceived_difficulty: difficulty, previous_session: comparison } }

  async function generate() {
    if (controllerRef.current) return
    const controller = new AbortController()
    controllerRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 40000)
    setState('loading'); setError('')
    try {
      const response = await requestSessionSummary(payload(), controller.signal)
      setSummary(response.summary); setState('done')
    } catch (err) {
      setError(err.name === 'AbortError' ? 'The review took too long. Your results are still available. Try again.' : err.message)
      setState('error')
    } finally { clearTimeout(timeout); controllerRef.current = null }
  }

  function save() {
    if (!profile.trim()) { setSavedMessage('Enter a demo profile label first. Use the same label only for the same person.'); return }
    try {
      saveReviewHistory(window.localStorage, { id: sessionId, profile: profile.trim(), saved_at: new Date().toISOString(), session: payload() })
      setHistory(loadReviewHistory(window.localStorage)); setSavedMessage('Saved in this browser. This is not cloud storage.')
    } catch { setSavedMessage('Browser storage is unavailable or full. These results remain on this screen.') }
  }

  function download() {
    const lines = ['PT Form Coach — session handoff', session.exercise, `Side: ${session.side}`,
      `Reps: ${session.completed_reps}/${session.planned_reps}`, `Tracked active time: ${session.duration_seconds}s`,
      `Tracking interruptions: ${session.tracking_interruptions}`, `Visible while running: ${evidence.visibility_percent ?? 'not measured'}%`,
      `Method: ${session.measurement_method}`, `Self-reported end reason: ${REASONS[reason]}`, '',
      ...session.rep_details.map((row) => `Rep ${row.rep}: observed excursion ${row.excursion_degrees} deg; measured hold ${row.hold_seconds ?? 'not recorded'}s; cycle ${row.cycle_seconds}s; quality: ${repQuality(row, session).join('; ') || 'no detected flags'}`),
      '', summary ? 'AI-generated interpretation:\n' + summary : 'No AI interpretation generated.',
      '', 'Experimental estimates. No diagnosis, healing assessment, or treatment recommendation.']
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'pt-session-handoff.txt'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="camera-card session-results">
    <p className="eyebrow">THERAPIST HANDOFF</p><h2>{session.exercise}</h2>
    <p className="intro">{result.side === 'left' ? 'Left' : 'Right'} side · {result.completedGoal ? 'Selected goal reached' : 'Session ended before the selected goal'}</p>
    <div className="result-grid">
      {!timed && <div><span>{session.measurement_method === 'manual confirmation' ? 'Confirmed reps' : 'Counted reps'}</span><strong>{session.completed_reps}<small> / {session.planned_reps}</small></strong></div>}
      <div><span>Tracked active time</span><strong>{session.duration_seconds}<small> sec</small></strong></div>
      <div><span>Usable tracking while running · approximate</span><strong>{evidence.visibility_percent === null ? '—' : evidence.visibility_percent + '%'}</strong></div>
      <div><span>Tracking interruptions</span><strong>{session.tracking_interruptions}</strong></div>
    </div>
    <section className="review-quality" aria-label="Measurement quality">
      <h3>Check the measurements first</h3>
      <p><strong>{evidence.included_reps}</strong> completed rep measurements have no detected tracking flags. <strong>{evidence.excluded_reps}</strong> have flags and are excluded from excursion statistics. This check is not proof of clinical accuracy.</p>
      {evidence.warnings.length > 0 ? <ul>{evidence.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>No automatic quality flags were detected. Camera perspective can still affect the result.</p>}
      <p>Usable tracking means selected landmarks were visible and passed the available tracking checks. It does not prove that the angles or posture were correct.</p>
    </section>
    <section className="review-evidence">
      <h3>What was actually measured</h3>
      {evidence.measured_reps > 0 ? <>
        <p>{evidence.measured_reps} completed reps have per-rep measurements. {evidence.included_reps > 0 ? <>Among reps without detected tracking flags, observed excursion ranged from <strong>{evidence.min_excursion}° to {evidence.max_excursion}°</strong>.</> : 'All measured reps are flagged; no excursion statistics or comparisons will be interpreted.'} This is change between stable camera-estimated positions, not a clinical range-of-motion test.</p>
        <div className="table-scroll"><table><thead><tr><th>Rep</th><th>Start → held angle</th><th>Excursion</th><th>Completed hold</th><th>Cycle time</th><th>Measurement check</th></tr></thead><tbody>
          {session.rep_details.map((row) => <tr key={row.rep}><td>{row.rep}</td><td>{row.start_angle ?? '—'}° → {row.held_angle ?? '—'}°</td><td>{row.excursion_degrees}°</td><td>{row.hold_seconds === null ? 'Not recorded' : row.hold_seconds + 's'}</td><td>{row.cycle_seconds}s</td><td>{repQuality(row, session).length ? <span className="quality-flag">Flagged — excluded</span> : <span>No detected flags</span>}</td></tr>)}
        </tbody></table></div>
        <p className="privacy">Cycle time can include brief tracking gaps. Position holds must finish while tracked. Incomplete reps are not included in this table.</p>
      </> : <p>{timed ? 'Visibility-assisted timing only. The app did not measure movement quality.' : session.measurement_method === 'manual confirmation' ? 'Reps were confirmed manually. Joint excursion and hold measurements are not available.' : 'No completed rep measurements were recorded. The review will state that evidence is missing.'}</p>}
    </section>
    <section className="review-feedback"><h3>What made this session difficult?</h3>
      <div className="coach-settings">
        <label>Why did you finish?<select disabled={state === 'loading'} value={reason} onChange={(e) => { setReason(e.target.value); changed() }}>{Object.entries(REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>How did the movement feel?<select disabled={state === 'loading'} value={difficulty} onChange={(e) => { setDifficulty(e.target.value); changed() }}><option value="not_answered">Not answered</option><option value="easy">Easy</option><option value="manageable">Manageable</option><option value="difficult">Difficult</option></select></label>
      </div>
      <p className="privacy">Optional self-report. The camera cannot determine pain, fatigue, or why you stopped.</p>
    </section>
    <section className="review-history"><h3>Compare with a saved session</h3>
      <label>Demo profile label<input maxLength={40} value={profile} disabled={state === 'loading'} placeholder="For example: Demo person A" onChange={(e) => { setProfile(e.target.value); setSameSetup(false); setSavedMessage(''); changed() }} /></label>
      <p>{previous ? 'A prior measured session matches this exercise, side, movement, reference angles, and hold setting.' : 'No comparable saved session for this profile yet. Save this one, then perform another with the same setup.'}</p>
      {previous && <label className="comparison-confirm"><input type="checkbox" checked={sameSetup} disabled={state === 'loading'} onChange={(e) => { setSameSetup(e.target.checked); changed() }} /> Same person, camera position, and movement setup as that session.</label>}
      {comparison && <p>Previous mean observed excursion: {comparison.mean_excursion}°. Current: {evidence.mean_excursion}°. Changes in camera estimates do not establish recovery or healing.</p>}
      <button className="secondary" onClick={save}>Save session in this browser</button>
      {savedMessage && <p role="status">{savedMessage}</p>}
      <p className="privacy">Stores up to 20 sessions on this device. Use separate profile labels for different people. Profile labels stay local and are not sent to AWS.</p>
    </section>
    <section className="aws-summary-card" aria-label="AWS therapist review">
      <span className="badge">Amazon Bedrock · Nova Lite</span><h3>Make sense of the evidence</h3>
      <p>Ask AWS to explain the observations, identify measurement limits, and draft questions for your therapist. We send the measurements above, your selected feedback, and the previous measurements only if you confirm the same setup. No video, images, or profile label are sent.</p>
      <button className="primary" disabled={state === 'loading' || state === 'done'} onClick={generate}>{state === 'loading' ? 'Preparing therapist review…' : state === 'done' ? 'Review ready ✓' : 'Generate therapist review with AWS'}</button>
      {state === 'loading' && <p role="status">Amazon Bedrock is reviewing the session evidence…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {summary && <div className="summary-output" aria-live="polite">{summary.split('\n').filter((line) => line.trim()).map((line, index) => {
        const plain = line.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '')
        return /^\*\*[^*]+\*\*\s*$/.test(line.trim()) || /^#{1,6}\s/.test(line) ? <h4 key={index}>{plain}</h4> : <p key={index}>{plain}</p>
      })}<p className="privacy">AI-generated interpretation. Check numbers against the evidence table. It does not diagnose, verify safe form, or prescribe a recovery plan.</p></div>}
    </section>
    <div className="controls"><button className="secondary" onClick={download}>Download session handoff</button><button className="secondary" onClick={onNext}>Choose another exercise →</button></div>
  </section>
}
