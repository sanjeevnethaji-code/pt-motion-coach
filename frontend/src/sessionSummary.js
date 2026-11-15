export const SUMMARY_ENDPOINT = 'https://5kkqdn2u2rrwkzzqilhebkf43a0pjvld.lambda-url.us-east-2.on.aws/'

export function buildSessionPayload(exercise, kind, part, reps, goal, seconds, interruptions) {
  return {
    exercise: exercise.name + (exercise.id === 'elbow-wrist' ? ` (${part})` : ''),
    completed_reps: kind === 'timed' ? 0 : reps,
    planned_reps: kind === 'timed' ? 0 : goal,
    duration_seconds: Math.max(0, Math.floor(seconds)),
    tracking_interruptions: interruptions,
    measurement_method: kind === 'auto' ? 'experimental webcam estimates' : kind === 'guided' ? 'manual confirmation' : 'visibility-assisted timer',
  }
}

export async function requestSessionSummary(session, signal, fetcher = fetch) {
  const response = await fetcher(SUMMARY_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...session, review_version: 3 }), signal,
  })
  let data
  try { data = await response.json() } catch { throw new Error('The summary service returned an unreadable response. Your results are still shown below.') }
  if (!response.ok) throw new Error(response.status === 403 ? 'AWS denied access to the summary URL.' : data.error || 'The summary service is unavailable. Please try again.')
  if (typeof data.summary !== 'string' || !data.summary.trim()) throw new Error('The service returned no summary. Please try again.')
  if (data.review_version !== 3) throw new Error('The AWS function still runs the earlier review code. Update lambda_function.py with the measurement-quality version, Deploy it, then try again.')
  return data
}
