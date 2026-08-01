import { useCallback, useRef, useState } from 'react'

const MIN_SCALE = 10
const MAX_SCALE = 400
const DEFAULT_SCALE = 100

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export interface ImageViewport {
  scale: number
  pan: { x: number; y: number }
}

export function useSyncedImageViewport() {
  const [viewport, setViewport] = useState<ImageViewport>({
    scale: DEFAULT_SCALE,
    pan: { x: 0, y: 0 },
  })

  const resetViewport = useCallback(() => {
    setViewport({ scale: DEFAULT_SCALE, pan: { x: 0, y: 0 } })
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent, container: HTMLElement) => {
    e.preventDefault()
    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    setViewport((prev) => {
      const scaleFactor = prev.scale / 100
      const imageCenterX = centerX + prev.pan.x
      const imageCenterY = centerY + prev.pan.y
      const relativeX = (mouseX - imageCenterX) / scaleFactor
      const relativeY = (mouseY - imageCenterY) / scaleFactor

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = clamp(prev.scale * zoomFactor, MIN_SCALE, MAX_SCALE)
      const newFactor = newScale / 100

      const newImageCenterX = mouseX - relativeX * newFactor
      const newImageCenterY = mouseY - relativeY * newFactor

      return {
        scale: newScale,
        pan: {
          x: newImageCenterX - centerX,
          y: newImageCenterY - centerY,
        },
      }
    })
  }, [])

  const panBy = useCallback((deltaX: number, deltaY: number) => {
    setViewport((prev) => ({
      ...prev,
      pan: { x: prev.pan.x + deltaX, y: prev.pan.y + deltaY },
    }))
  }, [])

  return { viewport, resetViewport, handleWheel, panBy }
}

const DRAG_THRESHOLD_PX = 5

export function usePointerDragPan(panBy: (dx: number, dy: number) => void) {
  const draggingRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const movedRef = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    draggingRef.current = true
    movedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        movedRef.current = true
      }
      if (movedRef.current) {
        panBy(dx, dy)
        startRef.current = { x: e.clientX, y: e.clientY }
      }
    },
    [panBy]
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }, [])

  const wasDrag = useCallback(() => movedRef.current, [])

  const resetDragFlag = useCallback(() => {
    movedRef.current = false
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp, wasDrag, resetDragFlag }
}
