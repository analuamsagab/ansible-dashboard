import { useState, useRef } from 'react'
import { api } from '../../lib/api'
import { useFetch } from '../../hooks/useFetch'
import { motion } from 'framer-motion'
import { FileText, Upload, Trash2, Pencil, Plus } from 'lucide-react'
import { Modal } from '../ui/Modal'

interface Template {
  id: string
  name: string
  filename: string
  created_at: string
}

export function TemplateManager() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [filename, setFilename] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editTarget, setEditTarget] = useState<Template | null>(null)
  const [editName, setEditName] = useState('')
  const [editFilename, setEditFilename] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  const { data: templatesRaw, loading, refetch } = useFetch<Template[]>(() => api.getTemplates(), [])
  const templates = templatesRaw ?? []

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((c) => {
      setContent(c)
      const base = file.name.replace(/\.j2$/i, '')
      if (!name) setName(base)
      setFilename(file.name)
    })
  }

  const handleCreate = async () => {
    if (!name || !filename || !content) return
    setSaving(true)
    setError(null)
    try {
      await api.createTemplate({ name, filename, content })
      setName('')
      setFilename('')
      setContent('')
      setShowForm(false)
      refetch()
    } catch (err: unknown) {
      setError((err as Error).message)
    }
    setSaving(false)
  }

  const startEdit = async (t: Template) => {
    setEditTarget(t)
    setEditName(t.name)
    setEditFilename(t.filename)
    setEditContent('')
    setEditSaving(false)
    try {
      const full = await api.getTemplate(t.id)
      setEditContent(full.content)
    } catch {}
  }

  const handleEditUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((c) => {
      setEditContent(c)
      setEditFilename(file.name)
    })
  }

  const handleSaveEdit = async () => {
    if (!editTarget || !editName || !editFilename) return
    setEditSaving(true)
    try {
      await api.updateTemplate(editTarget.id, { name: editName, filename: editFilename, content: editContent })
      setEditTarget(null)
      refetch()
    } catch {}
    setEditSaving(false)
  }

  const handleDelete = async (id: string) => {
    await api.deleteTemplate(id)
    refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          Templates
        </h2>
        <button
          onClick={() => { setShowForm(!showForm); setError(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <div className="flex gap-2">
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="filename.j2"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 border border-gray-700 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              <input ref={fileInputRef} type="file" accept=".j2" className="hidden" onChange={handleFileUpload} />
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="{# Jinja2 template content #}"
            rows={8}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-600 resize-y"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name || !filename || !content}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors text-white"
            >
              {saving ? 'Saving...' : 'Save Template'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </motion.div>
      )}

      <div className="space-y-1.5">
        {loading ? (
          <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No templates yet</div>
        ) : (
          templates.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/70 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-lg bg-gray-700/50">
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{t.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {t.filename} &middot; {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => startEdit(t)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Modal open={!!editTarget} title={`Edit: ${editTarget?.name || ''}`} onClose={() => setEditTarget(null)}>
          <div className="space-y-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Template name"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
            />
            <div className="flex gap-2">
              <input
                value={editFilename}
                onChange={(e) => setEditFilename(e.target.value)}
                placeholder="filename.j2"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                className="px-3 py-2 text-sm text-gray-400 hover:text-gray-200 bg-gray-800 border border-gray-700 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" />
                <input ref={editFileInputRef} type="file" accept=".j2" className="hidden" onChange={handleEditUpload} />
              </button>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="{# Jinja2 template content #}"
              rows={12}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-600 resize-y"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editName || !editFilename}
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
