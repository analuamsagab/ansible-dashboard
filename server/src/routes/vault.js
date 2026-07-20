import { Router } from 'express'
import db, { genId } from '../db.js'
import { authMiddleware } from '../auth.js'
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'

const router = Router()
router.use(authMiddleware)

function writePasswordFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'vault-'))
  const path = join(dir, 'password')
  writeFileSync(path, content, 'utf-8')
  return { dir, path }
}

function vaultExec(args) {
  try {
    return execSync(`ansible-vault ${args.join(' ')}`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    if (e.stdout) return e.stdout
    throw new Error(e.stderr || e.message)
  }
}

router.get('/', (req, res) => {
  const items = db.prepare(
    'SELECT id, name, description, created_at FROM vault_items WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.id)
  res.json(items)
})

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM vault_items WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!item) return res.status(404).json({ error: 'Vault item not found' })
  res.json(item)
})

router.post('/', (req, res) => {
  const { name, description, content, vaultPassword } = req.body
  if (!name || !content || !vaultPassword) {
    return res.status(400).json({ error: 'name, content, and vaultPassword are required' })
  }

  const pwDir = writePasswordFile(vaultPassword)
  const contentFile = join(pwDir.dir, 'plaintext')

  try {
    writeFileSync(contentFile, content, 'utf-8')
    vaultExec([`encrypt --vault-password-file="${pwDir.path}" "${contentFile}"`])
    const encryptedContent = readFileSync(contentFile, 'utf-8')

    const id = genId()
    db.prepare(
      'INSERT INTO vault_items (id, user_id, name, description, encrypted_content) VALUES (?, ?, ?, ?, ?)'
    ).run(id, req.user.id, name, description || null, encryptedContent)

    res.json({ id, name, description: description || null })
  } finally {
    try { unlinkSync(contentFile) } catch {}
    try { rmSync(pwDir.dir, { recursive: true, force: true }) } catch {}
  }
})

router.post('/decrypt', (req, res) => {
  const { id, vaultPassword } = req.body
  if (!id || !vaultPassword) return res.status(400).json({ error: 'id and vaultPassword are required' })

  const item = db.prepare('SELECT * FROM vault_items WHERE id = ? AND user_id = ?')
    .get(id, req.user.id)
  if (!item) return res.status(404).json({ error: 'Vault item not found' })

  const pwDir = writePasswordFile(vaultPassword)
  const encryptedFile = join(pwDir.dir, 'encrypted')

  try {
    writeFileSync(encryptedFile, item.encrypted_content, 'utf-8')
    vaultExec([`decrypt --vault-password-file="${pwDir.path}" "${encryptedFile}"`])
    const content = readFileSync(encryptedFile, 'utf-8')
    res.json({ content })
  } catch (e) {
    res.status(400).json({ error: 'Failed to decrypt: incorrect vault password?' })
  } finally {
    try { unlinkSync(encryptedFile) } catch {}
    try { rmSync(pwDir.dir, { recursive: true, force: true }) } catch {}
  }
})

router.post('/rekey', (req, res) => {
  const { id, oldPassword, newPassword } = req.body
  if (!id || !oldPassword || !newPassword) {
    return res.status(400).json({ error: 'id, oldPassword, and newPassword are required' })
  }

  const item = db.prepare('SELECT * FROM vault_items WHERE id = ? AND user_id = ?')
    .get(id, req.user.id)
  if (!item) return res.status(404).json({ error: 'Vault item not found' })

  const pwDir = writePasswordFile(oldPassword)
  const newPwDir = writePasswordFile(newPassword)
  const encryptedFile = join(pwDir.dir, 'encrypted')

  try {
    writeFileSync(encryptedFile, item.encrypted_content, 'utf-8')
    vaultExec([
      `rekey --vault-password-file="${pwDir.path}" --new-vault-password-file="${newPwDir.path}" "${encryptedFile}"`,
    ])
    const newEncrypted = readFileSync(encryptedFile, 'utf-8')
    db.prepare('UPDATE vault_items SET encrypted_content = ? WHERE id = ?')
      .run(newEncrypted, id)
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ error: 'Failed to rekey: incorrect old vault password?' })
  } finally {
    try { unlinkSync(encryptedFile) } catch {}
    try { rmSync(pwDir.dir, { recursive: true, force: true }) } catch {}
    try { rmSync(newPwDir.dir, { recursive: true, force: true }) } catch {}
  }
})

router.put('/:id', (req, res) => {
  const { name, description, content, vaultPassword } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  const item = db.prepare('SELECT * FROM vault_items WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)
  if (!item) return res.status(404).json({ error: 'Vault item not found' })

  if (content && vaultPassword) {
    const pwDir = writePasswordFile(vaultPassword)
    const contentFile = join(pwDir.dir, 'plaintext')

    try {
      writeFileSync(contentFile, content, 'utf-8')
      vaultExec([`encrypt --vault-password-file="${pwDir.path}" "${contentFile}"`])
      const newEncrypted = readFileSync(contentFile, 'utf-8')
      db.prepare(
        'UPDATE vault_items SET name = ?, description = ?, encrypted_content = ? WHERE id = ? AND user_id = ?'
      ).run(name, description || null, newEncrypted, req.params.id, req.user.id)
    } finally {
      try { unlinkSync(contentFile) } catch {}
      try { rmSync(pwDir.dir, { recursive: true, force: true }) } catch {}
    }
  } else {
    db.prepare(
      'UPDATE vault_items SET name = ?, description = ? WHERE id = ? AND user_id = ?'
    ).run(name, description || null, req.params.id, req.user.id)
  }

  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM vault_items WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ success: true })
})

export default router
