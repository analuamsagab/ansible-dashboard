import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { motion } from 'framer-motion'
import { Upload, ScrollText, Lock, FileText, AlertTriangle } from 'lucide-react'

interface Playbook {
  id: string
  name: string
  description: string | null
  content_yaml: string
}

interface PlaybookDeployProps {
  serverIds: string[]
  serverNames: string[]
  onJobCreated: (jobId: string) => void
}

export function PlaybookDeploy({ serverIds, serverNames, onJobCreated }: PlaybookDeployProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null)
  const [useVault, setUseVault] = useState(false)
  const [vaultPassword, setVaultPassword] = useState('')
  const [templateStatus, setTemplateStatus] = useState<{ found: string[]; missing: string[] } | null>(null)
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    api.getPlaybooks().then((data) => {
      if (data) setPlaybooks(data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedPlaybookId) { setTemplateStatus(null); return }
    const playbook = playbooks.find(p => p.id === selectedPlaybookId)
    if (!playbook) { setTemplateStatus(null); return }
    setTemplateStatus(null)
    setDetecting(true)
    api.detectTemplates(playbook.content_yaml)
      .then(setTemplateStatus)
      .catch(() => setTemplateStatus(null))
      .finally(() => setDetecting(false))
  }, [selectedPlaybookId, playbooks])

  const handleDeploy = async () => {
    if (serverIds.length === 0 || !selectedPlaybookId) return
    setErrorMessage(null)
    setDeploySuccess(null)
    setDeploying(true)

    try {
      const job = await api.deployJob(serverIds, selectedPlaybookId, useVault ? vaultPassword : undefined)
      onJobCreated(job.id)
      setDeploySuccess('Job deployed successfully')
    } catch (err: unknown) {
      setErrorMessage((err as Error).message)
    }
    setDeploying(false)
  }

  const selectedPlaybook = playbooks.find((p) => p.id === selectedPlaybookId)

  const deployLabel = () => {
    if (serverIds.length === 0) return 'Select target servers first'
    if (serverIds.length === 1) return `Deploy to ${serverNames[0]}`
    return `Deploy to ${serverNames[0]} + ${serverIds.length - 1} other${serverIds.length - 1 > 1 ? 's' : ''}`
  }

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

      {detecting && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="inline-block w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full" />
          Detecting templates...
        </div>
      )}

      {templateStatus && !detecting && (
        <div className="space-y-1">
          {templateStatus.found.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <FileText className="w-3 h-3" />
              <span>{templateStatus.found.length} template{templateStatus.found.length > 1 ? 's' : ''}: {templateStatus.found.join(', ')}</span>
            </div>
          )}
          {templateStatus.missing.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-300">
              <AlertTriangle className="w-3 h-3" />
              <span>Missing: {templateStatus.missing.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {serverIds.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {serverNames.map((name, i) => (
            <span key={i} className="text-[11px] text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded-full">
              {name}
            </span>
          ))}
        </div>
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
        disabled={deploying || serverIds.length === 0 || !selectedPlaybookId}
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
            {deployLabel()}
          </>
        )}
      </button>
    </div>
  )
}
