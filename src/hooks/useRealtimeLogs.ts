import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface LogLine {
  id: number
  log_line: string
  stream: 'stdout' | 'stderr' | 'system'
  created_at: string
}

export function useRealtimeLogs(jobId: string | null) {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!jobId) {
      setLogs([])
      setConnected(false)
      return
    }

    setLogs([])

    const channel = supabase
      .channel(`job_logs:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_logs',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          setLogs((prev) => [...prev, payload.new as LogLine])
        },
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId])

  return { logs, connected }
}
