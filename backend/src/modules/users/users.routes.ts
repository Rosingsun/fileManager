import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendOk } from '../../utils/response.js'
import { usersService } from './users.service.js'

export const usersRouter = Router()

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await usersService.getMe(userId)
    sendOk(res, data)
  })
)

usersRouter.post(
  '/me',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await usersService.patchMe(userId, req.body)
    sendOk(res, data)
  })
)

usersRouter.post(
  '/me/password',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await usersService.changePassword(userId, req.body)
    sendOk(res, data)
  })
)
