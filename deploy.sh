#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Ansible Dashboard — Deploy Script
# Target: Debian 12
# Usage:  sudo ./deploy.sh
# ============================================================

APP_DIR="/opt/ansible-dashboard"
WORKER_DIR="${APP_DIR}/worker"
NGINX_CONF="/etc/nginx/sites-available/ansible-dashboard"
DOMAIN="${DOMAIN:-ansible.example.com}"
NODE_VERSION="20"
SUPABASE_URL="https://eovfjrskpqbikzglkmdl.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdmZqcnNrcHFiaWt6Z2xrbWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTY5NjcsImV4cCI6MjA5OTk5Mjk2N30.BEssyHHgVrPLHKJVRBFS-vru4d7NjAiRcDFHZVTDMYo"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdmZqcnNrcHFiaWt6Z2xrbWRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDQxNjk2NywiZXhwIjoyMDk5OTkyOTY3fQ.Gek-hdibSj6xe41CFeR5SgU_L2uZ2kXCPHzjL3N2HmQ"
USE_DOCKER="${USE_DOCKER:-false}"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# --- Root check ---
[[ $EUID -eq 0 ]] || fail "Run this script as root: sudo ./deploy.sh"

# --- Step 1: System updates & packages ---
log "Updating system packages..."
apt update && apt upgrade -y

log "Installing base dependencies..."
apt install -y curl wget git ufw nginx

# --- Step 2: Firewall ---
log "Configuring UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# --- Step 3: Node.js ---
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
    log "Installing Node.js ${NODE_VERSION}..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    apt install -y nodejs
else
    log "Node.js $(node -v) already installed"
fi

# --- Step 4: Clone or pull repo ---
git config --global --add safe.directory "$APP_DIR" 2>/dev/null
if [[ -d "$APP_DIR/.git" ]]; then
    log "Pulling latest code..."
    cd "$APP_DIR"
    git pull origin main
else
    log "Cloning repository..."
    git clone <your-repo-url> "$APP_DIR"
fi
cd "$APP_DIR"

# --- Step 5: Frontend .env ---
log "Writing frontend .env..."
cat > .env << EOF
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
EOF

# --- Step 6: Worker .env ---
log "Writing worker .env..."
mkdir -p "$WORKER_DIR"
cat > "${WORKER_DIR}/.env" << EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_KEY}
JOB_TIMEOUT_MS=1800000
EOF

# --- Step 7: Build frontend ---
log "Installing frontend dependencies..."
npm install

log "Building frontend..."
npm run build

# --- Step 8: Setup worker ---
if [[ "$USE_DOCKER" == "true" ]]; then
    if ! command -v docker &>/dev/null; then
        log "Installing Docker..."
        curl -fsSL https://get.docker.com | bash
        apt install -y docker-compose-plugin
        systemctl enable --now docker
    fi

    log "Building Docker worker image..."
    docker build -t ansible-worker "$WORKER_DIR"
    WORKER_SERVICE="ansible-worker-docker"
else
    log "Installing worker dependencies + Ansible..."
    cd "$WORKER_DIR"
    npm install
    apt install -y ansible
    WORKER_SERVICE="ansible-worker"
fi

cd "$APP_DIR"

# --- Step 9: Create ansible user ---
if ! id -u ansible &>/dev/null; then
    log "Creating ansible system user..."
    useradd -m -s /bin/bash ansible
fi
chown -R ansible:ansible "$APP_DIR"

# --- Step 10: Nginx ---
log "Configuring Nginx..."
cat > "$NGINX_CONF" << NGINX_EOF
server {
    listen 80;
    server_name ${DOMAIN};

    root ${APP_DIR}/dist;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|webp)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t || fail "Nginx config test failed"
systemctl reload nginx

# --- Step 11: Systemd service ---
log "Installing systemd service: ${WORKER_SERVICE}..."

if [[ "$WORKER_SERVICE" == "ansible-worker-docker" ]]; then
    cat > /etc/systemd/system/ansible-worker.service << SERVICEEOF
[Unit]
Description=Ansible Dashboard Worker (Docker)
After=docker.service network-online.target
Wants=docker.service network-online.target

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStartPre=-/usr/bin/docker stop ansible-worker
ExecStartPre=-/usr/bin/docker rm ansible-worker
ExecStart=/usr/bin/docker run --rm \
  --name ansible-worker \
  --env-file ${WORKER_DIR}/.env \
  -v ${WORKER_DIR}:/app:ro \
  ansible-worker:latest
ExecStop=/usr/bin/docker stop -t 30 ansible-worker

[Install]
WantedBy=multi-user.target
SERVICEEOF
else
    cat > /etc/systemd/system/ansible-worker.service << SERVICEEOF
[Unit]
Description=Ansible Dashboard Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ansible
Group=ansible
WorkingDirectory=${WORKER_DIR}
EnvironmentFile=${WORKER_DIR}/.env
ExecStart=/usr/bin/node --env-file ${WORKER_DIR}/.env ${WORKER_DIR}/worker.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF
fi

systemctl daemon-reload
systemctl enable ansible-worker
systemctl restart ansible-worker

# --- Step 12: Health check ---
log "Running health checks..."
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
log "=============================================="
log "  Deployment complete!"
log "  Frontend: http://${DOMAIN}"
log "  Worker:   systemctl status ansible-worker"
log "  Logs:     journalctl -u ansible-worker -f"
log "=============================================="
