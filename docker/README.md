# Ansible Dashboard — Docker Deployment

## Prerequisites

- Server with Docker + Docker Compose installed
- Ansible installed in the backend container (included in Dockerfile)
- Domain pointing to server IP (optional)

## Quick Start

### 1. Prepare env files

```bash
cp docker/.env.example docker/.env
# Edit docker/.env → fill JWT_SECRET with a random string
```

### 2. Deploy

```bash
cd docker
docker compose up -d --build
```

### 3. Open browser

```
http://your-server-ip
```

Register the first user — they'll automatically get the admin role.

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
docker compose logs -f backend

# Restart a service
docker compose restart backend
```

## File Layout

```
docker/
├── docker-compose.yml       ← Service definitions
├── .env                     ← Environment variables
├── .env.example             ← Template for .env
├── README.md                ← This file
└── frontend/
    ├── Dockerfile            ← Multi-stage build (Vite → Nginx)
    └── nginx.conf            ← Nginx SPA + API/WS proxy
```

## Architecture

```
Browser ──▶ nginx:80 (frontend container)
                │
                ├── /api ──▶ backend:3001 (Express + SQLite)
                ├── /ws  ──▶ backend:3001 (WebSocket)
                └── /     ──▶ static files (Vite build)

Backend (Node + Ansible) ───▶ SSH ──▶ Target Servers
Data stored in SQLite volume (ansible-data)
```

## Environment Variables

| Variable          | Where | Type    | Purpose                                |
|-------------------|-------|---------|----------------------------------------|
| `VITE_API_URL`    | .env  | Build   | Frontend API path (/api with nginx)    |
| `JWT_SECRET`      | .env  | Runtime | Auth token signing key                 |
| `JOB_TIMEOUT_MS`  | .env  | Runtime | Ansible job timeout (default 30min)    |
