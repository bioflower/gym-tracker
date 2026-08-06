# Deploy Environment Reconciliation — Design

## Problem

The backend (Zappa → Lambda + API Gateway) and frontend (Amplify → S3 + CloudFront)
are deployed independently, but two configuration values must stay in sync between them:

- **Amplify env var `VITE_API_URL`** must equal the current Zappa API Gateway URL
  (baked into the frontend bundle at build time — see `src/api/client.ts`).
- **SSM parameter `/gym-tracker/dev/CORS_ALLOWED_ORIGINS`** must include the current
  Amplify branch URL (read by Django at Lambda cold start — see
  `backend/config/aws_parameters.py` and `backend/config/settings.py`).

Today, nothing in the repo keeps these in sync. If the API Gateway URL changes (e.g. a
`zappa deploy` recreate) or the Amplify URL changes (new branch/custom domain), the two
sides silently drift and the deployed app breaks (wrong API URL, or CORS rejection).

## Goal

A manually-triggered GitHub Actions workflow that reconciles both directions:
reads the current state of both AWS resources, and updates whichever side is stale.
Idempotent — running it with no drift makes no changes.

## Non-goals

- Not automating the actual `zappa deploy`/`zappa update` step itself (that stays manual,
  per `Zappa Deployment Gotchas` — it depends on the `.venv-lambda` Docker build flow).
- Not handling multiple stages/environments (only `dev`, matching current
  `zappa_settings.json`).
- Not handling Amplify custom domains automatically (documented as a manual override,
  see Open Questions).

## Architecture

```
GitHub Actions (workflow_dispatch, manual trigger)
   │
   ├─ Assume IAM role via OIDC (no stored AWS credentials)
   │
   ├─ Step A: Resolve current API Gateway URL
   │     aws apigateway get-rest-apis → find item named "gym-tracker-dev"
   │     → https://<api-id>.execute-api.us-east-1.amazonaws.com/dev/api
   │
   ├─ Step B: Reconcile Amplify → VITE_API_URL
   │     aws amplify get-branch (fetch existing environmentVariables map)
   │     if environmentVariables["VITE_API_URL"] != resolved URL:
   │       merge new value into existing map (preserve all other env vars)
   │       aws amplify update-branch --environment-variables <merged map>
   │       aws amplify start-job --job-type RELEASE   # env var changes need an explicit rebuild
   │
   ├─ Step C: Resolve current Amplify branch URL
   │     aws amplify get-app  → app.defaultDomain
   │     aws amplify get-branch → branch.branchName
   │     → https://<branch>.<app-id>.amplifyapp.com
   │
   ├─ Step D: Reconcile SSM → CORS_ALLOWED_ORIGINS
   │     aws ssm get-parameter --name /gym-tracker/dev/CORS_ALLOWED_ORIGINS
   │     split existing value on comma
   │     if resolved Amplify URL not already in the list:
   │       append it, re-join, aws ssm put-parameter --overwrite
   │
   └─ Step E: Force Lambda cold start (only if Step D wrote a new value)
         aws lambda update-function-configuration \
           --function-name gym-tracker-dev \
           --description "force-cold-<unix-timestamp>"
         # Lambda caches SSM params for the life of a warm container
         # (see config/aws_parameters.py's @lru_cache) — without this,
         # the new CORS value won't take effect until the next natural cold start.
```

Every write step is idempotent: it diffs current vs. desired state first and skips the
AWS write (and the associated Amplify rebuild / Lambda cold-start) if nothing changed.

## Components

### `backend/scripts/reconcile_deploy_env.py`

New script, invoked by the workflow. Implemented in Python using `boto3` (already a
project dependency per `backend/requirements.txt`) rather than raw shell `aws` CLI calls,
so the merge/diff logic is unit-testable in isolation from AWS.

Responsibilities:
- `resolve_api_gateway_url(region, rest_api_name) -> str`
- `resolve_amplify_url(app_id, branch_name) -> str`
- `reconcile_amplify_env_var(app_id, branch_name, key, value) -> bool` (returns whether a change was made)
- `reconcile_cors_origins(parameter_name, origin_to_ensure) -> bool` (returns whether a change was made)
- `force_lambda_cold_start(function_name) -> None`
- A `main()` that wires the above together, prints a before/after summary to stdout
  (captured by the workflow into the GitHub Actions step summary), and exits non-zero
  if the API Gateway REST API or the Amplify app/branch cannot be found.

### `.github/workflows/reconcile-deploy-env.yml`

- Trigger: `workflow_dispatch` only. Run manually right after `zappa update dev`
  completes locally — matches the project's current manual deploy flow. No
  auto-triggering on push, since `zappa deploy` itself isn't run from CI today.
