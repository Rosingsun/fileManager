import express from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendOk } from '../../utils/response.js'
import { adminService } from './admin.service.js'
import { adminUserQuotaService } from './admin.userQuota.service.js'

export const adminRouter = express.Router()

adminRouter.get(
  '/parameters/cos',
  asyncHandler(async (_req, res) => {
    const data = await adminService.getCosParameters()
    sendOk(res, data)
  })
)

adminRouter.post(
  '/parameters/cos',
  asyncHandler(async (req, res) => {
    const data = await adminService.updateCosParameters(req.userId!, req.body)
    sendOk(res, data)
  })
)

adminRouter.get(
  '/users/cos-quota',
  asyncHandler(async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined
    const email = typeof req.query.email === 'string' ? req.query.email : undefined
    const data = await adminUserQuotaService.getUserCosQuota({ userId, email })
    sendOk(res, data)
  })
)

adminRouter.post(
  '/users/cos-quota',
  asyncHandler(async (req, res) => {
    const data = await adminUserQuotaService.adjustUserCosQuota(req.userId!, req.body)
    sendOk(res, data)
  })
)

adminRouter.get(
  '/users/cos-quota/history',
  asyncHandler(async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : ''
    const limit = req.query.limit
    const data = await adminUserQuotaService.getUserCosQuotaHistory(userId, limit)
    sendOk(res, data)
  })
)
