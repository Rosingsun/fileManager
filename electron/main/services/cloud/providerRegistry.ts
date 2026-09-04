/**
 * 云盘 Provider 注册中心
 *
 * - 集中管理所有可用的 CloudProvider 实现
 * - 渲染层只通过 id 获取 provider，避免直接 new 具体类
 * - 后续加入 OneDrive / WebDAV / S3 时只需注册到 PROVIDERS 数组
 */

import { AliyunDriveProvider } from './aliyunDriveProvider'
import type { CloudProvider, CloudProviderFactory, CloudProviderId } from './types'

const FACTORIES: CloudProviderFactory[] = [
  {
    id: 'aliyun-drive',
    info: {
      id: 'aliyun-drive',
      name: '阿里云盘',
      requiresNetwork: true,
      riskNotice:
        '阿里云盘暂未对个人开发者开放官方 API，本集成通过社区维护的非官方协议实现，' +
        '接口随时可能变更。仅供个人备份与学习使用，请勿用于商业用途；高频调用存在被限流或封号风险。',
    },
    create: () => new AliyunDriveProvider(),
  },
]

const instances = new Map<CloudProviderId, CloudProvider>()

export function listProviderInfos() {
  return FACTORIES.map(f => f.info)
}

export function getProvider(id: CloudProviderId): CloudProvider {
  let p = instances.get(id)
  if (p) return p
  const factory = FACTORIES.find(f => f.id === id)
  if (!factory) {
    throw new Error(`Unknown cloud provider: ${id}`)
  }
  p = factory.create()
  instances.set(id, p)
  return p
}
