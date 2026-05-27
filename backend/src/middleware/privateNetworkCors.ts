import type { Request, Response, NextFunction } from 'express'

/**
 * Chromium Private Network Access：跨端口访问本地 API 时会先发 OPTIONS；
 * 预检及 CORS 模式下的实际响应均须带 Access-Control-Allow-Private-Network，否则只见 OPTIONS、真实 POST/GET 被拦截。
 * 本服务为本地认证 API，统一回应该许可并与 cors 的 Origin 校验配合。
 */
export function privateNetworkAccessHeader(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  next()
}
