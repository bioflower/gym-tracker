# Docker-Based Lambda Dependency Build for Zappa Deployment — Design

## Problem

`zappa update`/`deploy` packages whatever is currently installed in the active
virtualenv's `site-packages` — it does not read `requirements.txt` at zip
time, and it does not know or care what OS/architecture built the packages
it's zipping.

On a Mac (especially Apple Silicon), `pip install` pulls macOS wheels for any
package with compiled C extensions (e.g. `psycopg2-binary`). AWS Lambda runs
Linux x86_64. This previously caused a full 502/500 outage in production:
`_psycopg.cpython-311-darwin.so` (macOS arm64 Mach-O) was zipped and shipped
to a Linux x86_64 Lambda function, which failed to import it
(`ImproperlyConfigured: Error loading psycopg2 or psycopg module`). See
`Zappa Deployment Gotchas.md` in the Obsidian vault for the full incident.

The fix applied at the time was a one-off manual `pip install --platform
manylinux2014_x86_64 ...` for just `psycopg2-binary`. That's fragile: any
*future* dependency with compiled extensions (`Pillow`, `cryptography`,
`lxml`, etc.) would silently reintroduce the same class of bug unless someone
remembers to special-case it too.

## Goal

Rebuild the **entire** `backend/requirements.txt` inside a Docker container
that matches Lambda's actual runtime (Linux x86_64, Python 3.11), then swap
the result into a **dedicated deploy-only virtualenv**'s `site-packages`
before running `zappa update`/`deploy` normally on the host, from that venv.
This closes the whole class of bug, not just the one package we already
found, without affecting the regular dev `.venv` used for local development
and tests.

> **Amendment (found during implementation of Task 2, before this spec's
> approval was finalized):** the original design swapped the *existing* dev
> `.venv` in place. That was verified to be safe for the `zappa` CLI's own
> import graph, but it missed that this repository's local Django test suite
> (`manage.py test`) also uses that same venv and connects to a real Postgres
> database (`DATABASE_URL` in `backend/.env`, not SQLite) — so it imports
> `psycopg2` directly. `psycopg2` has no pure-Python fallback (unlike
> `charset_normalizer`/`markupsafe`/`PyYAML`), so after an in-place swap,
> `manage.py test` fails locally with the same `ImproperlyConfigured` error
> from the original production incident, until the native macOS dependencies
> are manually reinstalled. This section and the ones below reflect the
> corrected design: a **separate** venv used only for packaging/deploying,
> so the dev `.venv` is never touched and local tests keep working
> unconditionally.

## Non-goals

- **Not** switching Lambda to container-image deployment (`--docker-image-uri`
  / ECR). The Lambda function keeps its existing zip-based deployment exactly
  as configured in `zappa_settings.json` today.
- **Not** running `zappa` itself inside Docker. `zappa`/`boto3` continue to
  run on the host, authenticated via the existing `gym-tracker-admin` AWS SSO
  profile. No AWS credentials are ever mounted into the container.
- **Not** a CI/CD pipeline change. This is a local developer-run script, same
  as the current manual `zappa update dev` workflow. (Could be wired into CI
  later, out of scope here.)

## Architecture

```
backend/
├── docker/
│   └── Dockerfile.lambda-deps                   # NEW — builds Linux x86_64 wheels
├── scripts/
│   └── build_lambda_deps.sh                     # NEW — orchestrates build + swap
├── requirements.txt                             # unchanged, read by the Dockerfile
├── .venv/                                       # dev venv — untouched by this script
└── .venv-lambda/lib/python3.11/site-packages/   # NEW — deploy-only venv, swapped by the script
```

`.venv-lambda/` is a second, independent virtualenv used only for
packaging/deploying via `zappa`. It's bootstrapped normally the first time
(`python3.11 -m venv .venv-lambda && .venv-lambda/bin/pip install -r
requirements.txt`, giving it a fully working macOS-native `zappa` CLI, same
as `.venv`), and its `site-packages` is what gets replaced with the
Linux-built dependencies. The regular dev `.venv` is never touched by any
part of this workflow.

### `docker/Dockerfile.lambda-deps`

Base image: `public.ecr.aws/sam/build-python3.11`. This is AWS's own image
built specifically for producing Lambda-compatible dependency packages — the
same image `sam build --use-container` uses. It has the correct glibc/ABI to
match the Lambda execution environment and includes build tools (gcc, etc.)
in case any dependency needs to compile from source rather than use a
prebuilt wheel.

```dockerfile
FROM public.ecr.aws/sam/build-python3.11

COPY requirements.txt /tmp/requirements.txt

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --target /out -r /tmp/requirements.txt
```

