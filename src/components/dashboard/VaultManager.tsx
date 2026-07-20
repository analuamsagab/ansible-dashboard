import { useState } from 'react'
import { api } from '../../lib/api'
import { useFetch } from '../../hooks/useFetch'
import { motion } from 'framer-motion'
import { Lock, Plus, Trash2, Eye, KeyRound, Copy, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import toast from 'react-hot-toast'

interface VaultItem {
  id: string
  name: string
  description: string | null
  created_at: string
}

export function VaultManager() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const [viewTarget, setViewTarget] = useState<VaultItem | null>(null)
  const [viewPassword, setViewPassword] = useState('')
  const [viewContent, setViewContent] = useState<string | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [viewError, setViewError] = useState<string | null>(null)

  const [rekeyTarget, setRekeyTarget] = useState<VaultItem | null>(null)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [rekeying, setRekeying] = useState(false)

  const [copied, setCopied] = useState(false)

  const { data: itemsRaw, loading, refetch } = useFetch<VaultItem[]>(() => api.getVaultItems(), [])
  const items = itemsRaw ?? []

  const handleCreate = async () => {
    if (!name || !content || !vaultPassword) return
    setSaving(true)
    try {
      await api.createVaultItem({ name, description, content, vaultPassword })
      setName('')
      setDescription('')
      setContent('')
      setVaultPassword('')
      setShowForm(false)
      refetch()
      toast.success('Vault item created')
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
    setSaving(false)
  }

  const handleView = async () => {
    if (!viewTarget || !viewPassword) return
    setViewLoading(true)
    setViewContent(null)
    setViewError(null)
    try {
      const result = await api.decryptVaultItem(viewTarget.id, viewPassword)
      setViewContent(result.content)
    } catch (err: unknown) {
      setViewError((err as Error).message)
    }
    setViewLoading(false)
  }

  const handleRekey = async () => {
    if (!rekeyTarget || !oldPassword || !newPassword) return
    setRekeying(true)
    try {
      await api.rekeyVaultItem(rekeyTarget.id, oldPassword, newPassword)
      setRekeyTarget(null)
      setOldPassword('')
      setNewPassword('')
      toast.success('Vault password changed')
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
    setRekeying(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteVaultItem(id)
      refetch()
      toast.success('Vault item deleted')
    } catch {}
  }

  const handleCopy = async () => {
    if (!viewContent) return
    try {
      await navigator.clipboard.writeText(viewContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          Ansible Vault
        </h2>
        <button
          onClick={() => { setShowForm(!showForm) }}
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
            placeholder="Vault item name"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Sensitive content to encrypt (e.g. API keys, passwords, ...)"
            rows={6}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-600 resize-y"
          />
          <input
            value={vaultPassword}
            onChange={(e) => setVaultPassword(e.target.value)}
            type="password"
            placeholder="Vault password"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name || !content || !vaultPassword}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors text-white"
            >
              {saving ? 'Encrypting...' : 'Encrypt & Save'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-1.5">
        {loading ? (
          <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No vault items yet</div>
        ) : (
          items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/70 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-lg bg-gray-700/50">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.description || 'No description'} &middot; {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => { setViewTarget(item); setViewPassword(''); setViewContent(null); setViewError(null) }}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                  title="Decrypt & view"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setRekeyTarget(item); setOldPassword(''); setNewPassword('') }}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
                  title="Change vault password"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Modal open={!!viewTarget} title={`View: ${viewTarget?.name || ''}`} onClose={() => setViewTarget(null)}>
        <div className="space-y-3">
          <input
            value={viewPassword}
            onChange={(e) => setViewPassword(e.target.value)}
            type="password"
            placeholder="Enter vault password to decrypt"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <button
            onClick={handleView}
            disabled={viewLoading || !viewPassword}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors text-white"
          >
            {viewLoading ? 'Decrypting...' : 'Decrypt'}
          </button>
          {viewError && <p className="text-sm text-red-400">{viewError}</p>}
          {viewContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Decrypted content</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-sm text-gray-200 font-mono bg-gray-900 p-3 rounded-lg border border-gray-700 overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
                {viewContent}
              </pre>
            </motion.div>
          )}
        </div>
      </Modal>

      <Modal open={!!rekeyTarget} title={`Rekey: ${rekeyTarget?.name || ''}`} onClose={() => setRekeyTarget(null)}>
        <div className="space-y-3">
          <input
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            type="password"
            placeholder="Current vault password"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            placeholder="New vault password"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRekey}
              disabled={rekeying || !oldPassword || !newPassword}
              className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors text-white"
            >
              {rekeying ? 'Rekeying...' : 'Change Password'}
            </button>
            <button
              onClick={() => setRekeyTarget(null)}
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
