import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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
  const [loading, setLoading] = useState(false)

  const fetchServers = async () => {
    const { data } = await supabase
      .from('target_servers')
      .select('id, friendly_name, ip_address, ssh_port, ssh_user')
      .order('created_at', { ascending: false })
    if (data) setServers(data)
  }

  useEffect(() => { fetchServers() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.from('target_servers').insert({
      friendly_name: friendlyName,
      ip_address: ipAddress,
      ssh_port: parseInt(sshPort),
      ssh_user: sshUser,
      encrypted_ssh_key: sshKey || null,
    })
    setFriendlyName('')
    setIpAddress('')
    setSshUser('root')
    setSshPort('22')
    setSshKey('')
    setShowForm(false)
    setLoading(false)
    fetchServers()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('target_servers').delete().eq('id', id)
    fetchServers()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Target Servers</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Server'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 bg-gray-800 p-3 rounded-lg border border-gray-700">
          <input
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            placeholder="Friendly name (e.g. Prod-01)"
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            required
          />
          <input
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            placeholder="IP address (e.g. 192.168.1.100)"
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            required
          />
          <div className="flex gap-2">
            <input
              value={sshUser}
              onChange={(e) => setSshUser(e.target.value)}
              placeholder="SSH user"
              className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
            <input
              value={sshPort}
              onChange={(e) => setSshPort(e.target.value)}
              placeholder="Port"
              className="w-20 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>
          <textarea
            value={sshKey}
            onChange={(e) => setSshKey(e.target.value)}
            placeholder="SSH private key (paste or leave empty for password auth)"
            rows={3}
            className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-sm font-medium transition-colors"
          >
            {loading ? 'Saving...' : 'Save Server'}
          </button>
        </form>
      )}

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {servers.map((s) => (
          <div
            key={s.id}
            onClick={() => onSelect(selectedId === s.id ? null : s)}
            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
              selectedId === s.id
                ? 'bg-emerald-900/40 border border-emerald-700'
                : 'bg-gray-800/50 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            <div>
              <p className="text-sm font-medium text-gray-200">{s.friendly_name}</p>
              <p className="text-xs text-gray-400">{s.ssh_user}@{s.ip_address}:{s.ssh_port}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          </div>
        ))}
        {servers.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No servers added yet</p>
        )}
      </div>
    </div>
  )
}
