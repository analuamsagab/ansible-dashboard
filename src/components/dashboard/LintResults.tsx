import { motion } from 'framer-motion'
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react'

interface LintIssue {
  line: number
  column: number
  severity: string
  message: string
  tag: string
}

interface LintResultsProps {
  issues: LintIssue[]
  error?: string
  loading?: boolean
}

const severityIcon: Record<string, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const severityColors: Record<string, string> = {
  error: 'text-red-400 border-red-500/20 bg-red-500/5',
  warning: 'text-yellow-300 border-yellow-500/20 bg-yellow-500/5',
  info: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
}

const severityLabel: Record<string, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}

export function LintResults({ issues, error, loading }: LintResultsProps) {
  if (loading) {
    return (
      <div className="border border-gray-700/50 rounded-lg p-4 bg-gray-900/30">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          Linting...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-red-500/20 rounded-lg p-4 bg-red-500/5">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (issues.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border border-emerald-500/20 rounded-lg p-4 bg-emerald-500/5"
      >
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          No issues found
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-gray-700/50 rounded-lg overflow-hidden"
    >
      <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700/50 text-xs text-gray-400 font-medium">
        {issues.length} issue{issues.length !== 1 ? 's' : ''} found
      </div>
      <div className="divide-y divide-gray-700/30 max-h-60 overflow-y-auto">
        {issues.map((issue, i) => {
          const Icon = severityIcon[issue.severity] || AlertTriangle
          const color = severityColors[issue.severity] || severityColors.warning
          const label = severityLabel[issue.severity] || issue.severity
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className={`flex items-start gap-2.5 px-3 py-2 text-sm ${color}`}
            >
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="font-medium text-[10px] uppercase tracking-wider opacity-70">{label}</span>{' '}
                <span className="text-gray-300">{issue.message}</span>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Line {issue.line}{issue.column ? `, col ${issue.column}` : ''} &middot; {issue.tag}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
