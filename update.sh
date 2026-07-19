#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Ansible Dashboard — Update Script
# Pull latest code, rebuild, restart services
# Usage:  sudo ./update.sh
# ============================================================

APP_DIR="/opt/ansible-dashboard"
WORKER_DIR="${APP_DIR}/worker"
USE_DOCKER="${USE_DOCKER:-false}"

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Root check ---
[[ $EUID -eq 0 ]] || fail "Run as root: sudo ./update.sh"

# --- Step 1: Pull latest code ---
log "Pulling latest code..."
git config --global --add safe.directory "$APP_DIR" 2>/dev/null
cd "$APP_DIR"
git pull origin main
[[ $? -eq 0 ]] || fail "Git pull failed"

# --- Step 2: Rebuild frontend ---
log "Installing frontend dependencies..."
npm install

log "Building frontend..."
npm run build

# --- Step 3: Update worker ---
if [[ "$USE_DOCKER" == "true" ]]; then
    log "Rebuilding Docker worker image..."
    docker build -t ansible-worker "$WORKER_DIR"
    log "Restarting worker container..."
    systemctl restart ansible-worker
else
    log "Reinstalling worker dependencies..."
    cd "$WORKER_DIR"
    npm install

    # Check if Ansible needs update
    if ! command -v ansible-playbook &>/dev/null; then
        log "Installing Ansible..."
        apt install -y ansible
    fi

    log "Restarting worker service..."
    systemctl restart ansible-worker
fi

cd "$APP_DIR"

# --- Step 4: Reload Nginx ---
log "Reloading Nginx..."
systemctl reload nginx || warn "Nginx reload failed"

# --- Step 5: Health check ---
sleep 2

if systemctl is-active --quiet nginx; then
    log "Nginx is running"
else
    warn "Nginx is not running — check: systemctl status nginx"
fi

if systemctl is-active --quiet ansible-worker; then
    log "Worker is running"
else
    warn "Worker is not running — check: systemctl status ansible-worker"
fi

# --- Done ---
log "======================================"
log "  Update complete!"
log "  Run SQL fix if needed:"
log "  cat ${APP_DIR}/supabase-fix.sql"
log "======================================"
