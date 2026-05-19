import express from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendOk } from '../../utils/response.js'
import { adminService } from './admin.service.js'

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
