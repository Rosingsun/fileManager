import express from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendOk } from '../../utils/response.js'
import { getCosConfig } from '../parameters/cosConfig.service.js'
import * as cosService from './cos.service.js'

export const cosRouter = express.Router()

function cosUploadBodyParser(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const limit = Math.min(Math.max(getCosConfig().uploadMaxBytes, 1), 1073741824)
  express.raw({
    limit,
    type: (r) => {
      const ct = String(r.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      return ct === 'application/octet-stream' || ct.startsWith('image/')
    },
  })(req, res, next)
}

cosRouter.post(
  '/upload',
  cosUploadBodyParser,
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const fileName = typeof req.query.fileName === 'string' ? req.query.fileName : ''
    const parentPrefix = typeof req.query.parentPrefix === 'string' ? req.query.parentPrefix : undefined
    const raw = req.body
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw ?? [])
    const data = await cosService.uploadObjectBuffer(userId, {
      fileName,
      parentPrefix,
      buffer,
    })
    sendOk(res, data)
  })
)

cosRouter.get(
  '/browse',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : undefined
    const delimiter = typeof req.query.delimiter === 'string' ? req.query.delimiter : undefined
    const data = await cosService.browse(userId, prefix, delimiter)
    sendOk(res, data)
  })
)

cosRouter.get(
  '/image-stats',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const data = await cosService.imageStats(userId)
    sendOk(res, data)
  })
)

cosRouter.post(
  '/presign-upload',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const body = req.body as { fileName?: unknown; contentType?: unknown; parentPrefix?: unknown }
    const data = await cosService.presignUpload(userId, {
      fileName: typeof body.fileName === 'string' ? body.fileName : '',
      contentType: typeof body.contentType === 'string' ? body.contentType : undefined,
      parentPrefix: typeof body.parentPrefix === 'string' ? body.parentPrefix : undefined,
    })
    sendOk(res, data)
  })
)

cosRouter.post(
  '/presign-get',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const body = req.body as { key?: unknown }
    const variantRaw = (body as { variant?: unknown }).variant
    const variant =
      variantRaw === 'thumb' || variantRaw === 'full' ? variantRaw : undefined
    const data = await cosService.presignGet(userId, {
      key: typeof body.key === 'string' ? body.key : '',
      variant,
    })
    sendOk(res, data)
  })
)

cosRouter.post(
  '/mkdir',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const body = req.body as { parentPrefix?: unknown; name?: unknown }
    const data = await cosService.mkdir(userId, {
      parentPrefix: typeof body.parentPrefix === 'string' ? body.parentPrefix : undefined,
      name: typeof body.name === 'string' ? body.name : '',
    })
    sendOk(res, data)
  })
)

cosRouter.post(
  '/move',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const body = req.body as { fromKey?: unknown; toKey?: unknown }
    const data = await cosService.moveObject(userId, {
      fromKey: typeof body.fromKey === 'string' ? body.fromKey : '',
      toKey: typeof body.toKey === 'string' ? body.toKey : '',
    })
    sendOk(res, data)
  })
)

cosRouter.post(
  '/delete',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const body = req.body as { key?: unknown }
    const data = await cosService.deleteObject(userId, {
      key: typeof body.key === 'string' ? body.key : '',
    })
    sendOk(res, data)
  })
)

cosRouter.post(
  '/rename-folder',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const body = req.body as { fromKey?: unknown; newName?: unknown }
    const data = await cosService.renameFolder(userId, {
      fromKey: typeof body.fromKey === 'string' ? body.fromKey : '',
      newName: typeof body.newName === 'string' ? body.newName : '',
    })
    sendOk(res, data)
  })
)

cosRouter.post(
  '/move-folder',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const body = req.body as { fromKey?: unknown; targetParentPrefix?: unknown }
    const data = await cosService.moveFolder(userId, {
      fromKey: typeof body.fromKey === 'string' ? body.fromKey : '',
      targetParentPrefix: typeof body.targetParentPrefix === 'string' ? body.targetParentPrefix : undefined,
    })
    sendOk(res, data)
  })
)

cosRouter.post(
  '/delete-folder',
  asyncHandler(async (req, res) => {
    const userId = req.userId!
    const body = req.body as { key?: unknown }
    const data = await cosService.deleteFolder(userId, {
      key: typeof body.key === 'string' ? body.key : '',
    })
    sendOk(res, data)
  })
)
