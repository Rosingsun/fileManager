/**
 * 使用 XHR 发起 PUT/POST，以支持 upload progress（fetch 无标准上传进度）。
 */

export class XhrHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseText: string
  ) {
    super(message)
    this.name = 'XhrHttpError'
  }
}

export function xhrPutWithProgress(
  url: string,
  body: Blob,
  requestHeaders: Record<string, string>,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  const totalHint = body.size > 0 ? body.size : 1
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.withCredentials = false
    for (const [k, v] of Object.entries(requestHeaders)) {
      if (v) xhr.setRequestHeader(k, v)
    }
    xhr.upload.onprogress = (ev) => {
      const total = ev.lengthComputable && ev.total > 0 ? ev.total : totalHint
      onProgress(ev.loaded, total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(totalHint, totalHint)
        resolve()
        return
      }
      const bodyText = (xhr.responseText || '').trim().replace(/\s+/g, ' ').slice(0, 400)
      reject(
        new XhrHttpError(`HTTP ${xhr.status}${bodyText ? ` ${bodyText}` : ''}`, xhr.status, xhr.responseText || '')
      )
    }
    xhr.onerror = () => reject(new TypeError('Network request failed'))
    xhr.onabort = () => reject(new Error('aborted'))
    xhr.send(body)
  })
}

/** XHR POST，返回响应文本（用于解析 JSON 包体），支持上传进度 */
export function xhrPostWithProgress(
  url: string,
  body: Blob,
  requestHeaders: Record<string, string>,
  onProgress: (loaded: number, total: number) => void
): Promise<string> {
  const totalHint = body.size > 0 ? body.size : 1
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = false
    xhr.responseType = 'text'
    for (const [k, v] of Object.entries(requestHeaders)) {
      if (v) xhr.setRequestHeader(k, v)
    }
    xhr.upload.onprogress = (ev) => {
      const total = ev.lengthComputable && ev.total > 0 ? ev.total : totalHint
      onProgress(ev.loaded, total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(totalHint, totalHint)
        resolve(xhr.responseText || '')
        return
      }
      const bodyText = (xhr.responseText || '').trim().replace(/\s+/g, ' ').slice(0, 400)
      reject(
        new XhrHttpError(`HTTP ${xhr.status}${bodyText ? ` ${bodyText}` : ''}`, xhr.status, xhr.responseText || '')
      )
    }
    xhr.onerror = () => reject(new TypeError('Network request failed'))
    xhr.onabort = () => reject(new Error('aborted'))
    xhr.send(body)
  })
}
