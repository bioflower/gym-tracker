# Docker-Based Lambda Dependency Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Dockerfile + script that rebuilds `backend/requirements.txt` inside a Lambda-matching Linux x86_64 container and swaps the result into the existing dev `.venv`, so `zappa update`/`deploy` (run normally on the host with existing AWS SSO credentials) always ships Lambda-compatible binaries.

**Architecture:** A `docker/Dockerfile.lambda-deps` image (based on `public.ecr.aws/sam/build-python3.11`) installs the full `requirements.txt` into `/out`. A `scripts/build_lambda_deps.sh` script builds that image, extracts `/out`, wipes and replaces `backend/.venv/lib/python3.11/site-packages/` with it, then verifies the swap produced a Linux ELF binary for `psycopg2` before allowing anything else to proceed. Zappa itself never runs inside Docker — no AWS credentials ever touch the container.

**Tech Stack:** Docker (with `--platform linux/amd64`), Bash, `public.ecr.aws/sam/build-python3.11` base image, Python 3.11, Zappa 0.60.2.

## Global Constraints

- Base image is exactly `public.ecr.aws/sam/build-python3.11` — this matches Lambda's actual runtime ABI/glibc.
- Every `docker build`/`docker run`/`docker create` in this plan MUST pin `--platform linux/amd64` explicitly — Lambda's function architecture is `x86_64` (confirmed via `aws lambda get-function-configuration --query Architectures`), and Apple Silicon Docker will otherwise silently build/pull the arm64 variant.
- `zappa`/`boto3` MUST NOT run inside the Docker container. No AWS credentials are ever mounted into or passed to the container.
- `backend/.venv/lib/python3.11/site-packages/` must only be wiped/replaced AFTER the Docker build and `/out` extraction have both fully succeeded — a failed build or extraction must leave the existing venv untouched.
- The script must fail loudly (non-zero exit) if the post-swap `psycopg2` binary is not an ELF 64-bit binary.
- This is a local developer-run script, not a CI/CD change. No GitHub Actions workflow changes in this plan.

---

### Task 1: Dockerfile for Linux x86_64 dependency build

**Files:**
- Create: `backend/docker/Dockerfile.lambda-deps`

**Interfaces:**
- Produces: a Docker image tagged `gym-tracker-lambda-deps` with `/out` inside the image containing every package from `backend/requirements.txt`, installed for Python 3.11 / Linux x86_64.
- Consumes: `backend/requirements.txt` (read via `COPY` during build; the Dockerfile must be built with `backend/` as the build context so this path resolves).

- [ ] **Step 1: Create the `docker/` directory and the Dockerfile**

Create `backend/docker/Dockerfile.lambda-deps`:

```dockerfile
# Builds backend/requirements.txt for Lambda's actual runtime (Linux x86_64,
# Python 3.11), so locally-built macOS/arm64 wheels never get zipped and
# shipped to Lambda by mistake. See docs/superpowers/specs/2026-08-06-docker-lambda-deps-design.md
FROM public.ecr.aws/sam/build-python3.11

COPY requirements.txt /tmp/requirements.txt

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --target /out -r /tmp/requirements.txt
```

- [ ] **Step 2: Build the image and verify it succeeds**

Run from `backend/`:
```bash
docker build --platform linux/amd64 \
  -f docker/Dockerfile.lambda-deps \
  -t gym-tracker-lambda-deps \
  .
```
Expected: build completes with `Successfully tagged gym-tracker-lambda-deps:latest` (or the newer Buildx equivalent success output), no errors. If `docker: command not found` or `Cannot connect to the Docker daemon`, install/start Docker Desktop first — this step cannot proceed without it.

- [ ] **Step 3: Verify `/out` contains a Linux ELF `psycopg2` binary**

```bash
docker run --rm --platform linux/amd64 gym-tracker-lambda-deps \
  sh -c "file /out/psycopg2/_psycopg*.so"
```
Expected output contains `ELF 64-bit LSB shared object, x86-64` (NOT `Mach-O`).

- [ ] **Step 4: Commit**

```bash
cd /Users/ngoclinhdo/Projects/gym-tracker
git add backend/docker/Dockerfile.lambda-deps
git commit -m "Add Dockerfile to build Lambda-compatible Linux x86_64 dependencies"
```

---

### Task 2: Build/swap/verify orchestration script

**Files:**
- Create: `backend/scripts/build_lambda_deps.sh`

**Interfaces:**
- Consumes: the `gym-tracker-lambda-deps` image build process from Task 1 (Dockerfile path `docker/Dockerfile.lambda-deps` relative to `backend/`); existing `backend/.venv/lib/python3.11/site-packages/`.
- Produces: `backend/.venv/lib/python3.11/site-packages/` fully replaced with the Linux x86_64 build output. Exits non-zero and leaves `.venv` untouched on any failure before the swap step. Prints `OK: ... is a Linux ELF binary.` and reminds the user to run `zappa update dev` on success.

