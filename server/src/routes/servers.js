import { Router } from 'express'
import db, { genId } from '../db.js'
import { authMiddleware, requirePermission } from '../auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', requirePermission('servers', 'view'), (req, res) => {
  const servers = db.prepare(
    'SELECT id, friendly_name, ip_address, ssh_port, ssh_user, created_at FROM target_servers WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id)
  res.json(servers)
})

router.post('/', requirePermission('servers', 'execute'), (req, res) => {
  const { friendly_name, ip_address, ssh_user, ssh_port, encrypted_ssh_key, encrypted_ssh_password } = req.body
  if (!friendly_name || !ip_address) return res.status(400).json({ error: 'friendly_name and ip_address required' })

  const id = genId()
  db.prepare(`
    INSERT INTO target_servers (id, user_id, friendly_name, ip_address, ssh_user, ssh_port, encrypted_ssh_key, encrypted_ssh_password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, friendly_name, ip_address, ssh_user || 'root', ssh_port || 22, encrypted_ssh_key || null, encrypted_ssh_password || null)

  const server = db.prepare('SELECT id, friendly_name, ip_address, ssh_port, ssh_user, created_at FROM target_servers WHERE id = ?').get(id)
  res.json(server)
})

router.put('/:id', requirePermission('servers', 'execute'), (req, res) => {
  const existing = db.prepare('SELECT id FROM target_servers WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!existing) return res.status(404).json({ error: 'Server not found' })

  const { friendly_name, ip_address, ssh_user, ssh_port, encrypted_ssh_key, encrypted_ssh_password } = req.body

  const updates = []
  const values = []

  if (friendly_name !== undefined) { updates.push('friendly_name = ?'); values.push(friendly_name) }
  if (ip_address !== undefined) { updates.push('ip_address = ?'); values.push(ip_address) }
  if (ssh_user !== undefined) { updates.push('ssh_user = ?'); values.push(ssh_user) }
  if (ssh_port !== undefined) { updates.push('ssh_port = ?'); values.push(ssh_port) }
  if (encrypted_ssh_key !== undefined) { updates.push('encrypted_ssh_key = ?'); values.push(encrypted_ssh_key || null) }
  if (encrypted_ssh_password !== undefined) { updates.push('encrypted_ssh_password = ?'); values.push(encrypted_ssh_password || null) }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' })

  values.push(req.params.id)
  db.prepare(`UPDATE target_servers SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  const server = db.prepare('SELECT id, friendly_name, ip_address, ssh_port, ssh_user, created_at FROM target_servers WHERE id = ?').get(req.params.id)
  res.json(server)
})

router.delete('/:id', requirePermission('servers', 'execute'), (req, res) => {
  try {
    db.prepare('UPDATE ansible_jobs SET server_id = NULL WHERE server_id = ?').run(req.params.id)
    const info = db.prepare('DELETE FROM target_servers WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
    if (info.changes === 0) return res.status(404).json({ error: 'Server not found' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
