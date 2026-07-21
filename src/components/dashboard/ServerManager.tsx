import { useState } from 'react'
import { api } from '../../lib/api'
import { useFetch } from '../../hooks/useFetch'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Server, Plus, Trash2, EthernetPort, User, Key, Lock, Pencil } from 'lucide-react'
import { CardSkeleton } from '../ui/Skeleton'
import { Modal } from '../ui/Modal'

interface Server {
  id: string
  friendly_name: string
  ip_address: string
  ssh_port: number
  ssh_user: string
}

export function ServerManager() {
  const { can } = useAuth()
  const { data: serversRaw, loading, refetch } = useFetch<Server[]>(() => api.getServers(), [])
  const servers = serversRaw ?? []
  const [showForm, setShowForm] = useState(false)
  const [friendlyName, setFriendlyName] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [sshPort, setSshPort] = useState('22')
  const [sshKey, setSshKey] = useState('')
  const [sshPassword, setSshPassword] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [editTarget, setEditTarget] = useState<Server | null>(null)
  const [editFriendlyName, setEditFriendlyName] = useState('')
  const [editIpAddress, setEditIpAddress] = useState('')
  const [editSshUser, setEditSshUser] = useState('')
  const [editSshPort, setEditSshPort] = useState('')
  const [editSshKey, setEditSshKey] = useState('')
  const [editSshPassword, setEditSshPassword] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    if (!sshKey && !sshPassword) { setErrorMessage('SSH key or password is required'); return }

    try {
      await api.createServer({
        friendly_name: friendlyName,
        ip_address: ipAddress,
        ssh_user: sshUser,
        ssh_port: parseInt(sshPort),
        encrypted_ssh_key: sshKey || null,
        encrypted_ssh_password: sshPassword || null,
      })
      setFriendlyName(''); setIpAddress(''); setSshUser('root'); setSshPort('22')
      setSshKey(''); setSshPassword(''); setShowForm(false)
      refetch()
    } catch (err: unknown) {
      setErrorMessage((err as Error).message)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await api.deleteServer(id)
    setDeleting(null)
    refetch()
  }

  const openEdit = (s: Server) => {
    setEditTarget(s)
    setEditFriendlyName(s.friendly_name)
    setEditIpAddress(s.ip_address)
    setEditSshUser(s.ssh_user)
    setEditSshPort(String(s.ssh_port))
    setEditSshKey('')
    setEditSshPassword('')
    setEditError(null)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setEditError(null)
    setEditSaving(true)

    try {
      const payload: Record<string, unknown> = {
        friendly_name: editFriendlyName,
        ip_address: editIpAddress,
        ssh_user: editSshUser,
        ssh_port: parseInt(editSshPort),
      }
      if (editSshKey) payload.encrypted_ssh_key = editSshKey
      if (editSshPassword) payload.encrypted_ssh_password = editSshPassword

      await api.updateServer(editTarget.id, payload)
      setEditTarget(null)
      refetch()
    } catch (err: unknown) {
      setEditError((err as Error).message)
    }
    setEditSaving(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          Servers
        </h2>
        {can('servers', 'execute') && (
          <button
            onClick={() => { setShowForm(!showForm); setErrorMessage(null) }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            {showForm ? 'Cancel' : 'Add'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="space-y-2 bg-gray-800/50 p-3 rounded-lg border border-gray-700 overflow-hidden"
          >
            <input value={friendlyName} onChange={(e) => setFriendlyName(e.target.value)} placeholder="Friendly name" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500" required />
            <input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="IP address" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500" required />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={sshUser} onChange={(e) => setSshUser(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none" required />
              </div>
              <input value={sshPort} onChange={(e) => setSshPort(e.target.value)} className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none" required />
            </div>
            <div className="relative">
              <Key className="w-3.5 h-3.5 absolute left-2.5 top-3 text-gray-500" />
              <textarea value={sshKey} onChange={(e) => setSshKey(e.target.value)} placeholder="SSH private key (optional)" rows={2} className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500" />
            </div>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="password" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} placeholder="SSH password (or use key above)" className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500" />
            </div>
            {errorMessage && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-xs">{errorMessage}</motion.p>}
            <button type="submit" disabled={loading} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors text-white">
              {loading ? 'Saving...' : 'Save Server'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-1.5 pt-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : servers.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No servers yet</div>
        ) : (
          servers.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/50 hover:bg-gray-800/70 hover:border-gray-600 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-lg bg-gray-700/50">
                  <Server className="w-4 h-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{s.friendly_name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <EthernetPort className="w-3 h-3" />
                    {s.ssh_user}@{s.ip_address}:{s.ssh_port}
                  </p>
                </div>
              </div>
              {can('servers', 'execute') && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Server">
        <form onSubmit={handleEdit} className="space-y-3">
          <input value={editFriendlyName} onChange={(e) => setEditFriendlyName(e.target.value)} placeholder="Friendly name" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500" required />
          <input value={editIpAddress} onChange={(e) => setEditIpAddress(e.target.value)} placeholder="IP address" className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500" required />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={editSshUser} onChange={(e) => setEditSshUser(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none" required />
            </div>
            <input value={editSshPort} onChange={(e) => setEditSshPort(e.target.value)} className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none" required />
          </div>
          <div className="relative">
            <Key className="w-3.5 h-3.5 absolute left-2.5 top-3 text-gray-500" />
            <textarea value={editSshKey} onChange={(e) => setEditSshKey(e.target.value)} placeholder="SSH private key (leave blank to keep current)" rows={2} className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500" />
          </div>
          <div className="relative">
            <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input type="password" value={editSshPassword} onChange={(e) => setEditSshPassword(e.target.value)} placeholder="SSH password (leave blank to keep current)" className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500" />
          </div>
          {editError && <p className="text-red-400 text-xs">{editError}</p>}
          <button type="submit" disabled={editSaving} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors text-white">
            {editSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
