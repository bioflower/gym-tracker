# Deploy Environment Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manually-triggered GitHub Actions workflow that reconciles the Amplify frontend's `VITE_API_URL` env var against the live Zappa API Gateway URL, and the backend's SSM `CORS_ALLOWED_ORIGINS` parameter against the live Amplify branch URL — idempotently, with no stored AWS credentials.

**Architecture:** A standalone Python script (`backend/scripts/reconcile_deploy_env.py`, using `boto3`) with small, independently-testable functions for each AWS lookup/reconcile step, wired together by a `main()` entrypoint. A GitHub Actions workflow (`workflow_dispatch`-triggered) authenticates via OIDC to a narrowly-scoped IAM role and runs the script.

**Tech Stack:** Python 3.11, `boto3` (already in `backend/requirements.txt`), stdlib `unittest` + `unittest.mock` for tests (no new test dependency), GitHub Actions, AWS IAM OIDC federation.

## Global Constraints

- Single stage only: `dev` (matches `backend/zappa_settings.json` — no multi-stage support in this iteration).
- No new Python dependencies — `boto3` is already present; tests use stdlib `unittest.mock`, not `pytest`/`moto`.
- No AWS credentials stored anywhere in GitHub (Secrets or otherwise) — OIDC + IAM role only.
- CORS origin reconciliation is additive-only: never remove an existing origin from `CORS_ALLOWED_ORIGINS`.
- Amplify env var reconciliation must preserve all other existing environment variables on the branch (`amplify:UpdateBranch` replaces the whole map if called naively — always fetch-merge-write).
- SSM parameter reconciliation must preserve the parameter's original `Type` (e.g. `SecureString`) — never downgrade it to `String` on write.
- Region is `us-east-1` throughout (matches `zappa_settings.json` and the Amplify app).
- All test commands assume `backend/.venv` is activated (`source backend/.venv/bin/activate` from `backend/`) — `boto3` and `PyYAML` are already installed there via `requirements.txt`. Do NOT use `.venv-lambda` for this (that venv is deploy-only, per `Zappa Deployment Gotchas`).

---

### Task 1: Script skeleton + `resolve_api_gateway_url`

**Files:**
- Create: `backend/scripts/__init__.py`
- Create: `backend/scripts/reconcile_deploy_env.py`
- Create: `backend/scripts/tests/__init__.py`
- Create: `backend/scripts/tests/test_reconcile_deploy_env.py`

**Interfaces:**
- Produces: `resolve_api_gateway_url(apigateway_client, rest_api_name: str, stage: str, region: str) -> str` — raises `LookupError` if zero or multiple matches found.

- [ ] **Step 1: Create empty package files**

```bash
mkdir -p backend/scripts/tests
touch backend/scripts/__init__.py
touch backend/scripts/tests/__init__.py
```

- [ ] **Step 2: Write the failing test**

Create `backend/scripts/tests/test_reconcile_deploy_env.py`:

```python
import unittest
from unittest.mock import MagicMock

from scripts.reconcile_deploy_env import resolve_api_gateway_url


class ResolveApiGatewayUrlTests(unittest.TestCase):
    def test_returns_url_for_matching_rest_api(self):
        client = MagicMock()
        client.get_rest_apis.return_value = {
            "items": [
                {"id": "other000", "name": "some-other-api"},
                {"id": "abc123", "name": "gym-tracker-dev"},
            ]
        }

        url = resolve_api_gateway_url(client, "gym-tracker-dev", "dev", "us-east-1")

        self.assertEqual(
            url, "https://abc123.execute-api.us-east-1.amazonaws.com/dev/api"
        )
        client.get_rest_apis.assert_called_once_with(limit=500)

    def test_raises_when_no_match_found(self):
        client = MagicMock()
        client.get_rest_apis.return_value = {"items": []}

        with self.assertRaises(LookupError):
            resolve_api_gateway_url(client, "gym-tracker-dev", "dev", "us-east-1")

    def test_raises_when_multiple_matches_found(self):
        client = MagicMock()
        client.get_rest_apis.return_value = {
            "items": [
                {"id": "abc123", "name": "gym-tracker-dev"},
                {"id": "def456", "name": "gym-tracker-dev"},
            ]
        }

        with self.assertRaises(LookupError):
            resolve_api_gateway_url(client, "gym-tracker-dev", "dev", "us-east-1")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.reconcile_deploy_env'`

