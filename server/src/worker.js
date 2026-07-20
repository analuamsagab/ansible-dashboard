import { spawn } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from './db.js'

const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MS || '1800000', 10)

let broadcastLog = () => {}
let broadcastStatus = () => {}

export function setBroadcastFns(logFn, statusFn) {
  broadcastLog = logFn
  broadcastStatus = statusFn
}

function insertLog(jobId, logLine, stream = 'stdout') {
  const info = db.prepare(
    "INSERT INTO job_logs (job_id, log_line, stream) VALUES (?, ?, ?)"
  ).run(jobId, logLine, stream)

  broadcastLog(jobId, { id: info.lastInsertRowid, log_line: logLine, stream, created_at: new Date().toISOString() })
}

function updateJobStatus(jobId, status) {
  const update = { status }
  if (status === 'running') update.started_at = new Date().toISOString()
  if (['success', 'failed', 'timeout'].includes(status)) update.finished_at = new Date().toISOString()

  const fields = ['status = ?']
  const values = [status]
  if (update.started_at) { fields.push('started_at = ?'); values.push(update.started_at) }
  if (update.finished_at) { fields.push('finished_at = ?'); values.push(update.finished_at) }

  values.push(jobId)
  db.prepare(`UPDATE ansible_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  broadcastStatus(jobId, status)
}

export async function executeJob(job) {
  try {
    const server = db.prepare('SELECT * FROM target_servers WHERE id = ?').get(job.server_id)
    const playbook = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(job.playbook_id)

    if (!playbook?.content_yaml || !server) {
      insertLog(job.id, 'Failed to fetch playbook or server data', 'system')
      updateJobStatus(job.id, 'failed')
      return
    }

    updateJobStatus(job.id, 'running')
    insertLog(job.id, `Job started — target: ${server.ssh_user}@${server.ip_address}:${server.ssh_port}`, 'system')

    const tempDir = mkdtempSync(join(tmpdir(), 'ansible-'))
    const playbookPath = join(tempDir, `playbook_${job.id}.yml`)
    const sshKeyPath = join(tempDir, `ssh_key_${job.id}`)

    try {
      writeFileSync(playbookPath, playbook.content_yaml, 'utf-8')

      if (server.encrypted_ssh_key) {
        writeFileSync(sshKeyPath, server.encrypted_ssh_key, 'utf-8')
      }

      const inventory = `${server.ip_address},`
      const env = { ...process.env, ANSIBLE_HOST_KEY_CHECKING: 'False' }

      const child = spawn('ansible-playbook', [
        '-i', inventory,
        '-u', server.ssh_user,
        ...(server.encrypted_ssh_key ? ['--private-key', sshKeyPath] : []),
        ...(server.encrypted_ssh_password ? ['--ask-pass'] : []),
        playbookPath,
      ], { env, stdio: ['pipe', 'pipe', 'pipe'] })

      if (server.encrypted_ssh_password) {
        child.stdin.write(server.encrypted_ssh_password + '\n')
        child.stdin.end()
      }

      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        insertLog(job.id, 'TIMEOUT — Job exceeded 30 minutes, forcefully terminated', 'system')
      }, JOB_TIMEOUT_MS)

      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          insertLog(job.id, line, 'stdout')
        }
      })

      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          insertLog(job.id, line, 'stderr')
        }
      })

      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve)
        child.on('error', (err) => {
          insertLog(job.id, `Process error: ${err.message}`, 'stderr')
          resolve(1)
        })
      })

      clearTimeout(timer)

      if (exitCode === 0) {
        updateJobStatus(job.id, 'success')
        insertLog(job.id, 'Job completed successfully', 'system')
      } else {
        updateJobStatus(job.id, 'failed')
        insertLog(job.id, `Job failed with exit code ${exitCode}`, 'system')
      }
    } catch (err) {
      updateJobStatus(job.id, 'failed')
      insertLog(job.id, `Unexpected error: ${err.message}`, 'stderr')
    } finally {
      try { unlinkSync(playbookPath) } catch {}
      try { unlinkSync(sshKeyPath) } catch {}
      try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
    }
  } catch (err) {
    console.error(`Worker error for job ${job.id}:`, err)
  }
}

export function startWorker() {
  console.log('[Worker] Started — polling for pending jobs...')

  setInterval(() => {
    try {
      const pending = db.prepare("SELECT * FROM ansible_jobs WHERE status = 'pending'").all()
      for (const job of pending) {
        executeJob(job)
      }
    } catch (err) {
      console.error('[Worker] Poll error:', err)
    }
  }, 2000)
}
