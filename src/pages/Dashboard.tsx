import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { Sidebar } from '../components/layout/Sidebar'
import { DashboardOverview } from '../components/dashboard/DashboardOverview'
import { ServerManager } from '../components/dashboard/ServerManager'
import { PlaybookManager } from '../components/dashboard/PlaybookManager'
import { TemplateManager } from '../components/dashboard/TemplateManager'
import { VaultManager } from '../components/dashboard/VaultManager'
import { LintResults } from '../components/dashboard/LintResults'
import { PlaybookDeploy } from '../components/dashboard/PlaybookDeploy'
import { TerminalView } from '../components/dashboard/TerminalView'
import { JobHistory } from '../components/dashboard/JobHistory'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { CheckSquare } from 'lucide-react'

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
  const [lintContent, setLintContent] = useState('')
  const [lintIssues, setLintIssues] = useState<{ line: number; column: number; severity: string; message: string; tag: string }[] | null>(null)
  const [linting, setLinting] = useState(false)
  const [lintError, setLintError] = useState<string | undefined>()

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

  const handleStandaloneLint = async () => {
    if (!lintContent) return
    setLintIssues(null)
    setLintError(undefined)
    setLinting(true)
    try {
      const result = await api.lintPlaybook(lintContent)
      setLintIssues(result.issues)
    } catch (err: unknown) {
      setLintError((err as Error).message)
    }
    setLinting(false)
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
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4 w-full">
              <ServerManager />
            </div>
          </motion.div>
        )
      case 'playbooks':
        return (
          <motion.div key="playbooks" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4 w-full">
              <PlaybookManager />
            </div>
          </motion.div>
        )
      case 'templates':
        return (
          <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4 w-full">
              <TemplateManager />
            </div>
          </motion.div>
        )
      case 'vault':
        return (
          <motion.div key="vault" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4 w-full">
              <VaultManager />
            </div>
          </motion.div>
        )
      case 'lint':
        return (
          <motion.div key="lint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800 p-4 w-full space-y-4">
              <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                Lint Playbook
              </h2>
              <p className="text-sm text-gray-500">
                Paste your Ansible playbook YAML below to check for best practices and common issues.
              </p>
              <textarea
                value={lintContent}
                onChange={(e) => setLintContent(e.target.value)}
                placeholder="Paste your playbook YAML here..."
                rows={12}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-600 resize-y"
              />
              <button
                onClick={handleStandaloneLint}
                disabled={linting || !lintContent}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-white"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                {linting ? 'Linting...' : 'Run Lint'}
              </button>
              {lintIssues !== null && <LintResults issues={lintIssues} loading={false} />}
              {lintError && <LintResults issues={[]} error={lintError} />}
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
