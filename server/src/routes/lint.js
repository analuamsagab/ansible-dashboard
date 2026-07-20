import { Router } from 'express'
import { authMiddleware } from '../auth.js'
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const router = Router()
router.use(authMiddleware)

router.post('/', (req, res) => {
  const { content } = req.body
  if (!content) return res.status(400).json({ error: 'content is required' })

  const tmpDir = mkdtempSync(join(tmpdir(), 'ansible-lint-'))
  const playbookPath = join(tmpDir, 'playbook.yml')
  writeFileSync(playbookPath, content)

  try {
    const stdout = execSync(
      `ansible-lint --format json "${playbookPath}"`,
      { timeout: 30000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    res.json({ issues: JSON.parse(stdout.trim() || '[]') })
  } catch (e) {
    if (e.stdout) {
      try { return res.json({ issues: JSON.parse(e.stdout.trim() || '[]') }) } catch {}
    }
    res.json({ issues: [], error: e.stderr || e.message })
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

export default router
