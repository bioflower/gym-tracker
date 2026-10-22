# CI Docker-Based Lambda Deploy (Zappa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate the existing Docker-based Lambda dependency build + `zappa update` into a push-button GitHub Actions workflow, with a pre-provisioned Lambda execution role.

**Architecture:** A `workflow_dispatch`-only workflow on `ubuntu-latest` runs the existing `backend/scripts/build_lambda_deps.sh` (Docker linux/amd64 build → `.venv-lambda` swap → ELF check), then `manage.py migrate`/`collectstatic` (config resolved from SSM via `APP_ENV=aws-dev`), then `.venv-lambda/bin/zappa update dev`. AWS creds come from a new OIDC role; `zappa_settings.json` sets `manage_roles: false` + a pre-provisioned `role_name` so the deploy role stays least-privilege.

**Tech Stack:** GitHub Actions, Zappa 0.60.2, Docker, Django 5.1, Python 3.11, boto3, PyYAML (tests).

## Global Constraints

- Zappa stage: `dev` only (matches `backend/zappa_settings.json`).
- Region: `us-east-1`. AWS account: `214182382176`.
- Reuse `backend/scripts/build_lambda_deps.sh` and `backend/docker/Dockerfile.lambda-deps` **unchanged**.
- Do not modify `requirements.txt`, `Dockerfile.lambda-deps`, or `build_lambda_deps.sh`.
- Deploy is manual-only (`workflow_dispatch`); no `push`/`pull_request` triggers.
- Workflow YAML must declare `permissions: { id-token: write, contents: read }`.
- Lambda execution role name: `gym-tracker-dev-ZappaLambdaExecutionRole` (matches zappa's default naming).
- GitHub repo for OIDC trust policy: `bioflower/gym-tracker`.

---
## File Structure

- `.github/workflows/deploy-lambda.yml` — NEW. The deploy workflow (the primary deliverable).
- `backend/zappa_settings.json` — MODIFY. Add `manage_roles: false` and `role_name`.
- `backend/scripts/tests/test_deploy_workflow_yaml.py` — NEW. Validates the new workflow YAML (mirrors the existing `test_workflow_yaml.py` pattern).
- `docs/aws-deploy-roles.md` — NEW. IAM trust + permissions JSON for both roles.

---

### Task 1: Deploy workflow + YAML validation test

**Files:**
- Create: `.github/workflows/deploy-lambda.yml`
- Test: `backend/scripts/tests/test_deploy_workflow_yaml.py`

**Interfaces:**
- Consumes: existing `backend/scripts/build_lambda_deps.sh` (no changes); existing `backend/.venv-lambda` produced by that script.
- Produces: `.github/workflows/deploy-lambda.yml` — a workflow named `Deploy backend to Lambda (Zappa + Docker deps)` with one `deploy` job. `zappa_settings.json` `role_name` (from Task 2) is consumed by the running zappa.

- [ ] **Step 1: Write the failing test**

Create `backend/scripts/tests/test_deploy_workflow_yaml.py`:

```python
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

    def test_deploy_job_runs_on_ubuntu(self):
        with open(WORKFLOW_PATH) as handle:
            workflow = yaml.safe_load(handle)

        self.assertEqual(workflow["jobs"]["deploy"]["runs-on"], "ubuntu-latest")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m unittest scripts.tests.test_deploy_workflow_yaml -v`

Expected: FAIL — `AssertionError: False is not true` because `.github/workflows/deploy-lambda.yml` does not exist yet.

- [ ] **Step 3: Create the workflow**

Create `.github/workflows/deploy-lambda.yml`:

```yaml
name: Deploy backend to Lambda (Zappa + Docker deps)

on:
  workflow_dispatch:
    inputs:
      stage:
        description: Zappa stage to deploy
        required: true
        default: dev
        type: choice
        options: [dev]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::214182382176:role/gym-tracker-github-deploy
          audience: sts.amazonaws.com
          aws-region: us-east-1

      - name: Build Lambda dependencies (Docker)
        working-directory: backend
        run: ./scripts/build_lambda_deps.sh

      - name: Run migrations + collectstatic
        working-directory: backend
        env:
          APP_ENV: aws-dev
          AWS_PARAMETER_PREFIX: /gym-tracker/dev
          AWS_APP_REGION: us-east-1
        run: |
          ./.venv-lambda/bin/python manage.py migrate --noinput
          ./.venv-lambda/bin/python manage.py collectstatic --noinput

      - name: Deploy with Zappa
        working-directory: backend
        run: ./.venv-lambda/bin/zappa update ${{ inputs.stage }}

      - name: Verify deployment
        run: aws lambda get-function-configuration --function-name gym-tracker-dev --query 'State,LastUpdateStatus' --output text
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m unittest scripts.tests.test_deploy_workflow_yaml -v`

Expected: 5 tests PASS (all `ok`).

- [ ] **Step 5: Run full backend test suite to confirm nothing broke**

Run: `cd backend && python manage.py test`

Expected: all existing tests pass (including `scripts.tests.test_workflow_yaml`).

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy-lambda.yml backend/scripts/tests/test_deploy_workflow_yaml.py
git commit -m "Add push-button Docker-based Lambda deploy workflow"
```

---

### Task 2: Pre-provisioned Lambda execution role in zappa settings

**Files:**
- Modify: `backend/zappa_settings.json` (the `dev` block, lines 2-24)
- Test: `backend/scripts/tests/test_deploy_workflow_yaml.py` (append assertions)

**Interfaces:**
- Consumes: nothing new.
- Produces: `zappa_settings.json` with `dev.manage_roles == false` and `dev.role_name == "gym-tracker-dev-ZappaLambdaExecutionRole"` — consumed by Task 1's `zappa update` step at runtime.

- [ ] **Step 1: Write the failing test (append to test file)**

Append this class to `backend/scripts/tests/test_deploy_workflow_yaml.py`:

```python
import json
from pathlib import Path


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m unittest scripts.tests.test_deploy_workflow_yaml -v`

Expected: FAIL — `KeyError: 'manage_roles'` (or `AssertionError`) because the settings do not yet have these keys.

- [ ] **Step 3: Modify `backend/zappa_settings.json`**

In the `dev` block, change:

```json
    "manage_roles": true,
```

to:

```json
    "manage_roles": false,
    "role_name": "gym-tracker-dev-ZappaLambdaExecutionRole",
```

The result should read:

```json
{
  "dev": {
    "project_name": "gym-tracker",
    "profile_name": "gym-tracker-admin",
    "runtime": "python3.11",
    "aws_region": "us-east-1",
    "django_settings": "config.settings",
    "s3_bucket": "gym-tracker-zappa-dev",
    "manage_roles": false,
    "role_name": "gym-tracker-dev-ZappaLambdaExecutionRole",
    "timeout_seconds": 30,
    "memory_size": 512,
    "environment_variables": {
      "APP_ENV": "aws-dev",
      "AWS_PARAMETER_PREFIX": "/gym-tracker/dev",
      "AWS_APP_REGION": "us-east-1"
    },

    "exclude": [
      ".env",
      ".env.*",
      ".git/*",
      "frontend/*"
    ]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m unittest scripts.tests.test_deploy_workflow_yaml -v`

Expected: all tests PASS (both classes).

- [ ] **Step 5: Commit**

```bash
git add backend/zappa_settings.json backend/scripts/tests/test_deploy_workflow_yaml.py
git commit -m "Use pre-provisioned Lambda execution role (manage_roles: false)"
```

---

### Task 3: IAM role documentation

**Files:**
- Create: `docs/aws-deploy-roles.md`

**Interfaces:**
- Consumes: spec `docs/superpowers/specs/2026-09-01-ci-docker-lambda-deploy-design.md` (IAM section).
- Produces: the trust + permissions JSON the user pastes into AWS IAM for roles `gym-tracker-github-deploy` (A) and `gym-tracker-dev-ZappaLambdaExecutionRole` (B).

- [ ] **Step 1: Create `docs/aws-deploy-roles.md`**

Create the file with the exact content below. It documents both roles and the one-time manual setup, including the "tighten before merge" note.

```markdown
# AWS IAM Roles for CI Lambda Deploy

Deploying the Zappa backend from CI uses two IAM roles. Create both once in
the AWS console (account `214182382176`, region `us-east-1`).

## A. GitHub Actions deploy role — `gym-tracker-github-deploy`

The workflow assumes this role via OIDC. Keep it least-privilege: it never
creates/deletes IAM roles (the Lambda execution role is pre-provisioned, see B).

### Trust policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::214182382176:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:bioflower/gym-tracker:*"
        }
      }
    }
  ]
}
```

> **Tighten before merging to main:** change the `StringLike` value to
> `"repo:bioflower/gym-tracker:ref:refs/heads/main"` so only the main branch
> can assume the role. The broad value is for bring-up testing from the feature
> branch.

### Permissions (inline policy)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket", "s3:GetBucketLocation", "s3:PutObject",
        "s3:GetObject", "s3:DeleteObject", "s3:CreateBucket"
      ],
      "Resource": ["arn:aws:s3:::gym-tracker-zappa-dev", "arn:aws:s3:::gym-tracker-zappa-dev/*"]
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:GetFunction", "lambda:GetFunctionConfiguration",
        "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration",
        "lambda:CreateFunction", "lambda:PublishVersion", "lambda:AddPermission",
        "lambda:RemovePermission", "lambda:UpdateAlias", "lambda:GetAlias", "lambda:CreateAlias"
      ],
      "Resource": ["arn:aws:lambda:us-east-1:214182382176:function:gym-tracker-dev"]
    },
    {
      "Effect": "Allow",
      "Action": ["apigateway:GET", "apigateway:POST", "apigateway:PUT", "apigateway:PATCH", "apigateway:DELETE"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogGroups", "logs:TagResource", "logs:UntagResource", "logs:PutRetentionPolicy"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      "Resource": "arn:aws:ssm:us-east-1:214182382176:parameter/gym-tracker/dev/*"
    },
    {
      "Effect": "Allow",
      "Action": ["iam:PassRole", "iam:GetRole", "iam:GetRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies"],
      "Resource": "arn:aws:iam::214182382176:role/gym-tracker-dev-ZappaLambdaExecutionRole"
    },
    {
      "Effect": "Allow",
      "Action": ["events:PutRule", "events:PutTargets", "events:RemoveTargets", "events:DeleteRule", "events:DescribeRule", "events:ListRules"],
      "Resource": "*"
    }
  ]
}
```

