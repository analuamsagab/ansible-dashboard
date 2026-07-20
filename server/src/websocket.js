import { WebSocketServer } from 'ws'
import { verifyToken } from './auth.js'

const clients = new Map()

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://x')
    const token = url.searchParams.get('token')
    const user = verifyToken(token)

    if (!user) {
      ws.close(4001, 'Unauthorized')
      return
    }

    ws.userId = user.id
    ws.subscriptions = new Set()

    if (!clients.has(user.id)) clients.set(user.id, [])
    clients.get(user.id).push(ws)

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'subscribe' && msg.jobId) {
          ws.subscriptions.add(msg.jobId)
        } else if (msg.type === 'unsubscribe' && msg.jobId) {
          ws.subscriptions.delete(msg.jobId)
        }
      } catch { }
    })

    ws.on('close', () => {
      const list = clients.get(user.id)
      if (list) {
        const idx = list.indexOf(ws)
        if (idx !== -1) list.splice(idx, 1)
        if (list.length === 0) clients.delete(user.id)
      }
    })
  })

  return { broadcastLog, broadcastStatus }
}

function broadcastLog(jobId, logData) {
  const msg = JSON.stringify({ type: 'log', jobId, data: logData })
  for (const [, list] of clients) {
    for (const ws of list) {
      if (ws.subscriptions.has(jobId) && ws.readyState === 1) {
        ws.send(msg)
      }
    }
  }
}

function broadcastStatus(jobId, status) {
  const msg = JSON.stringify({ type: 'status', jobId, status })
  for (const [, list] of clients) {
    for (const ws of list) {
      if (ws.subscriptions.has(jobId) && ws.readyState === 1) {
        ws.send(msg)
      }
    }
  }
}

export { broadcastLog, broadcastStatus }