- [ ] **Step 4: Write minimal implementation**

Create `backend/scripts/reconcile_deploy_env.py`:

```python
"""Reconciles deploy-time configuration drift between the Zappa backend
(Lambda + API Gateway) and the Amplify frontend.

See docs/superpowers/specs/2026-08-06-deploy-env-reconciliation-design.md
for the full design.
"""

import os
import sys
import time

import boto3
from botocore.exceptions import ClientError


def resolve_api_gateway_url(
    apigateway_client, rest_api_name: str, stage: str, region: str
) -> str:
    """Find the REST API named `rest_api_name` and return its invoke URL.

    Assumes fewer than 500 REST APIs exist in the account/region (a single
    un-paginated call is used for simplicity — see design doc open questions
    if this account ever needs pagination).
    """
    response = apigateway_client.get_rest_apis(limit=500)
    matches = [
        item for item in response.get("items", []) if item.get("name") == rest_api_name
    ]

    if not matches:
        raise LookupError(
            f"No API Gateway REST API found with name '{rest_api_name}'"
        )
    if len(matches) > 1:
        ids = [match["id"] for match in matches]
        raise LookupError(
            f"Multiple API Gateway REST APIs found with name '{rest_api_name}': {ids}"
        )

    api_id = matches[0]["id"]
    return f"https://{api_id}.execute-api.{region}.amazonaws.com/{stage}/api"
```

- [ ] **Step 5: Run test to verify it passes**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: `Ran 3 tests ... OK`

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/__init__.py backend/scripts/tests/__init__.py \
  backend/scripts/reconcile_deploy_env.py backend/scripts/tests/test_reconcile_deploy_env.py
git commit -m "Add resolve_api_gateway_url for deploy-env reconciliation script"
```

---

### Task 2: `resolve_amplify_url`

**Files:**
- Modify: `backend/scripts/reconcile_deploy_env.py`
- Modify: `backend/scripts/tests/test_reconcile_deploy_env.py`

**Interfaces:**
- Consumes: nothing from Task 1 (independent function).
- Produces: `resolve_amplify_url(amplify_client, app_id: str, branch_name: str) -> str`.

- [ ] **Step 1: Write the failing test**

Append to `backend/scripts/tests/test_reconcile_deploy_env.py`:

```python
from scripts.reconcile_deploy_env import resolve_amplify_url


