# Express + MySQL 落地步骤（与 ARCHITECTURE 配套）

当前仓库若仍为 Fastify + SQLite，请按下列步骤替换。**数据库密码不要提交 Git**；本地 `.env` 中可自行设置 `MYSQL_PASSWORD=123456`。

## 1. 安装依赖（在 `backend/` 目录）

移除：`fastify`、`@fastify/cors`、`better-sqlite3`  
新增：`express`、`cors`、`mysql2`  
保留：`bcryptjs`、`jsonwebtoken`、`tsx`、`typescript` 及对应 `@types/*`

```bash
cd backend
npm uninstall fastify @fastify/cors better-sqlite3
npm install express cors mysql2
npm install -D @types/express @types/cors
```

## 2. 环境变量 `backend/.env`（本地创建，勿提交）

建议在仓库中维护 `backend/.env.example`（勿含真实密码），示例内容：

```
PORT=3847
JWT_SECRET=change-me-at-least-16-chars

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=filedeal
```

本地开发可将 `MYSQL_PASSWORD` 设为 `123456`（仅本机 `.env`，勿提交）。

MySQL 需先建库：

```sql
CREATE DATABASE IF NOT EXISTS filedeal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 3. 新增/替换文件清单

| 路径 | 作用 |
|------|------|
| `migrations/001_init_auth.sql` | 建 `users`、`refresh_tokens` |
| `src/server.ts` | 入口：加载配置、迁移、启动 HTTP |
| `src/app.ts` | 创建 Express 实例、中间件、挂载路由 |
| `src/config/env.ts` | 统一读 `.env` + 校验 |
| `src/db/pool.ts` | `mysql2` 连接池 |
| `src/db/runMigrations.ts` | 执行 `migrations/*.sql` |
| `src/middleware/requestId.ts` | `X-Request-Id` |
| `src/middleware/errorHandler.ts` | 统一 JSON 错误体 |
| `src/utils/AppError.ts` | 业务异常类 |
| `src/utils/asyncHandler.ts` | 包装 async 路由 |
| `src/utils/response.ts` | `ok(data)` / `fail(code, message, status)` |
| `src/modules/auth/auth.repository.ts` | 用户与 refresh SQL |
| `src/modules/auth/auth.service.ts` | 注册/登录/刷新/登出逻辑 |
| `src/modules/auth/auth.routes.ts` | `/auth/*` |
| `src/modules/users/users.routes.ts` | `GET` / `POST /users/me`（需鉴权中间件） |
| `src/middleware/authBearer.ts` | 解析 JWT，写入 `req.userId` |
| `src/types/express.d.ts` | 扩展 `Express.Request` |

删除或弃用：`src/index.ts`（Fastify 单体）、`src/db.ts`（SQLite）。

`package.json` 的 `dev` 改为：`tsx watch src/server.ts`

## 4. 迁移 SQL `migrations/001_init_auth.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(64) NOT NULL DEFAULT '',
  avatar_url VARCHAR(512) NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 5. 统一响应与错误（与 ARCHITECTURE 一致）

- 成功：`{ ok: true, data: ... }`
- 失败：`{ ok: false, error: { code, message } }`
- `POST /auth/logout` 成功可返回 `204` 且无 body，或 `200` + `{ ok: true, data: null }`（二选一，全项目统一即可）。

## 6. 业务逻辑对齐（与旧 SQLite 版等价）

- 邮箱存小写；注册校验邮箱格式、密码长度 ≥ 8；`displayName` 默认取邮箱 `@` 前一段。
- Access JWT `typ: 'access'`，约 15 分钟；Refresh 随机 base64url，库内存 SHA-256，约 7 天；刷新时**轮换** refresh（删旧插新）。
- `POST /users/me`：`displayName`、`avatarUrl` 合并更新规则与旧实现一致。

## 7. 桌面端

根目录 `.env` 中 `VITE_AUTH_API_BASE_URL` 指向本服务（如 `http://127.0.0.1:3847`）。若前端尚未接统一 `ok/data` 外壳，可在 axios/fetch 封装层做一次解包，或临时在 auth 路由里同时兼容旧扁平结构（不推荐长期）。

---

**说明**：若您将 Cursor 切回 **Agent 模式**，可让助手按本清单自动改文件并跑通 `npm run dev`。
