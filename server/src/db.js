import Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'data', 'ansible.db')
const dbDir = dirname(dbPath)
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS target_servers (
    id                     TEXT PRIMARY KEY,
    user_id                TEXT NOT NULL REFERENCES users(id),
    friendly_name          TEXT NOT NULL,
    ip_address             TEXT NOT NULL,
    ssh_port               INTEGER NOT NULL DEFAULT 22,
    ssh_user               TEXT NOT NULL DEFAULT 'root',
    encrypted_ssh_key      TEXT,
    encrypted_ssh_password TEXT,
    created_at             DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS playbooks (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id),
    name              TEXT NOT NULL,
    description       TEXT,
    content_yaml      TEXT NOT NULL,
    is_system_default INTEGER NOT NULL DEFAULT 0,
    created_at        DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ansible_jobs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    server_id   TEXT NOT NULL REFERENCES target_servers(id),
    playbook_id TEXT NOT NULL REFERENCES playbooks(id),
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','success','failed','timeout')),
    started_at  DATETIME,
    finished_at DATETIME,
    created_at  DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS job_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id      TEXT NOT NULL REFERENCES ansible_jobs(id),
    log_line    TEXT NOT NULL,
    stream      TEXT NOT NULL DEFAULT 'stdout'
                CHECK (stream IN ('stdout','stderr','system')),
    created_at  DATETIME DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON ansible_jobs(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_jobs_created     ON ansible_jobs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_jobs_pending     ON ansible_jobs(status) WHERE status = 'pending';
  CREATE INDEX IF NOT EXISTS idx_logs_job_time   ON job_logs(job_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_servers_user    ON target_servers(user_id);
  CREATE INDEX IF NOT EXISTS idx_playbooks_user  ON playbooks(user_id);

  CREATE TABLE IF NOT EXISTS templates (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id),
    name       TEXT NOT NULL,
    filename   TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);
`)

export default db

export function genId() {
  return uuid()
}
