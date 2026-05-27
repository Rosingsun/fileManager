# 设计规范使用说明

## 概述

本项目已集成 macOS/iOS 风格的 UI 设计规范，并通过 **应用级主题 token** 支持浅色、深色与「跟随系统」。在生成或修改 UI 组件前，应首先阅读设计规范以确保一致性。

## 主题与 Design Tokens

### 切换方式

- **运行时**：`document.documentElement` 上的 `data-app-theme="light" | "dark"`（由 `ThemedApp` + `useThemeStore` 维护）。
- **用户入口**：个人中心 → 偏好与数据 → **外观主题**（浅色 / 深色 / 跟随系统）。
- **Ant Design**：`ThemedApp` 内 `ConfigProvider` 使用 `getAntAppTheme(resolvedTheme)`。

### Token 文件

| 文件 | 说明 |
|------|------|
| `src/styles/tokens.css` | 全部 `--app-*` 变量（背景、文字、边框、毛玻璃、文件类型色、编辑器等） |
| `src/utils/themeTokens.ts` | `getAntAppTheme`、`FILE_TYPE_ICON_COLORS` |
| `src/stores/useThemeStore.ts` | 偏好持久化（`localStorage` key: `app.theme`） |

### 编写样式约定

1. **优先使用 CSS 变量**，避免硬编码 `#1890ff` 等 hex。
2. **深色样式**使用 `[data-app-theme='dark'] .your-class`，**不要**再新增 `@media (prefers-color-scheme: dark)`（系统偏好仅用于解析「跟随系统」）。
3. **毛玻璃面板**：`background: var(--app-glass-bg)`、`border: 1px solid var(--app-glass-border)`，可参考 `getMacOSBlurCSS()`。
4. **链接/操作文字**：使用 `.app-text-link` 或 `color: var(--app-primary)`。

### 统一组件（UnifiedUI）

从 `src/components/UnifiedUI`（或 `@/components` 统一导出）引入：

| 组件 | 用途 |
|------|------|
| `GlassCard` | 毛玻璃卡片，替代手写 `cardStyle` |
| `PageHeader` | 模块标题区（图标 + 标题 + 副标题 + extra） |
| `PageSection` | 内容分区标题 |
| `ToolTile` | 快捷入口/工具网格块 |
| `SettingsRow` | 设置项行（标签 + 控件） |
| `StatCard` | 统计数字卡片 |
| `AppEmptyState` | 空状态 |

样式入口：`src/styles/index.css`（含 `tokens.css`、`ant-overrides.css`、`layout.css`、`editor.css`）。

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

const fullGuidelines = getDesignGuidelines()
const blurCSS = getMacOSBlurCSS()
```

### 在 AI 对话中使用

1. 读取 `docs/design-guidelines.md` 或 `getDesignGuidelines()`。
2. 新组件使用 `--app-*` token 与 UnifiedUI 组件。
3. 变更对外样式时检查浅色/深色两套表现。

## 设计规范文件位置

- **Markdown 文档**：`docs/design-guidelines.md`
- **本说明**：`docs/design-guidelines-usage.md`
- **工具函数**：`src/utils/designGuidelines.ts`

## 核心设计要点

### macOS 风格要点

- 半透明标题栏和侧边栏
- 毛玻璃模糊效果（backdrop-filter）
- 圆角矩形按钮和控件
- SF Symbols 风格图标
- 浅色/深色系统背景（与应用主题联动）

### 通用原则

- 清晰度优先
- 保持一致性
- 利用留白构建层次
- 流畅的过渡动画

## 注意事项

1. 每次生成 UI 组件前，务必读取设计规范并检查 token 用法。
2. 保持与现有组件的一致性；新卡片优先 `GlassCard`。
3. 优先使用 CSS 变量实现视觉效果。
4. 深色模式以 `data-app-theme` 为准，而非仅依赖系统 `prefers-color-scheme`。
5. 确保交互反馈清晰明确。