class ResolveAmplifyUrlTests(unittest.TestCase):
    def test_builds_url_from_app_and_branch(self):
        client = MagicMock()
        client.get_app.return_value = {
            "app": {"appId": "d123456abcdef", "defaultDomain": "d123456abcdef.amplifyapp.com"}
        }
        client.get_branch.return_value = {"branch": {"branchName": "main"}}

        url = resolve_amplify_url(client, "d123456abcdef", "main")

        self.assertEqual(url, "https://main.d123456abcdef.amplifyapp.com")
        client.get_app.assert_called_once_with(appId="d123456abcdef")
        client.get_branch.assert_called_once_with(
            appId="d123456abcdef", branchName="main"
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: FAIL with `ImportError: cannot import name 'resolve_amplify_url'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/scripts/reconcile_deploy_env.py` (after `resolve_api_gateway_url`):

```python
def resolve_amplify_url(amplify_client, app_id: str, branch_name: str) -> str:
    """Return the default (non-custom-domain) URL for an Amplify branch."""
    app = amplify_client.get_app(appId=app_id)["app"]
    branch = amplify_client.get_branch(appId=app_id, branchName=branch_name)["branch"]
    return f"https://{branch['branchName']}.{app['defaultDomain']}"
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: `Ran 4 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/reconcile_deploy_env.py backend/scripts/tests/test_reconcile_deploy_env.py
git commit -m "Add resolve_amplify_url for deploy-env reconciliation script"
```

---

### Task 3: `reconcile_amplify_env_var`

**Files:**
- Modify: `backend/scripts/reconcile_deploy_env.py`
- Modify: `backend/scripts/tests/test_reconcile_deploy_env.py`

**Interfaces:**
- Produces: `reconcile_amplify_env_var(amplify_client, app_id: str, branch_name: str, key: str, value: str) -> bool` (returns `True` if a change was made).

- [ ] **Step 1: Write the failing test**

Append to `backend/scripts/tests/test_reconcile_deploy_env.py`:

```python
from scripts.reconcile_deploy_env import reconcile_amplify_env_var


class ReconcileAmplifyEnvVarTests(unittest.TestCase):
    def test_no_change_when_value_already_matches(self):
        client = MagicMock()
        client.get_branch.return_value = {
            "branch": {"environmentVariables": {"VITE_API_URL": "https://same.example.com"}}
        }

        changed = reconcile_amplify_env_var(
            client, "app-id", "main", "VITE_API_URL", "https://same.example.com"
        )

        self.assertFalse(changed)
        client.update_branch.assert_not_called()
        client.start_job.assert_not_called()

    def test_updates_and_preserves_other_env_vars(self):
        client = MagicMock()
        client.get_branch.return_value = {
            "branch": {
                "environmentVariables": {
                    "VITE_API_URL": "https://old.example.com",
                    "SOME_OTHER_VAR": "keep-me",
                }
            }
        }

        changed = reconcile_amplify_env_var(
            client, "app-id", "main", "VITE_API_URL", "https://new.example.com"
        )

        self.assertTrue(changed)
        client.update_branch.assert_called_once_with(
            appId="app-id",
            branchName="main",
            environmentVariables={
                "VITE_API_URL": "https://new.example.com",
                "SOME_OTHER_VAR": "keep-me",
            },
        )
        client.start_job.assert_called_once_with(
            appId="app-id", branchName="main", jobType="RELEASE"
        )

    def test_sets_value_when_key_absent(self):
        client = MagicMock()
        client.get_branch.return_value = {"branch": {"environmentVariables": {}}}

        changed = reconcile_amplify_env_var(
            client, "app-id", "main", "VITE_API_URL", "https://new.example.com"
        )

        self.assertTrue(changed)
        client.update_branch.assert_called_once_with(
            appId="app-id",
            branchName="main",
            environmentVariables={"VITE_API_URL": "https://new.example.com"},
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: FAIL with `ImportError: cannot import name 'reconcile_amplify_env_var'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/scripts/reconcile_deploy_env.py`:

```python
def reconcile_amplify_env_var(
    amplify_client, app_id: str, branch_name: str, key: str, value: str
) -> bool:
    """Ensure `key=value` is set in the Amplify branch's env vars.

    Preserves every other existing environment variable on the branch —
    `amplify:UpdateBranch` replaces the whole map, so this always
    fetch-merges before writing. Returns True if a write was made.
    """
    branch = amplify_client.get_branch(appId=app_id, branchName=branch_name)["branch"]
    current_env = dict(branch.get("environmentVariables", {}))

    if current_env.get(key) == value:
        return False

    current_env[key] = value
    amplify_client.update_branch(
        appId=app_id, branchName=branch_name, environmentVariables=current_env
    )
    # Amplify does not auto-rebuild on an env var change; trigger it explicitly.
    amplify_client.start_job(appId=app_id, branchName=branch_name, jobType="RELEASE")
    return True
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: `Ran 7 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/reconcile_deploy_env.py backend/scripts/tests/test_reconcile_deploy_env.py
git commit -m "Add reconcile_amplify_env_var for deploy-env reconciliation script"
```

---

### Task 4: `reconcile_cors_origins`

**Files:**
- Modify: `backend/scripts/reconcile_deploy_env.py`
- Modify: `backend/scripts/tests/test_reconcile_deploy_env.py`

**Interfaces:**
- Produces: `reconcile_cors_origins(ssm_client, parameter_name: str, origin_to_ensure: str) -> bool`.

- [ ] **Step 1: Write the failing test**

Append to `backend/scripts/tests/test_reconcile_deploy_env.py`:

```python
from scripts.reconcile_deploy_env import reconcile_cors_origins


class ReconcileCorsOriginsTests(unittest.TestCase):
    def test_no_change_when_origin_already_present(self):
        client = MagicMock()
        client.get_parameter.return_value = {
            "Parameter": {
                "Value": "http://localhost:5173,https://main.example.amplifyapp.com",
                "Type": "String",
            }
        }

        changed = reconcile_cors_origins(
            client, "/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            "https://main.example.amplifyapp.com",
        )

        self.assertFalse(changed)
        client.put_parameter.assert_not_called()

    def test_appends_missing_origin_and_preserves_existing(self):
        client = MagicMock()
        client.get_parameter.return_value = {
            "Parameter": {"Value": "http://localhost:5173", "Type": "String"}
        }

        changed = reconcile_cors_origins(
            client, "/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            "https://main.example.amplifyapp.com",
        )

        self.assertTrue(changed)
        client.put_parameter.assert_called_once_with(
            Name="/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            Value="http://localhost:5173,https://main.example.amplifyapp.com",
            Type="String",
            Overwrite=True,
        )

    def test_preserves_secure_string_type(self):
        client = MagicMock()
        client.get_parameter.return_value = {
            "Parameter": {"Value": "http://localhost:5173", "Type": "SecureString"}
        }

        reconcile_cors_origins(
            client, "/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            "https://main.example.amplifyapp.com",
        )

        client.put_parameter.assert_called_once_with(
            Name="/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
            Value="http://localhost:5173,https://main.example.amplifyapp.com",
            Type="SecureString",
            Overwrite=True,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: FAIL with `ImportError: cannot import name 'reconcile_cors_origins'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/scripts/reconcile_deploy_env.py`:

```python
def reconcile_cors_origins(
    ssm_client, parameter_name: str, origin_to_ensure: str
) -> bool:
    """Ensure `origin_to_ensure` is present in the comma-separated
    CORS_ALLOWED_ORIGINS SSM parameter, without removing anything already
    there. Preserves the parameter's original Type (e.g. SecureString) on
    write. Returns True if a write was made.
    """
    parameter = ssm_client.get_parameter(Name=parameter_name, WithDecryption=True)[
        "Parameter"
    ]
    origins = [origin.strip() for origin in parameter["Value"].split(",") if origin.strip()]

    if origin_to_ensure in origins:
        return False

    origins.append(origin_to_ensure)
    ssm_client.put_parameter(
        Name=parameter_name,
        Value=",".join(origins),
        Type=parameter["Type"],
        Overwrite=True,
    )
    return True
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: `Ran 10 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/reconcile_deploy_env.py backend/scripts/tests/test_reconcile_deploy_env.py
git commit -m "Add reconcile_cors_origins for deploy-env reconciliation script"
```

---

### Task 5: `force_lambda_cold_start`

**Files:**
- Modify: `backend/scripts/reconcile_deploy_env.py`
- Modify: `backend/scripts/tests/test_reconcile_deploy_env.py`

**Interfaces:**
- Produces: `force_lambda_cold_start(lambda_client, function_name: str) -> None`.

- [ ] **Step 1: Write the failing test**

Append to `backend/scripts/tests/test_reconcile_deploy_env.py`:

```python
from scripts.reconcile_deploy_env import force_lambda_cold_start


class ForceLambdaColdStartTests(unittest.TestCase):
    def test_updates_function_description_with_force_cold_prefix(self):
        client = MagicMock()

        force_lambda_cold_start(client, "gym-tracker-dev")

        client.update_function_configuration.assert_called_once()
        _, kwargs = client.update_function_configuration.call_args
        self.assertEqual(kwargs["FunctionName"], "gym-tracker-dev")
        self.assertTrue(kwargs["Description"].startswith("force-cold-"))
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: FAIL with `ImportError: cannot import name 'force_lambda_cold_start'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/scripts/reconcile_deploy_env.py`:

```python
def force_lambda_cold_start(lambda_client, function_name: str) -> None:
    """Force a new Lambda execution environment so warm containers pick up
    freshly-written SSM parameter values immediately, instead of waiting
    for their next natural cold start (config/aws_parameters.py caches
    Parameter Store reads for the life of a warm container via
    @lru_cache).
    """
    lambda_client.update_function_configuration(
        FunctionName=function_name,
        Description=f"force-cold-{int(time.time())}",
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: `Ran 11 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/reconcile_deploy_env.py backend/scripts/tests/test_reconcile_deploy_env.py
git commit -m "Add force_lambda_cold_start for deploy-env reconciliation script"
```

---

### Task 6: `main()` CLI wiring

**Files:**
- Modify: `backend/scripts/reconcile_deploy_env.py`
- Modify: `backend/scripts/tests/test_reconcile_deploy_env.py`

**Interfaces:**
- Consumes: all functions from Tasks 1-5.
- Produces: `main() -> int` (0 on success, 1 on failure), reads config from env vars: `AWS_REGION`, `API_GATEWAY_NAME`, `ZAPPA_STAGE`, `AMPLIFY_APP_ID`, `AMPLIFY_BRANCH_NAME`, `SSM_PARAMETER_NAME`, `LAMBDA_FUNCTION_NAME`.

- [ ] **Step 1: Write the failing test**

Append to `backend/scripts/tests/test_reconcile_deploy_env.py`:

```python
from unittest.mock import patch

from scripts.reconcile_deploy_env import main


class MainTests(unittest.TestCase):
    ENV = {
        "AWS_REGION": "us-east-1",
        "API_GATEWAY_NAME": "gym-tracker-dev",
        "ZAPPA_STAGE": "dev",
        "AMPLIFY_APP_ID": "app-id",
        "AMPLIFY_BRANCH_NAME": "main",
        "SSM_PARAMETER_NAME": "/gym-tracker/dev/CORS_ALLOWED_ORIGINS",
        "LAMBDA_FUNCTION_NAME": "gym-tracker-dev",
    }

    def _make_clients(self, apigateway, amplify, ssm, lambda_):
        clients = {
            "apigateway": apigateway,
            "amplify": amplify,
            "ssm": ssm,
            "lambda": lambda_,
        }
        return lambda service_name, region_name=None: clients[service_name]

    @patch("scripts.reconcile_deploy_env.boto3")
    @patch.dict(os.environ, ENV, clear=True)
    def test_success_path_reconciles_both_sides_and_forces_cold_start(self, mock_boto3):
        apigateway = MagicMock()
        apigateway.get_rest_apis.return_value = {
            "items": [{"id": "abc123", "name": "gym-tracker-dev"}]
        }

        amplify = MagicMock()
        amplify.get_branch.return_value = {
            "branch": {"branchName": "main", "environmentVariables": {}}
        }
        amplify.get_app.return_value = {
            "app": {"defaultDomain": "app-id.amplifyapp.com"}
        }

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {"Value": "http://localhost:5173", "Type": "String"}
        }

        lambda_client = MagicMock()

        mock_boto3.client.side_effect = self._make_clients(
            apigateway, amplify, ssm, lambda_client
        )

        exit_code = main()

        self.assertEqual(exit_code, 0)
        amplify.update_branch.assert_called_once()
        ssm.put_parameter.assert_called_once()
        lambda_client.update_function_configuration.assert_called_once()

    @patch("scripts.reconcile_deploy_env.boto3")
    @patch.dict(os.environ, ENV, clear=True)
    def test_returns_1_when_api_gateway_not_found(self, mock_boto3):
        apigateway = MagicMock()
        apigateway.get_rest_apis.return_value = {"items": []}

        mock_boto3.client.side_effect = self._make_clients(
            apigateway, MagicMock(), MagicMock(), MagicMock()
        )

        exit_code = main()

        self.assertEqual(exit_code, 1)

    @patch("scripts.reconcile_deploy_env.boto3")
    @patch.dict(os.environ, ENV, clear=True)
    def test_skips_cold_start_when_cors_already_up_to_date(self, mock_boto3):
        apigateway = MagicMock()
        apigateway.get_rest_apis.return_value = {
            "items": [{"id": "abc123", "name": "gym-tracker-dev"}]
        }

        amplify = MagicMock()
        amplify.get_branch.return_value = {
            "branch": {
                "branchName": "main",
                "environmentVariables": {
                    "VITE_API_URL": "https://abc123.execute-api.us-east-1.amazonaws.com/dev/api"
                },
            }
        }
        amplify.get_app.return_value = {
            "app": {"defaultDomain": "app-id.amplifyapp.com"}
        }

        ssm = MagicMock()
        ssm.get_parameter.return_value = {
            "Parameter": {
                "Value": "https://main.app-id.amplifyapp.com",
                "Type": "String",
            }
        }

        lambda_client = MagicMock()

        mock_boto3.client.side_effect = self._make_clients(
            apigateway, amplify, ssm, lambda_client
        )

        exit_code = main()

        self.assertEqual(exit_code, 0)
        amplify.update_branch.assert_not_called()
        ssm.put_parameter.assert_not_called()
        lambda_client.update_function_configuration.assert_not_called()
```

Add `import os` to the top of the test file's imports (alongside the existing `import unittest`).

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: FAIL with `ImportError: cannot import name 'main'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/scripts/reconcile_deploy_env.py`:

```python
def main() -> int:
    region = os.environ.get("AWS_REGION", "us-east-1")
    rest_api_name = os.environ["API_GATEWAY_NAME"]
    stage = os.environ.get("ZAPPA_STAGE", "dev")
    amplify_app_id = os.environ["AMPLIFY_APP_ID"]
    amplify_branch = os.environ.get("AMPLIFY_BRANCH_NAME", "main")
    ssm_parameter_name = os.environ["SSM_PARAMETER_NAME"]
    lambda_function_name = os.environ["LAMBDA_FUNCTION_NAME"]

    apigateway_client = boto3.client("apigateway", region_name=region)
    amplify_client = boto3.client("amplify", region_name=region)
    ssm_client = boto3.client("ssm", region_name=region)
    lambda_client = boto3.client("lambda", region_name=region)

    try:
        api_url = resolve_api_gateway_url(apigateway_client, rest_api_name, stage, region)
    except LookupError as exc:
        print(f"ERROR: {exc}")
        return 1
    print(f"Resolved API Gateway URL: {api_url}")

    amplify_changed = reconcile_amplify_env_var(
        amplify_client, amplify_app_id, amplify_branch, "VITE_API_URL", api_url
    )
    print(f"Amplify VITE_API_URL {'updated' if amplify_changed else 'already up to date'}")

    try:
        amplify_url = resolve_amplify_url(amplify_client, amplify_app_id, amplify_branch)
    except ClientError as exc:
        print(f"ERROR: {exc}")
        return 1
    print(f"Resolved Amplify URL: {amplify_url}")

    cors_changed = reconcile_cors_origins(ssm_client, ssm_parameter_name, amplify_url)
    print(f"CORS_ALLOWED_ORIGINS {'updated' if cors_changed else 'already up to date'}")

    if cors_changed:
        force_lambda_cold_start(lambda_client, lambda_function_name)
        print(f"Forced cold start on {lambda_function_name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `python -m unittest scripts.tests.test_reconcile_deploy_env -v`
Expected: `Ran 14 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/reconcile_deploy_env.py backend/scripts/tests/test_reconcile_deploy_env.py
git commit -m "Add main() CLI entrypoint for deploy-env reconciliation script"
```

---

### Task 7: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/reconcile-deploy-env.yml`
- Test: `backend/scripts/tests/test_workflow_yaml.py`

**Interfaces:**
- Consumes: `backend/scripts/reconcile_deploy_env.py`'s env var contract from Task 6.
- Produces: a runnable `workflow_dispatch` GitHub Actions workflow.

- [ ] **Step 1: Write the failing test**

Create `backend/scripts/tests/test_workflow_yaml.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `python -m unittest scripts.tests.test_workflow_yaml -v`
Expected: FAIL — `AssertionError: ... does not exist`

- [ ] **Step 3: Write the workflow file**

Create `.github/workflows/reconcile-deploy-env.yml`:

```yaml
name: Reconcile deploy env (Amplify <-> Zappa)

on:
  workflow_dispatch: {}

permissions:
  contents: read

jobs:
  reconcile:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    env:
      AWS_REGION: us-east-1
      API_GATEWAY_NAME: gym-tracker-dev
      ZAPPA_STAGE: dev
      AMPLIFY_APP_ID: REPLACE_WITH_AMPLIFY_APP_ID
      AMPLIFY_BRANCH_NAME: main
      SSM_PARAMETER_NAME: /gym-tracker/dev/CORS_ALLOWED_ORIGINS
      LAMBDA_FUNCTION_NAME: gym-tracker-dev
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install boto3

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::REPLACE_WITH_ACCOUNT_ID:role/gym-tracker-github-actions
          aws-region: us-east-1

      - name: Reconcile deploy environment
        working-directory: backend
        run: python -m scripts.reconcile_deploy_env
```

Note the two `REPLACE_WITH_*` placeholders — filled in during Task 8 once the AWS account ID and IAM role exist.

- [ ] **Step 4: Run test to verify it passes**

Run (from `backend/`): `python -m unittest scripts.tests.test_workflow_yaml -v`
Expected: `Ran 3 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/reconcile-deploy-env.yml backend/scripts/tests/test_workflow_yaml.py
git commit -m "Add reconcile-deploy-env GitHub Actions workflow"
```

---

### Task 8: AWS IAM OIDC role setup (manual AWS step)

**Files:**
- Modify: `.github/workflows/reconcile-deploy-env.yml` (fill in placeholders)
- Modify (Obsidian, outside repo): `AWS Deployment - Backend (Zappa) and Frontend (Amplify).md`

This task has no automated test — it provisions real AWS IAM resources. Verification is via `aws iam` read commands after each step.

- [ ] **Step 1: Check whether a GitHub OIDC provider already exists**

```bash
aws iam list-open-id-connect-providers --profile gym-tracker-admin
```
Look for an ARN containing `token.actions.githubusercontent.com`. If present, skip Step 2.

- [ ] **Step 2: Create the GitHub OIDC provider (only if Step 1 found none)**

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --profile gym-tracker-admin
```

- [ ] **Step 3: Write the trust policy file**

Create `/tmp/gym-tracker-github-actions-trust.json` (not committed — contains the AWS account ID):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:bioflower/gym-tracker:ref:refs/heads/main"
        }
      }
    }
  ]
}
```
Replace `<account-id>` with the real account ID from `aws sts get-caller-identity --profile gym-tracker-admin`.

- [ ] **Step 4: Write the permissions policy file**

Create `/tmp/gym-tracker-github-actions-policy.json` (replace `<account-id>` and `<amplify-app-id>`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "apigateway:GET", "Resource": "*" },
    {
      "Effect": "Allow",
      "Action": ["amplify:GetApp", "amplify:GetBranch", "amplify:UpdateBranch", "amplify:StartJob"],
      "Resource": "arn:aws:amplify:us-east-1:<account-id>:apps/<amplify-app-id>*"
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:PutParameter"],
      "Resource": "arn:aws:ssm:us-east-1:<account-id>:parameter/gym-tracker/dev/CORS_ALLOWED_ORIGINS"
    },
    {
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:us-east-1:<account-id>:key/*"
    },
    {
      "Effect": "Allow",
      "Action": ["lambda:GetFunctionConfiguration", "lambda:UpdateFunctionConfiguration"],
      "Resource": "arn:aws:lambda:us-east-1:<account-id>:function:gym-tracker-dev"
    }
  ]
}
```

