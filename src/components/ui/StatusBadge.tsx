import { motion } from 'framer-motion'

interface StatusBadgeProps {
  status: string | null
  pulse?: boolean
}

const config: Record<string, { color: string; bg: string; label: string }> = {
  pending:  { color: 'text-yellow-300', bg: 'bg-yellow-500/10', label: 'Pending' },
  running:  { color: 'text-blue-300',   bg: 'bg-blue-500/10',   label: 'Running' },
  success:  { color: 'text-emerald-300', bg: 'bg-emerald-500/10', label: 'Success' },
  failed:   { color: 'text-red-300',    bg: 'bg-red-500/10',    label: 'Failed' },
  timeout:  { color: 'text-orange-300', bg: 'bg-orange-500/10', label: 'Timeout' },
}

export function StatusBadge({ status, pulse }: StatusBadgeProps) {
  if (!status) return null
  const c = config[status] || { color: 'text-gray-300', bg: 'bg-gray-500/10', label: status }

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.color} ${c.bg}`}
    >
      {pulse && (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-1.5 h-1.5 rounded-full bg-current"
        />
      )}
      {c.label}
    </motion.span>
  )
}
