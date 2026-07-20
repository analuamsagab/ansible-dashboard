import { Router } from 'express'
import db, { genId } from '../db.js'
import { authMiddleware } from '../auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const playbooks = db.prepare(`
    SELECT id, name, description, content_yaml, is_system_default, created_at
    FROM playbooks
    WHERE is_system_default = 1 OR user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id)
  res.json(playbooks)
})

router.post('/', (req, res) => {
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

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM playbooks WHERE id = ? AND user_id = ? AND is_system_default = 0').run(req.params.id, req.user.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Playbook not found or cannot be deleted' })
  res.json({ success: true })
})

export default router
