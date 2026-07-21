import { useState, useRef, useEffect } from 'react'
import { api } from '../../lib/api'
import { useFetch } from '../../hooks/useFetch'
import { useAuth } from '../../context/AuthContext'
import { motion } from 'framer-motion'
import { ScrollText, Upload, Trash2, FileText, Code, CheckSquare, Pencil } from 'lucide-react'
import { YamlEditor } from './YamlEditor'
import { LintResults } from './LintResults'
import { Modal } from '../ui/Modal'

interface Playbook {
  id: string
  name: string
  description: string | null
  content_yaml: string
  is_system_default: boolean
  created_at: string
}

export function PlaybookManager() {
  const { can } = useAuth()
  const [tab, setTab] = useState<'upload' | 'custom' | 'saved'>(can('playbooks', 'execute') ? 'custom' : 'saved')
  const [customName, setCustomName] = useState('')
  const [customYaml, setCustomYaml] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [lintIssues, setLintIssues] = useState<{ line: number; column: number; severity: string; message: string; tag: string }[] | null>(null)
  const [linting, setLinting] = useState(false)
  const [lintError, setLintError] = useState<string | undefined>()
  const [savedLintIssues, setSavedLintIssues] = useState<Record<string, { issues: typeof lintIssues; error?: string }>>({})

  const [savedPlaybooks, setSavedPlaybooks] = useState<Playbook[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)

  const [editTarget, setEditTarget] = useState<Playbook | null>(null)
  const [editName, setEditName] = useState('')
  const [editYaml, setEditYaml] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    if (tab === 'saved') fetchSaved()
  }, [tab])

  const fetchSaved = async () => {
    setLoadingSaved(true)
    try {
      const data = await api.getPlaybooks()
      setSavedPlaybooks(data.filter(p => !p.is_system_default))
    } catch {}
    setLoadingSaved(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((content) => {
      const name = file.name.replace(/\.(yml|yaml)$/i, '')
      setCustomName(name)
      setCustomYaml(content)
      setTab('custom')
      setMessage({ type: 'success', text: `File "${file.name}" loaded` })
    })
  }

  const handleSave = async () => {
    if (!customYaml) return
    setMessage(null)
    setSaving(true)

    try {
      await api.createPlaybook({
        name: customName || 'Untitled Playbook',
        content_yaml: customYaml,
        is_system_default: false,
      })
      setMessage({ type: 'success', text: 'Playbook saved successfully' })
      setCustomName('')
      setCustomYaml('')
    } catch (err: unknown) {
      setMessage({ type: 'error', text: (err as Error).message })
    }
    setSaving(false)
  }

  const handleLint = async (content: string) => {
    setLintIssues(null)
    setLintError(undefined)
    if (!content) return
    setLinting(true)
    try {
      const result = await api.lintPlaybook(content)
      setLintIssues(result.issues)
    } catch (err: unknown) {
      setLintError((err as Error).message)
    }
    setLinting(false)
  }

  const handleLintSaved = async (playbookId: string, content: string) => {
    if (savedLintIssues[playbookId]) return
    try {
      const result = await api.lintPlaybook(content)
      setSavedLintIssues(prev => ({ ...prev, [playbookId]: { issues: result.issues } }))
    } catch (err: unknown) {
      setSavedLintIssues(prev => ({ ...prev, [playbookId]: { issues: null, error: (err as Error).message } }))
    }
  }

  const handleEditStart = (p: Playbook) => {
    setEditTarget(p)
    setEditName(p.name)
    setEditYaml(p.content_yaml)
  }

  const handleSaveEdit = async () => {
    if (!editTarget || !editName || !editYaml) return
    setEditSaving(true)
    try {
      await api.updatePlaybook(editTarget.id, { name: editName, content_yaml: editYaml })
      setEditTarget(null)
      fetchSaved()
    } catch {}
    setEditSaving(false)
  }

  const handleDelete = async (id: string) => {
    await api.deletePlaybook(id)
    fetchSaved()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-emerald-400" />
        Playbook Manager
      </h2>

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
        {[
          ...(can('playbooks', 'execute') ? [
            { id: 'custom' as const, label: 'Custom', icon: Code },
            { id: 'upload' as const, label: 'Upload', icon: Upload },
          ] : []),
          { id: 'saved' as const, label: 'Saved', icon: FileText },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-md transition-all font-medium ${
              tab === t.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'upload' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-dashed border-gray-700 hover:border-emerald-600/50 rounded-xl p-8 text-center transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">Click to upload a YAML playbook file</p>
          <p className="text-xs text-gray-600">.yml or .yaml files</p>
          <input ref={fileInputRef} type="file" accept=".yml,.yaml" className="hidden" onChange={handleFileUpload} />
        </motion.div>
      )}

      {tab === 'custom' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Playbook name"
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <YamlEditor
            value={customYaml}
            onChange={setCustomYaml}
            placeholder="Write your Ansible playbook YAML here..."
            minHeight="280px"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleLint(customYaml)}
              disabled={linting || !customYaml}
              className="flex items-center justify-center gap-1.5 flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-gray-200"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {linting ? 'Linting...' : 'Lint'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !customYaml}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-white"
            >
              {saving ? 'Saving...' : 'Save Playbook'}
            </button>
          </div>
          {lintIssues !== null && (
            <LintResults issues={lintIssues} loading={false} />
          )}
          {lintError && (
            <LintResults issues={[]} error={lintError} />
          )}
        </motion.div>
      )}

      {tab === 'saved' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1.5"
        >
          {loadingSaved ? (
            <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
          ) : savedPlaybooks.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">No saved playbooks yet</div>
          ) : (
            <>
              {savedPlaybooks.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="group flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/70 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg bg-gray-700/50">
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {can('playbooks', 'execute') && (
                      <button
                        onClick={() => handleEditStart(p)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleLintSaved(p.id, p.content_yaml)}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                      title="Lint"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                    </button>
                    {can('playbooks', 'execute') && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
              {Object.entries(savedLintIssues).map(([id, result]) => {
                const playbook = savedPlaybooks.find(p => p.id === id)
                if (!playbook) return null
                return (
                  <div key={`lint-${id}`} className="mt-2">
                    <LintResults issues={result.issues || []} error={result.error} />
                  </div>
                )
              })}
            </>
          )}
        </motion.div>
      )}

      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {message.text}
        </motion.p>
      )}

      <Modal open={!!editTarget} title={`Edit: ${editTarget?.name || ''}`} onClose={() => setEditTarget(null)}>
        <div className="space-y-3">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Playbook name"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <YamlEditor
            value={editYaml}
            onChange={setEditYaml}
            placeholder="Write your Ansible playbook YAML here..."
            minHeight="300px"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={editSaving || !editName || !editYaml}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors text-white"
            >
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setEditTarget(null)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
