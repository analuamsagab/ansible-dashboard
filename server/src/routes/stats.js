import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/', (req, res) => {
  const userId = req.user.id

  const servers = db.prepare('SELECT COUNT(*) AS count FROM target_servers WHERE user_id = ?').get(userId).count
  const jobsTotal = db.prepare('SELECT COUNT(*) AS count FROM ansible_jobs WHERE user_id = ?').get(userId).count
  const jobsSuccess = db.prepare("SELECT COUNT(*) AS count FROM ansible_jobs WHERE user_id = ? AND status = 'success'").get(userId).count
  const jobsFailed = db.prepare("SELECT COUNT(*) AS count FROM ansible_jobs WHERE user_id = ? AND status = 'failed'").get(userId).count

  res.json({ servers, jobsTotal, jobsSuccess, jobsFailed })
})

export default router
