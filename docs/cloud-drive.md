# 云盘管理（多 Provider 架构）

> 适用于：v1.x 起的「文件整理工具」桌面客户端。

## 1. 目标与定位

把本地图片（以及任意文件）备份到第三方云盘，并在应用内浏览、批量整理、下载链接获取。设计上采用 **多 Provider 架构**，本期落地 **阿里云盘**，后续可平滑接入 OneDrive / WebDAV / S3 等。

> ⚠️ 阿里云盘未对个人开发者开放官方 API。本实现使用社区维护的非官方协议（基于 `refresh_token` 续期 + 分片上传 + 快速上传 SHA1），仅供个人备份与学习使用，请勿用于商业用途；高频调用存在被限流或封号风险。

## 2. 架构总览

```
┌─────────────────────────────┐
│  Renderer（React + Ant）    │
│  src/components/CloudDrive  │  凭证面板 / 目录浏览 / 上传任务
│  src/utils/cloudClient.ts   │  IPC 包装
└──────────┬──────────────────┘
           │ contextBridge
┌──────────▼──────────────────┐
│  Preload (electron/preload) │
│  cloud.*                    │
└──────────┬──────────────────┘
           │ ipcRenderer.invoke
┌──────────▼──────────────────┐
│  Main (electron/main)       │
│  ipc/cloudIpc.ts            │  通道 cloud:*
│  services/cloud/            │
│   ├ types.ts                │  CloudProvider 抽象接口
│   ├ tokenVault.ts           │  safeStorage 加密落盘
│   ├ aliyunDriveProvider.ts  │  阿里云盘实现
│   └ providerRegistry.ts     │  Provider 工厂
└─────────────────────────────┘
```

## 3. 抽象接口（`CloudProvider`）

```ts
interface CloudProvider {
  readonly info: CloudProviderInfo
  hasCredentials(): Promise<boolean>
  setCredentials(raw: string): Promise<{ accountHint: string }>
  clearCredentials(): Promise<void>
  validateCredentials(): Promise<{ ok: boolean; accountHint?: string; error?: string }>
  list(parentId: string, cursor?: string): Promise<CloudListResult>
  mkdir(parentId: string, name: string): Promise<CloudMkdirResult>
  remove(fileId: string): Promise<void>
  rename(fileId: string, newName: string): Promise<void>
  move(fileId: string, newParentId: string, newName?: string): Promise<void>
  getDownloadTicket(fileId: string): Promise<CloudDownloadTicket>
  uploadFile(
    localPath: string,
    options: CloudUploadOptions,
    onProgress: (p: CloudUploadProgress) => void,
    signal: AbortSignal
  ): Promise<{ fileId: string; name: string; size: number }>
}
```

错误统一抛出 `CloudError(code, message, retryable)`，调用方根据 `code` 决定是否刷新 token 后重试。

## 4. 凭证安全

- 存储位置：`app.getPath('userData')/cloud-credentials/<providerId>.enc`
- 加密方式：Electron `safeStorage`（macOS Keychain / Windows DPAPI / Linux kwallet）
- 内存缓存：进程内 `Map<providerId, { raw, loadedAt }>`，避免每次操作都解密
- 物理隔离：与平台用户系统的 `auth-refresh.enc` 完全分离
- rotate：阿里云盘每次 `refresh_token` 都会返回新的 refresh_token，Provider 内部自动 `saveCredential()` 持久化

## 5. 阿里云盘实现要点

| 模块 | 说明 |
|------|------|
| 续期 | `POST auth.aliyundrive.com/token/refresh`，返回 access_token（7200s）+ 新的 refresh_token |
| 列目录 | `POST api.aliyundrive.com/v2/file/list` |
| 新建文件夹 | `POST /v2/file/create`（已存在则自动返回原 fileId） |
| 删除 | `POST /v2/file/delete` |
| 重命名 | `POST /v3/file/update` |
| 移动 | `POST /v2/file/move` |
| 下载链接 | `POST /v2/file/get_download_url` |
| 上传 | `POST /v2/file/create_with_proof` + `POST /v2/file/get_upload_url`（按 16 MB 分片 PUT）+ `POST /v2/file/complete_upload`；命中 SHA1 即秒传 |
| proof_code | 将文件按 1 MiB 切片做 SHA1，再 SHA1(全部 SHA1 的 hex 拼接) |

