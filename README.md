# Ansible Dashboard

Dashboard web untuk menjalankan dan memonitor Ansible playbook secara real-time. Worker Node.js mendengarkan antrian job dari Supabase Realtime, lalu mengeksekusi playbook ke server target melalui SSH.

## Fitur

- Dashboard statistik: jumlah server, total job, sukses, gagal
- Manajemen server target: tambah, edit, hapus, simpan SSH key dan password
- Playbook manager: upload file .yml, tulis custom playbook, kelola playbook tersimpan
- Deploy playbook ke server target dengan satu klik
- Terminal output langsung dengan ANSI color parsing
- Riwayat job: pencarian dan filter berdasarkan status
- Login dan Register melalui Supabase Auth

## Arsitektur

Browser terhubung langsung ke Supabase — REST untuk query data, Realtime untuk streaming log. Worker berlangganan (subscribe) ke tabel `ansible_jobs` via Realtime. Saat ada job baru dengan status `pending`, worker mengambil data playbook dan server, lalu menjalankan `ansible-playbook` sebagai proses child. Output proses dikirim baris per baris ke tabel `job_logs`, dan browser menampilkannya langsung melalui subscription Realtime.

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐
│ Browser  │────▶│   Supabase   │◀────│    Worker     │
│ (React)  │     │  (DB + Auth  │     │  (Node.js +   │
│          │◀────│  + Realtime) │────▶│   Ansible)    │
└──────────┘     └──────────────┘     └───────┬───────┘
                                              │ SSH
                                        ┌─────▼──────┐
                                        │   Target   │
                                        │   Servers  │
                                        └────────────┘
```

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19, TypeScript, TailwindCSS v4, Vite |
| UI | Framer Motion, Lucide Icons, React Hot Toast |
| Backend | Supabase (PostgreSQL, Auth, Realtime, RLS) |
| Worker | Node.js 22, @supabase/supabase-js |
| Eksekutor | Ansible, sshpass, OpenSSH |
| Infra native | Debian 12, Nginx, systemd |
| Infra docker | Docker Compose, Nginx (alpine) |

## Prasyarat

- Project Supabase (free tier cukup — daftar di https://supabase.com)
- Server untuk deployment (Debian 12 atau VPS dengan Docker)
- Domain (opsional, hanya diperlukan untuk native deployment)

## Cara Cepat (Docker)

```bash
cp docker/.env.example docker/.env           # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
cp worker/.env.example worker/.env           # isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
cd docker
docker compose up -d
```

Buka Supabase SQL Editor, jalankan `supabase-fix.sql`, lalu akses `http://<ip-server>`.

## Deployment Native (Debian 12)

### Setup Sistem

```bash
apt update && apt upgrade -y
apt install -y curl wget git ufw nginx
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

### Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

### Clone dan Build

```bash
git clone <repo-url> /opt/ansible-dashboard
cd /opt/ansible-dashboard

# Buat file .env frontend
cat > .env << EOF
VITE_SUPABASE_URL=https://project-anda.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
EOF

# Buat file .env worker
cat > worker/.env << EOF
SUPABASE_URL=https://project-anda.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JOB_TIMEOUT_MS=1800000
EOF

# Build frontend
npm install
npm run build

