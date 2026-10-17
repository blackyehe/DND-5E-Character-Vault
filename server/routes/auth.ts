import { Router, type Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User'
import { env } from '../env'
import { requireAuth } from '../middleware/auth'

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(64),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

function setTokenCookie(res: Response, userId: string) {
  const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
  }
  const { email, password, displayName } = parsed.data
  const existing = await User.findOne({ email })
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' })
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({ email, passwordHash, displayName })
  setTokenCookie(res, user.id)
  res.status(201).json({ id: user.id, email: user.email, displayName: user.displayName })
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' })
  }
  const { email, password } = parsed.data
  const user = await User.findOne({ email })
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  setTokenCookie(res, user.id)
  res.json({ id: user.id, email: user.email, displayName: user.displayName })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' })
  res.json({ ok: true })
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('email displayName')
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }
  res.json({ id: user.id, email: user.email, displayName: user.displayName })
})

export default router
