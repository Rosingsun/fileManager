# 开发指南

## 环境要求

- Node.js 18+ 
- npm 或 yarn 或 pnpm

## 首次运行

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动开发服务器**
   ```bash
   npm run dev
   ```

   这将同时启动：
   - Vite 开发服务器（端口 5173）
   - Electron 应用窗口

## 开发说明

### 项目结构

- `electron/main/` - Electron 主进程代码
- `electron/preload/` - 预加载脚本（桥接主进程和渲染进程）
- `src/` - React 渲染进程代码
  - `components/` - React 组件
  - `hooks/` - 自定义 Hooks
  - `stores/` - Zustand 状态管理
  - `utils/` - 工具函数
  - `types/` - TypeScript 类型定义

### IPC 通信

主进程和渲染进程通过 IPC（Inter-Process Communication）通信：

- **主进程** (`electron/main/main.ts`) 注册 IPC 处理器
- **预加载脚本** (`electron/preload/preload.ts`) 暴露安全的 API
- **渲染进程** 通过 `window.electronAPI` 调用主进程功能

### 添加新的 IPC 通道

1. 在 `electron/main/main.ts` 中添加处理器：
   ```typescript
   ipcMain.handle('your:action', async (event, ...args) => {
     // 处理逻辑
   })
   ```

2. 在 `electron/preload/preload.ts` 中暴露 API：
   ```typescript
   yourAction: (...args) => ipcRenderer.invoke('your:action', ...args)
   ```

3. 在 `src/types/index.ts` 中添加类型定义

4. 在渲染进程中使用：
   ```typescript
   await window.electronAPI.yourAction(...args)
   ```

## 构建和打包

### 构建

```bash
npm run build
```

构建产物：
- `dist/` - 渲染进程构建文件
- `dist-electron/` - Electron 主进程和预加载脚本构建文件

### 打包

```bash
npm run dist
```

打包产物在 `release/` 目录中。

## 常见问题

### 1. 端口被占用

如果 5173 端口被占用，修改 `vite.config.ts` 中的 `server.port`。

### 2. 类型错误

确保已安装所有依赖：
```bash
npm install
```

### 3. Electron 窗口无法打开

检查：
- Vite 开发服务器是否正常启动
- 控制台是否有错误信息
- `electron/main/main.ts` 中的路径是否正确

## 代码规范

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- 遵循 React Hooks 规则
- 使用 ESLint 和 Prettier 格式化代码

