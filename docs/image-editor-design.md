# 图片编辑功能设计文档

## 1. 概述

本文档描述文件整理工具的图片编辑功能完整设计方案，提供专业且易用的图片编辑体验。

## 2. 功能清单

### 2.1 基础调整（已实现，优化预览）

| 功能 | 范围 | 说明 |
|------|------|------|
| 亮度 | 0-200% | 默认 100% |
| 对比度 | 0-200% | 默认 100% |
| 饱和度 | 0-200% | 默认 100% |
| 曝光 | 0-200% | 默认 100% |
| 色相 | 0-360° | 默认 0° |

### 2.2 变换操作（已实现）

| 功能 | 值 | 说明 |
|------|-----|------|
| 旋转 | 0-360° | 顺时针旋转 |
| 水平翻转 | boolean | 左右镜像 |
| 垂直翻转 | boolean | 上下镜像 |

### 2.3 裁剪功能（待完善）

**当前问题**：需要手动输入坐标 (x, y, w, h)

**改进方案**：
- 可视化裁切框，鼠标拖拽调整
- 支持预设比例：自由、1:1、4:3、16:9
- 裁切框可移动和缩放

### 2.4 滤镜效果（新增）

| 滤镜 | 参数 | 说明 |
|------|------|------|
| 灰度 | 无 | 转换为黑白 |
| 复古 | 强度 0-100 | 棕褐色调，模拟老照片 |
| 模糊 | 半径 0-20 | 高斯模糊 |
| 锐化 | 强度 0-100 | 增强边缘细节 |

### 2.5 高级调整（新增）

| 功能 | 范围 | 说明 |
|------|------|------|
| 阴影 | -100 到 +100 | 提亮/压暗阴影部分 |
| 高光 | -100 到 +100 | 提亮/压暗高光部分 |
| 清晰度 | -100 到 +100 | 增加局部对比度 |
| 色调分离 | -100 到 +100 | 调整红/青、蓝/黄平衡 |

### 2.6 预设功能（已实现，优化）

**内置预设**：
- 默认（无调整）
- 明亮
- 柔和
- 鲜艳
- 复古
- 黑白
- 清冷
- 暖阳

**用户预设**：
- 保存当前调整为命名预设
- 应用/编辑/删除预设

### 2.7 格式与压缩（已实现）

| 功能 | 选项 |
|------|------|
| 格式转换 | JPEG, PNG, WebP, BMP, TIFF |
| 质量压缩 | 1-100% |

## 3. UI 布局设计

```
┌─────────────────────────────────────────────────────────────┐
│  图片编辑                                    [格式/压缩] [重置] [取消] [保存] │
├───────────────────────────────────────────┬─────────────────┤
│                                           │ 预设            │
│                                           │ [预设下拉选择]   │
│         图片预览区域                      ├─────────────────┤
│         (支持翻转/旋转预览)                │ 基础调整        │
│                                           │ 亮度 [━━━━━○]   │
│                                           │ 对比度 [━━━━━]  │
│                                           │ 饱和度 [━━━○]   │
│                                           │ ...             │
│                                           ├─────────────────┤
│                                           │ 滤镜            │
│                                           │ [灰度][复古]    │
│                                           │ [模糊][锐化]    │
│                                           ├─────────────────┤
│                                           │ 高级            │
│                                           │ 阴影 [━━○━━]   │
│                                           │ 高光 [━━━○]    │
│                                           │ 清晰度 [━━━]   │
│                                           ├─────────────────┤
│                                           │ 变换            │
│                                           │ 旋转 [0°    ]   │
│                                           │ [水平][垂直]    │
│                                           ├─────────────────┤
│                                           │ 裁剪            │
│                                           │ [比例▼]         │
│                                           │ [应用裁剪]      │
└───────────────────────────────────────────┴─────────────────┘
```

## 4. 技术实现

### 4.1 数据结构

```typescript
interface ImageEditSettings {
  // 基础调整
  brightness?: number    // 0-200, 默认 100
  contrast?: number     // 0-200, 默认 100
  saturation?: number    // 0-200, 默认 100
  hue?: number          // 0-360, 默认 0
  exposure?: number    // 0-200, 默认 100
  
  // 变换
  rotation?: number    // 0-360, 默认 0
  flipHorizontal?: boolean
  flipVertical?: boolean
  
  // 裁剪
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  
  // 滤镜
  grayscale?: boolean
  vintage?: number      // 0-100
  blur?: number          // 0-20
  sharpen?: number      // 0-100
  
  // 高级
  shadows?: number      // -100 到 100
  highlights?: number   // -100 到 100
  clarity?: number      // -100 到 100
  tint?: number         // -100 到 100
}
```

