import { useState, useEffect } from 'react'

export type Breakpoint = 'xl' | 'lg' | 'md' | 'sm' | 'xs'

export interface ResponsiveInfo {
  breakpoint: Breakpoint
  isMobile: boolean
  isSidebarCollapsed: boolean
  isPanelCollapsed: boolean
  width: number
  height: number
}

export function useResponsive(): ResponsiveInfo {
  const [width, setWidth] = useState(window.innerWidth)
  const [height, setHeight] = useState(window.innerHeight)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const handleResize = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setWidth(window.innerWidth)
        setHeight(window.innerHeight)
      }, 100)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const breakpoint: Breakpoint =
    width >= 1400 ? 'xl' :
    width >= 1100 ? 'lg' :
    width >= 860 ? 'md' :
    width >= 640 ? 'sm' :
    'xs'

  const isMobile = width < 640
  const isSidebarCollapsed = width < 1100
  const isPanelCollapsed = width < 860

  return { breakpoint, isMobile, isSidebarCollapsed, isPanelCollapsed, width, height }
}
