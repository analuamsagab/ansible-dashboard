import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { motion } from 'framer-motion'
import { StatusBadge } from '../ui/StatusBadge'
import { YamlEditor } from './YamlEditor'
import { ScrollText, Upload } from 'lucide-react'

interface Playbook {
  id: string
  name: string
  description: string | null
  content_yaml: string
  is_system_default: boolean
}

interface PlaybookTriggerProps {
  serverId: string | null
  serverName?: string
  onJobCreated: (jobId: string) => void
}

export function PlaybookTrigger({ serverId, serverName, onJobCreated }: PlaybookTriggerProps) {
  const [tab, setTab] = useState<'system' | 'custom'>('system')
  const [systemPlaybooks, setSystemPlaybooks] = useState<Playbook[]>([])
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('')
  const [customYaml, setCustomYaml] = useState('')
  const [customName, setCustomName] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('playbooks')
      .select('id, name, description, content_yaml, is_system_default')
      .eq('is_system_default', true)
      .then(({ data, error }) => {
        if (error) {
          console.error('fetch playbooks error:', error.message, error.details, error.hint)
          setErrorMessage(error.message)
          return
        }
        if (data) setSystemPlaybooks(data)
      })
  }, [])

  const handleDeploy = async () => {
    if (!serverId) return

    setErrorMessage(null)
    setDeploySuccess(null)
    setDeploying(true)
    let playbookId = selectedPlaybookId

    if (tab === 'custom') {
      const { data, error } = await supabase
        .from('playbooks')
        .insert({
          name: customName || 'Custom Playbook',
          content_yaml: customYaml,
          is_system_default: false,
        })
        .select('id')
        .single()

      if (error) {
        console.error('insert custom playbook error:', error.message, error.details, error.hint)
        setErrorMessage(error.message)
        setDeploying(false)
        return
      }
      if (data) playbookId = data.id
    }

    const { data: job, error: jobError } = await supabase
      .from('ansible_jobs')
      .insert({
        server_id: serverId,
        playbook_id: playbookId,
        status: 'pending',
      })
      .select('id')
      .single()

    if (jobError) {
      console.error('insert job error:', jobError.message, jobError.details, jobError.hint)
      setErrorMessage(jobError.message)
      setDeploying(false)
      return
    }

    if (job) {
      onJobCreated(job.id)
      setDeploySuccess('Job deployed successfully')
    }
    setDeploying(false)
  }

  const selectedPlaybook = systemPlaybooks.find((p) => p.id === selectedPlaybookId)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-emerald-400" />
        Deploy Playbook
      </h2>

      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
        {(['system', 'custom'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm rounded-md transition-all font-medium ${
              tab === t
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'system' ? 'System Playbooks' : 'Custom Playbook'}
          </button>
        ))}
      </div>

      {tab === 'system' ? (
        <div className="space-y-3">
          <select
            value={selectedPlaybookId}
            onChange={(e) => setSelectedPlaybookId(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">Select a playbook...</option>
            {systemPlaybooks.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedPlaybook && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 p-3 rounded-lg border border-gray-700"
            >
              <p className="text-sm text-gray-300 mb-2">{selectedPlaybook.description}</p>
              <pre className="text-xs text-gray-400 overflow-x-auto max-h-40">{selectedPlaybook.content_yaml.slice(0, 500)}</pre>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Playbook name"
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-gray-500"
          />
          <YamlEditor
            value={customYaml}
            onChange={setCustomYaml}
            placeholder="Paste your Ansible playbook YAML here..."
            minHeight="240px"
          />
        </div>
      )}

      {errorMessage && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm">{errorMessage}</motion.p>
      )}
      {deploySuccess && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400 text-sm">{deploySuccess}</motion.p>
      )}

      <button
        onClick={handleDeploy}
        disabled={deploying || !serverId || (tab === 'system' && !selectedPlaybookId) || (tab === 'custom' && !customYaml)}
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
