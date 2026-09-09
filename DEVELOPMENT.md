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
   - 前端 API 地址：仓库已含根目录 `.env.development`，默认 `VITE_AUTH_API_BASE_URL=http://localhost:3999`（与 Vite 默认 `localhost` 页面一致，避免 Chromium 对 `127.0.0.1` 的本地网络预检拦截）；若需改端口可编辑该文件或自建根目录 `.env`。
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
  - `components/icons/` - **react-icons** 统一导出（Tabler / Remix / Phosphor 等，见 [图标库](https://react-icons.github.io/react-icons/)）；Ant Design 与 Lucide 仍用各自包
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
   ipcMain.handle("your:action", async (event, ...args) => {
     // 处理逻辑
   });
   ```

2. 在 `electron/preload/preload.ts` 中暴露 API：

   ```typescript
   yourAction: (...args) => ipcRenderer.invoke("your:action", ...args);
   ```

3. 在 `src/types/index.ts` 中添加类型定义

4. 在渲染进程中使用：
   ```typescript
   await window.electronAPI.yourAction(...args);
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

| 日期       | 端点                                                                                                                            | 摘要                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-09 | Electron IPC `fs:readDirectory` 改造；新增 `fs:readDirectoryPage` | 打开文件夹改为分页浏览提速：`fs:readDirectory` 由「串行逐项 stat」改为**并发（64）批量 stat + 稳定排序**，仍返回全量 `FileInfo[]`（供整理/预览/图片分类/分析等需整目录的惰性全量副本与既有递归/兄弟图调用方使用，行为兼容）。新增 `fs:readDirectoryPage(path, { offset, limit, extensions? })`，仅对目标切片并发 stat，返回 `{ items, totalCount, hasMore }`（按「文件夹在前→名称」稳定排序切段，offset/limit 滚动不重复/缺漏）。preload 暴露 `electronAPI.readDirectoryPage`；类型 `DirectoryPageRequest`/`DirectoryPageResult`。渲染层 `fileStore` 拆分浏览态（`browseItems/browseTotal/browseLoading/browseDone/browsePath`）与惰性全量副本（`fileList` 语义迁移为「需整目录时由 `ensureAllFilesLoaded` 填充」，含失效与路径快照）；`useFileSystem.loadDirectory` 仅拉分页首页，新增 `ensureAllFilesLoaded`/`loadBrowseMorePage` 与 `useBrowsing`。`FileList` 主浏览改「滚动到底自动加载更多」，任何筛选（类别/子扩展名/图片内容分类/质量）回退到惰性全量副本前端过滤；预览翻页/RAW·LivePhoto 判定/图片分析/ControlPanel 整理与预览等需整目录动作在触发时惰性拉取全量。每批 60、单会话上限 1200，避免无限 DOM。 |
| 2026-09-04 | Electron IPC `cloud:*`（多 Provider 架构，当前已实现 `aliyun-drive`） | 新增独立「云盘」管理 Tab。新增通道：`cloud:listProviders`、`cloud:isVaultAvailable`、`cloud:hasCredentials`、`cloud:setCredentials`、`cloud:clearCredentials`、`cloud:validateCredentials`、`cloud:list`、`cloud:mkdir`、`cloud:remove`、`cloud:rename`、`cloud:move`、`cloud:getDownloadTicket`、`cloud:upload`、`cloud:cancelUpload`、`cloud:openExternal`；main→renderer 推送 `cloud:uploadProgress`。凭证经 `app.getPath('userData')/cloud-credentials/<providerId>.enc` + Electron `safeStorage` 加密落盘，与现有 `auth-refresh.enc` 物理隔离。**阿里云盘**走社区非官方协议：`POST auth.aliyundrive.com/token/refresh` 续期、`api.aliyundrive.com/v2/file/list|create|move|delete|update`、`v2/file/create_with_proof` + `v2/file/get_upload_url` + `v2/file/complete_upload` 分片上传（16 MB）+ SHA1 快速上传。前端 `src/utils/cloudClient.ts` + `src/components/CloudDrive/*`；类型 `src/types/cloud.ts`、渲染层 `window.electronAPI.cloud.*`。详见 `docs/cloud-drive.md`。 |
| 2026-05-27 | 迁移 `015_invite_generations_per_role.sql`；`POST /invites`、`GET /invites/quota` | 每日生成邀请码次数按角色分参：`app_parameters.invite_max_generations_per_day` 仅普通用户（迁移后默认 **1**）；`invite_max_generations_per_day_admin` 仅管理员（默认 **5**）。`GET /invites/quota` 的 `maxGenerationsPerDay` 按当前用户 `is_admin` 返回对应上限；响应字段名不变。管理员仍不受 `invite_max_redemptions_per_inviter` 限制（`unlimitedInvitees`）。运维改表示例：`UPDATE app_parameters SET int_value = N, updated_at = UNIX_TIMESTAMP(NOW(3))*1000 WHERE param_key = 'invite_max_generations_per_day_admin'`。 |
| 2026-05-25 | Electron IPC `image:previewExport` | 编辑器导出预览：`previewExport(filePath, FormatConversionOptions)` 返回 `{ dataUrl, byteSize, width, height }`（应用 `editSettings` + 目标格式/质量后编码）。`FormatConversionOptions` 增加 `overwrite`；`convertFormat` 支持覆盖原图或 `{原名}_编辑_{时间戳}` 另存。前端保存改为「导出」并打开 `EditorExportDialog`（预览、格式、质量、同文件夹批量导出）。 |
| 2026-05-25 | `POST /share/selections/remap-keys` | Body：`{ shareId, mappings: [{ fromKey, toKey }] }`。COS 移动选片相关图片后同步更新 `cos_share_selection_items.cos_key`，避免反馈抽屉缩略图失效。 |
| 2026-05-25 | 迁移 `014_cos_share_enhancements.sql`；`cos_shares` 增 `selection_round`、`recommended_keys_json`、`asset_variant`、`hide_quality_failed`；选片项增 `tier`/`note`、提交增 `selection_round`；`POST /share/update-meta`；`GET /share/selections/pending`、`/diff`；`submit-selection` 支持 `items[]`；`GET /cos/meta/by-prefix`、`POST /cos/meta/batch-upsert` | 选片分级（必选/备选/淘汰）与备注、多轮、摄影师推荐集、精修版分享、质检隐藏；云图库交付动作与待办聚合。 |
| 2026-05-25 | 迁移 `013_cos_share_selections.sql`；`POST /share/:token/submit-selection`；`GET /share/selections/summary`、`/submissions`、`/by-prefix`；`POST /share/create` 增加 `selectionEnabled` | 文件夹分享可开启选片反馈。访客匿名提交 `{ pickerClientId, pickerLabel?, keys[] }`（追加模式，每次一条 submission）。分享者在对应文件夹查看角标（被提交次数）与 Drawer 明细。MySQL 表 `cos_share_selection_submissions`、`cos_share_selection_items`；`cos_shares.selection_enabled`。 |
| 2026-05-25 | 迁移 `012_cos_shares.sql`；`POST /share/create`、`POST /share/revoke`、`GET /share/mine`；匿名 `GET /share/:token`、`GET /share/:token/browse`、`POST /share/:token/presign-get` | 云图库分享：MySQL `cos_shares` 表存 token、资源类型（file/folder）、COS key/prefix、权限（read/download）、过期与撤销。登录用户可创建/撤销/列出分享；匿名凭 token 读元数据、浏览文件夹、获取短时预签名预览 URL（**不**复用 `/cos/presign-get` 所有权校验）。禁止分享 `avatars/` 路径。前端 `shareClient.ts`、云图库「创建分享」、应用内 `#share/{token}` 预览页 `CosShareViewTab`。 |
| 2026-05-20 | `GET /admin/users/cos-quota/list` | 需管理员。分页列出全部用户云图库配额；query：`keyword`（邮箱/昵称模糊）、`minQuotaGb`/`maxQuotaGb`、`page`/`pageSize`、`sortBy`（`email` \| `displayName` \| `quotaBytes` \| `createdAt`）、`sortOrder`、`withUsage`（为 true 时拉取 COS 用量）、`usageLevel`（`high`≥90% \| `over`≥100%，需 `withUsage`）。`data`：`{ items, total, page, pageSize, defaultQuotaBytesForNewUsers, cosConfigured }`。前端「云库配额管理」默认展示用户列表与筛选。 |
| 2026-05-19 | Electron `tools:previewFocusAdjust`、`tools:applyFocusAdjust` | 实用工具「对焦调整」。`invoke(filePath, FocusAdjustOptions)`：预览返回 JPEG base64；导出返回输出路径。`FocusAdjustOptions`：`mode`（`subjectRecover` \| `regionSharpen`）、`focusX`/`focusY`（0–1）、`radius`、`sharpenStrength`、`backgroundBlur`、`feather`、可选 `outputPath`。前端 `electronAPI.previewFocusAdjust` / `applyFocusAdjust`。 |
| 2026-05-25 | `POST /invites`、`GET /invites/quota` | 需 Bearer。`users.is_admin = 1` 的管理员生成邀请码时**不校验** `invite_max_redemptions_per_inviter`（不受邀请总人数上限，`403 INVITE_QUOTA_EXCEEDED` 不适用于管理员）。`GET /invites/quota` 的 `data` 增加 `unlimitedInvitees`（boolean）。每日生成次数上限仍适用。 |
| 2026-05-19 | 迁移 `011_user_cos_quota_adjustments.sql`；`GET/POST /admin/users/cos-quota`、`GET /admin/users/cos-quota/history` | 需管理员。按用户查询云图库配额与 COS 用量；`POST` body 二选一：`quotaBytes`（设为绝对上限）或 `addQuotaBytes`（充值增量）；写入 `user_cos_quota_adjustments` 审计。`GET/POST /admin/parameters/cos` 的视图增加/可更新 `defaultUserStorageQuotaBytes`（新用户默认，不改已有用户）。登录/刷新/`GET /users/me` 的 `user` 增加 `cosStorageQuotaBytes`。前端管理员「云库配额管理」页。 |
| 2026-05-19 | 迁移 `010_users_cos_storage_quota.sql`；`GET /cos/image-stats`；`POST /cos/upload` | `users` 新增 `cos_storage_quota_bytes`（默认 5GB）；`app_parameters` 新增 `cos_user_storage_quota_bytes`（新注册用户默认配额）。`image-stats` 的 `data` 增加 `quotaBytes`；上传前校验总用量，超限 `413`、`STORAGE_QUOTA_EXCEEDED`。前端 `cosImageStats` 类型 `CosImageStats`；云图库摘要卡与个人中心展示「已用 / 上限」与进度条。 |
| 2026-05-19 | 迁移 `009_app_parameters_remark.sql` | `app_parameters` 新增可空列 `remark`（VARCHAR(512)），并为现有邀请/COS 共 10 个参数键写入中文维护说明；运维可直接在库中查阅或修改备注，不影响业务读取逻辑。 |
| 2026-05-19 | 迁移 `007_cos_app_parameters.sql`、`008_users_is_admin.sql`；`GET/POST /admin/parameters/cos` | 腾讯云 COS 配置（`cos_secret_id`、`cos_secret_key`、`cos_region`、`cos_bucket` 及可选前缀/上限/预签名秒数）迁入 `app_parameters`，**不再**从 `backend/.env` 读取。启动时加载并缓存；管理员（`users.is_admin = 1`）可 `GET` 脱敏查看、`POST` 部分更新（body 字段均为可选 camelCase）。`POST /auth/bootstrap-first-user` 创建的首个用户自动 `isAdmin: true`。登录/注册/刷新/`GET /users/me` 的 `user` 增加 `isAdmin`（boolean）。未配置 COS 时 `/cos/*` 仍为 `503`、`COS_NOT_CONFIGURED`。 |
| 2026-05-20 | Electron IPC `image:previewEdits`、`image:analyzeForEdit` | 单图编辑：`previewEdits(filePath, settings)` 返回降采样 JPEG base64 预览；`analyzeForEdit(filePath)` 返回建议 `ImageEditSettings`（一键增强）。`ImageEditSettings` 增加 `temperature`、`gamma`、`vignette`、`fade`、`grain`、`denoise`；主进程 `buildImageEditPipeline` 与保存/预览共用。前端全屏 `ImageEditorShell` + `EditorPreviewCanvas`。 |
| 2026-05-20 | `ImageEditSettings` 扩展（无新 IPC 路径） | 新增 `levels`（黑点/白点/中间调 gamma）、`toneCurve.master`（主曲线控制点 0–1）。`buildImageEditPipeline` 在色彩段末应用 LUT（`composeLuts`）。侧栏分段：调整 / 色彩 / **曲线** / **几何** / 滤镜 / 裁切；调整页含色相彩虹轨、曝光+实时直方图；曲线页含自动色阶与 SVG 曲线编辑。 |
| 2026-05-20 | 编辑器二期 + `image:getHistogram` | `ImageEditSettings` 增加 `toneCurve.red/green/blue`、`dehaze`、`vibrance`、`hslHueAdjust`；`FormatConversionOptions` 增加 `scalePercent`、`maxEdge`、`editSettings`、`watermark`。IPC `image:getHistogram`；`convertFormat` 返回 `newPath` 并支持编辑链+缩放+水印。 |
| 2026-05-18 | `GET /users/me`、`POST /users/me` 及登录/注册/刷新返回的 `user` | `data` / `user` 对象增加 `createdAt`（Unix 毫秒，账号创建时间）。前端 `AuthUser.createdAt` 已同步。 |
| 2026-05-18 | `POST /cos/presign-get` | Body 可选 `variant`：`full`（默认，原图）或 `thumb`（网格缩略图，预签名 URL 带 `imageMogr2/thumbnail/320x` 等基础图片处理参数，需桶开通 COS 图片处理）。前端 `cosPresignGet({ key, variant })`；云图库网格用 `thumb`，弹窗大图仍用 `full`。 |
| 2026-05-15 | `GET /cos/image-stats` | 需 Bearer。在用户 COS 根前缀下扁平分页列举对象，统计扩展名为 jpg/jpeg/png/webp/gif 的图片张数与总字节；成功 `data`：`{ imageCount, totalBytes, quotaBytes }`（`quotaBytes` 取自 `users.cos_storage_quota_bytes`，见 2026-05-19 迁移）。未配置 COS 时 `503`、`COS_NOT_CONFIGURED`。前端 `cosImageStats`。 |
| 2026-05-14 | `POST /invites`、`GET /invites/quota`、迁移 `006_invite_max_generations_per_day.sql` | 需 Bearer。`app_parameters` 新增键 `invite_max_generations_per_day`（默认 `2`）：同一用户按 **UTC 自然日** 统计 `invite_codes.created_at`，当日生成次数（每次 `POST /invites` 计 1 次）达到上限则返回 `403`、`INVITE_DAILY_GENERATION_LIMIT`。`GET /invites/quota` 的 `data` 增加 `maxGenerationsPerDay`、`generationsToday`（camelCase）。 |
| 2026-05-14 | `GET /invites/codes`、迁移 `005_invite_codes_plain.sql` | 需 Bearer。`invite_codes` 新增列 `invite_plain`（COMMENT 标明仅供邀请人列表复制、校验仍以 `code_hash` 为准）。`GET /invites/codes` 每条记录增加 `code`（`string \| null`）：新产生的码为明文，迁移前历史数据为 `null`。 |
| 2026-05-14 | `POST /invites`、`GET /invites/quota`、迁移 `004_app_parameters.sql` | 需 Bearer。`POST /invites`：`data.expiresAt` 仍为创建时间 + 3 天（Unix 毫秒）。生成新码前校验 `invite_redemptions` 中该邀请人成功邀请人数是否小于 `app_parameters.invite_max_redemptions_per_inviter`（默认 `1`，可运维改表）；超限返回 `403`、`INVITE_QUOTA_EXCEEDED`。同一事务内对该用户 `users` 行 `FOR UPDATE`，将该用户所有 `revoked_at IS NULL` 的旧码批量写入 `revoked_at` 后再插入新码（**单活**）；新码固定 `max_uses = 1`，**忽略** body 中的 `maxUses`。成功 `data` 仍含 `code`、`expiresAt` 等。`GET /invites/quota`：`data` 含 `maxInvitees`、`redeemedCount`；**每日生成上限**见迁移 `006` 与上一条 API 说明。 |
| 2026-05-14 | `POST /cos/move-folder` | 需 Bearer。Body：`{ fromKey, targetParentPrefix? }`（`fromKey` 为完整文件夹键且以 `/` 结尾；`targetParentPrefix` 为相对用户根的父目录，语义同 `mkdir` 的 `parentPrefix`，留空/省略表示根下）。整夹递归复制到 `users/{id}/` + 规范化父路径 + **原文件夹最后一级名** + `/` 后删除源前缀下对象；禁止移入自身或子路径（`400`/`BAD_INPUT`）、禁止移动用户根（`fromKey === users/{id}/`）。成功 `data`：`{ key }`（新文件夹完整键）。前端 `cosMoveFolder`。 |
| 2026-05-14 | `POST /cos/rename-folder`、`POST /cos/delete-folder` | 需 Bearer。`rename-folder` body：`{ fromKey, newName }`（`fromKey` 为完整文件夹对象键且以 `/` 结尾，`newName` 为不含 `/` 的新文件夹名）；将前缀下全部对象复制到新路径后删除旧键。`delete-folder` body：`{ key }`（同上）；递归列出前缀下对象并批量删除。成功 `data`：`rename-folder` 为 `{ key }`（新文件夹键），`delete-folder` 为 `{ ok: true, deleted: number }`。错误示例：`409`/`ALREADY_EXISTS`（目标路径已有对象）、`404`/`NOT_FOUND`（重命名时源下无可列出内容）。前端封装见 `src/utils/cosClient.ts` 的 `cosRenameFolder`、`cosDeleteFolder`。 |
| 2026-05-14 | `POST /auth/register`、`POST /auth/bootstrap-first-user`（副作用） | 在 MySQL 事务提交成功后，若已配置 COS，将异步尽力创建对象键前缀 `users/{userId}/` 的目录占位（`putObject` 空对象）；未配置 COS 则跳过；COS 失败仅写运行日志 WARN，**不**撤销已创建账号。`GET /cos/browse` 在列目录前亦会尽力补建同一占位，便于历史用户。 |
| 2026-05-14 | `GET /cos/browse`、`POST /cos/presign-upload`、`POST /cos/presign-get`、`POST /cos/mkdir`、`POST /cos/move`、`POST /cos/delete` | 需 `Authorization: Bearer`；COS 在 `app_parameters` 配置（见 2026-05-19 迁移说明）后启用。对象键强制落在 `users/{userId}/` 命名空间下；未配置 COS 时返回 `503`、`COS_NOT_CONFIGURED`。`browse` 的 `data.scopePrefix` 为当前用户根前缀（完整 Key 前缀），`currentPrefix`/`commonPrefixes` 为相对路径片段。 |
| 2026-05-14 | `POST /cos/upload` | Query：`fileName`（必填）、`parentPrefix`（可选）。Body 为原始字节流，`Content-Type` 须为 `application/octet-stream` 或 `image/*`；大小上限为 `app_parameters.cos_upload_max_bytes`，超出返回 `413`、`PAYLOAD_TOO_LARGE`。成功 `data`：`{ key, size }`。由服务端写入 COS，**桌面端云图库默认经此接口上传**，可避免浏览器直连 COS 的跨域问题；预签名直传仍为可选能力。 |
| 2026-05-13 | `POST /auth/login` | 查询用户阶段若超过约 15s 未返回，将结束请求并返回 `503`、`error.code=AUTH_DB_TIMEOUT`（避免浏览器长期 Pending）；MySQL 正常时仍为即时 `401`/`200`。 |
| 2026-05-11 | `POST /users/me`、`POST /users/me/password` | 资料更新与改密由 `PATCH` 改为 `POST`（与 `AGENTS.md` 仅 GET/POST 约定一致）；前端已同步 `useAuthStore`。 |

### 腾讯云 COS（控制台检查清单）

- **访问策略**：子账号密钥仅授予目标存储桶最小权限（如 `GetObject`、`PutObject`、`DeleteObject`、`ListBucket` 及复制所需权限）；密钥写入 MySQL `app_parameters`（或经 `POST /admin/parameters/cos` 配置），勿提交仓库、勿写入 `backend/.env`。
- **管理员**：`users.is_admin = 1` 可维护 COS 参数；`POST /auth/bootstrap-first-user` 创建的首个用户默认为管理员。已有库可 `UPDATE users SET is_admin = 1 WHERE email = '...'`。
- **CORS**：在桶的「跨域访问 CORS」中允许应用来源（开发时常见为 `http://127.0.0.1:5173`、`http://localhost:5173` 等 Vite 地址；生产填实际页面来源）。**若使用预签名在浏览器内直连 COS 上传/下载**，Methods 至少含 **GET、PUT、HEAD**，Headers 含 `content-type` 等；**当前云图库默认经 `POST /cos/upload` 由服务端写入 COS**，可不依赖桶对页面域名的 CORS，但 **图片预览**（`POST /cos/presign-get` 后浏览器 GET COS）仍建议为桶配置 CORS 与 GET。
- **私有桶**：默认使用预签名 URL 预览与上传，无需将桶改为公有读；若使用自定义 CDN 域名，需在应用侧另行约定（当前实现未绑定 CDN）。

## 代码规范

- 使用 TypeScript 严格模式
- 组件使用函数式组件 + Hooks
- 遵循 React Hooks 规则
- 使用 ESLint 和 Prettier 格式化代码
