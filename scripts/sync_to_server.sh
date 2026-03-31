#!/usr/bin/env bash
set -euo pipefail

# Sync current project directory to the server via rsync over SSH.
# Source of truth: your local Mac folder.
#
# Usage:
#   SERVER_IP=81.31.247.70 ./scripts/sync_to_server.sh "/absolute/path/to/project"
#
# Notes:
# - Does NOT overwrite server runtime secrets (server/.env) unless you remove it from excludes.
# - Excludes node_modules, build artifacts, local mongo data.

SERVER_IP="${SERVER_IP:-81.31.247.70}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_DIR="${SERVER_DIR:-/opt/mikael}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/cursor_deploy_ed25519}"

SRC_DIR="${1:-}"
if [[ -z "${SRC_DIR}" ]]; then
  echo "ERROR: source dir is required"
  echo "Example: SERVER_IP=81.31.247.70 $0 \"/Users/arturartinov/Desktop/Mikael-final 777\""
  exit 1
fi

if [[ ! -d "${SRC_DIR}" ]]; then
  echo "ERROR: source dir not found: ${SRC_DIR}"
  exit 1
fi

rsync -az --delete --progress \
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
  "${SRC_DIR}/" "${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/"

echo "OK: synced to ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}"



