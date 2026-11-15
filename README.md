# PT Form Coach

A hackathon prototype for exercise instructions, experimental webcam movement feedback, and an evidence-aware session review.

**Public demo:** https://main.dfm633f5tw6fn.amplifyapp.com/

## What works

- Welcome, surgery selection, exercise selection, demonstration videos, and camera-readiness screens.
- Camera/body tracking runs in the browser using MediaPipe. No video is uploaded for the AI review.
- Experimental calibrated counting for heel slides, ankle pumps, and elbow movement.
- Timed visibility assistance for heel props and pendulums; guided manual confirmation for wrist movement and passive external rotation.
- Large live cues, target guide, rep counter, spoken coaching, and side-panel controls.
- Tracking spike filtering, camera-view checks, robust endpoint measurements, explicit quality flags, and a manual fallback.
- Per-rep evidence, user-selected feedback, browser-local history, compatible-session comparisons, and downloadable handoffs.
- AWS Amplify hosts the frontend. Lambda validates numerical session data, derives statistics, and calls Amazon Bedrock Nova Lite for interpretation.

The separate shoulder demo is a general movement demo, not an exercise prescription for a repaired rotator cuff.

## Run locally

Use a current Node.js LTS version compatible with Vite 8.

```sh
cd frontend
npm ci
npm run dev
```

The current AWS endpoint permits browser requests from the published Amplify domain. Live summary calls from localhost require a deliberate CORS configuration update; local movement tracking works independently.

## Checks

```sh
cd frontend
npm test
npm run lint
npm run build
```

From the repository root:

```sh
python3 backend/tests/test_quality_lambda.py
```

Tests cover spike rejection, full movement sequences, duplicate-count prevention, tracking gaps, legacy extreme measurements, comparison exclusions, input validation, and review version matching. They do not establish live camera accuracy or clinical validity.

## Deploy both parts

1. Replace the entire code of `pt-session-summary` with `backend/lambda_function.py`, then Deploy in Lambda. Keep the current 30-second timeout and existing Function URL.
2. Commit and push the repository. Amplify uses `amplify.yml` to build `frontend` and publish `frontend/dist`.
3. Refresh the public site and run a new measured session. Older sessions remain identifiable as older measurement versions and are excluded from quality-aware comparisons.

The AWS function must return `review_version: 3`. The frontend explains if the older review service is still running.

## Data and measurement limits

Angles are camera-based 2D estimates. Visibility, filtered data, and completed targets do not prove correct posture, safe movement, true joint ROM, passive motion, or healing. Use only care-team-approved exercises and limits. No surgery-specific targets are prescribed automatically.

Technical filters and quality thresholds are prototype heuristics. They can reject legitimate movements and miss inaccurate estimates. Recalibration and a clearly labeled manual mode are provided. A flagged measurement must be checked before any interpretation about the person.

Saved sessions are local to this browser, capped at 20, and separated by user-entered demo profiles. Comparisons require compatible settings and user confirmation of the same person/setup; this is not verified identity. No clinician account or cloud patient record system is implemented.

The AI review receives exercise measurements, selected feedback, and an optional compatible previous session. Profile labels, camera images, and video are not included. Missing information stays unknown. Generated text must be checked against displayed evidence.

This project uses webcam tracking and AWS. No wearable hardware is required.

## AI tools used

- OpenAI Codex: implementation, troubleshooting, UI changes, and automated checks.
- Amazon Bedrock / Amazon Nova Lite: in-product session interpretation.
- Google Gemini: earlier project brainstorming notes supplied by the team.

List every additional tool actually used in the final Shipyard submission. Judges should be told which modes are automatic, timed, or manually confirmed.

## Exercise demonstration sources

- UCSF Sports Medicine: https://sportsrehab.ucsf.edu/content/knee and https://sportsrehab.ucsf.edu/content/foot-ankle-mobile
- Penn State Health: https://www.boneandjoint.psu.edu/course/rotator_cuff/rc_recovery/rc_post_exercises.html
- Lincoln Surgical Hospital: https://lincolnsurgery.com/patient-information/rehabilitation/

Videos are embedded or linked from their original providers; internet and provider playback availability are required.


### Verified evidence review (v4)
Amazon Bedrock prioritizes candidate observations. The server validates the returned IDs and renders their wording from measured evidence. Unvalidated model prose is never displayed. Whole-session interruptions and rejected samples are always reported separately from completed-rep flags. Missing self-report stays unknown. Update Lambda alongside the frontend; old review responses are rejected.
