export type OperationLogEntry = {
  id: string
  ts: number
  action: string
  summary?: string
  detail?: string
}

export async function appendOperationLog(
  userId: string,
  action: string,
  summary?: string,
  detail?: string
): Promise<void> {
  const api = window.electronAPI
  if (!api?.appendOperationLog) return
  await api.appendOperationLog({ userId, action, summary, detail })
}

export async function listOperationLogs(userId: string, limit = 200): Promise<OperationLogEntry[]> {
  const api = window.electronAPI
  if (!api?.listOperationLogs) return []
  return api.listOperationLogs(userId, limit)
}

export async function clearOperationLogs(userId: string): Promise<void> {
  const api = window.electronAPI
  if (!api?.clearOperationLogs) return
  await api.clearOperationLogs(userId)
}

export async function logToolAction(userId: string | undefined, action: string, summary: string, detail?: string): Promise<void> {
  if (!userId) return
  await appendOperationLog(userId, action, summary, detail)
}

/** 使用当前登录用户写一条本地日志（未登录则忽略）；用动态 import 避免与 auth store 循环依赖 */
export function logSignedInUserAction(action: string, summary?: string, detail?: string): void {
  void import('../stores/useAuthStore')
    .then(({ useAuthStore }) => {
      const uid = useAuthStore.getState().user?.id
      if (uid) void appendOperationLog(uid, action, summary, detail)
    })
    .catch(() => {
      /* ignore */
    })
}
