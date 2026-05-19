# 文件整理工具 — 用户认证 API（自建）

最小可用的账号服务：邀请码注册、登录、刷新令牌、登出、`GET/POST /users/me`、邀请码发放与记录查询。实现栈为 **Node + Express + MySQL**（见 [架构与规范](docs/ARCHITECTURE.md) 与 [Express/MySQL 落地步骤](docs/IMPLEMENTATION_EXPRESS_MYSQL.md)）。

## 本地运行（MySQL）

1. 在 MySQL 中创建数据库：`CREATE DATABASE filedeal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
2. 复制 `backend/.env.example` 为 `backend/.env`，填写 `JWT_SECRET`（≥16 字符）、`MYSQL_USER`、`MYSQL_PASSWORD`（本地可为 `123456`）、`MYSQL_DATABASE` 等。**勿将含真实密码的 `.env` 提交到 Git。**
3. 安装依赖并启动（迁移会在启动时自动执行）：

```bash
cd backend
npm install
npm run dev
```

默认监听 `0.0.0.0:3847`（本机可用 `http://localhost:3847` 或 `http://127.0.0.1:3847`）。在仓库根目录配置 `VITE_AUTH_API_BASE_URL=http://localhost:3847` 供 Electron 渲染进程连接（与 Vite 默认 `localhost` 一致，避免浏览器本地网络预检问题）。

## 构建生产包

```bash
npm run build
node dist/server.js
```

（入口文件名以实际 `package.json` 的 `build` 输出为准。）

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/bootstrap-first-user | 库中无任何用户时；body: `{ secret, email, password, displayName? }` 与 `BOOTSTRAP_INVITE_SECRET` 一致 |
| POST | /auth/register | body: `{ email, password, displayName?, inviteCode? }`；生产须有效邀请码，除非 `ALLOW_OPEN_REGISTRATION=true` |
| POST | /auth/login | body: `{ email, password }` |
| POST | /auth/refresh | body: `{ refreshToken }` |
| POST | /auth/logout | body: `{ refreshToken }` |
| GET | /users/me | Header: `Authorization: Bearer <access>` |
| POST | /users/me | 同上；body: `{ displayName?, avatarUrl? }` |
| POST | /users/me/password | body: `{ currentPassword, newPassword }`；成功后吊销全部 refresh |
| POST | /invites | 需登录；生成邀请码，响应一次性明文 `code` |
| GET | /invites/codes | 需登录；我发出的邀请码列表 |
| GET | /invites/records | 需登录；我邀请成功的记录（受邀邮箱、成功时间） |

Access Token 约 15 分钟过期；Refresh Token 约 7 天，存库为 SHA-256 哈希，支持轮换与吊销。

腾讯云 COS 配置在 MySQL `app_parameters`（非 `.env`）；管理员可 `GET/POST /admin/parameters/cos`。详见根目录 `DEVELOPMENT.md`。

**响应格式**：统一为 `{ ok: true, data }` / `{ ok: false, error: { code, message } }`（详见架构文档）。
