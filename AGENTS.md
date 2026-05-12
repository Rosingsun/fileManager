# OpenCode 执行规则

## 执行前要求
徐工，您好！在开始执行任何任务之前，请先阅读本规则文件，并严格按照以下规则执行。

## 代码规则
- **代码规则文件**：`README.md` 
  - 所有代码生成和修改必须符合"文件整理工具"的项目定位
  - 确保代码功能服务于文件整理、管理的核心目标

## 样式规则
- **样式规则文件**：`docs/design-guidelines-usage.md`
  - 遵循 macOS/iOS 风格的 UI 设计规范
  - 保持清晰度优先的设计原则
  - 保持现有组件的视觉一致性
  - 使用毛玻璃效果时参考 `getMacOSBlurCSS()` 函数
  - 字体使用 San Francisco 字体族
  - 实现适当的交互反馈和动效

## 通用规则
1. **每次执行前**：必须称呼用户为"徐工"
2. **每次执行后**：必须称呼用户为"徐工"并总结执行结果
3. 遵守项目现有的代码风格和约定
4. 优先使用现有库和工具，避免引入不必要的新依赖
5. 遵循安全最佳实践，不暴露或记录敏感信息

## 注意事项
- 严格按规则执行，不得跳过任何步骤
- 保持代码简洁，避免不必要的注释
- 遵循项目的 lint 和 typecheck 要求

## 技能：数据与 API 契约

以下规范适用于 `backend/` 认证与业务 API，以及与 Electron 前端的 JSON 契约。执行任务时须遵守。

### 技能：数据库设计与迁移（MySQL）

- **引擎与字符集**：`ENGINE=InnoDB`，`DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`。
- **命名**：表名、列名使用 **snake_case**；唯一键 `uq_<table>_<cols>`，普通索引 `idx_<table>_<cols>`，外键 `fk_<from>_<to>`。
- **主键与时间**：业务主键 `CHAR(36)`（UUID）；时间字段优先 **Unix 毫秒 `BIGINT`**，列 `COMMENT` 中写明语义（如创建时间、过期时间）。
- **备注（强制）**：**每张表、每一列**须在迁移 SQL 中写 `COMMENT`（表级 `CREATE TABLE ... COMMENT='...'`，列级 `... COMMENT '...'`）。**新增迁移必须带齐 COMMENT**；历史表可在后续迁移中用 `ALTER TABLE ... MODIFY COLUMN ... COMMENT '...'` 补齐。
- **可空与默认**：可选字段显式 `NULL`，必填 `NOT NULL` 并给出合理默认值；敏感列（如 `password_hash`）在 COMMENT 中标明「仅存哈希、不可逆」等。
- **外键**：显式声明 `ON DELETE` / `ON UPDATE`（如 `CASCADE`、`RESTRICT`、`SET NULL`），COMMENT 简述业务含义。
- **变更纪律**：禁止静默改变列语义；改类型、可空、默认值须**新迁移文件**，并同步「接口变更与前端同步」清单中的契约项。

### 技能：后端模块与统一输入/输出

- **目录**：`backend/src/modules/<domain>/` 内 `*.routes.ts`（HTTP 边界）→ `*.service.ts`（业务）→ `*.repository.ts`（SQL）；共享逻辑在 `middleware/`、`utils/`。
- **路由层**：只解析 `req.query` / `req.body`、调用 service、使用 `sendOk`；不写 SQL；异步处理统一包在 `asyncHandler` 中。
- **成功响应**：统一使用 `sendOk(res, data)`，JSON 形状为 `{ "ok": true, "data": <T> }`；无业务载荷时 `data` 可为 `null`。
- **错误响应**：业务错误抛 `AppError`，由全局 `errorHandler` 输出 `{ "ok": false, "error": { "code": string, "message": string } }`；禁止在路由内手写其它错误 JSON 结构。
- **输入**：POST 的 JSON 在路由层做必填字段与枚举等边界校验；可逐步引入校验库，但不强制绑定特定依赖。
- **对外 JSON 字段名**：响应 `data` 内及请求 body 中与前端共享的字段使用 **camelCase**；若数据库为 snake_case，在 service 层映射后再返回。
- **日志**：错误日志应能关联请求（如 request id）；不记录令牌明文、密码、刷新令牌原文等敏感信息。

### 技能：HTTP 方法（仅 GET / POST）

- **GET**：仅用于**无副作用**的读取（如健康检查、当前用户资料查询）；参数使用 query；**禁止**在 GET 中修改持久化数据或产生业务副作用。
- **POST**：所有变更类操作（注册、登录、刷新、登出、资料更新、改密、删除等）一律使用 **POST**；操作意图以 **path** 表达（如 `/auth/login`、`/users/me/password`），参数以 **JSON body** 传递（与现有 `auth` / `users` 路由风格一致）。
- **禁止**：新增或使用 `PUT`、`PATCH`、`DELETE` 作为对外路由方法；CORS 仅允许 `GET`、`POST`、`OPTIONS`。
- **幂等**：POST 不默认保证幂等；若将来需要幂等（如支付类），在接口设计中单独约定（如 idempotency key），并在迁移与文档中说明。

### 技能：接口变更与前端同步

每次修改对外 HTTP API（路径、方法、query、body、`data` 形状、错误 `code` 或 HTTP 状态语义）时，须完成以下检查并在 PR / 提交说明中体现：

| 检查项 | 说明 |
|--------|------|
| 路径与方法 | 是否仍为 GET/POST；path 是否变更 |
| 请求 | query/body 字段增删改、必填/可选、类型 |
| 响应 | `data` 内字段增删改；`null`、数组、嵌套对象是否影响调用方 |
| 错误码 | `AppError` 的 `code` 与 HTTP status 是否变更 |
| 前端 | 同步 `src/utils/authClient.ts`（或等价封装）、调用方类型、`src/stores` 等与该 API 相关的代码 |
| 文档 | 在 `DEVELOPMENT.md` 增加简短 API 变更记录（日期、端点、摘要），便于 Code Review |

**可选**：后续若引入 OpenAPI / JSON Schema，可由前后端共生成类型，减少手写漂移。

## 统一导出规则

### 目录结构
- 所有工具函数放在 `src/utils/`
- 所有 Hooks 放在 `src/hooks/`
- 所有 Stores 放在 `src/stores/`
- 所有组件放在 `src/components/`

### 导入规则
1. **必须从统一导出文件导入**：所有导入必须从 index.ts 引入，禁止直接从具体模块导入
   - ✅ `import { xxx } from '@/utils'` 或 `import { xxx } from '../utils'`
   - ❌ `import { xxx } from '@/utils/fileUtils'`

2. **新增内容导出**：添加新模块后必须在对应 index.ts 中导出
   - 工具函数 → `src/utils/index.ts`
   - Hooks → `src/hooks/index.ts`
   - Stores → `src/stores/index.ts`
   - 组件 → `src/components/index.ts`

3. **示例**：
   ```typescript
   // 正确 ✅
   import { formatFileSize, formatDateTime } from '../utils'
   import { useFileSystem } from '../hooks'
   import { useFileStore } from '../stores'

   // 错误 ❌
   import { formatFileSize } from '../utils/fileUtils'
   import { useFileSystem } from '../hooks/useFileSystem'
   import { useFileStore } from '../stores/fileStore'
   ```
