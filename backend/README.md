# PT session therapist review

This Lambda function validates session evidence, calculates descriptive statistics, and calls Amazon Bedrock Nova Lite. It uses its execution role; no AWS credentials are embedded in the frontend.

## Deploy

Replace the code of the existing `pt-session-summary` Lambda function with `lambda_function.py` and select Deploy. Keep the 30-second timeout and the existing Function URL. GitHub/Amplify deployment publishes only the frontend; it does not update this Lambda automatically.

Optional environment variables: `BEDROCK_MODEL_ID` (default `us.amazon.nova-lite-v1:0`) and `BEDROCK_REGION` (default `us-east-1`).

## Data flow

The browser records completed-rep angle excursions and holds, approximate visibility, interruptions, selected feedback, and an optional comparable previous session. User profile labels stay in browser storage and are excluded from requests. No camera video or images are uploaded.

The function returns `review_version: 3`, validated session facts, server-calculated evidence, and an AI explanation. Missing measurements stay missing. A review is not a diagnosis, validation of exercise form, or treatment plan.

Saved session history is local to the browser and limited to 20 records. Previous-session comparisons require the same profile, exercise, side, movement, measurement method, near-matching reference angles, and matching hold settings, plus user confirmation of the same camera setup.

## Measurement checks

The browser filters angle spikes, rejects ambiguous projected geometry, and records stable start/hold/return endpoints. Flagged reps are excluded from descriptive excursion statistics and comparisons. Thresholds are prototype signal-processing heuristics, not medical limits. Unflagged measurements are not clinically validated.

Run offline backend tests from the repository root: `python3 backend/tests/test_quality_lambda.py`. These use a simulated model response; they do not validate live AWS permissions, model behavior, or clinical accuracy.
