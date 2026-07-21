import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Server, ScrollText, Terminal,
  ChevronLeft, LogOut, FileText, CheckSquare, Lock, Users,
} from 'lucide-react'

const allNavItems = [
  { id: 'overview',  label: 'Overview',     icon: LayoutDashboard, feature: 'overview' },
  { id: 'servers',   label: 'Servers',      icon: Server,         feature: 'servers' },
  { id: 'playbooks', label: 'Playbooks',    icon: ScrollText,     feature: 'playbooks' },
  { id: 'templates', label: 'Templates',    icon: FileText,       feature: 'templates' },
  { id: 'vault',     label: 'Vault',        icon: Lock,           feature: 'vault' },
  { id: 'lint',      label: 'Lint',         icon: CheckSquare,    feature: 'lint' },
  { id: 'jobs',      label: 'Job History',  icon: Terminal,       feature: 'jobs' },
  { id: 'users',     label: 'Users',        icon: Users,          feature: 'users' },
]

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, can, logout } = useAuth()
  const navigate = useNavigate()

  const navItems = allNavItems.filter(item => can(item.feature, 'view'))

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      className="bg-gray-900/90 backdrop-blur-sm border-r border-gray-800 flex flex-col h-full shrink-0 overflow-hidden"
    >
      <div className="flex items-center p-4 border-b border-gray-800">
        {collapsed ? (
          <div className="flex justify-center w-full">
            <img src="/ansible-dashboard.webp" alt="logo" className="w-8 h-8 rounded shrink-0" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 min-w-0"
          >
            <img src="/ansible-dashboard.webp" alt="logo" className="w-10 h-10 rounded shrink-0" />
            <span className="text-sm font-bold text-emerald-400 truncate">Ansible Dashboard</span>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              activeSection === item.id
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <item.icon className="w-4.5 h-4.5 min-w-[18px]" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="truncate"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </nav>

      <div className="p-2 border-t border-gray-800 space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all"
        >
          <ChevronLeft className={`w-4.5 h-4.5 min-w-[18px] transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-emerald-400">
              {user?.email?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-gray-500 truncate"
              >
                {user?.email}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4.5 h-4.5 min-w-[18px]" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
