/**
 * 图片加载Hook
 */

import { useState, useEffect, useCallback } from 'react'

export interface ImageLoadState {
  isLoading: boolean
  isError: boolean
  error: Error | null
}

export function useImageLoader(imageUrl: string | null) {
  const [state, setState] = useState<ImageLoadState>({
    isLoading: true,
    isError: false,
    error: null
  })

  useEffect(() => {
    if (!imageUrl || imageUrl.trim() === '') {
      setState({ isLoading: false, isError: false, error: null })
      return
    }

    setState({ isLoading: true, isError: false, error: null })

    const img = new Image()
    let isCancelled = false
    
    const handleLoad = () => {
      if (!isCancelled) {
        setState({ isLoading: false, isError: false, error: null })
      }
    }

    const handleError = () => {
      if (!isCancelled) {
        setState({
          isLoading: false,
          isError: true,
          error: new Error('图片加载失败')
        })
      }
    }

    img.onload = handleLoad
    img.onerror = handleError
    
    // 设置 crossOrigin 属性以支持跨域图片（如果需要）
    // img.crossOrigin = 'anonymous'
    
    img.src = imageUrl

    return () => {
      isCancelled = true
      img.onload = null
      img.onerror = null
      img.src = '' // 取消加载
    }
  }, [imageUrl])

  const retry = useCallback(() => {
    if (imageUrl) {
      setState({ isLoading: true, isError: false, error: null })
      const img = new Image()
      img.onload = () => setState({ isLoading: false, isError: false, error: null })
      img.onerror = () => setState({
        isLoading: false,
        isError: true,
        error: new Error('图片加载失败')
      })
      img.src = imageUrl
    }
  }, [imageUrl])

  return { ...state, retry }
}

