import { useRef, useEffect, useState } from 'react'
import { useRealtimeLogs } from '../../hooks/useRealtimeLogs'
import { motion } from 'framer-motion'
import { StatusBadge } from '../ui/StatusBadge'
import { Terminal, Trash2, Copy, Maximize2, Minimize2 } from 'lucide-react'
import { parseAnsi } from '../../lib/ansi'

interface TerminalViewProps {
  jobId: string | null
  status: string | null
}

export function TerminalView({ jobId, status }: TerminalViewProps) {
  const { logs, connected } = useRealtimeLogs(jobId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const clearIndexRef = useRef(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const displayLogs = logs.slice(clearIndexRef.current)

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  const handleCopy = () => {
    const text = displayLogs.map((l) => l.log_line).join('\n')
    navigator.clipboard.writeText(text)
  }

  const handleClear = () => {
    clearIndexRef.current = logs.length
  }

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
  }

  return (
    <div className={`space-y-2 ${fullscreen ? 'fixed inset-0 z-50 bg-gray-950 p-4 flex flex-col' : ''}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Terminal Output
        </h2>
        <div className="flex items-center gap-1.5">
          {status && <StatusBadge status={status} pulse={status === 'running'} />}
          {jobId && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? 'text-emerald-400' : 'text-gray-500'} bg-gray-800`}>
              {connected ? '● Live' : '○ Disconnected'}
            </span>
          )}
          {displayLogs.length > 0 && (
            <>
              <button onClick={handleCopy} className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleClear} className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-black rounded-lg border border-gray-700 font-mono text-xs overflow-y-auto p-3"
        style={{ height: fullscreen ? 'calc(100vh - 120px)' : '20rem' }}
      >
        {!jobId ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Terminal className="w-3.5 h-3.5" />
            Waiting for a job to start...
          </div>
        ) : displayLogs.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-500">
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            Waiting for log output...
          </div>
        ) : (
          displayLogs.map((log) => (
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
  )
}
