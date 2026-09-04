import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Button,
  Empty,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  CloudOutlined,
  FolderOutlined,
  FileOutlined,
  ReloadOutlined,
  SettingOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  LinkOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'
// import type { UploadProps } from 'antd'
import { useResponsive } from '../../hooks'
import {
  cloudGetDownloadTicket,
  cloudList,
  cloudMkdir,
  cloudMove,
  cloudOpenExternal,
  cloudRemove,
  cloudRename,
  hasCloudCredentials,
  isCloudVaultAvailable,
  listCloudProviders,
  showCloudError,
  startCloudUpload,
  subscribeUploadProgress,
  validateCloudCredentials,
} from '../../utils'
import type {
  CloudFileEntry,
  CloudProviderId,
  CloudProviderInfo,
  CloudUploadProgress,
} from '../../types/cloud'
import CloudCredentialsPanel from './CloudCredentialsPanel'
import './CloudDrive.css'

const ROOT_ID = 'root'
const ROOT_NAME = '云盘根目录'

interface UploadRow {
  sessionId: string
  filePath: string
  fileName: string
  fileSize: number
  loaded: number
  percent: number
  status: CloudUploadProgress['status']
  error?: string
  remoteFileId?: string
}

const CloudDrive: React.FC = () => {
  const responsive = useResponsive()
  const { modal } = AntdApp.useApp()
  const [providers, setProviders] = useState<CloudProviderInfo[]>([])
  const [activeProviderId, setActiveProviderId] = useState<CloudProviderId | null>(null)
  const [vaultAvailable, setVaultAvailable] = useState(true)
  const [hasCred, setHasCred] = useState(false)
  const [accountHint, setAccountHint] = useState<string>('')
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [pathStack, setPathStack] = useState<Array<{ id: string; name: string }>>([
    { id: ROOT_ID, name: ROOT_NAME },
  ])
  const [items, setItems] = useState<CloudFileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [uploads, setUploads] = useState<UploadRow[]>([])
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const currentDir = pathStack[pathStack.length - 1]
  const activeProvider = useMemo(
    () => providers.find(p => p.id === activeProviderId) ?? null,
    [providers, activeProviderId]
  )

  useEffect(() => {
    let cancelProgressSub: (() => void) | null = null
    ;(async () => {
      try {
        const list = await listCloudProviders()
        setProviders(list)
        if (list.length > 0) setActiveProviderId(list[0].id)
        setVaultAvailable(await isCloudVaultAvailable())
      } catch (e) {
        showCloudError(e)
      }
    })()
    cancelProgressSub = subscribeUploadProgress(progress => {
      setUploads(prev => {
        const idx = prev.findIndex(u => u.sessionId === progress.sessionId)
        if (idx === -1) {
          if (progress.status === 'completed' || progress.status === 'failed') {
            return prev
          }
          return [
            ...prev,
            {
              sessionId: progress.sessionId,
              filePath: progress.filePath,
              fileName: progress.fileName,
              fileSize: progress.fileSize,
              loaded: progress.loaded,
              percent: progress.percent,
              status: progress.status,
              error: progress.error,
              remoteFileId: progress.remoteFileId,
            },
          ]
        }
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          loaded: progress.loaded,
          percent: progress.percent,
          status: progress.status,
          error: progress.error,
          remoteFileId: progress.remoteFileId,
        }
        if (progress.status === 'completed' || progress.status === 'failed') {
          // 完成后 1.5s 清除已完成项，给用户看到状态
          setTimeout(() => {
            setUploads(curr => curr.filter(u => u.sessionId !== progress.sessionId))
            if (progress.status === 'completed') {
              void loadCurrent()
            }
          }, 1500)
        }
        return next
      })
    })
    return () => {
      cancelProgressSub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeProviderId) return
    let cancelled = false
    ;(async () => {
      try {
        const has = await hasCloudCredentials(activeProviderId)
        if (cancelled) return
        setHasCred(has)
        if (has) {
          const v = await validateCloudCredentials(activeProviderId)
          if (cancelled) return
          setAccountHint(v.accountHint ?? '')
        } else {
          setAccountHint('')
        }
      } catch (e) {
        showCloudError(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeProviderId])

  useEffect(() => {
    void loadCurrent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProviderId, pathStack])

  const loadCurrent = useCallback(async () => {
    if (!activeProviderId || !hasCred) return
    setLoading(true)
    try {
      const res = await cloudList(activeProviderId, currentDir.id)
      setItems(res.items)
    } catch (e) {
      showCloudError(e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [activeProviderId, hasCred, currentDir.id])

  const enterFolder = (entry: CloudFileEntry) => {
    if (entry.kind !== 'folder') return
    setPathStack(prev => [...prev, { id: entry.fileId, name: entry.name }])
    setSelectedRowKeys([])
  }

  const goBack = (index: number) => {
    setPathStack(prev => prev.slice(0, index + 1))
    setSelectedRowKeys([])
  }

  const onUploadClick = useCallback(async () => {
    if (!activeProviderId) return
    const paths = await window.electronAPI?.selectFiles?.('image')
    if (!paths || paths.length === 0) return
    for (const localPath of paths) {
      const fileName = localPath.split(/[\\/]/).pop() ?? localPath
      const h = startCloudUpload(activeProviderId, localPath, { parentId: currentDir.id })
      h.promise.catch(err => {
        console.warn('[cloudDrive] upload failed', err)
      })
      setUploads(prev => [
        ...prev,
        {
          sessionId: h.sessionId,
          filePath: localPath,
          fileName,
          fileSize: 0,
          loaded: 0,
          percent: 0,
          status: 'preparing',
        },
      ])
    }
  }, [activeProviderId, currentDir.id])

  const onCreateFolder = async () => {
    if (!activeProviderId) return
    let name = ''
    modal.confirm({
      title: '新建文件夹',
      content: (
        <input
          type="text"
          autoFocus
          placeholder="请输入文件夹名"
          style={{ width: '100%', padding: 6, marginTop: 8 }}
          onChange={e => {
            name = e.target.value
          }}
        />
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        if (!name.trim()) {
          message.warning('文件夹名不能为空')
          return Promise.reject()
        }
        try {
          await cloudMkdir(activeProviderId, currentDir.id, name.trim())
          message.success('创建成功')
          void loadCurrent()
        } catch (e) {
          showCloudError(e)
          return Promise.reject()
        }
      },
    })
  }

  const onRename = async (entry: CloudFileEntry) => {
    if (!activeProviderId) return
    let name = entry.name
    modal.confirm({
      title: '重命名',
      content: (
        <input
          type="text"
          defaultValue={entry.name}
          autoFocus
          style={{ width: '100%', padding: 6, marginTop: 8 }}
          onChange={e => {
            name = e.target.value
          }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        const trimmed = name.trim()
        if (!trimmed) {
          message.warning('名称不能为空')
          return Promise.reject()
        }
        if (trimmed === entry.name) return
        try {
          await cloudRename(activeProviderId, entry.fileId, trimmed)
          message.success('已重命名')
          void loadCurrent()
        } catch (e) {
          showCloudError(e)
          return Promise.reject()
        }
      },
    })
  }

  const onDelete = async (entries: CloudFileEntry[]) => {
    if (!activeProviderId || entries.length === 0) return
    modal.confirm({
      title: `确认删除 ${entries.length} 项？`,
      content: '删除后无法恢复（云盘端不会进入回收站）。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        for (const e of entries) {
          try {
            await cloudRemove(activeProviderId, e.fileId)
          } catch (err) {
            showCloudError(err)
            return Promise.reject()
          }
        }
        message.success('已删除')
        setSelectedRowKeys([])
        void loadCurrent()
      },
    })
  }

  const onOpenDownload = async (entry: CloudFileEntry) => {
    if (!activeProviderId) return
    try {
      const ticket = await cloudGetDownloadTicket(activeProviderId, entry.fileId)
      const res = await cloudOpenExternal(ticket.url)
      if (!res.ok) {
        message.error('打开下载链接失败')
      }
    } catch (e) {
      showCloudError(e)
    }
  }

  const onMoveSelected = async () => {
    if (!activeProviderId || selectedRowKeys.length === 0) return
    // 简单实现：弹窗输入目标 folder fileId
    let target = ''
    modal.confirm({
      title: '移动到其他目录',
      content: (
        <div>
          <div style={{ marginBottom: 6, color: 'var(--app-text-secondary)' }}>
            请粘贴目标文件夹的 fileId（在云盘根目录列表中可逐层获取；也可先在云盘网页端获取）
          </div>
          <input
            type="text"
            placeholder="例如 root 或 64abc..."
            style={{ width: '100%', padding: 6 }}
            onChange={e => {
              target = e.target.value
            }}
          />
        </div>
      ),
      okText: '移动',
      cancelText: '取消',
      onOk: async () => {
        const trimmed = target.trim()
        if (!trimmed) {
          message.warning('请填写目标目录 fileId')
          return Promise.reject()
        }
        for (const k of selectedRowKeys) {
          const entry = items.find(i => i.fileId === k)
          if (!entry) continue
          try {
            await cloudMove(activeProviderId, entry.fileId, trimmed)
          } catch (e) {
            showCloudError(e)
            return Promise.reject()
          }
        }
        message.success('已移动')
        setSelectedRowKeys([])
        void loadCurrent()
      },
    })
  }

  const onCredentialsSaved = async (hint: string) => {
    setAccountHint(hint)
    setHasCred(true)
    setCredentialsOpen(false)
    void loadCurrent()
  }

  const onClearCredentials = async () => {
    if (!activeProviderId) return
    modal.confirm({
      title: '清除云盘凭证？',
      content: '清除后下次使用需重新填写 refresh_token。',
      okText: '清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await window.electronAPI?.cloud?.clearCredentials?.(activeProviderId)
          setHasCred(false)
          setAccountHint('')
          setItems([])
        } catch (e) {
          showCloudError(e)
        }
      },
    })
  }

  const renderBreadcrumb = () => (
    <div className="cloud-drive-breadcrumb">
      {pathStack.map((p, i) => (
        <span key={`${p.id}-${i}`} className="cloud-drive-breadcrumb__item">
          {i > 0 && <span className="cloud-drive-breadcrumb__sep">/</span>}
          {i < pathStack.length - 1 ? (
            <a onClick={() => goBack(i)}>{p.name}</a>
          ) : (
            <strong>{p.name}</strong>
          )}
        </span>
      ))}
    </div>
  )

  const renderGuardEmpty = () => {
    if (!activeProvider) {
      return <Empty description="暂未注册任何云盘 Provider" />
    }
    if (!vaultAvailable) {
      return (
        <Alert
          type="error"
          showIcon
          message="系统未提供加密能力"
          description="当前操作系统的密钥链不可用，无法安全保存云盘凭证。请在 macOS / Windows / 已配置 kwallet 的 Linux 上使用。"
        />
      )
    }
    if (!hasCred) {
      return (
        <div className="cloud-drive-guard">
          <CloudOutlined className="cloud-drive-guard__icon" />
          <h2>欢迎使用 {activeProvider.name}</h2>
          <p className="cloud-drive-guard__desc">将本地图片备份到云端，统一管理</p>
          {activeProvider.riskNotice && (
            <Alert
              className="cloud-drive-guard__notice"
              type="warning"
              showIcon
              message="使用须知"
              description={activeProvider.riskNotice}
            />
          )}
          <Space>
            <Button type="primary" icon={<SettingOutlined />} onClick={() => setCredentialsOpen(true)}>
              配置凭证
            </Button>
          </Space>
        </div>
      )
    }
    return null
  }

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: CloudFileEntry) => (
        <span className="cloud-drive-row-name">
          {record.kind === 'folder' ? (
            <FolderOutlined style={{ color: 'var(--app-accent)' }} />
          ) : (
            <FileOutlined />
          )}
          <span
            className="cloud-drive-row-name__text"
            onDoubleClick={() => record.kind === 'folder' && enterFolder(record)}
            style={record.kind === 'folder' ? { cursor: 'pointer' } : undefined}
          >
            {name}
          </span>
        </span>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number, record: CloudFileEntry) =>
        record.kind === 'folder' ? '—' : formatBytes(size),
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedTime',
      key: 'modifiedTime',
      width: 180,
      render: (ts?: number) => (ts ? new Date(ts).toLocaleString() : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: CloudFileEntry) => (
        <Space>
          <Tooltip title="重命名">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onRename(record)} />
          </Tooltip>
          {record.kind === 'file' && (
            <Tooltip title="获取下载链接">
              <Button
                size="small"
                type="text"
                icon={<LinkOutlined />}
                onClick={() => onOpenDownload(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete([record])}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className={`cloud-drive${responsive.isMobile ? ' is-mobile' : ''}`}>
      <header className="cloud-drive-header">
        <div className="cloud-drive-header__title">
          <CloudOutlined />
          <h1>云盘</h1>
          {activeProvider && <Tag color="processing">{activeProvider.name}</Tag>}
          {hasCred && accountHint && <span className="cloud-drive-header__account">账号：{accountHint}</span>}
        </div>
        <Space>
          {providers.length > 1 && (
            <select
              className="cloud-drive-provider-switch"
              value={activeProviderId ?? ''}
              onChange={e => setActiveProviderId(e.target.value as CloudProviderId)}
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {hasCred && (
            <>
              <Button icon={<ReloadOutlined />} onClick={() => loadCurrent()}>
                刷新
              </Button>
              <Button icon={<FolderAddOutlined />} onClick={onCreateFolder}>
                新建文件夹
              </Button>
              <Button type="primary" icon={<InboxOutlined />} onClick={onUploadClick}>
                上传图片
              </Button>
            </>
          )}
          <Button
            icon={<SettingOutlined />}
            onClick={() => setCredentialsOpen(true)}
            type={hasCred ? 'default' : 'primary'}
          >
            {hasCred ? '重新配置凭证' : '配置凭证'}
          </Button>
          {hasCred && (
            <Button danger type="text" onClick={onClearCredentials}>
              清除凭证
            </Button>
          )}
        </Space>
      </header>

      {!hasCred || !vaultAvailable ? (
        renderGuardEmpty()
      ) : (
        <>
          <div className="cloud-drive-toolbar">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              disabled={pathStack.length <= 1}
              onClick={() => goBack(pathStack.length - 2)}
            >
              返回上一级
            </Button>
            {renderBreadcrumb()}
            {selectedRowKeys.length > 0 && (
              <Space>
                <span className="cloud-drive-toolbar__selected">已选 {selectedRowKeys.length} 项</span>
                <Button size="small" onClick={onMoveSelected}>
                  移动
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(items.filter(i => selectedRowKeys.includes(i.fileId)))}
                >
                  批量删除
                </Button>
              </Space>
            )}
          </div>

          <Table<CloudFileEntry>
            className="cloud-drive-table"
            rowKey="fileId"
            loading={loading}
            dataSource={items}
            columns={columns}
            pagination={false}
            size="middle"
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            locale={{ emptyText: <Empty description="此目录为空" /> }}
            onRow={record => ({
              onDoubleClick: () => record.kind === 'folder' && enterFolder(record),
            })}
          />

          {uploads.length > 0 && (
            <div className="cloud-drive-uploads">
              <h3>
                <InboxOutlined /> 上传任务
              </h3>
              <ul>
                {uploads.map(u => (
                  <li key={u.sessionId} className={`cloud-drive-uploads__item is-${u.status}`}>
                    <div className="cloud-drive-uploads__row">
                      <span className="cloud-drive-uploads__name">{u.fileName || u.filePath}</span>
                      <span className="cloud-drive-uploads__status">
                        {u.status === 'preparing' && '准备中…'}
                        {u.status === 'uploading' && `上传中 ${u.percent}%`}
                        {u.status === 'completed' && (
                          <>
                            <span style={{ color: 'var(--app-accent)' }}>已完成</span>
                          </>
                        )}
                        {u.status === 'failed' && (
                          <span style={{ color: 'var(--app-danger)' }}>
                            失败：{u.error || '未知错误'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="cloud-drive-uploads__bar">
                      <div
                        className="cloud-drive-uploads__bar-fill"
                        style={{ width: `${u.percent}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Modal
        title="云盘凭证"
        open={credentialsOpen}
        onCancel={() => setCredentialsOpen(false)}
        footer={null}
        width={responsive.isMobile ? '95%' : 560}
        destroyOnClose
      >
        {activeProviderId && (
          <CloudCredentialsPanel
            providerId={activeProviderId}
            providerName={activeProvider?.name ?? ''}
            riskNotice={activeProvider?.riskNotice}
            existingHint={accountHint}
            onSaved={onCredentialsSaved}
            onCancel={() => setCredentialsOpen(false)}
          />
        )}
      </Modal>

      <div style={{ marginTop: 12, color: 'var(--app-text-tertiary)', fontSize: 12 }}>
        提示：云盘凭证使用系统密钥链加密保存在本地，仅用于访问您本人的云盘空间。顶部「上传图片」按钮也可调用本地文件选择器批量上传。
      </div>

      {loading && items.length === 0 && (
        <div className="cloud-drive-loading">
          <Spin tip="正在加载…" />
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}

export default CloudDrive
