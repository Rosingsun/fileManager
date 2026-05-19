import React, { useCallback, useEffect, useState } from 'react'
import { App, Button, Col, List, Row, Space, Spin, Typography } from 'antd'
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
import { PageSection, StatCard } from '../UnifiedUI'
import { type UserCenterPanelProps } from './userCenterShared'

const { Text } = Typography

const SHORTCUTS = [
  { key: 'organize', label: '文件整理', icon: <FolderOpenOutlined />, tab: 'organize' as const, accent: '#0a84ff' },
  { key: 'similarity', label: '相似照片', icon: <CopyOutlined />, tab: 'similarity' as const, accent: '#7c5cff' },
  { key: 'classify', label: '图片分类', icon: <PictureOutlined />, tab: 'classify' as const, accent: '#30b95a' },
  { key: 'quickFilter', label: '快速筛选', icon: <FilterOutlined />, tab: 'quickFilter' as const, accent: '#ff9f0a' },
  { key: 'tools', label: '实用工具', icon: <ToolOutlined />, tab: 'tools' as const, accent: '#5ac8fa' },
  { key: 'cloud', label: '云图库', icon: <CloudOutlined />, tab: 'organize' as const, cloud: true, accent: '#0a84ff' },
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

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return '早上好'
    if (h < 18) return '下午好'
    return '晚上好'
  })()

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <PageSection
        title={`${greeting}，${user.displayName}`}
        subtitle="从这里快速进入常用能力，或查看云图库与最近活动"
      >
        <Row gutter={[12, 12]}>
          {SHORTCUTS.map((s) => (
            <Col xs={12} sm={8} md={8} key={s.key}>
              <button
                type="button"
                className="user-center-shortcut-tile"
                style={{ ['--shortcut-accent' as string]: s.accent }}
                onClick={() =>
                  onNavigateApp({
                    type: 'tab',
                    tab: s.tab,
                    organizeMode: s.cloud ? 'cloud' : 'local',
                  })
                }
              >
                <span className="user-center-shortcut-tile__icon">{s.icon}</span>
                <span className="user-center-shortcut-tile__label">{s.label}</span>
              </button>
            </Col>
          ))}
        </Row>
      </PageSection>

      <PageSection
        title="云图库"
        subtitle={cosDisabled ? '服务端未配置对象存储' : '云端图片存储用量概览'}
        extra={
          !cosDisabled ? (
            <Button type="link" size="small" onClick={() => void loadCos()} loading={cosLoading}>
              刷新
            </Button>
          ) : null
        }
      >
        {cosDisabled ? (
          <Text type="secondary">未配置对象存储，云图库不可用。可在「关于与服务」中查看 COS 状态。</Text>
        ) : cosLoading && !cosStats ? (
          <Spin size="small" />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                <StatCard
                  title="云端图片"
                  value={cosStats?.imageCount ?? 0}
                  icon={<PictureOutlined />}
                  accent="#0a84ff"
                  subtle
                />
              </Col>
              <Col xs={24} sm={12}>
                <StatCard
                  title="占用空间"
                  value={formatFileSize(cosStats?.totalBytes ?? 0)}
                  icon={<CloudOutlined />}
                  accent="#5ac8fa"
                  subtle
                />
              </Col>
            </Row>
            <Button
              type="primary"
              onClick={() => onNavigateApp({ type: 'tab', tab: 'organize', organizeMode: 'cloud' })}
            >
              进入云图库
            </Button>
          </Space>
        )}
      </PageSection>

      <PageSection
        title="最近活动"
        subtitle="基于本机操作日志，最多展示 8 条"
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
            className="user-center-activity-list"
            size="small"
            dataSource={recentLogs}
            renderItem={(item) => (
              <List.Item className="user-center-activity-list__item">
                <List.Item.Meta
                  title={<span className="user-center-activity-list__title">{operationLogActionLabel(item.action)}</span>}
                  description={
                    <Space direction="vertical" size={0}>
                      {item.summary ? <Text type="secondary">{item.summary}</Text> : null}
                      <Text type="secondary" className="user-center-activity-list__time">
                        {new Date(item.ts).toLocaleString()}
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

export default UserCenterOverviewTab
