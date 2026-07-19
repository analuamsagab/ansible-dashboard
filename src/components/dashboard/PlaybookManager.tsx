import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import { ScrollText, Upload, Trash2, FileText, Code } from 'lucide-react'
import { YamlEditor } from './YamlEditor'

interface Playbook {
  id: string
  name: string
  description: string | null
  content_yaml: string
  is_system_default: boolean
  created_at: string
}

export function PlaybookManager() {
  const [tab, setTab] = useState<'upload' | 'custom' | 'saved'>('custom')
  const [customName, setCustomName] = useState('')
  const [customYaml, setCustomYaml] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [savedPlaybooks, setSavedPlaybooks] = useState<Playbook[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)

  useEffect(() => {
    if (tab === 'saved') fetchSaved()
  }, [tab])

  const fetchSaved = async () => {
    setLoadingSaved(true)
    const { data } = await supabase
      .from('playbooks')
      .select('id, name, description, content_yaml, is_system_default, created_at')
      .eq('is_system_default', false)
      .order('created_at', { ascending: false })
    if (data) setSavedPlaybooks(data)
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

    const { error } = await supabase.from('playbooks').insert({
      name: customName || 'Untitled Playbook',
      content_yaml: customYaml,
      is_system_default: false,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Playbook saved successfully' })
      setCustomName('')
      setCustomYaml('')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('playbooks').delete().eq('id', id)
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
          { id: 'custom', label: 'Custom', icon: Code },
          { id: 'upload', label: 'Upload', icon: Upload },
          { id: 'saved', label: 'Saved', icon: FileText },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
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
          <button
            onClick={handleSave}
            disabled={saving || !customYaml}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-white"
          >
            {saving ? 'Saving...' : 'Save Playbook'}
          </button>
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
            savedPlaybooks.map((p) => (
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
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))
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
    </div>
  )
}
