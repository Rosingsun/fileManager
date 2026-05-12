import type { Request, Response, NextFunction } from 'express'

/**
 * Chromium Private Network Access：从 localhost 页面访问 127.0.0.1 等本地目标时，
 * 预检请求会带 Access-Control-Request-Private-Network: true，响应必须允许，否则浏览器不会发起真实 POST/GET。
 */
export function privateNetworkAccessHeader(req: Request, res: Response, next: NextFunction): void {
  if (req.get('Access-Control-Request-Private-Network') === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
  }
  next()
}