> 上传分片大小：16 MB；命名冲突：自动追加 `_1`、`_2` 后缀。

## 6. IPC 通道

| 通道 | 方向 | 说明 |
|------|------|------|
| `cloud:listProviders` | renderer→main | 获取可用的 Provider 列表 |
| `cloud:isVaultAvailable` | renderer→main | safeStorage 是否可用 |
| `cloud:hasCredentials` | renderer→main | 是否已写入凭证 |
| `cloud:setCredentials` | renderer→main | 写入并校验 |
| `cloud:clearCredentials` | renderer→main | 清除 |
| `cloud:validateCredentials` | renderer→main | 轻量校验（不刷新） |
| `cloud:list` | renderer→main | 列表 |
| `cloud:mkdir` | renderer→main | 新建文件夹 |
| `cloud:remove` | renderer→main | 删除 |
| `cloud:rename` | renderer→main | 重命名 |
| `cloud:move` | renderer→main | 移动 |
| `cloud:getDownloadTicket` | renderer→main | 获取下载链接 |
| `cloud:upload` | renderer→main | 上传（返回 final 结果） |
| `cloud:cancelUpload` | renderer→main | 取消进行中的上传 |
| `cloud:openExternal` | renderer→main | 用默认浏览器打开 URL |
| `cloud:uploadProgress` | main→renderer | 上传进度推送 |

## 7. 渲染层 API（`src/utils/cloudClient.ts`）

```ts
import {
  listCloudProviders,
  hasCloudCredentials,
  setCloudCredentials,
  clearCloudCredentials,
  validateCloudCredentials,
  cloudList, cloudMkdir, cloudRemove, cloudRename, cloudMove,
  cloudGetDownloadTicket,
  startCloudUpload,
  subscribeUploadProgress,
  cloudOpenExternal,
  describeCloudError,
  showCloudError,
} from '@/utils'
```

进度订阅使用 `subscribeUploadProgress(cb)`，返回反订阅函数；每个上传有唯一 `sessionId` 关联。

## 8. 使用流程

1. 顶部 Tab 点击「云盘」
2. 首次进入会提示配置凭证，弹窗展示使用须知与获取 refresh_token 的步骤
3. 填写并保存 → 自动调用 `validateCredentials` 确认有效
4. 进入云盘根目录，可逐层进入文件夹
5. 「上传图片」按钮调用本地文件选择器，批量加入上传队列
6. 上传任务区显示进度；完成后自动刷新当前目录
7. 「重命名 / 删除 / 移动 / 获取下载链接」在每行操作列；支持多选批量删除/移动

## 9. 扩展新 Provider

1. 在 `electron/main/services/cloud/` 新建 `xxxProvider.ts`，实现 `CloudProvider` 接口
2. 在 `providerRegistry.ts` 的 `FACTORIES` 数组注册
3. 在 `src/types/cloud.ts` 的 `CloudProviderId` 联合类型加上新 id
4. 渲染层 `listCloudProviders()` 会自动展示，无需改动 UI

## 10. 已知限制

- 当前阿里云盘为**非官方协议**，接口字段随时可能失效；上传分片大小、proof_code 算法与官方客户端保持一致，但阿里云盘未承诺兼容性
- 下载/移动/重命名按官方 `v2` 接口实现，相对稳定
- 大文件上传（>1 GB）未做断点续传持久化，进程崩溃需重传
- 「移动到其他目录」目前通过粘贴 fileId 实现，后续可加入目录选择弹窗
