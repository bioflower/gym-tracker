import json
import unittest
from pathlib import Path

import yaml

WORKFLOW_PATH = (
    Path(__file__).resolve().parents[3] / ".github" / "workflows" / "deploy-lambda.yml"
)


class DeployWorkflowYamlTests(unittest.TestCase):
    def test_workflow_file_exists_and_parses(self):
        self.assertTrue(WORKFLOW_PATH.exists(), f"{WORKFLOW_PATH} does not exist")
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        # PyYAML parses the bare key `on:` as the boolean True (YAML 1.1 gotcha).
        self.assertIn(True, workflow)
        self.assertIn("workflow_dispatch", workflow[True])

    def test_workflow_is_manual_only(self):
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        triggers = set(workflow[True])
        self.assertIn("workflow_dispatch", triggers)
        self.assertEqual(triggers, {"workflow_dispatch"})

    def test_workflow_declares_id_token_write_permission(self):
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        self.assertEqual(workflow["permissions"]["id-token"], "write")
        self.assertEqual(workflow["permissions"]["contents"], "read")

    def test_deploy_job_runs_docker_build_then_zappa(self):
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        steps = workflow["jobs"]["deploy"]["steps"]
        script_entries = [s for s in steps if s.get("run")]
        full_run = "\n".join(s["run"] for s in script_entries)
        self.assertIn("build_lambda_deps.sh", full_run)
        self.assertIn("zappa update", full_run)
        self.assertIn("manage.py migrate", full_run)
        self.assertTrue(
            full_run.index("build_lambda_deps.sh")
            < full_run.index("manage.py migrate")
            < full_run.index("zappa update")
        )

    def test_deploy_job_runs_on_ubuntu(self):
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        self.assertEqual(workflow["jobs"]["deploy"]["runs-on"], "ubuntu-latest")


class ZappaSettingsJsonTests(unittest.TestCase):
    def test_manage_roles_disabled_with_preprovisioned_role(self):
        settings_path = (
            Path(__file__).resolve().parents[2] / "zappa_settings.json"
        )
        with open(settings_path) as handle:
            settings = json.load(handle)

        dev = settings["dev"]
        self.assertFalse(dev["manage_roles"])
        self.assertEqual(
            dev["role_name"], "gym-tracker-dev-ZappaLambdaExecutionRole"
        )


if __name__ == "__main__":
    unittest.main()
