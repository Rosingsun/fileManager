import React, { useCallback, useEffect, useState } from 'react'
import { App, Button, Col, Modal, Row, Space, Typography } from 'antd'
import {
  TbBrowser,
  TbDatabase,
  TbDeviceFloppy,
  TbPhoto,
  TbRefresh,
  TbSparkles,
  TbTags,
  TbTrash,
} from '../icons'
import {
  ALL_CACHE_SCOPES,
  clearAllClearableCache,
  clearCacheScopes,
  formatFileSize,
  getFullCacheOverview,
  logSignedInUserAction,
  type CacheScope,
  type FullCacheOverview,
} from '../../utils'
import { PageSection } from '../UnifiedUI'

const { Text } = Typography

interface CacheBlockStat {
  primary: string
  secondary?: string
}

interface CacheBlockConfig {
  scope: CacheScope
  title: string
  hint: string
  icon: React.ReactNode
  accent: string
  format: (overview: FullCacheOverview) => CacheBlockStat
}

const CACHE_BLOCKS: CacheBlockConfig[] = [
  {
    scope: 'imagePreview',
    title: '图片预览',
    hint: '文件整理缩略图与原图，清空后重新加载',
    icon: <TbPhoto size={18} />,
    accent: '#0a84ff',
    format: (o) => {
      const s = o.renderer.imagePreview
      return {
        primary: formatFileSize(s.totalBytes),
        secondary: `${s.itemCount} 项 · 上限 ${formatFileSize(s.maxBytes)} · 命中 ${s.hitRate}%`,
      }
    },
  },
  {
    scope: 'classificationMemory',
    title: '分类结果',
    hint: '当前会话内的分类结果（内存）',
    icon: <TbTags size={18} />,
    accent: '#30b95a',
    format: (o) => ({
      primary: `${o.renderer.classificationMemory.itemCount} 项`,
      secondary: '内存缓存',
    }),
  },
  {
    scope: 'classificationStorage',
    title: '分类存档',
    hint: '持久化分类列表，清空后需重新扫描',
    icon: <TbDeviceFloppy size={18} />,
    accent: '#34c759',
    format: (o) => {
      const s = o.renderer.classificationStorage
      if (s.itemCount === 0) return { primary: '无', secondary: '本地存储' }
      return {
        primary: formatFileSize(s.totalBytes),
        secondary: '1 条记录 · 本地存储',
      }
    },
  },
  {
    scope: 'thumbnailStorage',
    title: '分类缩略图',
    hint: '分类选择器中的缩略图缓存',
    icon: <TbPhoto size={18} />,
    accent: '#5ac8fa',
    format: (o) => {
      const s = o.renderer.thumbnailStorage
      return {
        primary: formatFileSize(s.totalBytes),
        secondary: `${s.itemCount} 项 · 本地存储`,
      }
    },
  },
  {
    scope: 'imageDataStorage',
    title: '分类图片数据',
    hint: '查看大图时缓存的 base64 数据',
    icon: <TbDatabase size={18} />,
    accent: '#64d2ff',
    format: (o) => {
      const s = o.renderer.imageDataStorage
      return {
        primary: formatFileSize(s.totalBytes),
        secondary: `${s.itemCount} 项 · 本地存储`,
      }
    },
  },
  {
    scope: 'previewDisk',
    title: 'RAW 预览',
    hint: '从 RAW 等格式提取的临时预览图',
    icon: <TbDeviceFloppy size={18} />,
    accent: '#ff9f0a',
    format: (o) => {
      const s = o.main?.previewDisk
      if (!s) return { primary: '—', secondary: '磁盘' }
      return {
        primary: formatFileSize(s.totalBytes),
        secondary: `${s.itemCount} 个文件 · 磁盘`,
      }
    },
  },
  {
    scope: 'chromiumDisk',
    title: '浏览器缓存',
    hint: '网络与渲染缓存，不影响登录与偏好',
    icon: <TbBrowser size={18} />,
    accent: '#7c5cff',
    format: (o) => {
      const s = o.main?.chromiumDisk
      if (!s) return { primary: '—', secondary: '磁盘' }
      return {
        primary: formatFileSize(s.totalBytes),
        secondary: `${s.itemCount} 个文件 · 磁盘`,
      }
    },
  },
  {
    scope: 'modelSessions',
    title: 'AI 模型会话',
    hint: '释放内存中的模型会话，不删除已下载文件',
    icon: <TbSparkles size={18} />,
    accent: '#bf5af2',
    format: () => ({
      primary: '已加载',
      secondary: '清空后下次分类重新加载',
    }),
  },
]