> `events:*` covers zappa's default `keep_warm` scheduled invocations. If a
> missing action surfaces during verification, add just that action rather than
> widening to `*` globally.

## B. Lambda execution role — `gym-tracker-dev-ZappaLambdaExecutionRole`

Pre-provisioned once so `zappa_settings.json` can set `manage_roles: false`.
The name matches what zappa would have auto-created, so the running function's
role is preserved.

### Trust policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### Attached policies

1. AWS managed: `AWSLambdaBasicExecutionRole` (CloudWatch Logs).
2. Inline policy granting SSM reads for app config, scoped to the app prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"],
      "Resource": "arn:aws:ssm:us-east-1:214182382176:parameter/gym-tracker/dev/*"
    }
  ]
}
```

> The running function's existing role may carry additional policies (e.g.
> PostgreSQL/Neon egress). Before creating B, diff it against the live function:
> `aws lambda get-function-configuration --function-name gym-tracker-dev --query Role`
> then inspect that role's attached policies, so the pre-provisioned role is
> equivalent to what the function currently uses.

## One-time setup order

1. Create role **B**, then update its trust/attached policies to match the live
   function's role.
2. Set `manage_roles: false` + `role_name` (already done in `zappa_settings.json`).
3. Create role **A** (OIDC + permissions).
4. Trigger the `deploy-lambda` workflow from the Actions tab.
5. Before merging to main, tighten A's trust policy `sub` to
   `ref:refs/heads/main`.
```

- [ ] **Step 2: Commit**

```bash
git add docs/aws-deploy-roles.md
git commit -m "Add AWS IAM role documentation for CI Lambda deploy"
```

---

### Task 4: Manual end-to-end verification (documented, no code)

**Files:**
- None (AWS + GitHub Actions only).

**Interfaces:**
- Consumes: roles A and B from Task 3, workflow from Task 1, settings from Task 2.

- [ ] **Step 1: Create role B (Lambda execution role) in AWS** per `docs/aws-deploy-roles.md`, diffing against the live function's role.
- [ ] **Step 2: Create role A (GitHub deploy role) + OIDC trust policy** per `docs/aws-deploy-roles.md`.
- [ ] **Step 3: Trigger the workflow** from the Actions tab (`workflow_dispatch`, stage `dev`). Confirm: Docker build → ELF check pass → migrate → `zappa update dev` → `Your updated Zappa deployment is live!` → verify step returns `Active` (or no error).
- [ ] **Step 4: Confirm the function's execution role is unchanged**: `aws lambda get-function-configuration --function-name gym-tracker-dev --query Role` matches role B.
- [ ] **Step 5: Before merging to main**, tighten role A's OIDC trust policy `sub` to `ref:refs/heads/main`.
