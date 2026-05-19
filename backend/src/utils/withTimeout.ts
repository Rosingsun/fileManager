/**
 * 在指定毫秒内未完成则 reject，避免下游（如未响应的 TCP）导致 HTTP 永久挂起。
 * 超时时会 clearTimeout；若底层 Promise 稍后仍完成，其结果被丢弃（调用方已走超时分支）。
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(onTimeout()), ms)
  })
  try {
    return await Promise.race([promise, deadline])
  } finally {
    if (id !== undefined) clearTimeout(id)
  }
}
