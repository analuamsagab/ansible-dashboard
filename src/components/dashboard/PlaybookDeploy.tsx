import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { motion } from 'framer-motion'
import { Upload, ScrollText, Lock } from 'lucide-react'

interface Playbook {
  id: string
  name: string
  description: string | null
  content_yaml: string
}

interface PlaybookDeployProps {
  serverId: string | null
  serverName?: string
  onJobCreated: (jobId: string) => void
}

export function PlaybookDeploy({ serverId, serverName, onJobCreated }: PlaybookDeployProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null)
  const [useVault, setUseVault] = useState(false)
  const [vaultPassword, setVaultPassword] = useState('')

  useEffect(() => {
    api.getPlaybooks().then((data) => {
      if (data) setPlaybooks(data)
    }).catch(() => {})
  }, [])

  const handleDeploy = async () => {
    if (!serverId || !selectedPlaybookId) return
    setErrorMessage(null)
    setDeploySuccess(null)
    setDeploying(true)

    try {
      const job = await api.deployJob(serverId, selectedPlaybookId, useVault ? vaultPassword : undefined)
      onJobCreated(job.id)
      setDeploySuccess('Job deployed successfully')
    } catch (err: unknown) {
      setErrorMessage((err as Error).message)
    }
    setDeploying(false)
  }

  const selectedPlaybook = playbooks.find((p) => p.id === selectedPlaybookId)

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-emerald-400" />
        Deploy Playbook
      </h2>

      <select
        value={selectedPlaybookId}
        onChange={(e) => setSelectedPlaybookId(e.target.value)}
        className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
      >
        <option value="">Select a playbook...</option>
        {playbooks.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {selectedPlaybook && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 p-3 rounded-lg border border-gray-700"
        >
          {selectedPlaybook.description && (
            <p className="text-sm text-gray-300 mb-2">{selectedPlaybook.description}</p>
          )}
          <pre className="text-xs text-gray-400 overflow-x-auto max-h-32">{selectedPlaybook.content_yaml.slice(0, 300)}</pre>
        </motion.div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => { setUseVault(!useVault); if (!useVault) setVaultPassword('') }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all ${
            useVault
              ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
              : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-gray-400'
          }`}
        >
          <Lock className="w-3 h-3" />
          Use Vault
        </button>
      </div>

      {useVault && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <input
            value={vaultPassword}
            onChange={(e) => setVaultPassword(e.target.value)}
            type="password"
            placeholder="Enter vault password"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
        </motion.div>
      )}

      {errorMessage && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">{errorMessage}</motion.p>
      )}
      {deploySuccess && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400 text-sm">{deploySuccess}</motion.p>
      )}

      <button
        onClick={handleDeploy}
        disabled={deploying || !serverId || !selectedPlaybookId}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors text-white flex items-center justify-center gap-2"
      >
        {deploying ? (
          <>
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            Deploying...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {!serverId ? 'Select a target server first' : `Deploy to ${serverName || serverId}`}
          </>
        )}
      </button>
    </div>
  )
}
