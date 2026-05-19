import React, { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Col, List, Row, Space, Spin, Typography } from 'antd'
import {
  CloudOutlined,
  FolderOpenOutlined,
  PictureOutlined,
  FilterOutlined,
  ToolOutlined,
  CopyOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../../stores'
import {
  AuthApiError,
  cosImageStats,
  formatAuthApiError,
  formatFileSize,
  listOperationLogs,
  operationLogActionLabel,
  type OperationLogEntry,
} from '../../utils'
import UserAvatar from '../UserAvatar'
import { desensitizeEmail, userCenterCardStyle, type UserCenterPanelProps } from './userCenterShared'

const { Text, Paragraph } = Typography

const SHORTCUTS = [
  { key: 'organize', label: '文件整理', icon: <FolderOpenOutlined />, tab: 'organize' as const },
  { key: 'similarity', label: '相似照片', icon: <CopyOutlined />, tab: 'similarity' as const },
  { key: 'classify', label: '图片分类', icon: <PictureOutlined />, tab: 'classify' as const },
  { key: 'quickFilter', label: '快速筛选', icon: <FilterOutlined />, tab: 'quickFilter' as const },
  { key: 'tools', label: '实用工具', icon: <ToolOutlined />, tab: 'tools' as const },
  { key: 'cloud', label: '云图库', icon: <CloudOutlined />, tab: 'organize' as const, cloud: true },
]

const UserCenterOverviewTab: React.FC<UserCenterPanelProps> = ({ userId, onNavigateApp, onSwitchUserTab }) => {
  const { message } = App.useApp()
  const user = useAuthStore((s) => s.user)

  const [cosLoading, setCosLoading] = useState(true)
  const [cosDisabled, setCosDisabled] = useState(false)
  const [cosStats, setCosStats] = useState<{ imageCount: number; totalBytes: number } | null>(null)
  const [recentLogs, setRecentLogs] = useState<OperationLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  const loadCos = useCallback(async () => {
    setCosLoading(true)
    try {
      const data = await cosImageStats()
      setCosStats(data)
      setCosDisabled(false)
    } catch (e) {
      if (e instanceof AuthApiError && e.code === 'COS_NOT_CONFIGURED') {
        setCosDisabled(true)
        setCosStats(null)
      } else {
        message.error(formatAuthApiError(e))
      }
    } finally {
      setCosLoading(false)
    }
  }, [message])

  const loadRecent = useCallback(async () => {
    setLogsLoading(true)
    try {
      const data = await listOperationLogs(userId, 200)
      setRecentLogs(data.slice(0, 8))
    } catch (e) {
      message.error(formatAuthApiError(e))
    } finally {
      setLogsLoading(false)
    }
  }, [message, userId])

  useEffect(() => {
    void loadCos()
    void loadRecent()
  }, [loadCos, loadRecent])

  if (!user) return null

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card style={userCenterCardStyle}>
        <Space align="center" size="large" wrap className="user-center-profile-header">
          <UserAvatar size={64} avatarUrl={user.avatarUrl} />
          <div>
            <Text strong style={{ fontSize: 16 }}>
              {user.displayName}
            </Text>
            <div>
              <Text type="secondary">{desensitizeEmail(user.email)}</Text>
            </div>
            <Paragraph
              copyable={{ text: user.id, tooltips: ['复制用户 ID', '已复制'] }}
              type="secondary"
              style={{ marginBottom: 0, marginTop: 6, fontSize: 12 }}
            >
              ID：{user.id.slice(0, 8)}…
            </Paragraph>
            {user.createdAt != null ? (
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                注册于 {new Date(user.createdAt).toLocaleString()}
              </Text>
            ) : null}
          </div>
        </Space>
      </Card>

      <Card
        title={
          <span>
            <CloudOutlined style={{ marginRight: 6 }} />
            云图库
          </span>
        }
        style={userCenterCardStyle}
        extra={
          !cosDisabled ? (
            <Button type="link" size="small" onClick={() => void loadCos()} loading={cosLoading}>
              刷新
            </Button>
          ) : null
        }
      >
        {cosDisabled ? (
          <Text type="secondary">未配置对象存储，云图库不可用</Text>
        ) : cosLoading && !cosStats ? (
          <Spin size="small" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>
              <Text strong>{cosStats?.imageCount ?? 0}</Text> 张图片 ·{' '}
              <Text strong>{formatFileSize(cosStats?.totalBytes ?? 0)}</Text>
            </Text>
            <Button
              type="primary"
              onClick={() => onNavigateApp({ type: 'tab', tab: 'organize', organizeMode: 'cloud' })}
            >
              进入云图库
            </Button>
          </Space>
        )}
      </Card>

      <Card title="功能快捷入口" style={userCenterCardStyle}>
        <Row gutter={[12, 12]}>
          {SHORTCUTS.map((s) => (
            <Col xs={12} sm={8} key={s.key}>
              <Button
                block
                size="large"
                className="user-center-shortcut-btn"
                icon={s.icon}
                onClick={() =>
                  onNavigateApp({
                    type: 'tab',
                    tab: s.tab,
                    organizeMode: s.cloud ? 'cloud' : 'local',
                  })
                }
              >
                {s.label}
              </Button>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        title="最近活动"
        style={userCenterCardStyle}
        extra={
          <Button type="link" size="small" icon={<RightOutlined />} onClick={() => onSwitchUserTab('oplog')}>
            全部日志
          </Button>
        }
      >
        {logsLoading ? (
          <Spin size="small" />
        ) : recentLogs.length === 0 ? (
          <Text type="secondary">暂无记录。去「文件整理」选择目录开始使用吧。</Text>
        ) : (
          <List
            size="small"
            dataSource={recentLogs}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={operationLogActionLabel(item.action)}
                  description={
                    <Space direction="vertical" size={0}>
                      {item.summary ? <Text type="secondary">{item.summary}</Text> : null}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.ts).toLocaleString()}
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

export default UserCenterOverviewTab
