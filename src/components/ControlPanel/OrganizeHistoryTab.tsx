import React from 'react'
import { Button, Empty, List, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd'
import { ClearOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons'
import { useFileStore } from '../../stores'
import { useFileSystem } from '../../hooks'
import { formatDateTime, ORGANIZE_HISTORY_ACTION_LABELS } from '../../utils'
import type { OrganizeHistoryItem } from '../../types'

const { Text } = Typography

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8
}

/** 右侧控制面板「历史」标签：仅展示整理/提取/预览操作记录（最近目录在左侧栏） */
const OrganizeHistoryTab: React.FC = () => {
  const { organizeHistoryList, removeOrganizeHistory, clearOrganizeHistory } = useFileStore()
  const { loadDirectoryFromHistory } = useFileSystem()

  const openPath = (path: string) => {
    void loadDirectoryFromHistory(path)
  }

  return (
    <div>
      <div style={sectionHeaderStyle}>
        <Text strong>
          <HistoryOutlined style={{ marginRight: 6 }} />
          整理记录
        </Text>
        {organizeHistoryList.length > 0 && (
          <Popconfirm title="确定清空所有整理记录？" onConfirm={clearOrganizeHistory} okText="确定" cancelText="取消">
            <Button type="text" size="small" icon={<ClearOutlined />}>
              清空
            </Button>
          </Popconfirm>
        )}
      </div>
      {organizeHistoryList.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="执行整理、提取或预览后会记录在此" />
      ) : (
        <List
          size="small"
          dataSource={organizeHistoryList.slice(0, 20)}
          renderItem={(item: OrganizeHistoryItem) => (
            <List.Item
              actions={[
                <Button key="open" type="link" size="small" onClick={() => openPath(item.sourcePath)}>
                  打开目录
                </Button>,
                <Button
                  key="del"
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => removeOrganizeHistory(item.id)}
                />
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={4} wrap>
                    <Tag
                      color={
                        item.action === 'organize' ? 'blue' : item.action === 'extract' ? 'green' : 'default'
                      }
                    >
                      {ORGANIZE_HISTORY_ACTION_LABELS[item.action]}
                    </Tag>
                    <span>{item.ruleLabel}</span>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Tooltip title={item.sourcePath}>
                      <Text type="secondary" ellipsis style={{ maxWidth: '100%', fontSize: 12 }}>
                        {item.sourcePath}
                      </Text>
                    </Tooltip>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(item.timestamp)}
                      {item.totalCount != null && (
                        <>
                          {' '}
                          · 共 {item.totalCount} 项
                          {item.successCount != null && item.action !== 'preview' && (
                            <>，成功 {item.successCount}</>
                          )}
                          {item.failCount != null && item.failCount > 0 && (
                            <>，失败 {item.failCount}</>
                          )}
                        </>
                      )}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )
}

export default OrganizeHistoryTab
