import unittest
from pathlib import Path

import yaml

WORKFLOW_PATH = (
    Path(__file__).resolve().parents[3] / ".github" / "workflows" / "reconcile-deploy-env.yml"
)


class ReconcileWorkflowYamlTests(unittest.TestCase):
    def test_workflow_file_exists_and_parses(self):
        self.assertTrue(WORKFLOW_PATH.exists(), f"{WORKFLOW_PATH} does not exist")
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        # PyYAML parses the bare key `on:` as the boolean True, not the
        # string "on" — this is a well-known YAML 1.1 gotcha.
        self.assertIn(True, workflow)
        self.assertIn("workflow_dispatch", workflow[True])

    def test_workflow_declares_id_token_write_permission(self):
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        job = workflow["jobs"]["reconcile"]
        self.assertEqual(job["permissions"]["id-token"], "write")

    def test_workflow_sets_required_script_env_vars(self):
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        job_env = workflow["jobs"]["reconcile"]["env"]
        required_keys = {
            "AWS_REGION",
            "API_GATEWAY_NAME",
            "ZAPPA_STAGE",
            "AMPLIFY_APP_ID",
            "AMPLIFY_BRANCH_NAME",
            "SSM_PARAMETER_NAME",
            "LAMBDA_FUNCTION_NAME",
        }
        self.assertTrue(required_keys.issubset(job_env.keys()))


if __name__ == "__main__":
    unittest.main()
