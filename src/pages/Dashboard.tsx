import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { Sidebar } from '../components/layout/Sidebar'
import { DashboardOverview } from '../components/dashboard/DashboardOverview'
import { ServerManager } from '../components/dashboard/ServerManager'
import { PlaybookManager } from '../components/dashboard/PlaybookManager'
import { PlaybookDeploy } from '../components/dashboard/PlaybookDeploy'
import { TerminalView } from '../components/dashboard/TerminalView'
import { JobHistory } from '../components/dashboard/JobHistory'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'

interface Server {
  id: string
  friendly_name: string
}

export function DashboardPage() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState('overview')
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [selectedServerName, setSelectedServerName] = useState('')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)

  const handleSelectServer = (server: Server | null) => {
    setSelectedServerId(server?.id ?? null)
    setSelectedServerName(server?.friendly_name || '')
  }

  const handleJobCreated = (jobId: string) => {
    setActiveJobId(jobId)
    setJobStatus('pending')
    setActiveSection('overview')
  }

  const handleSelectJob = (jobId: string) => {
    setActiveJobId(jobId)
    setJobStatus(null)
    setActiveSection('overview')
  }

  const handleStatusChange = (status: string | null) => {
    setJobStatus(status)
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <DashboardOverview
              selectedServerId={selectedServerId}
              onSelectServer={handleSelectServer}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4">
                <PlaybookDeploy
                  serverId={selectedServerId}
                  serverName={selectedServerName}
                  onJobCreated={handleJobCreated}
                />
              </div>
              <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4">
                <TerminalView jobId={activeJobId} status={jobStatus} />
              </div>
            </div>
          </motion.div>
        )
      case 'servers':
        return (
          <motion.div key="servers" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4 max-w-lg">
              <ServerManager />
            </div>
          </motion.div>
        )
      case 'playbooks':
        return (
          <motion.div key="playbooks" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4 max-w-2xl">
              <PlaybookManager />
            </div>
          </motion.div>
        )
      case 'jobs':
        return (
          <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4">
              <JobHistory onSelectJob={handleSelectJob} />
            </div>
          </motion.div>
        )
    }
  }

  return (
    <div className="h-screen bg-gray-950 flex">
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: '0.75rem' },
          duration: 4000,
        }}
      />
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-gray-800/50 px-6 py-3 flex items-center justify-between bg-gray-900/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-100 capitalize">{activeSection}</h1>
            {selectedServerName && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
                Target: {selectedServerName}
              </span>
            )}
          </div>
          <span className="text-sm text-gray-500">{user?.email}</span>
        </header>
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
