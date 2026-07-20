#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ansible-dashboard-sqlite"
SERVER_DIR="${APP_DIR}/server"
NGINX_CONF="/etc/nginx/sites-available/ansible-dashboard-sqlite"
DOMAIN="${DOMAIN:-ansible.example.com}"
JWT_SECRET="${JWT_SECRET:-change-me-in-production}"
USE_DOCKER="${USE_DOCKER:-false}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

[[ $EUID -eq 0 ]] || fail "Run as root: sudo ./deploy.sh"

log "Updating system packages..."
apt update && apt upgrade -y

log "Installing base dependencies..."
apt install -y curl wget git ufw nginx

log "Configuring UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

log "Installing Node.js 22.x..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

git config --global --add safe.directory "$APP_DIR" 2>/dev/null
if [[ -d "$APP_DIR/.git" ]]; then
    log "Pulling latest code..."
    cd "$APP_DIR"
    git pull origin main
else
    log "Cloning repository..."
    git clone https://github.com/your-repo/ansible-dashboard-sqlite "$APP_DIR"
fi
cd "$APP_DIR"

log "Writing frontend .env..."
cat > .env << EOF
VITE_API_URL=http://${DOMAIN}:3001
EOF

log "Installing frontend dependencies..."
npm install

log "Building frontend..."
npm run build

if [[ "$USE_DOCKER" == "true" ]]; then
    if ! command -v docker &>/dev/null; then
        log "Installing Docker..."
        curl -fsSL https://get.docker.com | bash
        apt install -y docker-compose-plugin
        systemctl enable --now docker
    fi

    log "Building and starting with Docker Compose..."
    cd "$APP_DIR/docker"
    JWT_SECRET="$JWT_SECRET" docker compose up -d --build
    cd "$APP_DIR"
else
    log "Setting up backend..."
    cd "$SERVER_DIR"
    npm install

    if ! command -v ansible-playbook &>/dev/null; then
        log "Installing Ansible + sshpass..."
        apt install -y ansible sshpass
    fi

    cat > .env << EOF
PORT=3001
JWT_SECRET=${JWT_SECRET}
JOB_TIMEOUT_MS=1800000
MODE=full
DB_PATH=${SERVER_DIR}/data/ansible.db
EOF

    mkdir -p data

    log "Creating ansible user..."
    if ! id -u ansible &>/dev/null; then
        useradd -m -s /bin/bash ansible
    fi
    chown -R ansible:ansible "$APP_DIR"
    chown -R ansible:ansible "$SERVER_DIR/data"

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

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX_EOF

    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t || fail "Nginx config test failed"
    systemctl reload nginx

    log "Installing systemd service for backend..."
    cat > /etc/systemd/system/ansible-backend.service << SERVICEEOF
[Unit]
Description=Ansible Dashboard Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ansible
Group=ansible
WorkingDirectory=${SERVER_DIR}
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

    systemctl daemon-reload
    systemctl enable ansible-backend
    systemctl restart ansible-backend
fi

log "Running health checks..."
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

log "=============================================="
log "  Deployment complete!"
log "  Frontend: http://${DOMAIN}"
log "  Backend:  systemctl status ansible-backend"
log "  Logs:     journalctl -u ansible-backend -f"
log "=============================================="
