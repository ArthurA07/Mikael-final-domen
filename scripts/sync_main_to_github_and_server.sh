#!/usr/bin/env bash
set -euo pipefail

# Canonical sync flow:
# local main -> github-new/main -> server (/opt/mikael)
# Safety: aborts on tracked uncommitted changes or if not on main.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

TARGET_BRANCH="${TARGET_BRANCH:-main}"
GITHUB_REMOTE="${GITHUB_REMOTE:-github-new}"
SERVER_IP="${SERVER_IP:-81.31.247.70}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT_BRANCH}" != "${TARGET_BRANCH}" ]]; then
  echo "ERROR: current branch is '${CURRENT_BRANCH}', expected '${TARGET_BRANCH}'."
  echo "Switch branch first: git checkout ${TARGET_BRANCH}"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: tracked changes are not committed."
  echo "Commit/stash changes first, then re-run."
  exit 1
fi

echo "Step 1/4: fetch ${GITHUB_REMOTE}"
git fetch "${GITHUB_REMOTE}"

echo "Step 2/4: push ${TARGET_BRANCH} -> ${GITHUB_REMOTE}/${TARGET_BRANCH}"
git push -u "${GITHUB_REMOTE}" "${TARGET_BRANCH}"

echo "Step 3/4: rsync to server ${SERVER_IP}"
SERVER_IP="${SERVER_IP}" ./scripts/sync_to_server.sh "${ROOT_DIR}"

echo "Step 4/4: verify server dry-run"
CHECK_SERVER=1 GITHUB_REMOTE="${GITHUB_REMOTE}" GITHUB_BRANCH="${TARGET_BRANCH}" \
  SERVER_IP="${SERVER_IP}" ./scripts/check_sync_state.sh

echo "OK: sync flow completed."
