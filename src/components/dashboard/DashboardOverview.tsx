import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import { Server, Play, CheckCircle, XCircle } from 'lucide-react'
import { ServerSelector } from './ServerSelector'

interface Stats {
  servers: number
  jobsTotal: number
  jobsSuccess: number
  jobsFailed: number
}

interface DashboardOverviewProps {
  selectedServerId: string | null
  onSelectServer: (server: { id: string; friendly_name: string; ip_address: string; ssh_port: number; ssh_user: string } | null) => void
}

export function DashboardOverview({ selectedServerId, onSelectServer }: DashboardOverviewProps) {
  const [stats, setStats] = useState<Stats>({ servers: 0, jobsTotal: 0, jobsSuccess: 0, jobsFailed: 0 })

  useEffect(() => {
    Promise.all([
      supabase.from('target_servers').select('id', { count: 'exact', head: true }),
      supabase.from('ansible_jobs').select('id', { count: 'exact', head: true }),
      supabase.from('ansible_jobs').select('id', { count: 'exact', head: true }).eq('status', 'success'),
      supabase.from('ansible_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    ]).then(([s, t, su, f]) => {
      setStats({
        servers: s.count ?? 0,
        jobsTotal: t.count ?? 0,
        jobsSuccess: su.count ?? 0,
        jobsFailed: f.count ?? 0,
      })
    })
  }, [])

  const cards = [
    { icon: Server, label: 'Servers', value: stats.servers, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Play, label: 'Total Jobs', value: stats.jobsTotal, color: 'text-gray-300', bg: 'bg-gray-500/10' },
    { icon: CheckCircle, label: 'Successful', value: stats.jobsSuccess, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: XCircle, label: 'Failed', value: stats.jobsFailed, color: 'text-red-400', bg: 'bg-red-500/10' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-4 flex items-center gap-3"
          >
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-100">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl p-4"
      >
        <ServerSelector selectedId={selectedServerId} onSelect={onSelectServer} />
      </motion.div>
    </div>
  )
}
