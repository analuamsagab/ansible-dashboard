import { Router } from 'express'
import db, { genId } from '../db.js'
import { authMiddleware, requirePermission } from '../auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', requirePermission('playbooks', 'view'), (req, res) => {
  const playbooks = db.prepare(`
    SELECT id, name, description, content_yaml, is_system_default, created_at
    FROM playbooks
    WHERE is_system_default = 1 OR user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id)
  res.json(playbooks)
})

router.post('/', requirePermission('playbooks', 'execute'), (req, res) => {
  const { name, description, content_yaml, is_system_default } = req.body
  if (!name || !content_yaml) return res.status(400).json({ error: 'name and content_yaml required' })

  const id = genId()
  db.prepare(`
    INSERT INTO playbooks (id, user_id, name, description, content_yaml, is_system_default)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, name, description || null, content_yaml, is_system_default ? 1 : 0)

  const playbook = db.prepare('SELECT id, name, description, content_yaml, is_system_default, created_at FROM playbooks WHERE id = ?').get(id)
  res.json(playbook)
})

router.put('/:id', requirePermission('playbooks', 'execute'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM playbooks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
    if (!existing) return res.status(404).json({ error: 'Playbook not found' })

    const { name, description, content_yaml } = req.body
    const updates = []
    const values = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (content_yaml !== undefined) { updates.push('content_yaml = ?'); values.push(content_yaml) }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' })

    values.push(req.params.id, req.user.id)
    db.prepare(`UPDATE playbooks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requirePermission('playbooks', 'execute'), (req, res) => {
  try {
    db.prepare('DELETE FROM ansible_jobs WHERE playbook_id = ? AND user_id = ?').run(req.params.id, req.user.id)
    const info = db.prepare('DELETE FROM playbooks WHERE id = ? AND user_id = ? AND is_system_default = 0').run(req.params.id, req.user.id)
    if (info.changes === 0) return res.status(404).json({ error: 'Playbook not found or cannot be deleted' })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
