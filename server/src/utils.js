import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export function extractTemplateRefs(yaml) {
  const refs = []
  const regex = /^\s+src:\s*(?:templates\/)?(.+)$/gm
  let m
  while ((m = regex.exec(yaml)) !== null) {
    const f = m[1].replace(/["']/g, '').trim()
    if (f && f.endsWith('.j2')) refs.push(f)
  }
  return [...new Set(refs)]
}

export function writePasswordFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'vault-'))
  const path = join(dir, 'password')
  writeFileSync(path, content, 'utf-8')
  return { dir, path }
}