- [ ] **Step 5: Create the role and attach the policy**

```bash
aws iam create-role \
  --role-name gym-tracker-github-actions \
  --assume-role-policy-document file:///tmp/gym-tracker-github-actions-trust.json \
  --profile gym-tracker-admin

aws iam put-role-policy \
  --role-name gym-tracker-github-actions \
  --policy-name gym-tracker-github-actions-permissions \
  --policy-document file:///tmp/gym-tracker-github-actions-policy.json \
  --profile gym-tracker-admin
```

- [ ] **Step 6: Verify the role**

```bash
aws iam get-role --role-name gym-tracker-github-actions --profile gym-tracker-admin
aws iam get-role-policy --role-name gym-tracker-github-actions \
  --policy-name gym-tracker-github-actions-permissions --profile gym-tracker-admin
```
Confirm the trust policy's `sub` condition and the permissions policy's resources match Steps 3-4 exactly.

- [ ] **Step 7: Clean up local policy files**

```bash
rm /tmp/gym-tracker-github-actions-trust.json /tmp/gym-tracker-github-actions-policy.json
```

- [ ] **Step 8: Fill in the workflow placeholders**

Edit `.github/workflows/reconcile-deploy-env.yml`:
- Replace `AMPLIFY_APP_ID: REPLACE_WITH_AMPLIFY_APP_ID` with the real Amplify app ID (find via `aws amplify list-apps --profile gym-tracker-admin --query "apps[].{id:appId,name:name}"`).
- Replace `role-to-assume: arn:aws:iam::REPLACE_WITH_ACCOUNT_ID:role/gym-tracker-github-actions` with the real account ID.

