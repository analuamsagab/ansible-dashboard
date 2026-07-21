# Ansible Dashboard

Dashboard web untuk mengelola server target, menulis playbook, mengelola template Jinja2, menyimpan vault secrets, dan menjalankan Ansible playbook secara real-time dengan output terminal live via WebSocket.

## Fitur

- Dashboard statistik: jumlah server, total job, sukses, gagal
- Manajemen server target: tambah, edit, hapus, simpan SSH key & password terenkripsi
- Playbook manager: upload file .yml, tulis custom YAML, lint dengan ansible-lint
- Template Jinja2 manager: CRUD template `.j2`, auto-detect referensi dari playbook
- Ansible Vault: encrypt/decrypt/rekey item via `ansible-vault`
- Deploy playbook ke satu atau banyak server sekaligus
- Terminal output langsung dengan ANSI color parsing + WebSocket realtime
- Riwayat job: pencarian dan filter berdasarkan status, lihat detail + log
- Login & Register dengan JWT (bcrypt)

## Arsitektur

```
┌──────────────┐     ┌──────────────────────┐     ┌───────────────┐
│   Browser    │────▶│   Express Server      │◀────│    Worker     │
│  (React)     │     │  (:3001)              │     │  (Node.js +   │
│   WebSocket  │◀────│   REST API + WS       │────▶│   Ansible)    │
└──────────────┘     └──────┬───────────────┘     └───────┬───────┘
                            │                             │ SSH
                     ┌──────▼──────┐               ┌──────▼──────┐
                     │   SQLite    │               │   Target    │
                     │  ansible.db │               │   Servers   │
                     └─────────────┘               └─────────────┘
```

Browser terhubung ke Express server via REST API (data CRUD) dan WebSocket (log job realtime). Worker berjalan di dalam proses yang sama (mode `full`) atau terpisah (mode `worker`), mengambil job pending dari SQLite setiap 3 detik, mengeksekusi `ansible-playbook`, dan mengirim log + status update melalui WebSocket.

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Frontend | React 19, TypeScript, TailwindCSS v4, Vite |
| UI | Framer Motion, Lucide Icons, React Hot Toast |
| Backend | Express 4, better-sqlite3, JWT (jsonwebtoken), WebSocket (ws) |
| Worker | Node.js 22 (child_process), Ansible |
| Infra native | Debian 12, Nginx, systemd |
| Infra docker | Docker Compose, Nginx (alpine) |

## Prasyarat

- Node.js 22+
- Ansible + sshpass (untuk eksekusi playbook)
- Server Debian 12 atau VPS (untuk deployment)
- Domain (opsional, untuk native deployment)

## Cara Cepat (Docker)

```bash
cp docker/.env.example docker/.env    # isi VITE_API_URL dan JWT_SECRET
cd docker
docker compose up -d
```

Akses `http://<ip-server>`.

## Deployment Native (Debian 12)

Jalankan script deploy otomatis:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git nginx ansible sshpass

git clone -b sqlite https://github.com/analuamsagab/ansible-dashboard /opt/ansible-dashboard-sqlite
cd /opt/ansible-dashboard-sqlite
sudo DOMAIN="ansible.example.com" JWT_SECRET="your-secret" ./deploy.sh
```

Atau manual:

### Setup Frontend

```bash
cd /opt/ansible-dashboard-sqlite
npm install
npm run build
```

### Setup Backend

```bash
cd server
npm install

cat > .env << EOF
PORT=3001
JWT_SECRET=change-me-in-production
JOB_TIMEOUT_MS=1800000
MODE=full
DB_PATH=./data/ansible.db
EOF

