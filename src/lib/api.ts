const BASE = import.meta.env.VITE_API_URL || ''

function token(): string | null {
  return localStorage.getItem('token')
}

function setToken(t: string | null) {
  if (t) localStorage.setItem('token', t)
  else localStorage.removeItem('token')
}

async function req<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...((opts.headers as Record<string, string>) || {}),
    },
    ...opts,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; user: { id: string; email: string; fullName: string; role: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  register: (email: string, password: string, fullName: string) =>
    req<{ user: { id: string; email: string; fullName: string; role: string } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, fullName }) }
    ),

  me: () =>
    req<{ id: string; email: string; fullName: string; role: string }>('/auth/me'),

  getServers: () =>
    req<{ id: string; friendly_name: string; ip_address: string; ssh_port: number; ssh_user: string; created_at: string }[]>('/servers'),

  createServer: (data: Record<string, unknown>) =>
    req('/servers', { method: 'POST', body: JSON.stringify(data) }),

  updateServer: (id: string, data: Record<string, unknown>) =>
    req(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteServer: (id: string) =>
    req<{ success: boolean }>(`/servers/${id}`, { method: 'DELETE' }),

  getPlaybooks: () =>
    req<{ id: string; name: string; description: string | null; content_yaml: string; is_system_default: boolean; created_at: string }[]>('/playbooks'),

  createPlaybook: (data: Record<string, unknown>) =>
    req('/playbooks', { method: 'POST', body: JSON.stringify(data) }),

  updatePlaybook: (id: string, data: { name?: string; description?: string; content_yaml?: string }) =>
    req<{ success: boolean }>(`/playbooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deletePlaybook: (id: string) =>
    req<{ success: boolean }>(`/playbooks/${id}`, { method: 'DELETE' }),

  getJobs: () =>
    req<{ id: string; status: string; created_at: string; server_id: string; playbook_id: string; target_servers: { friendly_name: string } | null; playbooks: { name: string } | null }[]>('/jobs'),

  deployJob: (serverId: string, playbookId: string, vaultPassword?: string) =>
    req<{ id: string }>('/jobs', { method: 'POST', body: JSON.stringify({ serverId, playbookId, vaultPassword }) }),

  getStats: () =>
    req<{ servers: number; jobsTotal: number; jobsSuccess: number; jobsFailed: number }>('/stats'),

  wsUrl: () => BASE.replace(/^http/, 'ws') + '/ws',

  getTemplates: () =>
    req<{ id: string; name: string; filename: string; created_at: string }[]>('/templates'),

  getTemplate: (id: string) =>
    req<{ id: string; name: string; filename: string; content: string; created_at: string }>('/templates/' + id),

  createTemplate: (data: { name: string; filename: string; content: string }) =>
    req<{ id: string }>('/templates', { method: 'POST', body: JSON.stringify(data) }),

  updateTemplate: (id: string, data: { name: string; filename: string; content: string }) =>
    req<{ success: boolean }>('/templates/' + id, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTemplate: (id: string) =>
    req<{ success: boolean }>('/templates/' + id, { method: 'DELETE' }),

  lintPlaybook: (content: string) =>
    req<{ issues: { line: number; column: number; severity: string; message: string; tag: string }[] }>(
      '/lint', { method: 'POST', body: JSON.stringify({ content }) }
    ),

  getVaultItems: () =>
    req<{ id: string; name: string; description: string | null; created_at: string }[]>('/vault'),

  getVaultItem: (id: string) =>
    req<{ id: string; name: string; description: string | null; encrypted_content: string; created_at: string }>('/vault/' + id),

  createVaultItem: (data: { name: string; description?: string; content: string; vaultPassword: string }) =>
    req<{ id: string }>('/vault', { method: 'POST', body: JSON.stringify(data) }),

  decryptVaultItem: (id: string, vaultPassword: string) =>
    req<{ content: string }>('/vault/decrypt', { method: 'POST', body: JSON.stringify({ id, vaultPassword }) }),

  rekeyVaultItem: (id: string, oldPassword: string, newPassword: string) =>
    req<{ success: boolean }>('/vault/rekey', { method: 'POST', body: JSON.stringify({ id, oldPassword, newPassword }) }),

  updateVaultItem: (id: string, data: { name: string; description?: string; content?: string; vaultPassword?: string }) =>
    req<{ success: boolean }>('/vault/' + id, { method: 'PUT', body: JSON.stringify(data) }),

  deleteVaultItem: (id: string) =>
    req<{ success: boolean }>('/vault/' + id, { method: 'DELETE' }),
}

export { setToken, token }
