/**
 * 探测认证 API 是否可达：GET /health
 * 用法：先启动 backend（npm run dev:auth-api），再在根目录执行 node scripts/check-auth-api.mjs
 */
const base = (process.env.AUTH_API_URL || 'http://localhost:3847').replace(/\/$/, '')

try {
  const res = await fetch(`${base}/health`)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    console.error('[check-auth-api] 非 JSON 响应:', text.slice(0, 200))
    process.exit(1)
  }
  if (!res.ok || json.ok !== true || json.data?.status !== 'ok') {
    console.error('[check-auth-api] 异常:', res.status, json)
    process.exit(1)
  }
  console.log('[check-auth-api] 通过', base, '->', json)
} catch (e) {
  console.error('[check-auth-api] 请求失败（请先启动后端 npm run dev:auth-api）:', e.message)
  process.exit(1)
}
