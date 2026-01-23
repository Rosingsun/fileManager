# ImageViewer 全屏图片查看器组件

一个功能完整的全屏图片查看器组件，支持图片查看、编辑、EXIF信息显示、颜色提取等功能。

## 功能特性

- ✅ 全屏显示，占据整个浏览器窗口
- ✅ 两栏布局：左侧图片展示，右侧信息面板
- ✅ 图片缩放、旋转、翻转
- ✅ 鼠标滚轮缩放、拖拽平移
- ✅ 双击切换视图模式
- ✅ 键盘快捷键支持
- ✅ 文件信息显示
- ✅ EXIF信息解析和显示
- ✅ 主要颜色提取
- ✅ 图片描述编辑
- ✅ 标签管理
- ✅ 操作工具栏（导航、变换、删除等）
- ✅ 响应式设计
- ✅ 暗色/亮色主题支持

## 安装使用

```tsx
import ImageViewer from '@/components/ImageViewer'
import type { Image } from '@/components/ImageViewer'
```

## 基础用法

```tsx
import { useState } from 'react'
import ImageViewer from '@/components/ImageViewer'
import type { Image } from '@/components/ImageViewer'

function App() {
  const [visible, setVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const images: Image[] = [
    {
      id: '1',
      url: 'https://example.com/image1.jpg',
      filename: 'image1.jpg',
      width: 1920,
      height: 1080,
      size: 1024000,
      format: 'jpeg',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      description: '示例图片1',
      tags: ['风景', '自然'],
      exif: {
        make: 'Canon',
        model: 'EOS 5D Mark IV',
        fNumber: 2.8,
        iso: 400,
        focalLength: 50
      }
    }
    // ... 更多图片
  ]

  return (
    <>
      <button onClick={() => setVisible(true)}>打开图片查看器</button>
      {visible && (
        <ImageViewer
          images={images}
          currentIndex={currentIndex}
          onIndexChange={setCurrentIndex}
          onClose={() => setVisible(false)}
          onDescriptionUpdate={(id, description) => {
            console.log('更新描述:', id, description)
          }}
          onTagsUpdate={(id, tags) => {
            console.log('更新标签:', id, tags)
          }}
        />
      )}
    </>
  )
}
```

## API

### ImageViewerProps

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| images | Image[] | 是 | 图片列表 |
| currentIndex | number | 是 | 当前显示的图片索引 |
| onIndexChange | (index: number) => void | 否 | 图片切换回调 |
| onClose | () => void | 否 | 关闭查看器回调 |
| onImageEdit | (imageId: string, updates: ImageUpdates) => void | 否 | 图片编辑回调 |
| onTagsUpdate | (imageId: string, tags: string[]) => void | 否 | 标签更新回调 |
| onDescriptionUpdate | (imageId: string, description: string) => void | 否 | 描述更新回调 |
| onImageDelete | (imageId: string) => void | 否 | 删除图片回调 |
| onImageRotate | (imageId: string, rotation: number) => void | 否 | 旋转图片回调 |
| onImageFlip | (imageId: string, direction: 'horizontal' \| 'vertical') => void | 否 | 翻转图片回调 |

### Image

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| id | string | 是 | 图片唯一标识 |
| url | string | 是 | 图片URL |
| thumbnailUrl | string | 否 | 缩略图URL |
| filename | string | 是 | 文件名 |
| width | number | 是 | 图片宽度（像素） |
| height | number | 是 | 图片高度（像素） |
| size | number | 是 | 文件大小（字节） |
| format | string | 是 | 文件格式 |
| createdAt | string | 是 | 创建时间（ISO字符串） |
| modifiedAt | string | 是 | 修改时间（ISO字符串） |
| description | string | 否 | 图片描述 |
| tags | string[] | 否 | 标签列表 |
| exif | ExifData | 否 | EXIF元数据 |

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| ESC | 关闭查看器 |
| ← | 上一张 |
| → | 下一张 |
| R | 旋转图片（顺时针90°） |
| F | 切换适应屏幕/自由缩放 |
| 1 | 切换到实际尺寸 |
| Ctrl/Cmd + + | 放大 |
| Ctrl/Cmd + - | 缩小 |

## 视图模式

- **适应屏幕 (fit)**: 自动缩放图片以完全显示在区域内
- **实际尺寸 (actual)**: 以100%原始尺寸显示
- **自由缩放 (free)**: 用户自定义缩放比例

## 注意事项

1. **EXIF数据**: 浏览器环境下无法直接读取EXIF数据，需要后端支持或使用exif-js库。当前实现中，EXIF数据需要从后端获取并传入。

2. **颜色提取**: 颜色提取功能使用Canvas API，需要图片支持跨域访问（CORS）。

3. **性能优化**: 对于大图片，建议使用缩略图进行预览，或实现渐进式加载。

4. **响应式**: 在小屏幕设备上，信息面板会自动移动到底部。

## 样式定制

组件使用CSS变量，可以通过覆盖CSS类来自定义样式。主要类名：

- `.image-viewer`: 主容器
- `.image-viewer-canvas-wrapper`: 图片展示区域
- `.image-viewer-info-wrapper`: 信息面板
- `.info-panel`: 信息面板内容
- `.info-section`: 信息区域
- `.toolbar-btn`: 工具栏按钮

## 示例

完整的使用示例请参考项目中的其他组件，或查看 `src/components/ImageViewer/` 目录下的示例代码。

