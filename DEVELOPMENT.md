# 开发指南

## 环境要求

- Node.js 18+ 
- npm 或 yarn 或 pnpm

## 首次运行

1. **安装依赖**
   ```bash
   npm install
   ```

2. **（可选）用户中心自建 API（前后端联调）**  
   - 在 MySQL 中建库并执行 `backend/migrations/` 下 SQL（或按 `backend/README.md` 迁移）。  
   - 后端环境：`npm run init:backend-env`（若无 `backend/.env` 则从示例复制），再编辑 `JWT_SECRET`（≥16 字符）、`MYSQL_*`。  
   - 前端 API 地址：仓库已含根目录 `.env.development`，默认 `VITE_AUTH_API_BASE_URL=http://localhost:3847`（与 Vite 默认 `localhost` 页面一致，避免 Chromium 对 `127.0.0.1` 的本地网络预检拦截）；若需改端口可编辑该文件或自建根目录 `.env`。  
   - 终端一：`npm run dev:auth-api`；自检：`npm run check:auth-api`（需后端已监听）。终端二：`npm run dev`。  
   - 功能说明见 [docs/user-center-features.md](docs/user-center-features.md)。生产环境注册需**邀请码**；数据库尚无用户时可用 `POST /auth/bootstrap-first-user`（在 `backend/.env` 配置 `BOOTSTRAP_INVITE_SECRET`）创建首个账号以便后续发码。

3. **启动开发服务器**
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

## API 变更记录

| 日期 | 端点 | 摘要 |
|------|------|------|
| 2026-05-11 | `POST /users/me`、`POST /users/me/password` | 资料更新与改密由 `PATCH` 改为 `POST`（与 `AGENTS.md` 仅 GET/POST 约定一致）；前端已同步 `useAuthStore`。 |

## 代码规范

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- 遵循 React Hooks 规则
- 使用 ESLint 和 Prettier 格式化代码

