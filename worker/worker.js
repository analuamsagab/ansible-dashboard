import { spawn } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { supabase } from './supabase.js'

const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MS || '1800000', 10)

async function insertLog(jobId, logLine, stream = 'stdout') {
  await supabase.from('job_logs').insert({
    job_id: jobId,
    log_line: logLine,
    stream,
  })
}

async function updateJobStatus(jobId, status) {
  const update = { status }
  if (status === 'running') update.started_at = new Date().toISOString()
  if (['success', 'failed', 'timeout'].includes(status)) update.finished_at = new Date().toISOString()
  await supabase.from('ansible_jobs').update(update).eq('id', jobId)
}

async function fetchJobData(job) {
  const [playbookRes, serverRes, sshKeyRes] = await Promise.all([
    supabase.from('playbooks').select('content_yaml').eq('id', job.playbook_id).single(),
    supabase.from('target_servers').select('*').eq('id', job.server_id).single(),
    supabase.from('target_servers').select('encrypted_ssh_key, encrypted_ssh_password, ssh_user').eq('id', job.server_id).single(),
  ])
  return {
    playbookYaml: playbookRes.data?.content_yaml,
    server: serverRes.data,
    ssh: sshKeyRes.data,
  }
}

async function executeJob(job) {
  const { playbookYaml, server, ssh } = await fetchJobData(job)
  if (!playbookYaml || !server) {
    await insertLog(job.id, 'Failed to fetch playbook or server data', 'system')
    await updateJobStatus(job.id, 'failed')
    return
  }

  await updateJobStatus(job.id, 'running')
  await insertLog(job.id, `Job started — target: ${ssh.ssh_user}@${server.ip_address}:${server.ssh_port}`, 'system')

  const tempDir = mkdtempSync(join(tmpdir(), 'ansible-'))
  const playbookPath = join(tempDir, `playbook_${job.id}.yml`)
  const sshKeyPath = join(tempDir, `ssh_key_${job.id}`)

  try {
    writeFileSync(playbookPath, playbookYaml, 'utf-8')

    if (ssh.encrypted_ssh_key) {
      writeFileSync(sshKeyPath, ssh.encrypted_ssh_key, 'utf-8')
    }

    const inventory = `${server.ip_address},`
    const env = { ...process.env, ANSIBLE_HOST_KEY_CHECKING: 'False' }

    const child = spawn('ansible-playbook', [
      '-i', inventory,
      '-u', ssh.ssh_user,
      ...(ssh.encrypted_ssh_key ? ['--private-key', sshKeyPath] : []),
      ...(ssh.encrypted_ssh_password ? ['--ask-pass'] : []),
      playbookPath,
    ], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    if (ssh.encrypted_ssh_password) {
      child.stdin.write(ssh.encrypted_ssh_password + '\n')
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
      await updateJobStatus(job.id, 'success')
      await insertLog(job.id, 'Job completed successfully', 'system')
    } else {
      await updateJobStatus(job.id, 'failed')
      await insertLog(job.id, `Job failed with exit code ${exitCode}`, 'system')
    }
  } catch (err) {
    await updateJobStatus(job.id, 'failed')
    await insertLog(job.id, `Unexpected error: ${err.message}`, 'stderr')
  } finally {
    try { unlinkSync(playbookPath) } catch {}
    try { unlinkSync(sshKeyPath) } catch {}
    try { rmSync(tempDir, { recursive: true, force: true }) } catch {}
  }
}

async function watchJobs() {
  console.log('Ansible Worker started — listening for pending jobs...')

  const channel = supabase
    .channel('ansible-jobs-pending')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ansible_jobs',
        filter: 'status=eq.pending',
      },
      async (payload) => {
        const job = payload.new
        console.log(`New job detected: ${job.id}`)
        executeJob(job).catch((err) => {
          console.error(`Job ${job.id} execution error:`, err.message)
        })
      },
    )
    .subscribe((status) => {
      console.log(`Realtime subscription: ${status}`)
    })

  process.on('SIGINT', () => {
    console.log('\nShutting down...')
    supabase.removeChannel(channel)
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('\nShutting down...')
    supabase.removeChannel(channel)
    process.exit(0)
  })
}

watchJobs().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
