import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAccess } from '../../middleware/requireAccess.js'
import { sendOk } from '../../utils/response.js'
import { shareService } from './share.service.js'

export const shareRouter = Router()

shareRouter.post(
  '/create',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.create(userId, req.body ?? {})
    sendOk(res, data)
  })
)

shareRouter.post(
  '/revoke',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.revoke(userId, req.body ?? {})
    sendOk(res, data)
  })
)

shareRouter.get(
  '/mine',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.listMine(userId, req.query)
    sendOk(res, data)
  })
)

shareRouter.get(
  '/selections/summary',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.selectionSummary(userId, req.query.shareId)
    sendOk(res, data)
  })
)

shareRouter.get(
  '/selections/submissions',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.selectionSubmissions(userId, req.query)
    sendOk(res, data)
  })
)

shareRouter.get(
  '/selections/by-prefix',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const folderKey = typeof req.query.folderKey === 'string' ? req.query.folderKey : ''
    const data = await shareService.selectionsByFolderPrefix(userId, folderKey)
    sendOk(res, data)
  })
)

shareRouter.get(
  '/selections/pending',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.selectionPending(userId, req.query)
    sendOk(res, data)
  })
)

shareRouter.get(
  '/selections/diff',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.selectionDiff(userId, req.query)
    sendOk(res, data)
  })
)

shareRouter.post(
  '/update-meta',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.updateMeta(userId, req.body ?? {})
    sendOk(res, data)
  })
)

shareRouter.post(
  '/selections/remap-keys',
  requireAccess,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await shareService.remapSelectionKeys(userId, req.body ?? {})
    sendOk(res, data)
  })
)

shareRouter.post(
  '/:token/submit-selection',
  asyncHandler(async (req, res) => {
    const token = typeof req.params.token === 'string' ? req.params.token : ''
    const data = await shareService.submitSelection(token, req.body ?? {})
    sendOk(res, data)
  })
)

shareRouter.get(
  '/:token/browse',
  asyncHandler(async (req, res) => {
    const token = typeof req.params.token === 'string' ? req.params.token : ''
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : undefined
    const data = await shareService.browsePublic(token, prefix)
    sendOk(res, data)
  })
)

shareRouter.post(
  '/:token/presign-get',
  asyncHandler(async (req, res) => {
    const token = typeof req.params.token === 'string' ? req.params.token : ''
    const data = await shareService.presignPublic(token, req.body ?? {})
    sendOk(res, data)
  })
)

shareRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const token = typeof req.params.token === 'string' ? req.params.token : ''
    const data = await shareService.getPublic(token)
    sendOk(res, data)
  })
)
