import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db, { genId } from './db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) return res.status(409).json({ error: 'Email already registered' })

    const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
    const role = userCount === 0 ? 'admin' : 'engineer'

    const password_hash = await bcrypt.hash(password, 10)
    const id = genId()
    db.prepare('INSERT INTO users (id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)').run(id, email, password_hash, fullName || null, role)

    const permsRow = db.prepare('SELECT permissions FROM role_permissions WHERE role = ?').get(role)
    const permissions = permsRow ? JSON.parse(permsRow.permissions) : {}
    res.json({ user: { id, email, fullName, role, permissions } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
    const permsRow = db.prepare('SELECT permissions FROM role_permissions WHERE role = ?').get(user.role)
    const permissions = permsRow ? JSON.parse(permsRow.permissions) : {}
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role, permissions } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/me', (req, res) => {
  try {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })

    const decoded = jwt.verify(auth.slice(7), JWT_SECRET)
    const user = db.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?').get(decoded.id)
    if (!user) return res.status(401).json({ error: 'User not found' })

    const permsRow = db.prepare('SELECT permissions FROM role_permissions WHERE role = ?').get(user.role)
    const permissions = permsRow ? JSON.parse(permsRow.permissions) : {}

    res.json({ id: user.id, email: user.email, fullName: user.full_name, role: user.role, permissions })
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router

export function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' })
    req.user = jwt.verify(auth.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export function getRolePermissions(role) {
  const row = db.prepare('SELECT permissions FROM role_permissions WHERE role = ?').get(role)
  if (row) return JSON.parse(row.permissions)
  return {}
}

export function requirePermission(feature, requiredLevel) {
  return (req, res, next) => {
    const perms = getRolePermissions(req.user.role)
    const level = perms[feature] || 'none'

    if (level === 'none') return res.status(403).json({ error: 'Forbidden' })
    if (requiredLevel === 'view') return next()
    if (requiredLevel === 'execute' && (level === 'execute' || level === 'manage')) return next()
    if (requiredLevel === 'manage' && level === 'manage') return next()

    res.status(403).json({ error: 'Forbidden' })
  }
}
