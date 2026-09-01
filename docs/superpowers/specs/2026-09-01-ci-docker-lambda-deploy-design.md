# CI Docker-Based Lambda Deploy (Zappa) — Design

## Problem

Deploying the Zappa backend from macOS is fragile: `pip install` on a Mac pulls
macOS wheels for compiled packages (`psycopg`, `psycopg-binary`,
`psycopg2-binary`), which are Mach-O binaries that fail to import on AWS
Lambda's Linux x86_64 runtime. This caused a production outage
(`ImproperlyConfigured: Error loading psycopg2 or psycopg module`) and was
previously fixed with a one-off manual `pip install --platform manylinux` for
`psycopg2-binary` only.

A Docker-based dependency build already exists in this repo
(`backend/docker/Dockerfile.lambda-deps` + `backend/scripts/build_lambda_deps.sh`,
designed in `2026-08-06-docker-lambda-deps-design.md`). It rebuilds the entire
`backend/requirements.txt` inside AWS's own `sam/build-python3.11` image
(Linux x86_64, matching Lambda), swaps the result into a dedicated deploy-only
venv (`backend/.venv-lambda`), and verifies the binaries are ELF. **However, the
flow is manual**: a developer must run the script locally, then run
`.venv-lambda/bin/zappa update dev` from their machine.

This spec automates that exact flow in GitHub Actions so a deploy is a
push-button action, eliminating the macOS/CI drift entirely and making the
Docker path the single source of truth for how Lambda deps get built.

## Goal

A `workflow_dispatch`-only GitHub Actions workflow that:
1. Builds Lambda dependencies via the existing Dockerfile (`build_lambda_deps.sh`).
2. Runs `manage.py migrate` against the real Neon DB (resolving `DATABASE_URL`
   from SSM exactly like production).
3. Runs `zappa update dev` using the Linux-built `.venv-lambda`.
4. Verifies the deployment.

AWS credentials come from a new dedicated OIDC role, not from the local
`gym-tracker-admin` SSO profile.

## Non-goals

- **Not** switching to Lambda container images (ECR). Zip-based Zappa deployment
  is preserved.
- **Not** automating the Amplify frontend deploy or the existing
  `reconcile-deploy-env` workflow — those remain separate `workflow_dispatch`
  workflows.
- **Not** auto-deploy on push/PR. Deploy is manual-only.
- **Not** changing `requirements.txt`, `Dockerfile.lambda-deps`, or
  `build_lambda_deps.sh`.
- **Not** multi-stage support. `dev` only, matching `zappa_settings.json`.

## Design decisions (confirmed with user)

- **Trigger:** manual `workflow_dispatch` button only. No `push`/`pull_request`
  triggers, so merging code can never deploy by accident.
- **Migrations:** run in CI before `zappa update`, using `APP_ENV=aws-dev` so
  `config/settings.py` resolves `DATABASE_URL` from SSM the same way the Lambda
  does (no secrets in the repo, no DATABASE_URL hardcoded in the workflow).
