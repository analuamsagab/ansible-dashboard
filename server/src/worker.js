import { spawn } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import db from './db.js'
import { extractTemplateRefs } from './utils.js'

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
    const serverIds = job.server_ids ? JSON.parse(job.server_ids) : [job.server_id]
    const placeholders = serverIds.map(() => '?').join(',')
    const servers = db.prepare(
      `SELECT * FROM target_servers WHERE id IN (${placeholders})`
    ).all(...serverIds)

    const playbook = db.prepare('SELECT * FROM playbooks WHERE id = ?').get(job.playbook_id)

    if (!playbook?.content_yaml || servers.length === 0) {
      insertLog(job.id, 'Failed to fetch playbook or server data', 'system')
      updateJobStatus(job.id, 'failed')
      return
    }

    updateJobStatus(job.id, 'running')
    const names = servers.map(s => `${s.ssh_user}@${s.ip_address}`).join(', ')
    insertLog(job.id, `Job started — targets: ${names}`, 'system')

    const tempDir = mkdtempSync(join(tmpdir(), 'ansible-'))
    const playbookPath = join(tempDir, `playbook_${job.id}.yml`)
    const inventoryPath = join(tempDir, `inventory_${job.id}`)
    let vaultPath = null
    const sshKeyPaths = []

    try {
      writeFileSync(playbookPath, playbook.content_yaml, 'utf-8')

      if (job.vaultPassword) {
        vaultPath = join(tempDir, `vault_pass_${job.id}`)
        writeFileSync(vaultPath, job.vaultPassword, 'utf-8')
      }

      const templateRefs = extractTemplateRefs(playbook.content_yaml)
      if (templateRefs.length > 0) {
        const placeholders = templateRefs.map(() => '?').join(',')
        const matched = db.prepare(
          `SELECT filename, content FROM templates WHERE user_id = ? AND filename IN (${placeholders})`
        ).all(job.user_id, ...templateRefs)
        if (matched.length > 0) {
          const templatesDir = join(tempDir, 'templates')
          mkdirSync(templatesDir, { recursive: true })
          for (const t of matched) {
            writeFileSync(join(templatesDir, t.filename), t.content, 'utf-8')
          }
          insertLog(job.id, `Templates: ${matched.map(t => t.filename).join(', ')}`, 'system')
        }
        const missing = templateRefs.filter(f => !matched.some(t => t.filename === f))
        for (const f of missing) {
          insertLog(job.id, `Template "${f}" referenced but not found`, 'stderr')
        }
      }

      const inventoryLines = ['[all]']
      for (const server of servers) {
        let sshKeyPath = null
        if (server.encrypted_ssh_key) {
          sshKeyPath = join(tempDir, `ssh_key_${server.id}`)
          writeFileSync(sshKeyPath, server.encrypted_ssh_key, 'utf-8')
          sshKeyPaths.push(sshKeyPath)
        }

        const hostVars = [
          `ansible_host=${server.ip_address}`,
          `ansible_user=${server.ssh_user}`,
          `ansible_port=${server.ssh_port}`,
        ]
        if (sshKeyPath) hostVars.push(`ansible_ssh_private_key_file=${sshKeyPath}`)
        if (server.encrypted_ssh_password) hostVars.push(`ansible_ssh_pass=${server.encrypted_ssh_password}`)
        inventoryLines.push(`srv_${server.id} ${hostVars.join(' ')}`)
      }
      writeFileSync(inventoryPath, inventoryLines.join('\n'), 'utf-8')

      const env = { ...process.env, ANSIBLE_HOST_KEY_CHECKING: 'False' }

      const args = [
        '-i', inventoryPath,
        ...(vaultPath ? ['--vault-password-file', vaultPath] : []),
        playbookPath,
      ]

      const child = spawn('ansible-playbook', args, { env, stdio: ['pipe', 'pipe', 'pipe'] })

      for (const server of servers) {
        if (server.encrypted_ssh_password) {
          child.stdin.write(server.encrypted_ssh_password + '\n')
        }
      }
      child.stdin.end()

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
      try { unlinkSync(inventoryPath) } catch {}
      for (const p of sshKeyPaths) try { unlinkSync(p) } catch {}
      if (vaultPath) try { unlinkSync(vaultPath) } catch {}
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
      const row = db.prepare("SELECT COUNT(*) AS count FROM ansible_jobs WHERE status = 'pending'").get()
      if (!row || row.count === 0) return

      const pending = db.prepare("SELECT * FROM ansible_jobs WHERE status = 'pending'").all()
      for (const job of pending) {
        executeJob(job)
      }
    } catch (err) {
      console.error('[Worker] Poll error:', err)
    }
  }, 3000)
}
