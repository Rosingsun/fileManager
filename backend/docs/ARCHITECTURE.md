# 后端架构与开发规范（Express + MySQL）

本文约定 `backend/` 下后续所有接口与模块的扩展方式，便于多人协作与功能迭代。

## 1. 技术栈

- **运行时**：Node 20+（ESM，`"type": "module"`）
- **框架**：Express 4
- **数据库**：MySQL 8（`mysql2` 连接池 + 手写 SQL）
- **安全**：bcryptjs（密码）、jsonwebtoken（Access）、refresh 存库为 SHA-256 哈希

ORM 未引入：业务以 SQL 为中心时，迁移与查询更直观；若后续表量剧增可再评估 Drizzle/Prisma。

## 2. 目录结构

```
backend/
  docs/                 # 架构与设计说明（本文件）
  migrations/           # 仅放 SQL，按文件名排序执行，勿改已上线序号
  src/
    app.ts              # 组装 Express：中间件 + 路由挂载
    server.ts           # 进程入口：读配置、迁移、监听端口
    config/             # 环境变量校验与导出（禁止在业务里直接读 process.env）
    db/                 # 连接池、迁移执行器
    middleware/         # 全局中间件（错误、请求 ID 等）
    modules/            # 按业务域拆分，每个域自包含
      <domain>/
        <domain>.routes.ts    # 仅声明 path + HTTP 动词，薄层
        <domain>.service.ts   # 业务规则、编排
        <domain>.repository.ts # 仅 SQL / 数据访问（可选，复杂域再拆）
    types/              # 共享 TS 类型
    utils/              # 与业务无关的小工具（错误类、异步包装等）
```

新增业务域时：**新建 `modules/<新域>/`**，在 `app.ts` 中 `app.use('/api/<前缀>', router)` 挂载（当前认证相关路由为保持与桌面端一致仍为根路径 `/auth`、`/users`，见第 8 节）。

## 3. 统一 HTTP 响应体

所有 JSON 接口使用同一外壳（含错误），便于前端与日志解析。

**成功**

```json
{
  "ok": true,
  "data": { }
}
```

**失败**

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_EMAIL",
    "message": "邮箱格式不正确"
  }
}
```

- `code`：大写下划线枚举字符串，稳定可用来做 i18n 或客户端分支。
- `message`：给开发者/默认中文提示；生产环境可对敏感错误使用泛化文案。

**HTTP 状态码**：与语义一致（400 参数、401 未授权、403 禁止、404、409 冲突、500 服务器错误）。`body.ok` 与 `status` 保持一致。

## 4. 错误处理

- 业务层抛出 `AppError`（带 `statusCode`、`code`、`message`）。
- `asyncHandler` 包装异步路由，将异常交给 `errorHandler`。
- 非 `AppError` 的异常统一映射为 `500` + `code: INTERNAL_ERROR`，详细堆栈仅写服务端日志，不回传客户端。

## 5. 数据库与迁移

- **禁止**在业务代码里执行 `CREATE TABLE`。
- 所有表结构变更放在 `migrations/`：`001_xxx.sql`、`002_xxx.sql`，按字典序执行。
- 表 `schema_migrations` 记录已执行文件名；启动时自动补跑未执行文件。
- SQL 使用 `utf8mb4`；时间统一存 **毫秒时间戳 BIGINT**（与时区无关，与现有逻辑一致）。

## 6. 配置与安全

- 敏感配置仅来自 **环境变量** 或根目录 `backend/.env`（不入库）。
- **禁止**将 `JWT_SECRET`、数据库密码提交到 Git。
- CORS：开发可放宽；生产应白名单具体 Origin。

## 7. 日志与请求追踪

- 建议每个请求生成 `requestId`（UUID），写入响应头 `X-Request-Id`，并在日志中带上，便于排查。

## 8. 路由版本与兼容

当前桌面端按「根路径」调用：`/auth/*`、`/users/me`（历史原因）。**新模块**建议统一挂在 `/api/v1/...`，旧路径在文档中标注为 stable，变更需发版本说明。

## 9. 测试与质量（后续）

- 可为 `*.service.ts` 补充单元测试；集成测试使用测试库 + 迁移。
- CI 建议：`npm run build` + lint（若引入 eslint）。

## 10. 与具体实现的对应

Express + MySQL 的依赖调整、迁移文件名、入口脚本与模块拆分示例见 [IMPLEMENTATION_EXPRESS_MYSQL.md](./IMPLEMENTATION_EXPRESS_MYSQL.md)。
