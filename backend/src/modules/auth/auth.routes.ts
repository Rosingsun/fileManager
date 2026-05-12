import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendOk } from '../../utils/response.js'
import { authService } from './auth.service.js'

export const authRouter = Router()

authRouter.post(
  '/bootstrap-first-user',
  asyncHandler(async (req, res) => {
    const data = await authService.bootstrapFirstUser(req.body)
    sendOk(res, data)
  })
)

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = await authService.register(req.body)
    sendOk(res, data)
  })
)

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = await authService.login(req.body)
    sendOk(res, data)
  })
)

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const data = await authService.refresh(req.body)
    sendOk(res, data)
  })
)

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await authService.logout(req.body)
    sendOk(res, null)
  })
)
