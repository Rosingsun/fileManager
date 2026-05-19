import React, { useEffect, useState } from 'react'
import { App, Button, Card, List, Radio, Space, Switch, Typography } from 'antd'
import { DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { useFileStore } from '../../stores'
import { useImageEditorStore } from '../../stores'
import { userCenterCardStyle, type UserCenterPanelProps } from './userCenterShared'

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
      <Card title="使用偏好" style={userCenterCardStyle}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              文件整理 · 列表默认视图
            </Text>
            <Radio.Group
              value={viewMode}
              onChange={(e) => onViewModeChange(e.target.value as FileListViewMode)}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: '列表', value: 'list' },
                { label: '树形', value: 'tree' },
                { label: '网格', value: 'grid' },
              ]}
            />
          </div>
          <div className="user-center-pref-row">
            <div>
              <Text>云图库选图后自动上传</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                与云图库页「选图后自动上传」开关同步
              </Text>
            </div>
            <Switch checked={autoUpload} onChange={onAutoUploadChange} />
          </div>
        </Space>
      </Card>

      <Card title="本机数据" style={userCenterCardStyle}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text type="secondary">图片编辑预设（本机共享，未按账号隔离）</Text>
            <div style={{ marginTop: 8 }}>
              <Text>
                预设 <Text strong>{presets.length}</Text> 个 · 分组{' '}
                <Text strong>{groups.filter((g) => !g.isBuiltIn).length}</Text> 个（不含系统内置）
              </Text>
            </div>
          </div>
        </Space>
      </Card>

      <Card
        title="最近访问目录"
        style={userCenterCardStyle}
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
            size="small"
            dataSource={historyList.slice(0, 12)}
            renderItem={(item) => (
              <List.Item
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
                  title={<Text ellipsis style={{ maxWidth: 360 }}>{item.name || item.path}</Text>}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" ellipsis style={{ maxWidth: 400, fontSize: 12 }}>
                        {item.path}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  )
}

export default UserCenterPreferencesTab
