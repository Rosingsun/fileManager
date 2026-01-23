import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import ImageViewer from './ImageViewer'
import '@testing-library/jest-dom'

// Mock useImageLoader hook
jest.mock('./hooks/useImageLoader', () => ({
  useImageLoader: jest.fn(() => ({
    isLoading: false,
    isError: false,
    error: null,
    retry: jest.fn()
  }))
}))

// Mock useKeyboardShortcuts hook
jest.mock('./hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn()
}))

describe('ImageViewer Component', () => {
  const mockImages = [
    {
      id: '1',
      url: 'https://example.com/image1.jpg',
      filename: 'image1.jpg',
      width: 1920,
      height: 1080,
      size: 1024 * 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      description: ''
    },
    {
      id: '2',
      url: 'https://example.com/image2.jpg',
      filename: 'image2.jpg',
      width: 1280,
      height: 720,
      size: 512 * 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      description: ''
    }
  ]

  it('should render the component with initial image', () => {
    render(
      <ImageViewer
        images={mockImages}
        currentIndex={0}
        onClose={() => {}}
      />
    )

    // 检查组件是否渲染
    expect(screen.getByRole('img', { name: /预览/i })).toBeInTheDocument()
  })

  it('should display the correct image URL', () => {
    render(
      <ImageViewer
        images={mockImages}
        currentIndex={0}
        onClose={() => {}}
      />
    )

    // 检查图片是否使用了正确的URL
    const imgElement = screen.getByRole('img', { name: /预览/i }) as HTMLImageElement
    expect(imgElement.src).toBe(mockImages[0].url)
  })

  it('should handle different image URLs including non-data URLs', () => {
    const customImages = [
      {
        id: '3',
        url: 'https://test-domain.com/custom-image.jpg',
        filename: 'custom-image.jpg',
        width: 800,
        height: 600,
        size: 256 * 1024,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        description: ''
      }
    ]

    render(
      <ImageViewer
        images={customImages}
        currentIndex={0}
        onClose={() => {}}
      />
    )

    // 检查图片是否正确渲染，即使URL不是data:开头
    expect(screen.getByRole('img', { name: /预览/i })).toBeInTheDocument()
  })

  it('should handle image loading state', () => {
    // Mock loading state
    const { useImageLoader } = require('./hooks/useImageLoader')
    ;(useImageLoader as jest.Mock).mockReturnValue({
      isLoading: true,
      isError: false,
      error: null,
      retry: jest.fn()
    })

    render(
      <ImageViewer
        images={mockImages}
        currentIndex={0}
        onClose={() => {}}
      />
    )

    // 检查加载状态是否显示
    expect(screen.getByText(/正在加载图片/i)).toBeInTheDocument()
  })

  it('should handle image error state', () => {
    // Mock error state
    const { useImageLoader } = require('./hooks/useImageLoader')
    ;(useImageLoader as jest.Mock).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('图片加载失败'),
      retry: jest.fn()
    })

    render(
      <ImageViewer
        images={mockImages}
        currentIndex={0}
        onClose={() => {}}
      />
    )

    // 检查错误状态是否显示
    expect(screen.getByText(/图片加载失败/i)).toBeInTheDocument()
  })

  it('should update when currentIndex changes', () => {
    const { rerender } = render(
      <ImageViewer
        images={mockImages}
        currentIndex={0}
        onClose={() => {}}
      />
    )

    // 切换到第二张图片
    rerender(
      <ImageViewer
        images={mockImages}
        currentIndex={1}
        onClose={() => {}}
      />
    )

    // 检查组件是否重新渲染
    expect(screen.getByRole('img', { name: /预览/i })).toBeInTheDocument()
  })
})
