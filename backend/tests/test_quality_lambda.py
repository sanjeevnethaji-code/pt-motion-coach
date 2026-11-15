import unittest
import types
import sys
import json
from pathlib import Path

fake = types.ModuleType('boto3')
fake.client = lambda *a, **k: types.SimpleNamespace(converse=lambda **kwargs: {'output': {'message': {'content': [{'text': 'Tracking issues limit interpretation. Verify the camera setup.'}]}}})
sys.modules['boto3'] = fake
sys.modules['botocore'] = types.ModuleType('botocore')
config = types.ModuleType('botocore.config'); config.Config = lambda **k: k; sys.modules['botocore.config'] = config
errors = types.ModuleType('botocore.exceptions'); errors.ClientError = type('ClientError', (Exception,), {}); sys.modules['botocore.exceptions'] = errors
ns = {}
p = Path(__file__).resolve().parents[1] / 'lambda_function.py'
exec(compile(p.read_text(), str(p), 'exec'), ns)

BASE = {'exercise': 'Elbow range of motion (elbow)', 'exercise_id':'elbow-wrist', 'movement_part':'elbow', 'side':'right', 'quality_version':3,
        'completed_reps':1, 'planned_reps':3, 'duration_seconds':10, 'tracking_interruptions':0,
        'measurement_method':'experimental webcam estimates', 'calibration_start':10, 'calibration_target':60,
        'hold_goal_seconds':1, 'tracking_observed_seconds':10, 'tracking_visible_seconds':9, 'rep_details':[]}
ROW = {'rep':1, 'start_angle':10, 'held_angle':60, 'return_angle':10, 'min_angle':10, 'max_angle':60,
       'excursion_degrees':50, 'hold_seconds':1.1, 'cycle_seconds':5, 'rejected_samples':0, 'tracking_gaps':0}

class QualityTests(unittest.TestCase):
    def test_good_data_uses_endpoint_statistics(self):
        validated=ns['validate_session'](dict(BASE,rep_details=[ROW]))
        evidence=ns['evidence_for'](validated)
        self.assertEqual(evidence['reps_without_detected_tracking_flags'],1)
        self.assertEqual(evidence['mean_observed_excursion_degrees'],50)
        self.assertEqual(evidence['approximate_visibility_percent'],90)

    def test_rejected_rep_does_not_affect_statistics(self):
        validated=ns['validate_session'](dict(BASE,rep_details=[dict(ROW,rejected_samples=1)]))
        evidence=ns['evidence_for'](validated)
        self.assertIsNone(evidence['mean_observed_excursion_degrees'])
        self.assertEqual(len(evidence['excluded_rep_measurements']),1)
        self.assertTrue(evidence['quality_warnings'])

    def test_reported_legacy_extremes_are_not_interpreted(self):
        old = dict(BASE, quality_version=2, calibration_start=144, calibration_target=179, completed_reps=3, rep_details=[
            dict(ROW, rep=1,start_angle=None,held_angle=None,return_angle=None,min_angle=.9,max_angle=180,excursion_degrees=179.1),
            dict(ROW, rep=2,start_angle=None,held_angle=None,return_angle=None,min_angle=.7,max_angle=180,excursion_degrees=179.3),
            dict(ROW, rep=3,start_angle=None,held_angle=None,return_angle=None,min_angle=144,max_angle=179.3,excursion_degrees=35.3)])
        evidence=ns['evidence_for'](ns['validate_session'](old))
        self.assertEqual(evidence['reps_without_detected_tracking_flags'],0)
        self.assertIsNone(evidence['mean_observed_excursion_degrees'])
        self.assertIsNone(evidence['comparison'])

    def test_invalid_values_and_conflicting_endpoints_are_rejected(self):
        for changed in ({'duration_seconds':float('nan')},{'tracking_visible_seconds':30},{'stop_reason':'guessed'},{'rep_details':[dict(ROW,held_angle=80)]}):
            with self.subTest(changed=changed):
                response=ns['lambda_handler'](dict(BASE,**changed),None)
                self.assertEqual(response['statusCode'],400)

    def test_unsupported_measurements_cannot_appear_as_automatic(self):
        with self.assertRaises(ValueError):
            ns['validate_session'](dict(BASE,measurement_method='manual confirmation',rep_details=[ROW]))

    def test_quality_aware_response_and_missing_data(self):
        response=ns['lambda_handler'](dict(BASE,rep_details=[ROW]),None)
        self.assertEqual(response['statusCode'],200)
        self.assertEqual(json.loads(response['body'])['review_version'],3)
        empty=ns['evidence_for'](ns['validate_session'](BASE))
        self.assertTrue(empty['quality_warnings'])
        self.assertEqual(ns['lambda_handler']({'httpMethod':'OPTIONS'},None)['statusCode'],200)

if __name__ == '__main__':
    unittest.main()
