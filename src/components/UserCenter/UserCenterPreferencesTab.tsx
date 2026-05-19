import React, { useEffect, useState } from 'react'
import { App, Button, List, Radio, Space, Switch, Typography } from 'antd'
import { DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { useFileStore } from '../../stores'
import { useImageEditorStore } from '../../stores'
import { PageSection } from '../UnifiedUI'
import { type UserCenterPanelProps } from './userCenterShared'

const { Text } = Typography

const FILE_LIST_VIEW_KEY = 'file_list_view_mode'
const COS_AUTO_UPLOAD_KEY = 'cosImageLibrary.autoUploadAfterSelect'

type FileListViewMode = 'list' | 'tree' | 'grid'

function readFileListViewMode(): FileListViewMode {
  try {
    const v = localStorage.getItem(FILE_LIST_VIEW_KEY)
    if (v === 'list' || v === 'tree' || v === 'grid') return v
  } catch {
    /* ignore */
  }
  return 'list'
}

function readCosAutoUpload(): boolean {
  try {
    return localStorage.getItem(COS_AUTO_UPLOAD_KEY) === 'true'
  } catch {
    return false
  }
}

const UserCenterPreferencesTab: React.FC<Pick<UserCenterPanelProps, 'onNavigateApp'>> = ({ onNavigateApp }) => {
  const { message } = App.useApp()
  const historyList = useFileStore((s) => s.historyList)
  const clearHistory = useFileStore((s) => s.clearHistory)
  const loadHistoryFromStorage = useFileStore((s) => s.loadHistoryFromStorage)
  const presets = useImageEditorStore((s) => s.presets)
  const groups = useImageEditorStore((s) => s.groups)

  const [viewMode, setViewMode] = useState<FileListViewMode>(readFileListViewMode)
  const [autoUpload, setAutoUpload] = useState(readCosAutoUpload)

  useEffect(() => {
    loadHistoryFromStorage()
  }, [loadHistoryFromStorage])

  const onViewModeChange = (mode: FileListViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(FILE_LIST_VIEW_KEY, mode)
      message.success('已保存文件列表视图偏好')
    } catch {
      message.error('保存失败')
    }
  }

  const onAutoUploadChange = (checked: boolean) => {
    setAutoUpload(checked)
    try {
      localStorage.setItem(COS_AUTO_UPLOAD_KEY, checked ? 'true' : 'false')
      message.success(checked ? '已开启选图后自动上传' : '已关闭选图后自动上传')
    } catch {
      message.error('保存失败')
    }
  }

  const onOpenHistoryPath = (path: string) => {
    onNavigateApp({ type: 'organizePath', path })
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageSection title="使用偏好" subtitle="影响文件整理与云图库的默认行为">
        <div className="user-center-settings-list">
          <div className="user-center-settings-row">
            <div className="user-center-settings-row__main">
              <Text strong>文件列表默认视图</Text>
              <Text type="secondary" className="user-center-settings-row__hint">
                在「文件整理」中打开目录时的展示方式
              </Text>
            </div>
            <Radio.Group
              value={viewMode}
              onChange={(e) => onViewModeChange(e.target.value as FileListViewMode)}
              optionType="button"
              buttonStyle="solid"
              size="small"
              options={[
                { label: '列表', value: 'list' },
                { label: '树形', value: 'tree' },
                { label: '网格', value: 'grid' },
              ]}
            />
          </div>
          <div className="user-center-settings-row">
            <div className="user-center-settings-row__main">
              <Text strong>云图库选图后自动上传</Text>
              <Text type="secondary" className="user-center-settings-row__hint">
                与云图库页「选图后自动上传」开关同步
              </Text>
            </div>
            <Switch checked={autoUpload} onChange={onAutoUploadChange} />
          </div>
        </div>
      </PageSection>

      <PageSection title="本机数据" subtitle="保存在当前设备，未按账号隔离">
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          图片编辑预设与分组
        </Text>
        <Text>
          预设 <Text strong>{presets.length}</Text> 个 · 自定义分组{' '}
          <Text strong>{groups.filter((g) => !g.isBuiltIn).length}</Text> 个
        </Text>
      </PageSection>

      <PageSection
        title="最近访问目录"
        subtitle="点击「打开」将跳转到文件整理并定位该路径"
        extra={
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={historyList.length === 0}
            onClick={() => {
              clearHistory()
              message.success('已清空访问历史')
            }}
          >
            清空
          </Button>
        }
      >
        {historyList.length === 0 ? (
          <Text type="secondary">暂无记录</Text>
        ) : (
          <List
            className="user-center-history-list"
            size="small"
            dataSource={historyList.slice(0, 12)}
            renderItem={(item) => (
              <List.Item
                className="user-center-history-list__item"
                actions={[
                  <Button
                    key="open"
                    type="link"
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={() => onOpenHistoryPath(item.path)}
                  >
                    打开
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={<Text ellipsis className="user-center-history-list__name">{item.name || item.path}</Text>}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" ellipsis className="user-center-history-list__path">
                        {item.path}
                      </Text>
                      <Text type="secondary" className="user-center-history-list__time">
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </PageSection>
    </Space>
  )
}

export default UserCenterPreferencesTab
