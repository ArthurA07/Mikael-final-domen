#!/usr/bin/env bash
set -euo pipefail

# Build & restart services on the server after sync.
# Run THIS on the server (inside /opt/mikael).
#
# Usage:
#   cd /opt/mikael && ./scripts/deploy_on_server.sh

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Project: ${PROJECT_DIR}"

cd "${PROJECT_DIR}"

# Ensure swap exists (helps CRA build on 2GB RAM)
if ! swapon --show | grep -q '^/swapfile'; then
  echo "Creating swapfile (2G)..."
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "Installing deps (server) & building client..."
cd "${PROJECT_DIR}/server"
npm ci --omit=dev

cd "${PROJECT_DIR}/client"
export NODE_OPTIONS="--max_old_space_size=1024"
npm ci
npm run build

echo "Restarting service..."
systemctl restart mikael
systemctl status mikael --no-pager -l | head -n 20

echo "Done."



