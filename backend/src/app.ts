import express from 'express'
import cors from 'cors'
import { requestIdMiddleware } from './middleware/requestId.js'
import { httpLoggerMiddleware } from './middleware/httpLogger.js'
import { privateNetworkAccessHeader } from './middleware/privateNetworkCors.js'
import { requireAccess } from './middleware/requireAccess.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { usersRouter } from './modules/users/users.routes.js'
import { inviteRouter } from './modules/invite/invite.routes.js'
import { sendOk } from './utils/response.js'

export function createApp(): express.Application {
  const app = express()
  app.disable('x-powered-by')
  app.use(requestIdMiddleware)
  app.use(httpLoggerMiddleware)
  app.use(privateNetworkAccessHeader)
  app.use(
    cors({
      origin: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )
  app.use(express.json({ limit: '512kb' }))

  app.get('/health', (_req, res) => {
    sendOk(res, { status: 'ok' })
  })

  app.use('/auth', authRouter)
  app.use('/users', requireAccess, usersRouter)
  app.use('/invites', requireAccess, inviteRouter)

  app.use(errorHandler)
  return app
}
