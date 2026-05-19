import { useEffect, useState } from 'react'
import { resolveAvatarDisplayUrl, revokeAvatarDisplayUrl } from '../utils'

export function useAvatarSrc(avatarUrl: string | null | undefined): {
  src: string | undefined
  loading: boolean
} {
  const [src, setSrc] = useState<string | undefined>(() => {
    const trimmed = avatarUrl?.trim()
    if (trimmed && /^https?:\/\//i.test(trimmed)) return trimmed
    return undefined
  })
  const [loading, setLoading] = useState(() => {
    const trimmed = avatarUrl?.trim()
    return Boolean(trimmed && !/^https?:\/\//i.test(trimmed))
  })

  useEffect(() => {
    const trimmed = avatarUrl?.trim()
    if (!trimmed) {
      setSrc(undefined)
      setLoading(false)
      return
    }

    if (/^https?:\/\//i.test(trimmed)) {
      setSrc(trimmed)
      setLoading(false)
      return
    }

    let cancelled = false
    let objectUrl: string | undefined
    setLoading(true)
    void resolveAvatarDisplayUrl(trimmed)
      .then((url) => {
        if (cancelled) {
          revokeAvatarDisplayUrl(url)
          return
        }
        objectUrl = url
        setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(undefined)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      revokeAvatarDisplayUrl(objectUrl)
    }
  }, [avatarUrl])

  return { src, loading }
}
