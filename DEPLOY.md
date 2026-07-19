# Ansible Dashboard — Deployment Guide (Debian 12)

## Prerequisites

- Debian 12 server with root/sudo access
- Domain name (e.g. `ansible.example.com`) pointing to server IP
- [Supabase](https://supabase.com) project already created (DB + Auth)
- SSH access to the server

---

## 1. Initial Server Setup

```bash
apt update && apt upgrade -y
apt install -y curl wget git ufw nginx
```

### Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## 2. Install Node.js 20.x

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

---

## 3. Install Docker (optional — for isolated worker)

```bash
curl -fsSL https://get.docker.com | bash
apt install -y docker-compose-plugin
systemctl enable --now docker
```

---

## 4. Clone Project

```bash
mkdir -p /opt
cd /opt
git clone <your-repo-url> ansible-dashboard
cd ansible-dashboard
```

---

## 5. Configure Environment

```bash
# Frontend .env
cat > /opt/ansible-dashboard/.env << 'EOF'
VITE_SUPABASE_URL=https://eovfjrskpqbikzglkmdl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdmZqcnNrcHFiaWt6Z2xrbWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MTY5NjcsImV4cCI6MjA5OTk5Mjk2N30.BEssyHHgVrPLHKJVRBFS-vru4d7NjAiRcDFHZVTDMYo
EOF

# Worker .env
cat > /opt/ansible-dashboard/worker/.env << 'EOF'
SUPABASE_URL=https://eovfjrskpqbikzglkmdl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdmZqcnNrcHFiaWt6Z2xrbWRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDQxNjk2NywiZXhwIjoyMDk5OTkyOTY3fQ.Gek-hdibSj6xe41CFeR5SgU_L2uZ2kXCPHzjL3N2HmQ
JOB_TIMEOUT_MS=1800000
EOF
```

---

## 6. Build Frontend

```bash
cd /opt/ansible-dashboard
npm install
npm run build
```

---

## 7. Install Worker Dependencies

```bash
cd /opt/ansible-dashboard/worker

# If running natively
npm install
apt install -y ansible

# OR if using Docker
docker build -t ansible-worker .
```

---

## 8. Nginx Configuration

Create `/etc/nginx/sites-available/ansible-dashboard`:

```nginx
server {
    listen 80;
    server_name ansible.example.com;

    root /opt/ansible-dashboard/dist;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:

```bash
ln -s /etc/nginx/sites-available/ansible-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

---

## 9. Systemd Services

### Worker Service (Native)

Create `/etc/systemd/system/ansible-worker.service`:

```ini
[Unit]
Description=Ansible Dashboard Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ansible
Group=ansible
WorkingDirectory=/opt/ansible-dashboard/worker
EnvironmentFile=/opt/ansible-dashboard/worker/.env
ExecStart=/usr/bin/node --env-file /opt/ansible-dashboard/worker/.env /opt/ansible-dashboard/worker/worker.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Worker Service (Docker)

Create `/etc/systemd/system/ansible-worker-docker.service`:

```ini
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
  --env-file /opt/ansible-dashboard/worker/.env \
  -v /opt/ansible-dashboard/worker:/app:ro \
  ansible-worker:latest
ExecStop=/usr/bin/docker stop -t 10 ansible-worker

[Install]
WantedBy=multi-user.target
```

### Enable & Start

```bash
useradd -m -s /bin/bash ansible
chown -R ansible:ansible /opt/ansible-dashboard

systemctl daemon-reload
systemctl enable ansible-worker
systemctl start ansible-worker
systemctl status ansible-worker
```

---

## 10. Run SQL Fix

Before using the app, run the SQL fix in Supabase SQL Editor:

```bash
cat /opt/ansible-dashboard/supabase-fix.sql
```

Copy the output and paste into Supabase SQL Editor, then run.

---

## 11. Verify Deployment

```bash
systemctl status nginx
systemctl status ansible-worker
curl -I http://ansible.example.com
journalctl -u ansible-worker -f
```

Open browser to `http://ansible.example.com`.

---

## 12. Updating

After pulling new code from GitHub, run the update script:

```bash
cd /opt/ansible-dashboard
sudo ./update.sh
```

If there are database schema changes, also run the SQL from `supabase-fix.sql` (or the new SQL file) in Supabase SQL Editor.

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   Browser   │────▶│   Nginx (:80)       │────▶│  /dist/      │
│  (React)    │     │  ansible.example.com │     │  (static)    │
└─────────────┘     └─────────────────────┘     └──────────────┘
       │                                                    │
       │  Supabase Realtime (direct)                        │
       ▼                                                    │
┌───────────────────────┐                                   │
│     Supabase          │◀───────────────────────────────────┘
│  ┌─────────────────┐  │      ┌──────────────────────┐
│  │   PostgreSQL    │  │◀────▶│  Worker (Node.js)    │
│  │  - ansible_jobs │  │      │  - Sub Realtime      │
│  │  - job_logs     │  │      │  - Spawn ansible     │
│  │  - playbooks    │  │      │  - Stream logs       │
│  │  - target_serv  │  │      └──────────┬───────────┘
│  └─────────────────┘  │                 │
└───────────────────────┘                 │
                                    ┌─────▼──────┐
                                    │  Target    │
                                    │  Servers   │
                                    │  (SSH)     │
                                    └────────────┘
```

---

## Security Notes

| Area | Recommendation |
|---|---|
| SSH Keys | Stored encrypted at rest, written to temp files, deleted immediately after job |
| Worker Isolation | Run as non-root `ansible` user; Docker container recommended |
| Supabase RLS | Service role key used only by worker (never exposed to frontend) |
| Job Timeout | 30-minute hard limit kills runaway playbooks via SIGKILL |
| File Cleanup | Temp playbooks & SSH keys deleted in `finally` block |
| Firewall | Only ports 22 (SSH) and 80 open |
