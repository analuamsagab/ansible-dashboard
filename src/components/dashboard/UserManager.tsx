import { useState } from 'react'
import { api } from '../../lib/api'
import { useFetch } from '../../hooks/useFetch'
import { useAuth } from '../../context/AuthContext'
import { motion } from 'framer-motion'
import { Users, Shield, Sliders } from 'lucide-react'
import toast from 'react-hot-toast'

const roleBadge: Record<string, string> = {
  admin: 'bg-purple-500/10 text-purple-300',
  'co-admin': 'bg-blue-500/10 text-blue-300',
  engineer: 'bg-emerald-500/10 text-emerald-300',
  visitor: 'bg-gray-500/10 text-gray-300',
}

const features = ['overview', 'servers', 'playbooks', 'templates', 'vault', 'lint', 'jobs', 'users']
const levels = ['none', 'view', 'execute', 'manage']

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  created_at: string
}

export function UserManager() {
  const { user: me, can } = useAuth()
  const { data: usersRaw, loading, refetch } = useFetch<User[]>(() => api.getUsers(), [])
  const { data: permsRaw, refetch: refetchPerms } = useFetch<Record<string, Record<string, string>>>(() => api.getRolePermissions(), [])
  const [changing, setChanging] = useState<string | null>(null)
  const [tab, setTab] = useState<'users' | 'permissions'>('users')
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editPerms, setEditPerms] = useState<Record<string, string> | null>(null)
  const [savingPerms, setSavingPerms] = useState(false)

  const users = usersRaw ?? []
  const allPerms = permsRaw ?? {}

  const handleRoleChange = async (userId: string, role: string) => {
    setChanging(userId)
    try {
      await api.updateUserRole(userId, role)
      toast.success('Role updated')
      refetch()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
    setChanging(null)
  }

  const startEditPerms = (role: string) => {
    setEditingRole(role)
    setEditPerms({ ...allPerms[role] })
  }

  const handleSavePerms = async () => {
    if (!editingRole || !editPerms) return
    setSavingPerms(true)
    try {
      await api.updateRolePermissions(editingRole, editPerms)
      toast.success('Permissions updated')
      setEditingRole(null)
      setEditPerms(null)
      refetchPerms()
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
    setSavingPerms(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          User Management
        </h2>
        {can('users', 'manage') && (
          <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
            <button
              onClick={() => setTab('users')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                tab === 'users' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Roles
            </button>
            <button
              onClick={() => setTab('permissions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                tab === 'permissions' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Permissions
            </button>
          </div>
        )}
      </div>

      {tab === 'users' && (
        <div className="space-y-1.5">
          {loading ? (
            <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">No users yet</div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-emerald-400">
                        {(u.email?.charAt(0) || '?').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {u.full_name || u.email}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge[u.role] || 'text-gray-400 bg-gray-700'}`}>
                      {u.role}
                    </span>
                    {can('users', 'manage') && u.id !== me?.id && (
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={changing === u.id}
                        className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="admin">admin</option>
                        <option value="co-admin">co-admin</option>
                        <option value="engineer">engineer</option>
                        <option value="visitor">visitor</option>
                      </select>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'permissions' && can('users', 'manage') && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(allPerms).map((role) => (
              <button
                key={role}
                onClick={() => startEditPerms(role)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                  editingRole === role
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
                }`}
              >
                {role}
              </button>
            ))}
          </div>

          {editingRole && editPerms && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-sm font-semibold text-gray-200">{editingRole} permissions</h3>
              <div className="space-y-1.5">
                {features.map((f) => (
                  <div key={f} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-gray-300 capitalize">{f}</span>
                    <select
                      value={editPerms[f] || 'none'}
                      onChange={(e) => setEditPerms(p => ({ ...p, [f]: e.target.value }))}
                      className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {levels.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSavePerms}
                  disabled={savingPerms}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors text-white"
                >
                  {savingPerms ? 'Saving...' : 'Save Permissions'}
                </button>
                <button
                  onClick={() => { setEditingRole(null); setEditPerms(null) }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
