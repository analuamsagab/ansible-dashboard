import { useState, useEffect, useRef } from 'react'
import { api, token } from '../lib/api'

interface LogLine {
  id: number
  log_line: string
  stream: 'stdout' | 'stderr' | 'system'
  created_at: string
}

export function useRealtimeLogs(jobId: string | null) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!jobId) {
      setLogs([])
      setConnected(false)
      return
    }

    setLogs([])

    const t = token()
    if (!t) return

    const ws = new WebSocket(`${api.wsUrl()}?token=${t}`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'subscribe', jobId }))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'log' && msg.jobId === jobId) {
          setLogs((prev) => [...prev, msg.data])
        } else if (msg.type === 'status' && msg.jobId === jobId) {
          setStatus(msg.status)
        }
      } catch { }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }

    ws.onerror = () => {
      ws.close()
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', jobId }))
        ws.close()
      }
      wsRef.current = null
    }
  }, [jobId])

  return { logs, connected, status }
}