# Install worker
cd worker
npm install
apt install -y ansible sshpass
cd ..
```

### Konfigurasi Nginx

Buat `/etc/nginx/sites-available/ansible-dashboard`:

```nginx
server {
    listen 80;
    server_name domain-anda.com;

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

Aktifkan dan reload:

```bash
ln -sf /etc/nginx/sites-available/ansible-dashboard /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### Worker sebagai Systemd Service

Buat `/etc/systemd/system/ansible-worker.service`:

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

[Install]
WantedBy=multi-user.target
```

Enable dan start:

```bash
useradd -m -s /bin/bash ansible
chown -R ansible:ansible /opt/ansible-dashboard
systemctl daemon-reload
systemctl enable --now ansible-worker
```

### Database

Jalankan `supabase-fix.sql` di Supabase SQL Editor (dashboard → SQL Editor → paste → run).

### Update

```bash
sudo ./update.sh
```

Script ini akan melakukan git pull, npm install, build ulang, dan restart worker.

## Deployment Docker

Seluruh file deployment Docker berada di `docker/`:

```
docker/
├── docker-compose.yml          # Orchestrasi frontend + worker
├── .env.example                # Template env untuk frontend build args
├── README.md                   # Panduan khusus docker
└── frontend/
    ├── Dockerfile              # Multi-stage: node:22 build → nginx:alpine serve
    └── nginx.conf              # Konfigurasi Nginx untuk SPA
```

Worker menggunakan `worker/Dockerfile` yang sudah ada.

### Penggunaan

```bash
# Pertama kali
cp docker/.env.example docker/.env   # isi VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
cp worker/.env.example worker/.env   # isi SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
cd docker
docker compose up -d

# Update setelah perubahan kode
docker compose build --no-cache
docker compose up -d

# Melihat log
docker compose logs -f frontend
docker compose logs -f worker

# Stop
docker compose down
```

### Catatan

- Variabel `VITE_*` adalah build-time args. Vite meng-inline nilai-nilai ini saat build.
- Worker menggunakan `env_file` di docker-compose, dimuat saat runtime.
- Container worker sudah termasuk Ansible dan sshpass.

## Variabel Environment

| Variabel | File | Scope | Deskripsi |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (root) | Build-time | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env` (root) | Build-time | Anon key Supabase (publik) |
| `SUPABASE_URL` | `worker/.env` | Runtime | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `worker/.env` | Runtime | Service role key Supabase (rahasia) |
| `JOB_TIMEOUT_MS` | `worker/.env` | Runtime | Timeout job dalam ms (default: 1800000 = 30 menit) |

## Database

Jalankan `supabase-fix.sql` di Supabase SQL Editor. File ini idempotent dan dapat dijalankan berulang kali.

Isi file:

| Bagian | Isi |
|---|---|
| 1 | Extensions (pgcrypto) |
| 2 | Enum `job_status` (pending, running, success, failed, timeout) |
| 3 | CREATE TABLE IF NOT EXISTS — 5 tabel (profiles, target_servers, playbooks, ansible_jobs, job_logs) |
| 4 | DEFAULT auth.uid() pada kolom user_id |
| 5 | Trigger auto-buat profile saat user signup |
| 6 | Fungsi is_admin() SECURITY DEFINER — mencegah infinite recursion RLS |
| 7 | Hapus semua policy lama |
| 8–12 | RLS policies untuk semua tabel |
| 13 | Indexes untuk performa query |
| 14 | Fungsi cleanup log di atas 30 hari |
| 15 | Realtime publication untuk worker |

## Struktur Project

```
ansible-dashboard/
├── src/                       # Frontend React
│   ├── components/
│   │   ├── auth/              # LoginForm, RegisterForm
│   │   ├── dashboard/         # DashboardOverview, ServerManager, PlaybookManager, dll
│   │   ├── layout/            # Sidebar
│   │   └── ui/                # StatusBadge, Skeleton, Modal
│   ├── hooks/                 # useAuth, useRealtimeLogs
│   ├── lib/                   # Supabase client
│   └── pages/                 # Login, Register, Dashboard
├── worker/                    # Worker Node.js
│   ├── worker.js              # Eksekutor job (spawn ansible-playbook)
│   ├── supabase.js            # Supabase client (service role)
│   ├── Dockerfile
│   ├── .env                   # Tidak di-commit
│   └── .env.example
├── docker/                    # Deployment Docker
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── README.md
│   └── frontend/
│       ├── Dockerfile
│       └── nginx.conf
├── supabase-fix.sql           # Schema database lengkap + policies + indexes
├── deploy.sh                  # Script deploy native otomatis
├── update.sh                  # Script update native otomatis
├── DEPLOY.md                  # Panduan deploy native (lengkap)
├── .env                       # Tidak di-commit
└── .env.example
```

## Development Lokal

```bash
git clone <repo-url>
cd ansible-dashboard
npm install

cp .env.example .env           # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm run dev                    # frontend di http://localhost:5173

# Terminal terpisah:
cd worker
npm install
cp .env.example .env           # isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
node worker.js
```

## Keamanan

| Area | Keterangan |
|---|---|
| SSH credentials | Disimpan terenkripsi di database. Ditulis ke temp file saat eksekusi, langsung dihapus di blok `finally` |
| Isolasi worker | Berjalan sebagai user `ansible` (bukan root). Docker memberikan isolasi tambahan |
| Supabase RLS | Service role key hanya digunakan oleh worker — tidak pernah terekspos ke frontend |
| Timeout job | Batas keras 30 menit, dihentikan paksa via SIGKILL |
| Pembersihan file | Temp playbook, SSH key, dan direktori kerja dihapus setelah setiap job |
| Firewall | Hanya port 22 (SSH) dan 80 (HTTP) yang terbuka |

## Troubleshooting

**WebSocket / Realtime tidak berfungsi**
Pastikan Node.js versi 22 atau lebih baru. Node 20 memiliki bug WebSocket yang sudah diperbaiki di versi 22.

**Error 500 saat mengakses data**
Jalankan `supabase-fix.sql`. Ini memperbaiki infinite recursion RLS dan default kolom yang hilang.

**Worker tidak memproses job**
Periksa `SUPABASE_SERVICE_ROLE_KEY` di `worker/.env`. Worker menggunakan service role key, bukan anon key.

**Git pull gagal di server karena perubahan lokal**
```bash
git stash && git pull origin main && npm install && npm run build && systemctl restart ansible-worker
```

# Creator
Bagas Maulana
Lebih banyak tentang saya : https://bagasproject.my.id
