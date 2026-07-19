import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { Server, Plus, Trash2, EthernetPort, User, Key, Lock } from 'lucide-react'
import { CardSkeleton } from '../ui/Skeleton'

interface Server {
  id: string
  friendly_name: string
  ip_address: string
  ssh_port: number
  ssh_user: string
}

interface ServerManagerProps {
  onSelect: (server: Server | null) => void
  selectedId: string | null
}

export function ServerManager({ onSelect, selectedId }: ServerManagerProps) {
  const [servers, setServers] = useState<Server[]>([])
  const [showForm, setShowForm] = useState(false)
  const [friendlyName, setFriendlyName] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [sshPort, setSshPort] = useState('22')
  const [sshKey, setSshKey] = useState('')
  const [sshPassword, setSshPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchServers = async () => {
    const { data, error } = await supabase
      .from('target_servers')
      .select('id, friendly_name, ip_address, ssh_port, ssh_user')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('fetchServers error:', error.message, error.details, error.hint)
      setErrorMessage(error.message)
      setLoading(false)
      return
    }
    setServers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchServers() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!sshKey && !sshPassword) {
      setErrorMessage('SSH key or password is required')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('target_servers').insert({
      friendly_name: friendlyName,
      ip_address: ipAddress,
      ssh_port: parseInt(sshPort),
      ssh_user: sshUser,
      encrypted_ssh_key: sshKey || null,
      encrypted_ssh_password: sshPassword || null,
    })

    if (error) {
      console.error('insert server error:', error.message, error.details, error.hint)
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    setFriendlyName('')
    setIpAddress('')
    setSshUser('root')
    setSshPort('22')
    setSshKey('')
    setSshPassword('')
    setShowForm(false)
    setLoading(false)
    fetchServers()
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    const { error } = await supabase.from('target_servers').delete().eq('id', id)
    if (error) {
      console.error('delete server error:', error.message, error.details, error.hint)
      setErrorMessage(error.message)
      setDeleting(null)
      return
    }
    setDeleting(null)
    if (selectedId === id) onSelect(null)
    fetchServers()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          Servers
        </h2>
        <button
          onClick={() => { setShowForm(!showForm); setErrorMessage(null) }}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? 'Cancel' : 'Add'}
        </button>
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
            <input
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="Friendly name"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
              required
            />
            <input
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="IP address"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
              required
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <input
                value={sshPort}
                onChange={(e) => setSshPort(e.target.value)}
                className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div className="relative">
              <Key className="w-3.5 h-3.5 absolute left-2.5 top-3 text-gray-500" />
              <textarea
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                placeholder="SSH private key (optional)"
                rows={2}
                className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
              />
            </div>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                value={sshPassword}
                onChange={(e) => setSshPassword(e.target.value)}
                placeholder="SSH password (or use key above)"
                className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
              />
            </div>
            {errorMessage && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-xs">{errorMessage}</motion.p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors text-white"
            >
              {loading ? 'Saving...' : 'Save Server'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
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
              onClick={() => onSelect(selectedId === s.id ? null : s)}
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                selectedId === s.id
                  ? 'bg-emerald-900/20 border-emerald-700/50 shadow-sm shadow-emerald-900/20'
                  : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800/70 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-lg ${selectedId === s.id ? 'bg-emerald-500/20' : 'bg-gray-700/50'}`}>
                  <Server className={`w-4 h-4 ${selectedId === s.id ? 'text-emerald-400' : 'text-gray-500'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{s.friendly_name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <EthernetPort className="w-3 h-3" />
                    {s.ssh_user}@{s.ip_address}:{s.ssh_port}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                disabled={deleting === s.id}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
