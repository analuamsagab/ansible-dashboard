#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ansible-dashboard-sqlite"
SERVER_DIR="${APP_DIR}/server"
USE_DOCKER="${USE_DOCKER:-false}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -eq 0 ]] || fail "Run as root: sudo ./update.sh"

log "Pulling latest code..."
git config --global --add safe.directory "$APP_DIR" 2>/dev/null
cd "$APP_DIR"
git pull origin sqlite
[[ $? -eq 0 ]] || fail "Git pull failed"

log "Installing frontend dependencies..."
npm install

log "Building frontend..."
npm run build

if [[ "$USE_DOCKER" == "true" ]]; then
    log "Rebuilding with Docker Compose..."
    cd "$APP_DIR/docker"
    docker compose up -d --build
    cd "$APP_DIR"
else
    log "Reinstalling backend dependencies..."
    cd "$SERVER_DIR"
    npm install

    if ! command -v ansible-playbook &>/dev/null; then
        log "Installing Ansible + sshpass..."
        apt install -y ansible sshpass
    fi

    log "Restarting backend service..."
    systemctl restart ansible-backend
fi

cd "$APP_DIR"

log "Reloading Nginx..."
systemctl reload nginx || warn "Nginx reload failed"

sleep 2

if systemctl is-active --quiet nginx; then
    log "Nginx is running"
else
    warn "Nginx is not running — check: systemctl status nginx"
fi

if systemctl is-active --quiet ansible-backend; then
    log "Backend is running"
else
    warn "Backend is not running — check: systemctl status ansible-backend"
fi

log "======================================"
log "  Update complete!"
log "======================================"