### 4.2 CSS 预览

```typescript
// 滤镜组合
function getFilterCss(settings: ImageEditSettings): string {
  const filters: string[] = []
  
  // 基础调整
  if (settings.brightness) filters.push(`brightness(${settings.brightness}%)`)
  if (settings.contrast) filters.push(`contrast(${settings.contrast}%)`)
  if (settings.saturation) filters.push(`saturate(${settings.saturation}%)`)
  if (settings.hue) filters.push(`hue-rotate(${settings.hue}deg)')
  if (settings.exposure) filters.push(`brightness(${settings.exposure}%)')
  
  // 滤镜
  if (settings.grayscale) filters.push('grayscale(100%)')
  if (settings.blur) filters.push(`blur(${settings.blur}px)`)
  if (settings.vintage) filters.push(`sepia(${settings.vintage}%)`)
  
  return filters.join(' ')
}

// 变换组合
function getTransform(settings: ImageEditSettings): string {
  const transforms: string[] = []
  if (settings.rotation) transforms.push(`rotate(${settings.rotation}deg)`)
  if (settings.flipHorizontal) transforms.push('scaleX(-1)')
  if (settings.flipVertical) transforms.push('scaleY(-1)')
  return transforms.length ? transforms.join(' ') : 'none'
}
```

### 4.3 后端处理 (Sharp)

```typescript
async function applySharpSettings(sharpInstance: any, settings: ImageEditSettings) {
  // 基础调整
  if (settings.brightness || settings.contrast || settings.saturation) {
    sharpInstance = sharpInstance.modulate({
      brightness: (settings.brightness || 100) / 100,
      saturation: (settings.saturation || 100) / 100,
      hue: settings.hue || 0
    })
  }
  
  // 对比度使用线性调节
  if (settings.contrast) {
    const factor = (settings.contrast || 100) / 100
    sharpInstance = sharpInstance.linear(factor, -(128 * (factor - 1)))
  }
  
  // 滤镜
  if (settings.grayscale) {
    sharpInstance = sharpInstance.grayscale()
  }
  
  if (settings.blur) {
    sharpInstance = sharpInstance.blur(settings.blur)
  }
  
  if (settings.vintage) {
    // 复古效果：降低饱和度 + 棕褐色调
    sharpInstance = sharpInstance.recomb([
      [0.393, 0.769, 0.189],
      [0.349, 0.686, 0.168],
      [0.272, 0.534, 0.131]
    ])
  }
  
  // 锐化
  if (settings.sharpen) {
    const sigma = settings.sharpen / 50  // 0-2
    sharpInstance = sharpInstance.sharpen(sigma, 1, 0)
  }
  
  // 高级调整
  if (settings.shadows !== undefined) {
    // 阴影调整
    const shadowFactor = 1 + settings.shadows / 100
    sharpInstance = sharpInstance.modulate({ brightness: shadowFactor })
  }
  
  // 裁剪
  if (settings.crop) {
    sharpInstance = sharpInstance.extract({
      left: Math.round(settings.crop.x),
      top: Math.round(settings.crop.y),
      width: Math.round(settings.crop.width),
      height: Math.round(settings.crop.height)
    })
  }
  
  // 变换
  if (settings.rotation) {
    sharpInstance = sharpInstance.rotate(settings.rotation)
  }
  if (settings.flipHorizontal) {
    sharpInstance = sharpInstance.flip()
  }
  if (settings.flipVertical) {
    sharpInstance = sharpInstance.flop()
  }
  
  return sharpInstance
}
```

## 5. 实现计划

### Phase 1: 完善现有功能
- [x] 图片加载优化（base64）
- [x] 翻转/旋转预览
- [x] 重置功能
- [ ] 可视化裁切

### Phase 2: 新增滤镜
- [ ] 灰度滤镜
- [ ] 复古滤镜
- [ ] 模糊滤镜
- [ ] 锐化滤镜

### Phase 3: 高级调整
- [ ] 阴影/高光
- [ ] 清晰度
- [ ] 色调分离

### Phase 4: 预设系统
- [ ] 内置预设
- [ ] 预设分类

## 6. 设计原则

1. **直观易用**：滑块 + 实时预览，所见即所得
2. **专业实用**：提供常用高级功能（阴影、高光、锐化等）
3. **性能优先**：图片处理在主进程进行，预览用 CSS
4. **风格统一**：遵循 macOS/iOS 设计规范