- `permissions: id-token: write, contents: read` (required for OIDC).
- Uses `aws-actions/configure-aws-credentials@v4` with `role-to-assume` pointing at the
  new IAM role below — no `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` secrets anywhere.
- Config values (hardcoded in the workflow's `env:` block, single dev stage today):
  `AMPLIFY_APP_ID`, `AMPLIFY_BRANCH_NAME=main`, `API_GATEWAY_NAME=gym-tracker-dev`,
  `SSM_PARAMETER_NAME=/gym-tracker/dev/CORS_ALLOWED_ORIGINS`, `LAMBDA_FUNCTION_NAME=gym-tracker-dev`,
  `AWS_REGION=us-east-1`.

### IAM role: `gym-tracker-github-actions`

New role, trust policy scoped to this repo/branch via GitHub's OIDC provider:

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike": { "token.actions.githubusercontent.com:sub": "repo:bioflower/gym-tracker:ref:refs/heads/main" }
  }
}
```

Permissions policy — least-privilege, resource-scoped where the AWS API supports it:

```json
[
  { "Effect": "Allow", "Action": "apigateway:GET", "Resource": "*" },
  { "Effect": "Allow", "Action": ["amplify:GetApp", "amplify:GetBranch", "amplify:UpdateBranch", "amplify:StartJob"],
    "Resource": "arn:aws:amplify:us-east-1:<account>:apps/<amplify-app-id>*" },
  { "Effect": "Allow", "Action": ["ssm:GetParameter", "ssm:PutParameter"],
    "Resource": "arn:aws:ssm:us-east-1:<account>:parameter/gym-tracker/dev/CORS_ALLOWED_ORIGINS" },
  { "Effect": "Allow", "Action": "kms:Decrypt",
    "Resource": "arn:aws:kms:us-east-1:<account>:key/*" },
  { "Effect": "Allow", "Action": ["lambda:GetFunctionConfiguration", "lambda:UpdateFunctionConfiguration"],
    "Resource": "arn:aws:lambda:us-east-1:<account>:function:gym-tracker-dev" }
]
```

`apigateway:GET` needs the wildcard resource because `get-rest-apis` is a list operation
without per-resource ARN scoping in IAM; every other action is scoped to the specific
app/parameter/function. `kms:Decrypt` is required because the script calls
`get_parameter` with `WithDecryption=True` to support a `SecureString`-typed parameter
(the reconciliation script preserves the parameter `Type` on write). It is scoped to the
key prefix (`key/*`) because the parameter has no key pinned in code and uses the
account's default SSM KMS key.

This role is intentionally separate from (and much narrower than) the `gym-tracker-admin`
SSO profile used for interactive `zappa` deploys — it can only read API Gateway/Amplify/SSM
metadata and write to these three specific resources, nothing else.

## Error handling

- Script exits non-zero, failing the GitHub Actions job (visible in the Actions UI), if:
  - no API Gateway REST API named `gym-tracker-dev` is found (backend never deployed, or name mismatch)
  - the configured Amplify app ID or branch name doesn't exist
  - any AWS API call returns a `ClientError` other than "not found" (e.g. permissions issue) —
    propagated with the underlying boto3 exception message, not swallowed (per the lesson in
    `Zappa Deployment Gotchas` #5 about hidden exceptions).
- Writes are additive/merge-only for CORS origins — the script never removes an existing
  origin from `CORS_ALLOWED_ORIGINS`, only appends the Amplify URL if missing. This avoids
  silently breaking a manually-added origin (e.g. a developer testing locally against the
  dev backend).
- Amplify env var reconciliation merges into the existing `environmentVariables` map
  (`amplify:UpdateBranch` replaces the whole map if called naively) — the script always
  fetches current values first and only changes the `VITE_API_URL` key.

## Testing

- Unit tests for `reconcile_deploy_env.py`'s pure logic (URL construction from
  API Gateway/Amplify metadata, CORS origin merge/dedup, env var map merge) using mocked
  `boto3` clients — no real AWS calls in the test suite.
- Manual end-to-end validation: trigger the workflow once after a real `zappa update dev`,
  confirm the Amplify env var and SSM parameter are both updated correctly, then re-run
  and confirm it's a no-op (idempotency check).

## Open questions

- **Custom domains**: if Amplify is later put behind a custom domain instead of the default
  `*.amplifyapp.com` URL, `resolve_amplify_url` will need to check for a custom domain
  association (`aws amplify list-domain-associations`) and prefer it over the default
  domain. Not implemented in this first version — the default Amplify domain is assumed.
- **Multiple stages**: if a `prod` stage is added to `zappa_settings.json`, this workflow
  will need a stage input (or a second hardcoded config block) rather than the single
  `dev`-only config assumed here.
