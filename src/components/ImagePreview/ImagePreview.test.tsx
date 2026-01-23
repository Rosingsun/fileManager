/**
 * ImagePreview 组件单元测试
 * 
 * 注意：运行测试前需要安装测试框架
 * npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom
 * 
 * 在 package.json 中添加测试脚本：
 * "test": "vitest",
 * "test:ui": "vitest --ui"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImagePreview, { ImageSource } from './ImagePreview'

// Mock antd Modal
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    Modal: ({ children, open, onCancel, footer, title }: any) => {
      if (!open) return null
      return (
        <div data-testid="modal" role="dialog">
          <div data-testid="modal-title">{title}</div>
          <div data-testid="modal-body">{children}</div>
          <div data-testid="modal-footer">{footer}</div>
          <button data-testid="modal-close" onClick={onCancel}>
            关闭
          </button>
        </div>
      )
    },
    Button: ({ children, onClick, disabled, ...props }: any) => (
      <button onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    ),
    Space: ({ children }: any) => <div>{children}</div>,
    Empty: ({ description }: any) => <div>{description}</div>
  }
})

describe('ImagePreview', () => {
  const mockImageUrl = 'https://example.com/test-image.jpg'
  const mockBase64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  beforeEach(() => {
    // 重置所有mock
    vi.clearAllMocks()
  })

  afterEach(() => {
    // 清理
    vi.restoreAllMocks()
  })

  describe('基础渲染', () => {
    it('当 visible 为 false 时不应渲染', () => {
      const { container } = render(
        <ImagePreview visible={false} image={mockImageUrl} onClose={vi.fn()} />
      )
      expect(container.querySelector('[data-testid="modal"]')).toBeNull()
    })

    it('当 visible 为 true 时应该渲染', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('应该显示图片', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      const img = screen.getByAltText('预览')
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', mockImageUrl)
    })

    it('应该支持base64图片', () => {
      render(<ImagePreview visible={true} image={mockBase64Image} onClose={vi.fn()} />)
      const img = screen.getByAltText('预览')
      expect(img).toHaveAttribute('src', mockBase64Image)
    })
  })

  describe('图片列表', () => {
    const images: string[] = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg'
    ]

    it('应该显示图片列表中的第一张图片', () => {
      render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={0}
          onClose={vi.fn()}
        />
      )
      const img = screen.getByAltText('预览')
      expect(img).toHaveAttribute('src', images[0])
    })

    it('应该支持切换到指定索引的图片', () => {
      const { rerender } = render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={0}
          onClose={vi.fn()}
        />
      )

      rerender(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={1}
          onClose={vi.fn()}
        />
      )

      const img = screen.getByAltText('预览')
      expect(img).toHaveAttribute('src', images[1])
    })

    it('应该显示图片索引信息', () => {
      render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={1}
          onClose={vi.fn()}
        />
      )
      expect(screen.getByText(/2 \/ 3/)).toBeInTheDocument()
    })
  })

  describe('关闭功能', () => {
    it('应该调用 onClose 回调当点击关闭按钮', () => {
      const onClose = vi.fn()
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={onClose} />)
      
      const closeButton = screen.getByTestId('modal-close')
      fireEvent.click(closeButton)
      
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('应该支持 Esc 键关闭', () => {
      const onClose = vi.fn()
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={onClose} />)
      
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
      
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('缩放功能', () => {
    it('应该支持放大', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      
      const zoomInButton = screen.getByTitle('放大')
      fireEvent.click(zoomInButton)
      
      const img = screen.getByAltText('预览')
      expect(img).toHaveStyle({ transform: 'scale(1.2) rotate(0deg)' })
    })

    it('应该支持缩小', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      
      const zoomOutButton = screen.getByTitle('缩小')
      fireEvent.click(zoomOutButton)
      
      const img = screen.getByAltText('预览')
      expect(img).toHaveStyle({ transform: 'scale(0.8) rotate(0deg)' })
    })

    it('应该支持重置缩放', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      
      const zoomInButton = screen.getByTitle('放大')
      fireEvent.click(zoomInButton)
      fireEvent.click(zoomInButton)
      
      const resetButton = screen.getByTitle('重置缩放')
      fireEvent.click(resetButton)
      
      const img = screen.getByAltText('预览')
      expect(img).toHaveStyle({ transform: 'scale(1) rotate(0deg)' })
    })

    it('应该支持键盘快捷键缩放', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      
      fireEvent.keyDown(window, { key: '+', ctrlKey: true })
      
      const img = screen.getByAltText('预览')
      expect(img).toHaveStyle({ transform: 'scale(1.2) rotate(0deg)' })
    })
  })

  describe('旋转功能', () => {
    it('应该支持向右旋转', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      
      const rotateRightButton = screen.getByTitle('向右旋转')
      fireEvent.click(rotateRightButton)
      
      const img = screen.getByAltText('预览')
      expect(img).toHaveStyle({ transform: 'scale(1) rotate(90deg)' })
    })

    it('应该支持向左旋转', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      
      const rotateLeftButton = screen.getByTitle('向左旋转')
      fireEvent.click(rotateLeftButton)
      
      const img = screen.getByAltText('预览')
      expect(img).toHaveStyle({ transform: 'scale(1) rotate(-90deg)' })
    })

    it('应该支持重置旋转', () => {
      render(<ImagePreview visible={true} image={mockImageUrl} onClose={vi.fn()} />)
      
      const rotateRightButton = screen.getByTitle('向右旋转')
      fireEvent.click(rotateRightButton)
      
      const resetButton = screen.getByTitle('重置旋转')
      fireEvent.click(resetButton)
      
      const img = screen.getByAltText('预览')
      expect(img).toHaveStyle({ transform: 'scale(1) rotate(0deg)' })
    })
  })

  describe('导航功能', () => {
    const images: string[] = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
      'https://example.com/image3.jpg'
    ]

    it('应该支持上一张导航', () => {
      const onIndexChange = vi.fn()
      render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={1}
          onClose={vi.fn()}
          onIndexChange={onIndexChange}
        />
      )
      
      const prevButton = screen.getByTitle('上一张')
      fireEvent.click(prevButton)
      
      expect(onIndexChange).toHaveBeenCalledWith(0)
    })

    it('应该支持下一张导航', () => {
      const onIndexChange = vi.fn()
      render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={1}
          onClose={vi.fn()}
          onIndexChange={onIndexChange}
        />
      )
      
      const nextButton = screen.getByTitle('下一张')
      fireEvent.click(nextButton)
      
      expect(onIndexChange).toHaveBeenCalledWith(2)
    })

    it('应该支持键盘快捷键导航', () => {
      const onIndexChange = vi.fn()
      render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={1}
          onClose={vi.fn()}
          onIndexChange={onIndexChange}
        />
      )
      
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(onIndexChange).toHaveBeenCalledWith(2)
      
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      expect(onIndexChange).toHaveBeenCalledWith(0)
    })

    it('第一张图片时上一张按钮应该禁用', () => {
      render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={0}
          onClose={vi.fn()}
        />
      )
      
      const prevButton = screen.getByTitle('上一张')
      expect(prevButton).toBeDisabled()
    })

    it('最后一张图片时下一张按钮应该禁用', () => {
      render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={images.length - 1}
          onClose={vi.fn()}
        />
      )
      
      const nextButton = screen.getByTitle('下一张')
      expect(nextButton).toBeDisabled()
    })
  })

  describe('事件回调', () => {
    it('应该调用 onLoad 当图片加载完成', async () => {
      const onLoad = vi.fn()
      render(
        <ImagePreview
          visible={true}
          image={mockImageUrl}
          onClose={vi.fn()}
          onLoad={onLoad}
        />
      )
      
      const img = screen.getByAltText('预览')
      fireEvent.load(img)
      
      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledWith(0)
      })
    })

    it('应该调用 onError 当图片加载失败', async () => {
      const onError = vi.fn()
      render(
        <ImagePreview
          visible={true}
          image="invalid-url"
          onClose={vi.fn()}
          onError={onError}
        />
      )
      
      const img = screen.getByAltText('预览')
      fireEvent.error(img)
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalled()
      })
    })
  })

  describe('工具栏控制', () => {
    it('应该可以隐藏工具栏', () => {
      render(
        <ImagePreview
          visible={true}
          image={mockImageUrl}
          onClose={vi.fn()}
          showToolbar={false}
        />
      )
      
      expect(screen.queryByTitle('放大')).not.toBeInTheDocument()
    })

    it('应该可以隐藏导航按钮', () => {
      const images = ['image1.jpg', 'image2.jpg']
      render(
        <ImagePreview
          visible={true}
          images={images}
          currentIndex={0}
          onClose={vi.fn()}
          showNavigation={false}
        />
      )
      
      expect(screen.queryByTitle('上一张')).not.toBeInTheDocument()
      expect(screen.queryByTitle('下一张')).not.toBeInTheDocument()
    })
  })

  describe('自定义配置', () => {
    it('应该支持自定义缩放范围', () => {
      render(
        <ImagePreview
          visible={true}
          image={mockImageUrl}
          onClose={vi.fn()}
          minScale={50}
          maxScale={200}
          scaleStep={10}
        />
      )
      
      // 多次点击放大按钮，应该受maxScale限制
      const zoomInButton = screen.getByTitle('放大')
      for (let i = 0; i < 15; i++) {
        fireEvent.click(zoomInButton)
      }
      
      const img = screen.getByAltText('预览')
      // 应该不超过200%
      expect(img).toHaveStyle({ transform: expect.stringContaining('scale(2)') })
    })
  })
})

