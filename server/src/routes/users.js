import { Router } from 'express'
import db from '../db.js'
import { authMiddleware, requirePermission, getRolePermissions } from '../auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const perms = getRolePermissions(req.user.role)
  if (perms.users === 'none') return res.status(403).json({ error: 'Forbidden' })

  const users = db.prepare(
    'SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at ASC'
  ).all()
  res.json(users)
})

router.put('/:id/role', (req, res) => {
  const perms = getRolePermissions(req.user.role)
  if (perms.users !== 'manage') return res.status(403).json({ error: 'Forbidden' })

  const { role } = req.body
  if (!role) return res.status(400).json({ error: 'role required' })

  const validRoles = ['admin', 'co-admin', 'engineer', 'visitor']
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' })

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'User not found' })

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id)
  res.json({ success: true })
})

router.get('/permissions', (req, res) => {
  const perms = getRolePermissions(req.user.role)
  if (perms.users !== 'manage') return res.status(403).json({ error: 'Forbidden' })

  const rows = db.prepare('SELECT * FROM role_permissions').all()
  const result = {}
  for (const row of rows) {
    result[row.role] = JSON.parse(row.permissions)
  }
  res.json(result)
})

router.put('/permissions/:role', (req, res) => {
  const perms = getRolePermissions(req.user.role)
  if (perms.users !== 'manage') return res.status(403).json({ error: 'Forbidden' })

  const { role } = req.params
  const { permissions } = req.body
  if (!permissions) return res.status(400).json({ error: 'permissions object required' })

  const validRoles = ['admin', 'co-admin', 'engineer', 'visitor']
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' })

  db.prepare('UPDATE role_permissions SET permissions = ? WHERE role = ?').run(JSON.stringify(permissions), role)
  res.json({ success: true })
})

export default router
