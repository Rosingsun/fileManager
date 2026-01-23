import React from 'react'
import { createRoot } from 'react-dom/client'
import ImageViewer from './ImageViewer'
import type { Image } from './types'

// 测试图片列表，包含不同格式和EXIF信息的图片
const testImages: Image[] = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=100&auto=format&fit=crop',
    filename: 'landscape.jpg',
    width: 800,
    height: 533,
    size: 102400,
    format: 'jpeg',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    description: '测试风景图片',
    tags: ['风景', '测试']
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=100&auto=format&fit=crop',
    filename: 'portrait.jpg',
    width: 800,
    height: 1200,
    size: 153600,
    format: 'jpeg',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    description: '测试人像图片',
    tags: ['人像', '测试']
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800&auto=format&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&auto=format&fit=crop',
    filename: 'flower.jpg',
    width: 800,
    height: 533,
    size: 102400,
    format: 'jpeg',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    description: '测试花卉图片',
    tags: ['花卉', '测试']
  }
]

// 创建测试组件
const ExifTest: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(true)
  const [currentIndex, setCurrentIndex] = React.useState(0)

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f0f0' }}>
      {isOpen && (
        <ImageViewer
          images={testImages}
          currentIndex={currentIndex}
          onClose={() => setIsOpen(false)}
          onIndexChange={setCurrentIndex}
        />
      )}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          打开图片查看器
        </button>
      )}
    </div>
  )
}

// 渲染测试组件
const root = createRoot(document.getElementById('root')!)
root.render(<ExifTest />)