`/out` is the only thing the host cares about — a flat `site-packages`-style
directory containing every dependency built for Linux x86_64 / Python 3.11.

### `scripts/build_lambda_deps.sh`

Run from `backend/`. Responsibilities, in order:

1. **Build the image**, explicitly pinning the platform:
   ```bash
   docker build --platform linux/amd64 \
     -f docker/Dockerfile.lambda-deps \
     -t gym-tracker-lambda-deps .
   ```
   `--platform linux/amd64` is required, not optional — on Apple Silicon,
   Docker Desktop will otherwise silently build/pull the arm64 variant of the
   base image, reproducing the exact bug this whole effort exists to fix.
   The target platform is derived from the Lambda function's configured
   architecture (`x86_64`, confirmed via `aws lambda
   get-function-configuration --query Architectures`) — if that ever
   changes, this flag must change too.

2. **Bootstrap `.venv-lambda` if it doesn't exist yet**, exactly like a
   normal dev venv setup:
   ```bash
   python3.11 -m venv .venv-lambda
   .venv-lambda/bin/pip install --upgrade pip
   .venv-lambda/bin/pip install -r requirements.txt
   ```
   This gives `.venv-lambda` a fully working macOS-native `zappa` CLI (same
   as `.venv`) before its `site-packages` gets replaced below. If
   `.venv-lambda` already exists, this step is skipped.

3. **Extract `/out`** from the built image into a temp directory on the host,
   without needing a running container (via `docker create` + `docker cp` +
   `docker rm`):
   ```bash
   cid=$(docker create gym-tracker-lambda-deps)
   docker cp "$cid:/out" "$tmp_dir/out"
   docker rm "$cid" > /dev/null
   ```

4. **Swap into `.venv-lambda` — never into the dev `.venv`.** Wipe the
   contents of `.venv-lambda/lib/python3.11/site-packages/` and copy in
   everything from `$tmp_dir/out`. This is a full replace, not a merge —
   every dependency comes from the fresh Linux build, no mixing of old
   macOS and new Linux artifacts for the same package.

   Because this is a dedicated venv never used for local dev or tests, there
   is no risk of breaking `manage.py test` or any other local Postgres-backed
   workflow — those continue to use `.venv` (native macOS `psycopg2`),
   completely unaffected by this script.

5. **Verify.** Assert at least one known compiled package
   (`psycopg2/_psycopg*.so`) is now an ELF binary, not a Mach-O binary:
   ```bash
   file .venv-lambda/lib/python3.11/site-packages/psycopg2/_psycopg*.so
   # must contain "ELF 64-bit"
   ```
   Fail loudly (non-zero exit, clear error message) if this check doesn't
   pass — a bad build must not silently proceed to `zappa update`.

6. **Print next steps** — remind the user to run `.venv-lambda/bin/zappa
   update dev` (or `deploy`) manually. The script does not run `zappa`
   itself, per the design decision to keep AWS credentials out of Docker
   entirely.

### Error handling

- If `docker` is not installed/running, fail early with a clear message
  (`docker info` check) before doing anything else.
- If `docker build` fails, stop — do not touch `.venv-lambda`.
- If the `/out` extraction fails, stop — do not touch `.venv-lambda`.
- Only wipe/replace `.venv-lambda/lib/python3.11/site-packages/` after the
  Docker build and extraction have both fully succeeded, so a failed run
  leaves any existing (working) `.venv-lambda` untouched.
- The dev `.venv` is never referenced or modified by this script under any
  circumstance.

### Testing / manual verification plan

Since this is an infra/build script (not application code with a test
suite), verification is manual:

1. Run `backend/scripts/build_lambda_deps.sh` and confirm it exits 0 with the
   ELF check passing.
2. Run `python manage.py test` using the **dev `.venv`** (untouched) to
   confirm local tests are completely unaffected by the script having run.
3. Run `.venv-lambda/bin/zappa update dev` and confirm no `502` status-check
   warning.
4. Cold-start invoke the Lambda directly (per the debugging playbook in
   `Zappa Deployment Gotchas.md`) and confirm the app boots (e.g. `302` on
   `/admin/`), not a crash.
5. Re-inspect the deployed zip's `psycopg2/*.so` (download+`file`, as done
   during the original incident) to confirm it's the Linux binary, as a final
   sanity check.

## Open items for the implementation plan

- Exact temp-directory handling / cleanup in the bash script (`mktemp -d`,
  trap-based cleanup on exit).
- Whether to document this new step in `Zappa Deployment Gotchas.md`
  (Obsidian) as a follow-up once implemented and verified.

Confirmed during spec review: `.gitignore` needs one addition —
`backend/.venv-lambda/` — alongside the existing `backend/.venv/` entry, so
the new deploy-only venv is never committed.
