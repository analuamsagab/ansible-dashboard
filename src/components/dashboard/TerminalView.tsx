import { useRef, useEffect, useState } from 'react'
import { useRealtimeLogs } from '../../hooks/useRealtimeLogs'
import { motion } from 'framer-motion'
import { StatusBadge } from '../ui/StatusBadge'
import { Terminal, Trash2, Copy, Maximize2, Minimize2 } from 'lucide-react'

interface TerminalViewProps {
  jobId: string | null
  status: string | null
}

function parseAnsi(text: string): { text: string; color?: string }[] {
  const ansiRegex = /\x1b\[(\d+)(;\d+)*m/g
  const parts: { text: string; color?: string }[] = []
  let lastIndex = 0
    let currentColor: string | undefined



  const colorMap: Record<string, string | undefined> = {
    '30': 'text-gray-400',
    '31': 'text-red-400',
    '32': 'text-emerald-400',
    '33': 'text-yellow-300',
    '34': 'text-blue-400',
    '35': 'text-purple-400',
    '36': 'text-cyan-400',
    '37': 'text-gray-200',
    '90': 'text-gray-500',
    '91': 'text-red-300',
    '92': 'text-emerald-300',
    '93': 'text-yellow-200',
    '94': 'text-blue-300',
    '0': undefined,
  }

  let match: RegExpExecArray | null
  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), color: currentColor })
    }
    currentColor = colorMap[match[1]] || currentColor
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), color: currentColor })
  }
  return parts
}

export function TerminalView({ jobId, status }: TerminalViewProps) {
  const { logs, connected } = useRealtimeLogs(jobId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

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
          {logs.length > 0 && (
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
  )
}
