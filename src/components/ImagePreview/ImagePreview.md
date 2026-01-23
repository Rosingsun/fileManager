# ImagePreview 图片预览组件

一个功能完整的图片预览弹出框组件，支持缩放、旋转、导航等操作。

## 功能特性

- ✅ 支持单个图片或图片列表预览
- ✅ 支持图片URL或base64数据
- ✅ 图片缩放（放大/缩小）
- ✅ 图片旋转（左旋/右旋）
- ✅ 上一张/下一张导航（多图模式）
- ✅ 键盘快捷键支持
- ✅ 加载状态显示
- ✅ 错误处理和重试
- ✅ 响应式设计
- ✅ 可自定义样式

## 安装使用

```tsx
import ImagePreview from '@/components/ImagePreview/ImagePreview'
```

## 基础用法

### 单个图片预览

```tsx
import { useState } from 'react'
import ImagePreview from '@/components/ImagePreview/ImagePreview'

function App() {
  const [visible, setVisible] = useState(false)
  const imageUrl = 'https://example.com/image.jpg'

  return (
    <>
      <button onClick={() => setVisible(true)}>预览图片</button>
      <ImagePreview
        visible={visible}
        image={imageUrl}
        onClose={() => setVisible(false)}
      />
    </>
  )
}
```

### 图片列表预览

```tsx
import { useState } from 'react'
import ImagePreview from '@/components/ImagePreview/ImagePreview'

function App() {
  const [visible, setVisible] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const images = [
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
    'https://example.com/image3.jpg'
  ]

  return (
    <>
      <button onClick={() => setVisible(true)}>预览图片</button>
      <ImagePreview
        visible={visible}
        images={images}
        currentIndex={currentIndex}
        onClose={() => setVisible(false)}
        onIndexChange={setCurrentIndex}
      />
    </>
  )
}
```

### 使用base64数据

```tsx
<ImagePreview
  visible={visible}
  image="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  onClose={() => setVisible(false)}
/>
```

### 带标题和描述的图片列表

```tsx
const images = [
  {
    src: 'https://example.com/image1.jpg',
    title: '图片1',
    description: '这是第一张图片'
  },
  {
    src: 'https://example.com/image2.jpg',
    title: '图片2',
    description: '这是第二张图片'
  }
]

<ImagePreview
  visible={visible}
  images={images}
  currentIndex={currentIndex}
  onClose={() => setVisible(false)}
  onIndexChange={setCurrentIndex}
/>
```

## API 参数

### ImagePreviewProps

| 参数 | 说明 | 类型 | 默认值 | 必填 |
|------|------|------|--------|------|
| visible | 是否显示预览框 | `boolean` | - | ✅ |
| image | 单个图片源（URL或base64） | `string` | - | - |
| images | 图片列表 | `ImageSource[] \| string[]` | - | - |
| currentIndex | 当前显示的图片索引 | `number` | `0` | - |
| onClose | 关闭预览框的回调 | `() => void` | - | - |
| onIndexChange | 图片切换回调 | `(index: number) => void` | - | - |
| onLoad | 图片加载完成回调 | `(index: number) => void` | - | - |
| onError | 图片加载失败回调 | `(index: number, error: Error) => void` | - | - |
| showToolbar | 是否显示工具栏 | `boolean` | `true` | - |
| showNavigation | 是否显示导航按钮 | `boolean` | `true` | - |
| enableKeyboard | 是否启用键盘快捷键 | `boolean` | `true` | - |
| width | Modal宽度 | `number \| string` | `800` | - |
| height | Modal高度 | `number \| string` | `'80%'` | - |
| minScale | 最小缩放比例 | `number` | `20` | - |
| maxScale | 最大缩放比例 | `number` | `300` | - |
| scaleStep | 缩放步进值 | `number` | `20` | - |
| rotationStep | 旋转步进值 | `number` | `90` | - |
| className | 自定义类名 | `string` | `''` | - |

### ImageSource

| 参数 | 说明 | 类型 | 必填 |
|------|------|------|------|
| src | 图片URL或base64数据 | `string` | ✅ |
| title | 图片标题 | `string` | - |
| description | 图片描述 | `string` | - |

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Esc` | 关闭预览框 |
| `←` | 上一张图片 |
| `→` | 下一张图片 |
| `Ctrl/Cmd + +` | 放大 |
| `Ctrl/Cmd + -` | 缩小 |
| `Ctrl/Cmd + ←` | 向左旋转 |
| `Ctrl/Cmd + →` | 向右旋转 |
| `Ctrl/Cmd + 0` | 重置所有 |

## 事件回调

### onClose

关闭预览框时触发。

```tsx
<ImagePreview
  visible={visible}
  image={imageUrl}
  onClose={() => {
    console.log('预览框已关闭')
    setVisible(false)
  }}
/>
```

### onIndexChange

图片切换时触发（仅在使用图片列表时）。

```tsx
<ImagePreview
  visible={visible}
  images={images}
  currentIndex={currentIndex}
  onIndexChange={(index) => {
    console.log('切换到图片:', index)
    setCurrentIndex(index)
  }}
/>
```

### onLoad

图片加载完成时触发。

```tsx
<ImagePreview
  visible={visible}
  image={imageUrl}
  onLoad={(index) => {
    console.log('图片加载完成:', index)
  }}
/>
```

### onError

图片加载失败时触发。

```tsx
<ImagePreview
  visible={visible}
  image={imageUrl}
  onError={(index, error) => {
    console.error('图片加载失败:', index, error)
  }}
/>
```

## 自定义样式

组件支持通过 `className` 属性添加自定义样式：

```tsx
<ImagePreview
  visible={visible}
  image={imageUrl}
  className="my-custom-preview"
  onClose={() => setVisible(false)}
/>
```

```css
.my-custom-preview .image-preview-container {
  background-color: #000;
}

.my-custom-preview .image-preview-img {
  border: 2px solid #fff;
}
```

## 高级用法

### 隐藏工具栏

```tsx
<ImagePreview
  visible={visible}
  image={imageUrl}
  showToolbar={false}
  onClose={() => setVisible(false)}
/>
```

### 禁用键盘快捷键

```tsx
<ImagePreview
  visible={visible}
  image={imageUrl}
  enableKeyboard={false}
  onClose={() => setVisible(false)}
/>
```

### 自定义缩放范围

```tsx
<ImagePreview
  visible={visible}
  image={imageUrl}
  minScale={50}
  maxScale={500}
  scaleStep={10}
  onClose={() => setVisible(false)}
/>
```

### 自定义Modal尺寸

```tsx
<ImagePreview
  visible={visible}
  image={imageUrl}
  width={1200}
  height="90%"
  onClose={() => setVisible(false)}
/>
```

## 注意事项

1. **图片源格式**：支持标准的图片URL（http/https）和base64数据URI格式
2. **图片列表**：当使用 `images` 属性时，`currentIndex` 必须有效（0 到 images.length-1）
3. **性能优化**：对于大量图片，建议使用懒加载或虚拟列表
4. **跨域问题**：如果图片源存在跨域限制，可能需要配置CORS
5. **内存管理**：预览大量高清图片时注意内存占用，建议在关闭时清理状态

## 示例代码

完整示例请参考 `src/components/FileList.tsx` 中的使用方式。

## 更新日志

### v1.0.0
- 初始版本
- 支持基础预览功能
- 支持缩放、旋转、导航
- 支持键盘快捷键

