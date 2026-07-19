import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import { Server, EthernetPort, CheckCircle } from 'lucide-react'
import { CardSkeleton } from '../ui/Skeleton'

interface Server {
  id: string
  friendly_name: string
  ip_address: string
  ssh_port: number
  ssh_user: string
}

interface ServerSelectorProps {
  selectedId: string | null
  onSelect: (server: Server | null) => void
}

export function ServerSelector({ selectedId, onSelect }: ServerSelectorProps) {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('target_servers')
      .select('id, friendly_name, ip_address, ssh_port, ssh_user')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setServers(data)
        setLoading(false)
      })
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Server className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-gray-200">Target Server</h2>
        {selectedId && (
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            Selected
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
          {servers.map((s) => (
            <motion.button
              key={s.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(selectedId === s.id ? null : s)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                selectedId === s.id
                  ? 'bg-emerald-900/20 border-emerald-600/50 text-emerald-300 shadow-sm shadow-emerald-900/20'
                  : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:bg-gray-800/70 hover:border-gray-600 hover:text-gray-200'
              }`}
            >
              <div className={`p-1 rounded ${selectedId === s.id ? 'bg-emerald-500/20' : 'bg-gray-700/50'}`}>
                {selectedId === s.id ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <Server className="w-3.5 h-3.5" />
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
          ))}
        </div>
      )}
    </div>
  )
}