mkdir -p data
node src/index.js
```

### Nginx (proxying API + WebSocket)

```nginx
server {
    listen 80;
    server_name ansible.example.com;

    root /opt/ansible-dashboard-sqlite/dist;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    location / { try_files $uri $uri/ /index.html; }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api { proxy_pass http://127.0.0.1:3001; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }

    location /ws { proxy_pass http://127.0.0.1:3001; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_set_header Host $host; }
}
```

### Systemd Service

```ini
[Unit]
Description=Ansible Dashboard Backend
After=network-online.target

[Service]
Type=simple
User=ansible
WorkingDirectory=/opt/ansible-dashboard-sqlite/server
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Update

```bash
sudo ./update.sh
```

Script ini melakukan git pull, npm install, build ulang frontend, dan restart backend.

## Deployment Docker

```bash
cd docker
cp .env.example .env    # isi VITE_API_URL dan JWT_SECRET
docker compose up -d --build
```

### Stop

```bash
docker compose down
```

### Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Variabel Environment

### Frontend (`.env` di root)

| Variabel | Wajib | Deskripsi |
|---|---|---|
| `VITE_API_URL` | Ya | URL backend API (contoh: `http://localhost:3001`) |

### Backend (`server/.env`)

| Variabel | Wajib | Default | Deskripsi |
|---|---|---|---|
| `PORT` | Tidak | `3001` | Port HTTP server |
| `JWT_SECRET` | Ya | `change-me-in-production` | Secret key untuk JWT |
| `JOB_TIMEOUT_MS` | Tidak | `1800000` | Timeout job dalam ms (30 menit) |
| `MODE` | Tidak | `full` | `full` (server+worker) atau `worker` (worker only) |
| `DB_PATH` | Tidak | `./data/ansible.db` | Lokasi file SQLite |

### Docker (`docker/.env`)

| Variabel | Wajib | Deskripsi |
|---|---|---|
| `VITE_API_URL` | Ya | URL backend (contoh: `http://localhost:3001`) |
| `JWT_SECRET` | Ya | Secret key backend |
| `JOB_TIMEOUT_MS` | Tidak | Timeout job (default: 1800000) |
| `MODE` | Tidak | `full` atau `worker` |

## Struktur Project

```
ansible-dashboard-sqlite/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── auth/                 # LoginForm, RegisterForm
│   │   ├── dashboard/            # DashboardOverview, ServerManager, PlaybookManager, TemplateManager, VaultManager, PlaybookDeploy, TerminalView, JobHistory, JobDetailModal, LintResults, ServerSelector, YamlEditor
│   │   ├── layout/               # Sidebar
│   │   └── ui/                   # Modal, Skeleton, StatusBadge
│   ├── context/                  # AuthContext
│   ├── hooks/                    # useRealtimeLogs, useFetch
│   ├── lib/                      # api.ts (REST client), ansi.ts (ANSI parser)
│   └── pages/                    # Login, Register, Dashboard
├── server/                       # Backend Express
│   ├── src/
│   │   ├── index.js              # Entry point, mount routes + WS + worker
│   │   ├── auth.js               # JWT auth (register, login, /me, middleware)
│   │   ├── db.js                 # SQLite initialization + schema
│   │   ├── websocket.js          # WebSocket server + broadcasting
│   │   ├── worker.js             # Job executor (spawn ansible-playbook)
│   │   ├── utils.js              # Shared utilities (extractTemplateRefs, writePasswordFile)
│   │   └── routes/
│   │       ├── servers.js        # CRUD server target
│   │       ├── playbooks.js      # CRUD playbook
│   │       ├── templates.js      # CRUD template + detect
│   │       ├── vault.js          # CRUD vault + encrypt/decrypt/rekey
│   │       ├── jobs.js           # Job list + create + execute
│   │       ├── lint.js           # Ansible lint
│   │       └── stats.js          # Statistik dashboard
│   └── Dockerfile
├── docker/                       # Docker Compose
│   ├── docker-compose.yml
│   ├── .env.example
│   └── frontend/
│       ├── Dockerfile
│       └── nginx.conf
├── public/                       # Static assets (ansible-dashboard.webp)
├── deploy.sh                     # Script deploy native otomatis
├── update.sh                     # Script update native otomatis
├── DEPLOY.md                     # Panduan deploy native (lengkap)
├── .env.example                  # Template env frontend
└── vite.config.ts
```

## Development Lokal

```bash
git clone <repo-url>
cd ansible-dashboard-sqlite

# Terminal 1 — Backend
cd server
cp .env.example .env
npm install
node src/index.js          # running di :3001

# Terminal 2 — Frontend
cd ..
cp .env.example .env       # isi VITE_API_URL=http://localhost:3001
npm install
npm run dev                # running di :5173
```

Buka `http://localhost:5173`. Daftar akun baru, lalu login.

## Keamanan

| Area | Keterangan |
|---|---|
| SSH credentials | Disimpan di SQLite. Ditulis ke temp file saat eksekusi, langsung dihapus di blok `finally` |
| Isolasi worker | Berjalan dalam proses yang sama (mode full) atau container Docker (mode worker). User non-root `ansible` |
| JWT | Token expire 7 hari, dikirim via header Authorization |
| Vault password | Tidak pernah disimpan di DB — dimasukkan manual setiap deploy |
| Vault secrets | Disimpan terenkripsi via `ansible-vault`, hanya bisa didekripsi dengan password |
| Timeout job | Batas keras 30 menit, dihentikan paksa via SIGKILL |
| Pembersihan file | Temp playbook, SSH key, inventory, vault password file dihapus setelah setiap job |
| Firewall | Hanya port 22 (SSH) dan 80 (HTTP) yang terbuka |
| SQLite | WAL mode untuk performa, foreign keys ON |

## Troubleshooting

**WebSocket tidak terhubung**
Pastikan Nginx proxy `/ws` dengan Upgrade header. Lihat konfigurasi Nginx di atas.

**Error 401 saat login**
Pastikan `JWT_SECRET` konsisten antara session. Ganti JWT_SECRET akan invalidate semua token.

**Worker tidak memproses job**
Cek `MODE` di `server/.env`. Set ke `full` supaya server + worker jalan bareng.

**Ansible error "Host key verification failed"**
Environment `ANSIBLE_HOST_KEY_CHECKING=False` sudah di-set otomatis oleh worker.

**Git pull gagal karena file lokal berubah**
```bash
git stash && git pull origin sqlite
```

## Creator

Bagas Maulana — [bagasproject.my.id](https://bagasproject.my.id)
