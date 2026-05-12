import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendOk } from '../../utils/response.js'
import { inviteService } from './invite.service.js'

export const inviteRouter = Router()

inviteRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await inviteService.createInvite(userId, req.body)
    sendOk(res, data)
  })
)

inviteRouter.get(
  '/codes',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await inviteService.listMyCodes(userId)
    sendOk(res, data)
  })
)

inviteRouter.get(
  '/records',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await inviteService.listMyRecords(userId)
    sendOk(res, data)
  })
)