- [ ] **Step 1: Record a pre-change baseline of the local Django test suite**

Run from `backend/`:
```bash
.venv/bin/python manage.py test
```
Record the pass/fail result verbatim (e.g. `OK` and test count) — this is the baseline to compare against after the swap in Step 5, to confirm the site-packages swap didn't break local test execution.

- [ ] **Step 2: Write the script**

Create `backend/scripts/build_lambda_deps.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
DOCKERFILE="$BACKEND_DIR/docker/Dockerfile.lambda-deps"
IMAGE_NAME="gym-tracker-lambda-deps"
SITE_PACKAGES="$BACKEND_DIR/.venv/lib/python3.11/site-packages"

if [ ! -d "$BACKEND_DIR/.venv" ]; then
  echo "ERROR: $BACKEND_DIR/.venv does not exist. Create it first:" >&2
  echo "  python3.11 -m venv $BACKEND_DIR/.venv && $BACKEND_DIR/.venv/bin/pip install -r $BACKEND_DIR/requirements.txt" >&2
  exit 1
fi

if ! docker info > /dev/null 2>&1; then
  echo "ERROR: Docker is not running or not installed. Start Docker Desktop and try again." >&2
  exit 1
fi

echo "==> Building Linux x86_64 dependency image..."
docker build --platform linux/amd64 \
  -f "$DOCKERFILE" \
  -t "$IMAGE_NAME" \
  "$BACKEND_DIR"

echo "==> Extracting built dependencies..."
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

CONTAINER_ID="$(docker create --platform linux/amd64 "$IMAGE_NAME")"
docker cp "$CONTAINER_ID:/out" "$TMP_DIR/out"
docker rm "$CONTAINER_ID" > /dev/null

if [ ! -d "$TMP_DIR/out" ] || [ -z "$(ls -A "$TMP_DIR/out")" ]; then
  echo "ERROR: Docker build produced an empty /out directory. Aborting without touching .venv." >&2
  exit 1
fi

echo "==> Swapping site-packages with Linux-built dependencies..."
rm -rf "$SITE_PACKAGES"
mkdir -p "$SITE_PACKAGES"
cp -R "$TMP_DIR/out/." "$SITE_PACKAGES/"

echo "==> Verifying psycopg2 binary is Linux ELF, not macOS Mach-O..."
PSYCOPG_SO="$(find "$SITE_PACKAGES/psycopg2" -maxdepth 1 -name '_psycopg*.so' | head -n 1)"
if [ -z "$PSYCOPG_SO" ]; then
  echo "ERROR: Could not find psycopg2 compiled extension at $SITE_PACKAGES/psycopg2/_psycopg*.so" >&2
  exit 1
fi

if ! file "$PSYCOPG_SO" | grep -q "ELF 64-bit"; then
  echo "ERROR: $PSYCOPG_SO is not an ELF 64-bit binary:" >&2
  file "$PSYCOPG_SO" >&2
  exit 1
fi

echo "OK: $(basename "$PSYCOPG_SO") is a Linux ELF binary."
echo
echo "Dependencies rebuilt for Linux x86_64 successfully."
echo "Next: run 'zappa update dev' (or 'zappa deploy dev') from $BACKEND_DIR."
```

- [ ] **Step 3: Make it executable**

```bash
chmod +x /Users/ngoclinhdo/Projects/gym-tracker/backend/scripts/build_lambda_deps.sh
```

- [ ] **Step 4: Run the script and verify success output**

```bash
cd /Users/ngoclinhdo/Projects/gym-tracker/backend
./scripts/build_lambda_deps.sh
```
Expected: exits 0, last two lines are:
```
Dependencies rebuilt for Linux x86_64 successfully.
Next: run 'zappa update dev' (or 'zappa deploy dev') from /Users/ngoclinhdo/Projects/gym-tracker/backend.
```

- [ ] **Step 5: Verify the venv itself now has the Linux binary, and re-run the test baseline**

```bash
file /Users/ngoclinhdo/Projects/gym-tracker/backend/.venv/lib/python3.11/site-packages/psycopg2/_psycopg*.so
```
Expected: contains `ELF 64-bit LSB shared object, x86-64`.

