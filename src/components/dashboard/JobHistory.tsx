import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import { StatusBadge } from '../ui/StatusBadge'
import { TableSkeleton } from '../ui/Skeleton'
import { Search, Clock } from 'lucide-react'

interface Job {
  id: string
  status: string
  created_at: string
  server_id: string
  playbook_id: string
  target_servers: { friendly_name: string } | null
  playbooks: { name: string } | null
}

interface JobHistoryProps {
  onSelectJob: (jobId: string) => void
}

export function JobHistory({ onSelectJob }: JobHistoryProps) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    supabase
      .from('ansible_jobs')
      .select('id, status, created_at, server_id, playbook_id, target_servers(friendly_name), playbooks(name)')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setJobs(data as unknown as Job[])
        setLoading(false)
      })
  }, [])

  const filtered = jobs.filter((j) => {
    const serverName = j.target_servers?.friendly_name || ''
    const playbookName = j.playbooks?.name || ''
    const matchesSearch = serverName.toLowerCase().includes(search.toLowerCase()) ||
      playbookName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !filterStatus || j.status === filterStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-200">Job History</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none w-40"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="timeout">Timeout</option>
          </select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No jobs found</div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {filtered.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onSelectJob(job.id)}
              className="flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700/50 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <StatusBadge status={job.status} pulse={job.status === 'running'} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">
                    {job.playbooks?.name || 'Unknown playbook'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {job.target_servers?.friendly_name || 'Unknown server'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
                <Clock className="w-3 h-3" />
                {new Date(job.created_at).toLocaleString()}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
