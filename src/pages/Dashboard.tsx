import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ServerManager } from '../components/dashboard/ServerManager'
import { PlaybookTrigger } from '../components/dashboard/PlaybookTrigger'
import { TerminalView } from '../components/dashboard/TerminalView'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!activeJobId) return

    const channel = supabase
      .channel(`ansible-jobs:${activeJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ansible_jobs',
          filter: `id=eq.${activeJobId}`,
        },
        (payload) => {
          setJobStatus(payload.new.status)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeJobId])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleJobCreated = (jobId: string) => {
    setActiveJobId(jobId)
    setJobStatus('pending')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Ansible Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors text-gray-300"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 lg:p-6">
        <div className="lg:col-span-1 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <ServerManager
            onSelect={(s) => setSelectedServerId(s?.id ?? null)}
            selectedId={selectedServerId}
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <PlaybookTrigger
              serverId={selectedServerId}
              onJobCreated={handleJobCreated}
            />
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <TerminalView jobId={activeJobId} status={jobStatus} />
          </div>
        </div>
      </div>
    </div>
  )
}
