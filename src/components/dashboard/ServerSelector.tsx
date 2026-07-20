import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { motion } from 'framer-motion'
import { Server, EthernetPort, CheckCircle, Plus } from 'lucide-react'
import { CardSkeleton } from '../ui/Skeleton'

interface Server {
  id: string
  friendly_name: string
  ip_address: string
  ssh_port: number
  ssh_user: string
}

interface ServerSelectorProps {
  selectedIds: string[]
  onSelect: (servers: Server[]) => void
}

export function ServerSelector({ selectedIds, onSelect }: ServerSelectorProps) {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getServers().then((data) => {
      setServers(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const toggleServer = (s: Server) => {
    const newIds = selectedIds.includes(s.id)
      ? selectedIds.filter(id => id !== s.id)
      : [...selectedIds, s.id]
    onSelect(servers.filter(x => newIds.includes(x.id)))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Server className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-gray-200">Target Servers</h2>
        {selectedIds.length > 0 && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            {selectedIds.length} selected
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="min-w-[180px]"><CardSkeleton /></div>
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm bg-gray-900/50 rounded-lg border border-gray-800">
          No servers available. Add one in the Servers section.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {servers.map((s) => {
            const isSelected = selectedIds.includes(s.id)
            return (
              <motion.button
                key={s.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleServer(s)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-emerald-900/20 border-emerald-600/50 text-emerald-300 shadow-sm shadow-emerald-900/20'
                    : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:bg-gray-800/70 hover:border-gray-600 hover:text-gray-200'
                }`}
              >
                <div className={`p-1 rounded ${isSelected ? 'bg-emerald-500/20' : 'bg-gray-700/50'}`}>
                  {isSelected ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate max-w-[140px]">{s.friendly_name}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[140px]">
                    <EthernetPort className="w-2.5 h-2.5 inline mr-0.5" />
                    {s.ssh_user}@{s.ip_address}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}
