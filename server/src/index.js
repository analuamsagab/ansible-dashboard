import 'dotenv/config'
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import authRouter from './auth.js'
import serversRouter from './routes/servers.js'
import playbooksRouter from './routes/playbooks.js'
import jobsRouter from './routes/jobs.js'
import statsRouter from './routes/stats.js'
import templatesRouter from './routes/templates.js'
import lintRouter from './routes/lint.js'
import vaultRouter from './routes/vault.js'
import usersRouter from './routes/users.js'
import { setupWebSocket } from './websocket.js'
import { setBroadcastFns, startWorker } from './worker.js'
import db from './db.js'

const app = express()
const server = http.createServer(app)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRouter)
app.use('/api/servers', serversRouter)
app.use('/api/playbooks', playbooksRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/stats', statsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/lint', lintRouter)
app.use('/api/vault', vaultRouter)
app.use('/api/users', usersRouter)

const wsServer = setupWebSocket(server)
setBroadcastFns(wsServer.broadcastLog, wsServer.broadcastStatus)

const MODE = process.env.MODE || 'full'
if (MODE === 'full' || MODE === 'worker') startWorker()
if (MODE === 'worker') {
  console.log('[Server] Worker mode — no HTTP server')
}

const PORT = parseInt(process.env.PORT || '3001', 10)
server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} (mode: ${MODE})`)
})
