import { Router } from 'express'
import db, { genId } from '../db.js'
import { authMiddleware } from '../auth.js'
import { executeJob } from '../worker.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const jobs = db.prepare(`
    SELECT
      j.id, j.status, j.created_at, j.started_at, j.finished_at,
      j.server_id, j.server_ids, j.playbook_id,
      s.friendly_name AS server_name,
      p.name AS playbook_name
    FROM ansible_jobs j
    LEFT JOIN target_servers s ON s.id = j.server_id
    LEFT JOIN playbooks p ON p.id = j.playbook_id
    WHERE j.user_id = ?
    ORDER BY j.created_at DESC
    LIMIT 50
  `).all(req.user.id)

  res.json(jobs.map(j => {
    let targetServers = null
    if (j.server_ids) {
      const ids = JSON.parse(j.server_ids)
      const servers = db.prepare(
        `SELECT id, friendly_name FROM target_servers WHERE id IN (${ids.map(() => '?').join(',')})`
      ).all(...ids)
      targetServers = servers
    } else if (j.server_name) {
      targetServers = [{ id: j.server_id, friendly_name: j.server_name }]
    }
    return {
      id: j.id,
      status: j.status,
      created_at: j.created_at,
      started_at: j.started_at,
      finished_at: j.finished_at,
      server_id: j.server_id,
      server_ids: j.server_ids,
      playbook_id: j.playbook_id,
      target_servers: targetServers,
      playbooks: j.playbook_name ? { name: j.playbook_name } : null,
    }
  }))
})

router.post('/', (req, res) => {
  const { serverId, serverIds, playbookId, vaultPassword } = req.body
  const ids = serverIds || (serverId ? [serverId] : [])
  if (ids.length === 0 || !playbookId) return res.status(400).json({ error: 'serverIds and playbookId required' })

  const placeholders = ids.map(() => '?').join(',')
  const servers = db.prepare(`SELECT id, user_id FROM target_servers WHERE id IN (${placeholders})`).all(...ids)
  if (servers.length !== ids.length) return res.status(404).json({ error: 'One or more servers not found' })

  const playbook = db.prepare('SELECT id FROM playbooks WHERE id = ?').get(playbookId)
  if (!playbook) return res.status(404).json({ error: 'Playbook not found' })

  const id = genId()
  const serverIdsJson = JSON.stringify(ids)
  db.prepare(`
    INSERT INTO ansible_jobs (id, user_id, server_id, server_ids, playbook_id, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, req.user.id, ids[0], serverIdsJson, playbookId)

  const job = { id, user_id: req.user.id, server_id: ids[0], server_ids: serverIdsJson, playbook_id: playbookId, status: 'pending', vaultPassword: vaultPassword || null }

  executeJob(job)

  res.json({ id })
})

export default router
