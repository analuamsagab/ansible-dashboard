import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Playbook {
  id: string
  name: string
  description: string | null
  content_yaml: string
  is_system_default: boolean
}

interface PlaybookTriggerProps {
  serverId: string | null
  onJobCreated: (jobId: string) => void
}

export function PlaybookTrigger({ serverId, onJobCreated }: PlaybookTriggerProps) {
  const [tab, setTab] = useState<'system' | 'custom'>('system')
  const [systemPlaybooks, setSystemPlaybooks] = useState<Playbook[]>([])
  const [selectedPlaybookId, setSelectedPlaybookId] = useState('')
  const [customYaml, setCustomYaml] = useState('')
  const [customName, setCustomName] = useState('')
  const [deploying, setDeploying] = useState(false)

  useEffect(() => {
    supabase
      .from('playbooks')
      .select('id, name, description, content_yaml, is_system_default')
      .eq('is_system_default', true)
      .then(({ data }) => {
        if (data) setSystemPlaybooks(data)
      })
  }, [])

  const handleDeploy = async () => {
    if (!serverId) return

    setDeploying(true)
    let playbookId = selectedPlaybookId

    if (tab === 'custom') {
      const { data } = await supabase
        .from('playbooks')
        .insert({
          name: customName || 'Custom Playbook',
          content_yaml: customYaml,
          is_system_default: false,
        })
        .select('id')
        .single()
      if (data) playbookId = data.id
    }

    const { data: job } = await supabase
      .from('ansible_jobs')
      .insert({
        server_id: serverId,
        playbook_id: playbookId,
        status: 'pending',
      })
      .select('id')
      .single()

    if (job) onJobCreated(job.id)
    setDeploying(false)
  }

  const selectedPlaybook = systemPlaybooks.find((p) => p.id === selectedPlaybookId)

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-200">Deploy Playbook</h2>

      <div className="flex gap-1 bg-gray-800 rounded-lg p-1 border border-gray-700">
        <button
          onClick={() => setTab('system')}
          className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
            tab === 'system' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          System Playbooks
        </button>
        <button
          onClick={() => setTab('custom')}
          className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
            tab === 'custom' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Custom Playbook
        </button>
      </div>

      {tab === 'system' ? (
        <div className="space-y-2">
          <select
            value={selectedPlaybookId}
            onChange={(e) => setSelectedPlaybookId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="">-- Select a playbook --</option>
            {systemPlaybooks.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedPlaybook && (
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-300">{selectedPlaybook.description}</p>
              <pre className="mt-2 text-xs text-gray-400 overflow-x-auto max-h-32">{selectedPlaybook.content_yaml.slice(0, 500)}</pre>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Playbook name"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <textarea
            value={customYaml}
            onChange={(e) => setCustomYaml(e.target.value)}
            placeholder="Paste your Ansible playbook YAML here..."
            rows={10}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="file"
              accept=".yml,.yaml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setCustomName(file.name.replace(/\.(yml|yaml)$/, ''))
                  file.text().then(setCustomYaml)
                }
              }}
            />
            <span className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded cursor-pointer text-xs transition-colors">
              Upload YAML file
            </span>
          </label>
        </div>
      )}

      <button
        onClick={handleDeploy}
        disabled={deploying || !serverId || (tab === 'system' && !selectedPlaybookId) || (tab === 'custom' && !customYaml)}
        className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
      >
        {!serverId
          ? 'Select a target server first'
          : deploying
            ? 'Deploying...'
            : 'Deploy Playbook'}
      </button>
    </div>
  )
}