- **Credentials:** a **new** dedicated deploy IAM role, not the existing
  reconcile role (which lacks zappa's S3/Lambda/API Gateway/IAM needs).
- **IAM posture:** `manage_roles: false` in `zappa_settings.json` with a
  **pre-provisioned** Lambda execution role. This keeps the GitHub Actions
  deploy role strictly least-privilege (no `iam:CreateRole`/`DeleteRole`), so a
  compromised workflow cannot create/delete IAM roles. This is a deliberate
  trade-off vs. zappa's default `manage_roles: true`: one-time manual role
  creation now, in exchange for a narrower deploy-role surface.

## Architecture

```
┌──────────────────────────── GitHub Actions (ubuntu-latest) ────────────────────────────┐
│  workflow_dispatch  ──►  checkout  ──►  setup-python 3.11                              │
│                                  │                                                     │
│                                  ▼                                                     │
│                  Configure AWS creds (OIDC ─► gym-tracker-github-deploy)               │
│                                  │                                                     │
│                                  ▼                                                     │
│                  build_lambda_deps.sh  (Docker linux/amd64 ─► .venv-lambda)            │
│                                  │                                                     │
│                                  ▼                                                     │
│                  .venv-lambda/bin/python manage.py migrate --noinput                   │
│                  (APP_ENV=aws-dev; DATABASE_URL from SSM)                              │
│                                  │                                                     │
│                                  ▼                                                     │
│                  .venv-lambda/bin/zappa update dev  ──►  AWS Lambda gym-tracker-dev    │
│                                  │                                                     │
│                                  ▼                                                     │
│                  Verify: zappa status check + aws lambda get-function-configuration    │
└────────────────────────────────────────────────────────────────────────────────────────┘

AWS side (one-time manual setup, JSON provided in docs/aws-deploy-roles.md):
  A. Role gym-tracker-github-deploy          — OIDC trust, scoped perms
  B. Role gym-tracker-dev-ZappaLambdaExecutionRole — Lambda execution role (pre-provisioned)
```

### Workflow: `.github/workflows/deploy-lambda.yml`

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
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
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

Notes:
- `build_lambda_deps.sh` is reused verbatim. It requires `docker info` (Docker is
  preinstalled on `ubuntu-latest`) and `python3.11` on PATH (provided by
  `actions/setup-python`). The script's ELF check fails the build if the
  extracted deps are not Linux binaries.
- `zappa_settings.json` sets `profile_name: gym-tracker-admin` (a local SSO
  profile absent in CI). boto3's credential chain resolves env vars
  (`AWS_ACCESS_KEY_ID` etc. set by the OIDC action) before profile credentials,
  so deploys work. Confirmed during verification; if zappa fails to find the
  profile, `profile_name` is removed from `zappa_settings.json` (the env vars
  suffice).
- Migrations run with `APP_ENV=aws-dev` so `config/aws_parameters.py` reads the
  SSM tree under `/gym-tracker/dev`; the deploy role gets read-only SSM access to
  exactly that path.
- `zappa update` performs its own `GET /` status check after deploy; the
  `aws lambda` step is a cheap extra sanity check.

### zappa_settings.json change

Add to the `dev` stage:

```json
"manage_roles": false,
"role_name": "gym-tracker-dev-ZappaLambdaExecutionRole"
```

`role_name` matches zappa's default auto-generated name, so the Lambda function's
existing execution role keeps its name and the current deployment is preserved.

## AWS IAM (docs/aws-deploy-roles.md)

Two JSON blocks provided for pasting into AWS.

### A. Deploy role — `gym-tracker-github-deploy`

**Trust policy** (OIDC):
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
> **Tighten before merge:** change `StringLike` value to
> `"repo:bioflower/gym-tracker:ref:refs/heads/main"` so only the main branch can
> assume the role. The broad value is only for bring-up testing from the feature
> branch.

**Permissions** (least privilege):
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
> `events:*` (CloudWatch Events) covers zappa's default `keep_warm` scheduled
> invocations. If any missing action surfaces during verification, add it
> rather than widening to `*` globally.

### B. Lambda execution role — `gym-tracker-dev-ZappaLambdaExecutionRole`

Pre-provisioned once, matching what zappa would create with `manage_roles: true`.
Trust policy allows `lambda.amazonaws.com` to assume it; attach AWS managed
policies `AWSLambdaBasicExecutionRole` (CloudWatch Logs) plus an inline policy
granting `ssm:GetParametersByPath`/`GetParameter` on `/gym-tracker/dev/*`
(production app config is read from SSM by `config/aws_parameters.py`) and the
Neon/Postgres egress permissions the function already uses.

> Exact final inline policy for B is derived from the existing function's role
> (`aws iam get-role`/`list-attached-role-policies`) during implementation, so
> the pre-provisioned role is byte-for-byte equivalent to what the function
> currently has.

## Error handling / failure modes

- Docker not available or build fails → `build_lambda_deps.sh` exits non-zero,
  workflow fails before any deploy. Existing `.venv-lambda` untouched.
- ELF check fails → script exits non-zero, no deploy.
- Migrate fails → workflow stops, zappa never runs (no partially-deployed code
  with unmigrated schema).
- `zappa update` fails → no changes; zappa's status check surfaces a 502
  immediately for a bad artifact.
- Trust policy too loose is mitigated by the tighten-before-merge step.

## Files changed

- NEW `.github/workflows/deploy-lambda.yml`
- MODIFY `backend/zappa_settings.json` (`manage_roles: false`, `role_name`)
- NEW `docs/aws-deploy-roles.md`
- NEW `docs/superpowers/specs/2026-09-01-ci-docker-lambda-deploy-design.md`

## Verification plan (manual)

1. Create role **B** and **A** in AWS using `docs/aws-deploy-roles.md`.
2. Trigger `deploy-lambda` workflow (`workflow_dispatch`) from the feature
   branch. Expect: Docker build → ELF check pass → migrate → `zappa update dev`
   → `Your updated Zappa deployment is live!` + status check 200.
3. Confirm the deployed function's execution role is unchanged
   (`aws lambda get-function-configuration`).
4. Confirm `manage_roles: false` did not disturb the existing deployment.
5. Before merging: tighten the OIDC trust policy `sub` to `ref:refs/heads/main`.
