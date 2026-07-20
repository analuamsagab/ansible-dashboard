import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Terminal, Copy, Trash2, Clock, Server, BookOpen } from 'lucide-react'
import { useRealtimeLogs } from '../../hooks/useRealtimeLogs'
import { StatusBadge } from '../ui/StatusBadge'
import { parseAnsi, calcDuration } from '../../lib/ansi'

interface JobDetail {
  id: string
  status: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  server_id: string
  server_ids: string | null
  playbook_id: string
  target_servers: { id: string; friendly_name: string }[] | null
  playbooks: { name: string } | null
}

interface JobDetailModalProps {
  job: JobDetail | null
  onClose: () => void
}

export function JobDetailModal({ job, onClose }: JobDetailModalProps) {
  const { logs, connected, status } = useRealtimeLogs(job?.id ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const liveStatus = status || job?.status || null

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  const handleCopy = () => {
    const text = logs.map((l) => l.log_line).join('\n')
    navigator.clipboard.writeText(text)
  }

  const handleClear = () => {
    if (containerRef.current) containerRef.current.innerHTML = ''
  }

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }

  return (
    <AnimatePresence>
      {job && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden my-4 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
              <h2 className="text-lg font-semibold text-gray-200 truncate flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                {job.playbooks?.name || 'Job Detail'}
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-800 shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> Playbook
                  </span>
                  <p className="text-sm text-gray-200 truncate">{job.playbooks?.name || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium flex items-center gap-1">
                    <Server className="w-3 h-3" /> Server
                  </span>
                  <p className="text-sm text-gray-200 truncate">{(job.target_servers || []).map(s => s.friendly_name).join(', ') || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Duration
                  </span>
                  <p className="text-sm text-gray-200">{calcDuration(job.started_at, job.finished_at)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={liveStatus} pulse={liveStatus === 'running'} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${connected ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-500 bg-gray-800'}`}>
                      {connected ? '● Live' : '○ Offline'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Created: {new Date(job.created_at).toLocaleString()}
                {job.started_at && ` · Started: ${new Date(job.started_at).toLocaleString()}`}
                {job.finished_at && ` · Finished: ${new Date(job.finished_at).toLocaleString()}`}
              </div>
            </div>

            <div className="flex-1 p-4 pt-3 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" /> Output
                </span>
                <div className="flex items-center gap-1">
                  {logs.length > 0 && (
                    <>
                      <button onClick={handleCopy} className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors" title="Copy">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={handleClear} className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors" title="Clear">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 bg-black rounded-lg border border-gray-700 font-mono text-xs overflow-y-auto p-3 min-h-[200px]"
              >
                {!job.id ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Terminal className="w-3.5 h-3.5" />
                    No job selected
                  </div>
                ) : logs.length === 0 ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    Waiting for log output...
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="whitespace-pre-wrap break-all">
                      <span className="text-gray-600 mr-2 select-none">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                      <span className={
                        log.stream === 'stderr' ? 'text-red-400' :
                        log.stream === 'system' ? 'text-emerald-400' :
                        'text-gray-200'
                      }>
                        {log.stream === 'system' ? '⚡ ' : ''}
                        {parseAnsi(log.log_line).map((part, i) => (
                          <span key={i} className={part.color}>{part.text}</span>
                        ))}
                      </span>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
