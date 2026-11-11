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

### 2.8 专业控件与扩展工具（2026-05-20）

**侧栏分段**：调整 · 色彩 · **曲线** · **几何** · 滤镜 · 裁切

| 分段 | 能力 |
|------|------|
| 调整 | 曝光（上方实时亮度直方图）、亮度/对比度/饱和度（tonal 渐变轨）、色相（彩虹轨+色块）、智能增强、降噪 |
| 色彩 | 色温/色调渐变轨、伽马、阴影/高光/清晰度 |
| 曲线 | 实时直方图、自动色阶、黑点/中间调/白点、主曲线 SVG 拖拽 |
| 几何 | 左旋/右旋 90°、180°、水平/垂直翻转、角度 0–360° |
| 裁切 | 仅裁切与比例预设（旋转/翻转已迁至几何） |

**数据**：`ImageEditSettings.levels`、`ImageEditSettings.toneCurve`（master / R / G / B）；预览图 `previewSrc = sharpPreviewUrl ?? imageUrl ?? originalImageUrl`；直方图 Canvas 采样（最长边 320px，debounce 280ms）；≥4K 像素时回退 `image:getHistogram` 主进程采样。

### 2.9 二期专业能力（2026-05-20）

| 能力 | 说明 |
|------|------|
| 直方图拖拽黑/白场 | 曲线页直方图下沿三角与色阶滑杆双向绑定 |
| RGB 分通道曲线 | 曲线页分段：RGB / R / G / B；独立 LUT |
| RGB 直方图叠层 | 曲线页开关，R/G/B 半透明叠层 |
| HSL 分色相 8 色 | 色彩页折叠面板：红橙黄绿青蓝紫品红，各 h/s/l ±100 |
| 灰点白平衡 | 色彩页「灰点取色」→ 点击预览采样 RGB → 色温/色调 |
| 去雾 / 鲜明度 | 色彩页；Sharp 像素级近似 |
| 导出尺寸 / 水印 | 格式对话框：缩放 %、文字水印；`convertFormat` 支持 `editSettings` / `scalePercent` / `watermark` |
| 主进程直方图 | IPC `image:getHistogram`，弱机大图回退 |

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

## 5. 全屏编辑器（2026-05）

- **布局**：近全屏 `ImageEditorShell`，左侧大预览 + 右侧 320px Tab 侧栏（调整 / 色彩 / 滤镜 / 裁切 / 预设）。
- **预览（分层，2026-11 重构）**：
  - **基础项走 CSS 即时出画**：亮度、对比度、饱和度、色相、曝光、灰度、模糊、复古，以及旋转/翻转，由浏览器直接渲染，拖动滑块无延迟、无 IPC。
  - **高级项走 Sharp 预览**：锐化、阴影、高光、清晰度、色温、色调、伽马、色阶、曲线、去雾、鲜明度、HSL、暗角、褪色、颗粒、降噪、裁切，经 `image:previewEdits` 降采样渲染（260ms debounce）；请求体为「剥离基础项后的设置子集」，避免与 CSS 滤镜重复叠加。
  - **按需生成**：对比视图的全画幅预览只在切到「对比」时请求；裁切遮罩编辑期间预览不带裁切，保证选区与原图坐标一致。
  - **首屏体积**：画布用 `getImageBase64(filePath, 2560)` 的降采样图，避免大图整块 base64 走 IPC；导出仍读原文件。
- **保存**：主进程 `buildImageEditPipeline` 与预览共用管线，导出始终应用完整设置。
- **IPC**：`image:previewEdits`、`image:analyzeForEdit`（一键增强建议参数）。

### 编辑交互约定

| 交互 | 行为 |
|------|------|
| 空格 / 「按住原图」 | 临时查看原图，焦点在输入框内时不触发 |
| 滚轮 | 缩放画布（25%–400%），原生非被动监听 |
| 裁切遮罩 | 仅裁切页显示；切到其它工具自动收起；裁切时暂停几何变换与拖拽平移 |
| 灰点取色 | 开启后光标变十字，图片可接收点击，取色结束自动关闭 |
| 批量编辑 | 仅处理可预览图片，逐张应用并显示进度，完成后刷新列表 |

### ImageEditSettings 扩展字段

| 字段 | 范围 |
|------|------|
| temperature | -100 ~ 100 |
| gamma | 50 ~ 200 |
| vignette / fade / grain / denoise | 0 ~ 100 |

## 6. 设计原则

1. **直观易用**：滑块 + 实时预览，所见即所得
2. **专业实用**：色温、伽马、暗角、颗粒、降噪、一键增强
3. **性能优先**：基础 CSS + 降采样 Sharp 预览；保存走完整管线
4. **风格统一**：遵循 macOS/iOS 设计规范
