#!/usr/bin/env bash
set -euo pipefail

# Read-only diagnostic script:
# - shows local branch/remotes status
# - compares HEAD with github-new/main (and origin/main if present)
# - optionally runs rsync dry-run against server

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

GITHUB_REMOTE="${GITHUB_REMOTE:-github-new}"
GITHUB_BRANCH="${GITHUB_BRANCH:-main}"
SERVER_IP="${SERVER_IP:-81.31.247.70}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_DIR="${SERVER_DIR:-/opt/mikael}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/cursor_deploy_ed25519}"
CHECK_SERVER="${CHECK_SERVER:-1}"

echo "== Repo =="
echo "Path: ${ROOT_DIR}"
echo

echo "== Branch/Remotes =="
git branch -vv
echo
git remote -v
echo

echo "== Fetch remotes =="
git fetch "${GITHUB_REMOTE}" >/dev/null
if git remote get-url origin >/dev/null 2>&1; then
  git fetch origin >/dev/null || true
fi
echo "Fetched."
echo

echo "== Commit pointers =="
HEAD_SHA="$(git rev-parse HEAD)"
UPSTREAM_SHA="$(git rev-parse "${GITHUB_REMOTE}/${GITHUB_BRANCH}")"
echo "HEAD:                 ${HEAD_SHA}"
echo "${GITHUB_REMOTE}/${GITHUB_BRANCH}: ${UPSTREAM_SHA}"
if git rev-parse origin/main >/dev/null 2>&1; then
  echo "origin/main:          $(git rev-parse origin/main)"
fi
echo

if [[ "${HEAD_SHA}" == "${UPSTREAM_SHA}" ]]; then
  echo "OK: HEAD equals ${GITHUB_REMOTE}/${GITHUB_BRANCH}"
else
  echo "WARN: HEAD differs from ${GITHUB_REMOTE}/${GITHUB_BRANCH}"
fi
echo

echo "== Working tree =="
if git diff --quiet && git diff --cached --quiet; then
  echo "Tracked files: clean"
else
  echo "Tracked files: DIRTY"
fi

UNTRACKED_COUNT="$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')"
echo "Untracked files count: ${UNTRACKED_COUNT}"
if [[ "${UNTRACKED_COUNT}" != "0" ]]; then
  echo "Top untracked entries:"
  git ls-files --others --exclude-standard | sed -n '1,20p'
fi
echo

if [[ "${CHECK_SERVER}" != "1" ]]; then
  echo "Skip server check (CHECK_SERVER=${CHECK_SERVER})."
  exit 0
fi

echo "== Server dry-run (${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}) =="
set +e
RSYNC_OUTPUT="$(
  rsync -azn --delete --itemize-changes \
    --exclude '.git/' \
    --exclude '.DS_Store' \
    --exclude '**/.DS_Store' \
    --exclude 'node_modules/' \
    --exclude 'client/node_modules/' \
    --exclude 'server/node_modules/' \
    --exclude 'client/build/' \
    --exclude '_data/' \
    --exclude '*.log' \
    --exclude 'ACCESS.local.md' \
    --exclude 'server/.env' \
    -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=accept-new" \
    "${ROOT_DIR}/" "${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/" 2>&1
)"
RSYNC_EXIT=$?
set -e

if [[ ${RSYNC_EXIT} -ne 0 ]]; then
  echo "WARN: server dry-run failed:"
  echo "${RSYNC_OUTPUT}"
  exit 0
fi

if [[ -z "${RSYNC_OUTPUT}" || "${RSYNC_OUTPUT}" == ".d..t.... ./" ]]; then
  echo "OK: server appears synchronized."
else
  echo "Server differs from local snapshot:"
  echo "${RSYNC_OUTPUT}"
fi