```bash
cd /Users/ngoclinhdo/Projects/gym-tracker/backend
.venv/bin/python manage.py test
```
Expected: same pass/fail result as the Step 1 baseline (confirms the pure-Python fallbacks in `charset_normalizer`/`markupsafe`/`PyYAML` work fine locally on macOS after the swap, and the swap didn't break local test execution).

- [ ] **Step 6: Test the failure path — confirm `.venv` is left untouched on a bad build**

Temporarily break the Dockerfile to force a failure, confirm the script aborts before touching `.venv`:
```bash
cd /Users/ngoclinhdo/Projects/gym-tracker/backend
cp docker/Dockerfile.lambda-deps /tmp/Dockerfile.lambda-deps.bak
echo "RUN false" >> docker/Dockerfile.lambda-deps
./scripts/build_lambda_deps.sh; echo "exit code: $?"
```
Expected: non-zero exit code, error surfaced from `docker build`, and:
```bash
file /Users/ngoclinhdo/Projects/gym-tracker/backend/.venv/lib/python3.11/site-packages/psycopg2/_psycopg*.so
```
still shows `ELF 64-bit` (i.e. still the good Linux build from Step 4/5, proving the failed run never reached the swap step).

Restore the Dockerfile:
```bash
mv /tmp/Dockerfile.lambda-deps.bak /Users/ngoclinhdo/Projects/gym-tracker/backend/docker/Dockerfile.lambda-deps
```

- [ ] **Step 7: Commit**

```bash
cd /Users/ngoclinhdo/Projects/gym-tracker
git add backend/scripts/build_lambda_deps.sh
git commit -m "Add script to rebuild and swap in Linux-compatible Lambda dependencies"
```

---

### Task 3: End-to-end deployment verification

**Files:** None (no code changes — this task validates Tasks 1-2 against the real `gym-tracker-dev` Lambda function).

**Interfaces:**
- Consumes: the swapped `backend/.venv` from Task 2; existing `gym-tracker-admin` AWS SSO profile; existing `zappa_settings.json` (`dev` stage).
- Produces: a live, verified `gym-tracker-dev` Lambda deployment running Linux-native dependencies.

- [ ] **Step 1: Ensure AWS SSO session is active**

```bash
aws sso login --profile gym-tracker-admin
aws sts get-caller-identity --profile gym-tracker-admin
```
Expected: returns caller identity with `assumed-role/AWSReservedSSO_...` or the `gym-tracker-dev-ZappaLambdaExecutionRole`-adjacent identity, no error.

- [ ] **Step 2: Deploy using the host venv (now Linux-built) via zappa**

```bash
export VIRTUAL_ENV=/Users/ngoclinhdo/Projects/gym-tracker/backend/.venv
cd /Users/ngoclinhdo/Projects/gym-tracker/backend
./.venv/bin/zappa update dev
```
Expected: completes without the `Warning! Status check on the deployed lambda failed. A GET request to '/' yielded a 502 response code.` message that appeared during the original incident. Ends with `Your updated Zappa deployment is live!: <url>`.

- [ ] **Step 3: Force a fresh cold start and confirm the app boots**

```bash
AWS_PROFILE=gym-tracker-admin aws lambda update-function-configuration \
  --function-name gym-tracker-dev \
  --region us-east-1 \
  --description "force-cold-$(date +%s)"
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" \
  https://iik11anqk4.execute-api.us-east-1.amazonaws.com/dev/admin/
```
Expected: `302` (Django redirecting to admin login — confirms the app fully booted: settings loaded, SSM parameters loaded, database driver imported, WSGI app built). NOT `500`/`502`.

- [ ] **Step 4: Final sanity check — inspect the deployed zip's psycopg2 binary**

```bash
AWS_PROFILE=gym-tracker-admin aws lambda get-function \
  --function-name gym-tracker-dev --region us-east-1 \
  --query 'Code.Location' --output text > /tmp/deployed_url.txt
curl -s -o /tmp/deployed_pkg.zip "$(cat /tmp/deployed_url.txt)"
rm -rf /tmp/deployed_pkg_extracted
unzip -q /tmp/deployed_pkg.zip -d /tmp/deployed_pkg_extracted psycopg2/_psycopg*.so
file /tmp/deployed_pkg_extracted/psycopg2/_psycopg*.so
```
Expected: `ELF 64-bit LSB shared object, x86-64` — confirms the artifact actually deployed to Lambda (not just the local venv) is Linux-native.

- [ ] **Step 5: No commit needed**

This task is a deployment/verification action, not a code change. If all steps pass, Tasks 1-2 are confirmed working end-to-end.

---

## Follow-up (not part of this plan, do after Task 3 passes)

Update `Zappa Deployment Gotchas.md` in the Obsidian vault to document the new `./scripts/build_lambda_deps.sh` step as the recommended pre-deploy step, replacing the old one-off manual `pip install --platform manylinux2014_x86_64 ...` psycopg2-only fix.
