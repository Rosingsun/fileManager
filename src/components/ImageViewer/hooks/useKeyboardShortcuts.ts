/**
 * 键盘快捷键Hook
 */

import { useEffect } from 'react'

export interface KeyboardShortcuts {
  onEscape?: () => void
  onSpace?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onKeyR?: () => void
  onKeyF?: () => void
  onKey1?: () => void
  onPlus?: () => void
  onMinus?: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  const {
    onEscape,
    onSpace,
    onArrowLeft,
    onArrowRight,
    onKeyR,
    onKeyF,
    onKey1,
    onPlus,
    onMinus,
    enabled = true
  } = shortcuts

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果用户正在输入，不触发快捷键
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      switch (e.key) {
        case 'Escape':
          if (onEscape) {
            e.preventDefault()
            onEscape()
          }
          break
        case ' ':
          if (onSpace && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            onSpace()
          }
          break
        case 'ArrowLeft':
          if (onArrowLeft && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            onArrowLeft()
          }
          break
        case 'ArrowRight':
          if (onArrowRight && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            onArrowRight()
          }
          break
        case 'r':
        case 'R':
          if (onKeyR && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            onKeyR()
          }
          break
        case 'f':
        case 'F':
          if (onKeyF && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            onKeyF()
          }
          break
        case '1':
          if (onKey1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            onKey1()
          }
          break
        case '+':
        case '=':
          if (onPlus && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onPlus()
          }
          break
        case '-':
        case '_':
          if (onMinus && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onMinus()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    enabled,
    onEscape,
    onSpace,
    onArrowLeft,
    onArrowRight,
    onKeyR,
    onKeyF,
    onKey1,
    onPlus,
    onMinus
  ])
}