const UserCenterCacheSection: React.FC = () => {
  const { message } = App.useApp()
  const [overview, setOverview] = useState<FullCacheOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [clearingScope, setClearingScope] = useState<CacheScope | 'all' | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setOverview(await getFullCacheOverview())
    } catch {
      message.error('无法读取缓存信息')
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runClear = async (scopes: CacheScope[], label: string) => {
    setClearingScope(scopes.length === ALL_CACHE_SCOPES.length ? 'all' : scopes[0])
    try {
      await clearCacheScopes(scopes)
      message.success(`已清空：${label}`)
      logSignedInUserAction('cache_clear', label)
      await refresh()
    } catch {
      message.error('清空缓存失败')
    } finally {
      setClearingScope(null)
    }
  }

  const confirmClear = (scopes: CacheScope[], label: string) => {
    Modal.confirm({
      title: '确认清空缓存',
      content: `将清空「${label}」。不会删除主题、访问历史、编辑预设与账号登录信息。`,
      okText: '清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => runClear(scopes, label),
    })
  }

  const confirmClearAll = () => {
    Modal.confirm({
      title: '清空全部可清理缓存',
      content:
        '将清空图片预览、分类缓存、本地临时数据、磁盘预览与浏览器缓存等。不会删除主题、访问历史、编辑预设、已下载的 AI 模型文件与账号登录信息。',
      okText: '全部清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setClearingScope('all')
        try {
          await clearAllClearableCache()
          message.success('已清空全部可清理缓存')
          logSignedInUserAction('cache_clear', '清空全部可清理缓存')
          await refresh()
        } catch {
          message.error('清空缓存失败')
        } finally {
          setClearingScope(null)
        }
      },
    })
  }

  return (
    <PageSection
      title="缓存管理"
      subtitle="查看并清理应用产生的临时数据，释放内存与磁盘空间"
      extra={
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<TbRefresh size={16} />}
            loading={loading}
            onClick={() => void refresh()}
          >
            刷新
          </Button>
          <Button
            size="small"
            danger
            icon={<TbTrash size={16} />}
            loading={clearingScope === 'all'}
            disabled={!overview}
            onClick={confirmClearAll}
          >
            清空全部
          </Button>
        </Space>
      }
    >
      <Text type="secondary" className="user-center-cache-lead">
        <TbDatabase size={14} aria-hidden />
        以下缓存可单独或批量清理；清理后相关功能会按需重新生成数据。
      </Text>
      <Row gutter={[12, 12]} className="user-center-cache-grid">
        {CACHE_BLOCKS.map((block) => {
          const busy = clearingScope === block.scope || clearingScope === 'all'
          const stat = overview ? block.format(overview) : null
          return (
            <Col xs={24} sm={12} lg={8} key={block.scope}>
              <div
                className="user-center-cache-card"
                style={{ ['--cache-accent' as string]: block.accent }}
              >
                <div className="user-center-cache-card__top">
                  <div className="user-center-cache-card__head">
                    <span className="user-center-cache-card__icon" aria-hidden>
                      {block.icon}
                    </span>
                    <div className="user-center-cache-card__titles">
                      <Text strong className="user-center-cache-card__title">
                        {block.title}
                      </Text>
                      <Text type="secondary" className="user-center-cache-card__hint">
                        {block.hint}
                      </Text>
                    </div>
                  </div>
                  <Button
                    size="small"
                    danger
                    className="user-center-cache-card__action"
                    loading={busy}
                    disabled={!overview}
                    icon={<TbTrash size={12} />}
                    onClick={() => confirmClear([block.scope], block.title)}
                  >
                    清空
                  </Button>
                </div>
                <div className="user-center-cache-card__stat">
                  <span className="user-center-cache-card__primary">
                    {stat ? stat.primary : loading ? '…' : '—'}
                  </span>
                  {stat?.secondary ? (
                    <Text type="secondary" className="user-center-cache-card__secondary">
                      {stat.secondary}
                    </Text>
                  ) : null}
                </div>
              </div>
            </Col>
          )
        })}
      </Row>
    </PageSection>
  )
}

export default UserCenterCacheSection
