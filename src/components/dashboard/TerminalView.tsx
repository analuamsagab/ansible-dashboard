import { useRef, useEffect } from 'react'
import { useRealtimeLogs } from '../../hooks/useRealtimeLogs'

interface TerminalViewProps {
  jobId: string | null
  status: string | null
}

export function TerminalView({ jobId, status }: TerminalViewProps) {
  const { logs, connected } = useRealtimeLogs(jobId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const statusColor: Record<string, string> = {
    pending: 'text-yellow-400',
    running: 'text-blue-400',
    success: 'text-emerald-400',
    failed: 'text-red-400',
    timeout: 'text-orange-400',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Terminal Output</h2>
        <div className="flex items-center gap-2 text-xs">
          {status && (
            <span className={`px-2 py-0.5 rounded-full font-medium ${statusColor[status] || 'text-gray-400'} bg-gray-800`}>
              {status.toUpperCase()}
            </span>
          )}
          {jobId && (
            <span className={`px-2 py-0.5 rounded-full ${connected ? 'text-emerald-400' : 'text-gray-500'} bg-gray-800`}>
              {connected ? '● Live' : '○ Disconnected'}
            </span>
          )}
        </div>
      </div>

      <div className="bg-black rounded-lg border border-gray-700 font-mono text-xs h-64 overflow-y-auto p-3">
        {!jobId ? (
          <p className="text-gray-500">Waiting for a job to start...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500">Waiting for log output...</p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`${
                log.stream === 'stderr'
                  ? 'text-red-400'
                  : log.stream === 'system'
                    ? 'text-emerald-400'
                    : 'text-gray-200'
              }`}
            >
              <span className="text-gray-600 mr-2">
                {new Date(log.created_at).toLocaleTimeString()}
              </span>
              {log.log_line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
