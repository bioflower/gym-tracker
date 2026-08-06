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
