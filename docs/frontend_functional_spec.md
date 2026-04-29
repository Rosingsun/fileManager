# 前端功能规格文档

此文档面向基于 Electron + React 的前端改造，目标是实现与后端 MVP 对接的完整前端能力：按用户分离、COS 直传分块上传、5GB/文件上限、分层文件夹结构、分享链接等核心功能，并确保与后端 API 约定保持一致。

## 版本与范围
- 版本：v1.0
- 范围：登录/注册、用户信息展示、文件/文件夹浏览与管理、COS 直传分块上传、分享功能、错误日志上报、基本的权限校验与本地状态管理。

## 目标用户与角色
- 普通用户：使用邮箱完成注册与登录，浏览、创建、上传、分享文件/文件夹。
- 管理端（未来扩展）：查看日志、聚合统计、分发资源。当前版本不包含管理端 UI。

## 技术栈与约束
- 框架与运行时：React 18、Electron、现有状态管理（如 Zustand）、现有 UI 组件库（Ant Design）。
- COS 集成：前端通过腾讯云 COS JS SDK（cos-js-sdk-v5）进行直传与分块上传。
- API 客户端：统一封装 Axios/Wetch 请求，带 token 自动刷新、统一错误处理。
- 存储与状态：前端缓存用户信息、当前选中的文件夹、上传队列、分享状态等。
- 安全性：Token 存储采用内存优先、必要时借助受保护的本地安全存储，遵循最小暴露原则。

## 数据模型（前端视角的类型定义）
下面给出 TypeScript 风格的类型定义，实际实现可在前后端共用的接口定义基础上对齐。

```ts
// 用户信息
type User = {
  id: string;
  email: string;
  name?: string;
  storageUsed?: number;
  storageQuota?: number;
  createdAt?: string;
  updatedAt?: string;
  emailVerified?: boolean;
};

// 文件/文件夹条目
type EntryType = 'file' | 'folder';
type Entry = {
  id: string;
  userId: string;
  name: string;
  type: EntryType;
  mimeType?: string;
  size?: number;
  cosKey?: string; // COS 对象键
  parentId?: string;
  path?: string; // 从根到当前条目的路径
  createdAt?: string;
  updatedAt?: string;
  isPublicShare?: boolean;
  shareToken?: string;
  shareExpiresAt?: string;
  metadata?: any;
};

// 分享信息（简化）
type Share = {
  id: string;
  entryId: string;
  ownerUserId: string;
  token: string;
  expiresAt?: string;
  permissions?: string; // e.g., 'read', 'write' 等后续扩展
};
```

## API 客户端契约（核心接口摘要）
以下列出前端需要调用的核心接口及其请求/响应要点。实际实现时请在客户端封装，确保错误处理统一、token 自动刷新等。

- 认证与用户
  - POST /api/auth/register
    - 请求：{ email: string, password: string }
    - 响应：{ user: User, accessToken: string, refreshToken: string, expiresIn: number }
  - POST /api/auth/login
    - 请求：{ email: string, password: string }
    - 响应：{ accessToken: string, refreshToken: string, expiresIn: number }
  - POST /api/auth/refresh
    - 请求：{ refreshToken: string }
    - 响应：{ accessToken: string, refreshToken: string, expiresIn: number }
  - GET /api/user/me
    - 需要认证
    - 响应：{ user: User }

- 文件夹与文件元数据
  - POST /api/folders
    - 请求：{ name: string, parentId?: string }
    - 响应：{ entry: Entry }
  - PATCH /api/folders/:id
    - 请求：{ name: string }
    - 响应：{ entry: Entry }
  - DELETE /api/folders/:id
    - 请求：无
    - 响应：{ success: boolean }
  - GET /api/folders/:id/contents
    - 响应：{ items: Entry[] }
  - POST /api/files/upload-sign
    - 请求：{ name: string, size: number, mimeType: string, parentId?: string }
    - 响应：{ cosKey: string, uploadSignParams: any, bucket: string, host: string, expiresAt: string }
  - GET /api/files/:id
    - 响应：{ entry: Entry }
  - DELETE /api/files/:id
    - 响应：{ success: boolean }
  - GET /api/files
    - 请求：{ folderId?: string, page?: number, pageSize?: number }
    - 响应：{ items: Entry[], total: number }

- 分享与访问
  - POST /api/share
    - 请求：{ entryId: string, expiresInDays?: number }
    - 响应：{ shareToken: string, shareUrl: string, expiresAt: string }
  - GET /s/:token
    - 请求：无
    - 响应：{ entry: Entry } | { redirectUrl: string }

- COS 上传与状态
  - 上传流程以签名获取、Multipart Upload、以及完成回传元数据为核心。

## 关键工作流设计
- 登录/注册与会话：邮箱注册，JWT 管理，静默刷新。
- 浏览导航：根目录与任意文件夹的 contents 及 path 展示，树状/列表视图切换。
- 文件上传：获取上传签名，使用 COS JS SDK 实现分块上传，上传完成后回传元数据。
- 文件/文件夹管理：创建、重命名、删除、查看详情、列出 contents。
- 分享：创建分享链接、到期时间、访问入口、下载签名（后续扩展）。

## UI/组件设计要点
- 顶部导航：登录状态、用户信息、上传入口、搜索/筛选入口。
- 左侧树/目录结构：以文件夹树展示层级，右侧内容区域显示当前目录的条目。
- 上传区域：拖拽区域、选择文件按钮、分块上传进度显示、暂停/重新上传。
- 条目详情：快速查看元数据、COS 键、大小、类型、创建时间等。
- 分享面板：输入/选择分享有效期，生成链接，展示/复制链接按钮。

## 安全、日记与错误处理
- 全局错误处理，前端展示友好错误信息。
- 日志上报：集成外部日志服务（如 Sentry）用于错误上报与可观测性。
- 本地存储策略：在 Electron 环境下对敏感信息使用受限的本地存储或内存策略。

## 测试与质量保障
- 单元测试：组件逻辑、API 客户端封装、COS 上传封装的单元测试。
- 集成测试：登录、创建文件夹、上传小文件、分享链接创建等核心路径的端到端测试。
- 性能与稳定性测试：分块上传的断点续传、错误重试策略。

## 风险、挑战与缓解
- COS 签名实现的正确性、前后端参数对齐需要严格对齐。
- 文件夹层级在前后端的一致性，路径解析与排序要一致。
- 5GB 上传的网络波动可能影响上传进度，需要稳定的重试与断点续传策略。

## 里程碑与阶段性目标
- 第1阶段：认证、文件夹/文件元数据 CRUD、签名上传、分享骨架、外部日志初步接入。
- 第2阶段：实现分块上传、配额校验、分享访问控制、完善错误处理与测试。
- 第3阶段：权限细化、回收站、版本历史、CI/CD 与容器化部署。

## 需要与你对齐的关键点
- 以上设计为前端改造的功能蓝本，具体实现将与后端 API 合同严格对齐。
- 如你希望对某些细节进行偏好化定制，请直接在此文档中标注修改点。

## 附录
- 参考接口契约、TypeScript 类型、COS 上传示例代码将单独整理为代码示例文档。