- [ ] **Step 9: Commit**

```bash
git add .github/workflows/reconcile-deploy-env.yml
git commit -m "Fill in Amplify app ID and IAM role ARN in reconcile-deploy-env workflow"
```

---

### Task 9: End-to-end manual validation

**Files:** none (validation only)

- [ ] **Step 1: Confirm current drift state before running**

```bash
aws amplify get-branch --app-id <amplify-app-id> --branch-name main \
  --profile gym-tracker-admin --query "branch.environmentVariables.VITE_API_URL"

aws ssm get-parameter --name /gym-tracker/dev/CORS_ALLOWED_ORIGINS \
  --with-decryption --profile gym-tracker-admin --query "Parameter.Value"
```
Record both values.

- [ ] **Step 2: Trigger the workflow**

```bash
gh workflow run reconcile-deploy-env.yml
gh run watch
```

- [ ] **Step 3: Confirm the job summary shows expected before/after values**

Open the run in the GitHub Actions UI (or `gh run view --log`) and confirm the printed
`Resolved API Gateway URL`, `Amplify VITE_API_URL ...`, `Resolved Amplify URL`, and
`CORS_ALLOWED_ORIGINS ...` lines match what you'd expect from Step 1.

- [ ] **Step 4: Re-verify AWS state matches**

Re-run the two `aws` commands from Step 1 — confirm `VITE_API_URL` now matches the live
API Gateway URL and `CORS_ALLOWED_ORIGINS` now includes the live Amplify URL.

- [ ] **Step 5: Confirm idempotency**

```bash
gh workflow run reconcile-deploy-env.yml
gh run watch
```
Confirm the job summary shows `already up to date` for both Amplify and CORS, and that
no `update_branch`/`put_parameter`/`update_function_configuration` calls happened (no new
Amplify build triggered, no Lambda cold-start forced).

- [ ] **Step 6: Confirm the frontend actually works against the backend**

Open the live Amplify URL in a browser, log in, and confirm at least one API call
succeeds (e.g. the Today page loads workout data) — this is the real end-to-end proof
that `VITE_API_URL` and `CORS_ALLOWED_ORIGINS` are both correctly wired.
