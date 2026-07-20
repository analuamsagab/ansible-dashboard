import { Router } from 'express'
import db, { genId } from '../db.js'
import { authMiddleware } from '../auth.js'
import { executeJob } from '../worker.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const jobs = db.prepare(`
    SELECT
      j.id, j.status, j.created_at, j.server_id, j.playbook_id,
      s.friendly_name AS server_name,
      p.name AS playbook_name
    FROM ansible_jobs j
    LEFT JOIN target_servers s ON s.id = j.server_id
    LEFT JOIN playbooks p ON p.id = j.playbook_id
    WHERE j.user_id = ?
    ORDER BY j.created_at DESC
    LIMIT 50
  `).all(req.user.id)

  res.json(jobs.map(j => ({
    id: j.id,
    status: j.status,
    created_at: j.created_at,
    server_id: j.server_id,
    playbook_id: j.playbook_id,
    target_servers: j.server_name ? { friendly_name: j.server_name } : null,
    playbooks: j.playbook_name ? { name: j.playbook_name } : null,
  })))
})

router.post('/', (req, res) => {
  const { serverId, playbookId, vaultPassword } = req.body
  if (!serverId || !playbookId) return res.status(400).json({ error: 'serverId and playbookId required' })

  const server = db.prepare('SELECT id, user_id FROM target_servers WHERE id = ?').get(serverId)
  if (!server) return res.status(404).json({ error: 'Server not found' })

  const playbook = db.prepare('SELECT id FROM playbooks WHERE id = ?').get(playbookId)
  if (!playbook) return res.status(404).json({ error: 'Playbook not found' })

  const id = genId()
  db.prepare(`
    INSERT INTO ansible_jobs (id, user_id, server_id, playbook_id, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(id, req.user.id, serverId, playbookId)

  const job = { id, user_id: req.user.id, server_id: serverId, playbook_id: playbookId, status: 'pending', vaultPassword: vaultPassword || null }

  executeJob(job)

  res.json({ id })
})

export default router
