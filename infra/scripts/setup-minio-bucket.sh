#!/usr/bin/env bash
# Create the ClipX S3 bucket in local MinIO and mark it private.
# Requires: mc (MinIO client) — or use the MinIO web console at :9001.
set -euo pipefail

MC="${MC:-mc}"
ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
ACCESS_KEY="${S3_ACCESS_KEY:-clipx}"
SECRET_KEY="${S3_SECRET_KEY:-clipxsecret}"
BUCKET="${S3_BUCKET:-clipx}"

if ! command -v "$MC" >/dev/null 2>&1; then
  echo "MinIO client (mc) not found. Create the '$BUCKET' bucket via the MinIO console at http://localhost:9001 instead."
  exit 0
fi

"$MC" alias set clipx "$ENDPOINT" "$ACCESS_KEY" "$SECRET_KEY" >/dev/null 2>&1 || true
"$MC" mb --ignore-existing "clipx/$BUCKET" >/dev/null 2>&1 || true
# Default policy is private; ensure no anonymous read.
"$MC" anonymous set none "clipx/$BUCKET" >/dev/null 2>&1 || true
echo "Bucket '$BUCKET' ready (private) on $ENDPOINT"
