# 设计规范使用说明

## 概述

本项目已集成macOS/iOS风格的UI设计规范。在生成或修改UI组件前，应首先读取设计规范以确保一致性。

## 使用方法

### 在代码中读取设计规范

```typescript
import { 
  getDesignGuidelines, 
  getDesignPrinciples,
  getMacOSDesignPoints,
  getIOSDesignPoints,
  getTypographyGuidelines,
  getMacOSBlurCSS
} from '@/utils/designGuidelines'

// 获取完整的设计规范文本
const fullGuidelines = getDesignGuidelines()

// 获取设计原则摘要
const principles = getDesignPrinciples()

// 获取macOS设计要点
const macOSPoints = getMacOSDesignPoints()

// 获取iOS设计要点
const iosPoints = getIOSDesignPoints()

// 获取排版规范
const typography = getTypographyGuidelines()

// 获取macOS毛玻璃效果CSS代码
const blurCSS = getMacOSBlurCSS()
```

### 在AI对话中使用

在每次生成UI组件或进行设计相关的对话前，应：

1. **读取完整规范**：使用 `getDesignGuidelines()` 获取完整的设计规范文本
2. **参考设计原则**：确保新组件遵循清晰度、一致性、层次与留白、流畅动效等原则
3. **应用视觉风格**：根据平台（macOS/iOS）选择合适的视觉风格
4. **实现交互反馈**：添加适当的悬停效果和点击态
5. **遵循排版规范**：使用San Francisco字体族，合适的字体大小和行高

## 设计规范文件位置

- **Markdown文档**：`docs/design-guidelines.md`
- **工具函数**：`src/utils/designGuidelines.ts`

## 核心设计要点

### macOS风格要点
- 半透明标题栏和侧边栏
- 毛玻璃模糊效果（backdrop-filter）
- 圆角矩形按钮和控件
- SF Symbols风格图标
- 浅色/深色系统背景

### iOS风格要点
- 导航栏-内容区-标签栏布局
- 毛玻璃导航栏和标签栏
- 卡片式设计（圆角+阴影）
- 列表滑动操作
- 系统标准色彩

### 通用原则
- 清晰度优先
- 保持一致性
- 利用留白构建层次
- 流畅的过渡动画

## 技术实现

### 毛玻璃效果CSS

```css
.backdrop-blur {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
```

### 字体设置

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 
             'Helvetica Neue', Helvetica, Arial, sans-serif;
font-size: 13-15pt; /* 正文 */
```

## 注意事项

1. 每次生成UI组件前，务必读取设计规范
2. 保持与现有组件的一致性
3. 优先使用CSS实现视觉效果，而非依赖第三方库
4. 考虑深色模式适配
5. 确保交互反馈清晰明确

