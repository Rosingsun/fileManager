# 用户中心功能说明（设计与实现）

## 目标

为桌面端提供与自建账号 API 联通的**账号资料**、**安全（改密）**、**服务可达性**与**关于**能力；refresh token 由 Electron `safeStorage` 加密存储，失败时降级 `sessionStorage`。

## 功能矩阵

| 模块 | 行为 | 前端入口 |
|------|------|----------|
| 登录 / 注册 | 调用 `/auth/login`、`/auth/register`，保存 refresh | 未登录时 Tabs |
| 会话恢复 | `/auth/refresh` + 本地 refresh | 进入用户中心自动 `hydrateFromRefresh` |
| 个人资料 | `GET` + `POST /users/me`（昵称、头像 URL） | 已登录 · 个人信息 |
| 修改密码 | `POST /users/me/password`，服务端吊销全部 refresh | 已登录 · 账号安全 |
| 忘记密码 | 仅外链，无后端实现 | 环境变量 `VITE_PASSWORD_RESET_URL` |
| 服务检测 | `GET /health`（无需登录） | 已登录 · 关于与服务 |
| 关于 | `getAppVersion` / `getPlatform` | 已登录 · 关于与服务 |

## 修改密码安全策略

- 校验当前密码通过后更新哈希；**删除该用户全部 refresh token**，其他设备无法刷新会话。
- 客户端成功后清空本地 access 与 refresh，需重新登录。

## 环境变量（渲染进程）

见仓库根目录 `.env.example`：`VITE_AUTH_API_BASE_URL`、可选 `VITE_PASSWORD_RESET_URL`。

## 后端契约摘要

- `POST /users/me/password`，Body：`{ currentPassword, newPassword }`，响应：`{ ok: true, data: { ok: true } }`。

## 邀请码注册（增量）

- **注册**：默认必须提供有效 `inviteCode`（规范化后 SHA-256 匹配 `invite_codes`）。`invite_codes.created_at` 为发码时间，`invite_redemptions.redeemed_at` 为受邀者注册成功时间；`users.invited_by_user_id` 记录邀请人。
- **开放注册**：后端 `ALLOW_OPEN_REGISTRATION=true` 时可不传邀请码（仅建议开发环境）。
- **冷启动**：无用户时可调用 `POST /auth/bootstrap-first-user`（需配置 `BOOTSTRAP_INVITE_SECRET`），或手工执行迁移种子 SQL。
- **前端**：注册表单填写邀请码；已登录用户「我的邀请」可生成码、查看发出的码与邀请成功列表。
