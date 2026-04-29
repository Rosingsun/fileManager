# 后端功能概况设计

本设计面向“分用户、COS 直传、5GB/文件、分层文件夹、分享、外部日志”的最小可行产品（MVP）及后续演进。核心目标是明确职责边界、数据模型要点、COS 交互要点以及后续扩展路径，便于后续落地实现任务。

## 设计目标与约束
- 多租户架构：单 COS Bucket 方案，通过数据库元数据实现用户级隔离，后续可平滑过渡到多 Bucket/前缀方案。
- 上传容量：单用户总上传容量上限为 5GB，超过则返回错误。
- 分享策略：分享链接默认有效期 7 天，支持下载签名链接与访问元数据的组合方式。
- 文件上传：前端直传 COS，支持分块上传（Multipart Upload）用于大文件，保障断点续传与可靠性。
- 认证方案：初期采用邮箱注册/登录，后续扩展手机号注册、MFA 等。
- 日志与观测：接入外部日志服务，错误与事件可追踪；API 速率限制先不设，后续再加。

> 备注：以下内容为实现草案，后续会转化为具体的数据模型、API 合同、实现任务清单等文档。

## 架构概览
- AuthService：注册、登录、令牌生成与校验、密码哈希。
- UserService：用户资料读取与更新。
- COSService：腾讯云 COS 的直传签名、对象键管理、分块上传流程、权限校验。
- MetadataService：MongoDB 的元数据模型与 CRUD，维护文件/文件夹的层级关系。 
- EntryModel（文件/文件夹统一模型）：字段包括 userId、name、type、mimeType、size、cosKey、parentId、path、createdAt、updatedAt、ownerId、isPublicShare、shareToken、shareExpiresAt 等。
- ShareService：分享链接生成、有效期校验、访问日志。
- 网关/中间件：鉴权、输入校验、错误处理、CORS、日志输出。

## 数据模型要点（简要）
- User：{ _id, email, passwordHash, name, createdAt, updatedAt, storageUsed, storageQuota, emailVerified }
- Entry（通用文件/文件夹模型）：{ _id, userId, name, type: 'file'|'folder', mimeType, size, cosKey, parentId, path, createdAt, updatedAt, isPublicShare, shareToken, shareExpiresAt, metadata }
- 关系：parentId 指向同一 Entry 的 _id；path 保存自根到当前条目的路径，便于查询与排序。
- Share：{ _id, entryId, ownerUserId, token, expiresAt, accessCount, lastAccessAt, permissions }

索引建议：userId、parentId、path、cosKey、type、shareToken、shareExpiresAt。

## COS 直传与分块上传要点
- 直传：后端生成签名参数返回前端，前端直接上传到 COS。
- 分块上传：Multipart Upload 请求从前端发起，前端分块上传，完成后把块信息汇总，后端写入元数据。
- cosKey：COS 的对象键，建议包含 userId、Entry id 及时间戳以避免冲突。
- 5GB 限额：前端在提交前进行大小校验，后端二次校验以确保严格性。

## 安全、合规与日志
- 环境变量：COS、数据库、JWT 秘钥通过 .env 管理，生产环境考虑密钥管理服务。
- 外部日志：接入 Sentry（Node.js SDK）用于错误上报与简单追踪。
- 速率限制：初版暂不对 API 全局限流，后续可逐步引入 per-user/per-IP 速率限制。

## 部署与演进路径
- MVP：单体 Node.js 应用 + MongoDB，COS 直传 + Multipart Upload。
- 演进：分层微服务、租户隔离改造、权限模型扩展、回收站、版本历史、离线同步等。

## 风险与缓解
- COS 签名实现要点：严格按 COS 签名流程，避免权限误暴露。
- 数据一致性：COS 对象键与数据库元数据的一致性通过落库操作完成后再返回上传成功。
- 分块上传断点续传：前端实现断点续传策略，后端提供必要的上传初始化信息。

如需，我可将此草案进一步拆解为：数据模型详细设计、API 合同（带请求/响应示例）、COS 交互实现细节、以及分阶段的任务清单与里程碑。若你同意，请告知需要覆盖的具体文档深度。 
