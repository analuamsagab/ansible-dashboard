# Ansible Dashboard — Docker Deployment

## Prerequisites

- Server with Docker + Docker Compose installed
- Supabase project (cloud) already created
- Domain pointing to server IP (optional)

## Quick Start

### 1. Prepare env files

```bash
# Frontend build args
cp docker/.env.example docker/.env
# Edit docker/.env → fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Worker runtime env
cp worker/.env.example worker/.env
# Edit worker/.env → fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

### 2. Deploy

```bash
cd docker
docker compose up -d
```

### 3. Run database setup

Open Supabase SQL Editor, paste and run `supabase-fix.sql`.

### 4. Open browser

```
http://your-server-ip
```

## Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Rebuild after code changes
docker compose build --no-cache
docker compose up -d

# View logs
docker compose logs -f frontend
docker compose logs -f worker

# Restart a service
docker compose restart worker
```

## File Layout

```
docker/
├── docker-compose.yml      ← Service definitions
├── .env                    ← Frontend build args (VITE_SUPABASE_*)
├── .env.example            ← Template for .env
├── README.md               ← This file
└── frontend/
    ├── Dockerfile           ← Multi-stage build (Vite → Nginx)
    └── nginx.conf           ← Nginx SPA configuration
```

## Architecture

```
Browser ──▶ frontend:80 (Nginx) ── serves static build
               │
               ├── Supabase REST/Realtime (direct from browser)
               │
Worker (Node + Ansible) ◀── Supabase Realtime subscription
               │
               └── SSH ▶ Target Servers
```

## Environment Variables

| Variable | Where | Type | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `docker/.env` | Build-arg | Frontend Supabase endpoint |
| `VITE_SUPABASE_ANON_KEY` | `docker/.env` | Build-arg | Frontend Supabase anon key |
| `SUPABASE_URL` | `worker/.env` | Runtime | Worker Supabase endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | `worker/.env` | Runtime | Worker service role key |
| `JOB_TIMEOUT_MS` | `worker/.env` | Runtime | Ansible job timeout (default 30min) |
