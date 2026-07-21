import { Router } from 'express'
import db, { genId } from '../db.js'
import { authMiddleware, requirePermission } from '../auth.js'
import { extractTemplateRefs } from '../utils.js'

const router = Router()
router.use(authMiddleware)

router.get('/', requirePermission('templates', 'view'), (req, res) => {
  const templates = db.prepare(
    'SELECT id, name, filename, created_at FROM templates WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id)
  res.json(templates)
})

router.get('/:id', requirePermission('templates', 'view'), (req, res) => {
  const t = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!t) return res.status(404).json({ error: 'Template not found' })
  res.json(t)
})

router.post('/', requirePermission('templates', 'execute'), (req, res) => {
  const { name, filename, content } = req.body
  if (!name || !filename || content === undefined) {
    return res.status(400).json({ error: 'name, filename, and content are required' })
  }
  const id = genId()
  db.prepare('INSERT INTO templates (id, user_id, name, filename, content) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, name, filename, content)
  res.json({ id, name, filename })
})

router.post('/detect', requirePermission('templates', 'execute'), (req, res) => {
  const { content_yaml } = req.body
  if (!content_yaml) return res.status(400).json({ error: 'content_yaml required' })

  const refs = extractTemplateRefs(content_yaml)
  if (refs.length === 0) return res.json({ found: [], missing: [] })

  const placeholders = refs.map(() => '?').join(',')
  const matched = db.prepare(
    `SELECT filename FROM templates WHERE user_id = ? AND filename IN (${placeholders})`
  ).all(req.user.id, ...refs)
  const matchedNames = matched.map(t => t.filename)
  const missing = refs.filter(f => !matchedNames.includes(f))

  res.json({ found: matchedNames, missing })
})

router.put('/:id', requirePermission('templates', 'execute'), (req, res) => {
  const existing = db.prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)
  if (!existing) return res.status(404).json({ error: 'Template not found' })
  const { name, filename, content } = req.body
  db.prepare('UPDATE templates SET name = ?, filename = ?, content = ? WHERE id = ? AND user_id = ?')
    .run(name, filename, content, req.params.id, req.user.id)
  res.json({ success: true })
})

router.delete('/:id', requirePermission('templates', 'execute'), (req, res) => {
  db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ success: true })
})

export default router
