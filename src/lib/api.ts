const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

  deletePlaybook: (id: string) =>
    req<{ success: boolean }>(`/playbooks/${id}`, { method: 'DELETE' }),

  getJobs: () =>
    req<{ id: string; status: string; created_at: string; server_id: string; playbook_id: string; target_servers: { friendly_name: string } | null; playbooks: { name: string } | null }[]>('/jobs'),

  deployJob: (serverId: string, playbookId: string) =>
    req<{ id: string }>('/jobs', { method: 'POST', body: JSON.stringify({ serverId, playbookId }) }),

  getStats: () =>
    req<{ servers: number; jobsTotal: number; jobsSuccess: number; jobsFailed: number }>('/stats'),

  wsUrl: () => BASE.replace(/^http/, 'ws') + '/ws',
}

export { setToken, token }
