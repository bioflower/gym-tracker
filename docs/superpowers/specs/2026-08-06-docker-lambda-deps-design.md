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
the result into the existing dev `.venv`'s `site-packages` before running
`zappa update`/`deploy` normally on the host. This closes the whole class of
bug, not just the one package we already found.

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
│   └── Dockerfile.lambda-deps            # NEW — builds Linux x86_64 wheels
├── scripts/
│   └── build_lambda_deps.sh              # NEW — orchestrates build + swap
├── requirements.txt                      # unchanged, read by the Dockerfile
└── .venv/lib/python3.11/site-packages/   # swapped in place by the script
```

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

2. **Extract `/out`** from the built image into a temp directory on the host,
   without needing a running container (via `docker create` + `docker cp` +
   `docker rm`):
   ```bash
   cid=$(docker create gym-tracker-lambda-deps)
   docker cp "$cid:/out" "$tmp_dir/out"
   docker rm "$cid" > /dev/null
   ```

3. **Swap into the dev venv.** Wipe the contents of
   `.venv/lib/python3.11/site-packages/` and copy in everything from
   `$tmp_dir/out`. This is a full replace, not a merge — every dependency
   comes from the fresh Linux build, no mixing of old macOS and new Linux
   artifacts for the same package.

   This is safe for locally running `zappa` afterward: the only compiled
   (`.so`) extensions currently present in the venv belong to `psycopg2`,
   `charset_normalizer`, `markupsafe`, and `PyYAML`. All three of the latter
   ship documented pure-Python fallbacks that activate automatically via
   `try/except ImportError` when the compiled extension can't be loaded on
   the host OS — so `zappa update` still runs fine locally on macOS after
   the swap (just without those specific speedups locally). Only `psycopg2`
   has no pure-Python fallback, but it's never imported during the `zappa`
   CLI's own packaging process — it's only imported when the *deployed*
   Lambda code runs, which is Linux, which is exactly what it's now built
   for.

4. **Verify.** Assert at least one known compiled package
   (`psycopg2/_psycopg*.so`) is now an ELF binary, not a Mach-O binary:
   ```bash
   file .venv/lib/python3.11/site-packages/psycopg2/_psycopg*.so
   # must contain "ELF 64-bit"
   ```
   Fail loudly (non-zero exit, clear error message) if this check doesn't
   pass — a bad build must not silently proceed to `zappa update`.

5. **Print next steps** — remind the user to run `zappa update dev` (or
   `deploy`) manually. The script does not run `zappa` itself, per the
   design decision to keep AWS credentials out of Docker entirely.

### Error handling

- If `docker` is not installed/running, fail early with a clear message
  (`docker info` check) before doing anything else.
- If `docker build` fails, stop — do not touch `.venv`.
- If the `/out` extraction fails, stop — do not touch `.venv`.
- Only wipe/replace `.venv/lib/python3.11/site-packages/` after the Docker
  build and extraction have both fully succeeded, so a failed run leaves the
  existing (working) venv untouched.

### Testing / manual verification plan

Since this is an infra/build script (not application code with a test
suite), verification is manual:

1. Run `backend/scripts/build_lambda_deps.sh` and confirm it exits 0 with the
   ELF check passing.
2. Run `python manage.py test` (or the existing Django test workflow) using
   the now-swapped `.venv` to confirm nothing broke locally (pure-Python
   fallbacks working as expected).
3. Run `zappa update dev` and confirm no `502` status-check warning.
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

Confirmed during spec review: no `.gitignore` change is needed — `.venv/` is
already ignored at the repo root (`backend/.venv/`), so no transient build
artifacts risk being committed.
