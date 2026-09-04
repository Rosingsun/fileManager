import React, { useEffect, useState } from 'react'
import { Alert, Button, Input, Space, Tag } from 'antd'
import { CheckCircleOutlined, KeyOutlined, SafetyOutlined } from '@ant-design/icons'
import { isCloudVaultAvailable, setCloudCredentials, validateCloudCredentials, describeCloudError } from '../../utils'
import type { CloudProviderId } from '../../types/cloud'

interface Props {
  providerId: CloudProviderId
  providerName: string
  riskNotice?: string
  existingHint?: string
  onSaved: (accountHint: string) => void
  onCancel: () => void
}

const CloudCredentialsPanel: React.FC<Props> = ({
  providerId,
  providerName,
  riskNotice,
  existingHint,
  onSaved,
  onCancel,
}) => {
  const [vaultOk, setVaultOk] = useState(true)
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [maskedToken, setMaskedToken] = useState<string | null>(null)
  const [accountHint, setAccountHint] = useState<string>(existingHint ?? '')

  useEffect(() => {
    isCloudVaultAvailable().then(setVaultOk)
  }, [])

  const onSave = async () => {
    if (!token.trim()) return
    setSaving(true)
    setValidating(true)
    try {
      const { accountHint: hint, maskedToken: masked } = await setCloudCredentials(providerId, token.trim())
      setAccountHint(hint)
      setMaskedToken(masked)
      // 二次验证
      const v = await validateCloudCredentials(providerId)
      if (!v.ok) {
        throw new Error(v.error ?? '凭证校验失败')
      }
      setAccountHint(v.accountHint ?? hint)
      onSaved(v.accountHint ?? hint)
    } catch (e) {
      // 失败时让用户看到具体原因
      setAccountHint('')
      setMaskedToken(null)
      window.alert(`凭证保存失败：${describeCloudError(e)}`)
    } finally {
      setSaving(false)
      setValidating(false)
    }
  }

  return (
    <div className="cloud-credentials-panel">
      <p className="cloud-credentials-panel__provider">
        当前云盘：<strong>{providerName}</strong>
      </p>

      {!vaultOk && (
        <Alert
          type="error"
          showIcon
          message="系统密钥链不可用"
          description="无法在本地安全保存凭证，请检查系统设置后重试。"
          style={{ marginBottom: 12 }}
        />
      )}

      {riskNotice && (
        <Alert
          type="warning"
          showIcon
          message="使用须知"
          description={riskNotice}
          style={{ marginBottom: 12 }}
        />
      )}

      <Alert
        type="info"
        showIcon
        message="如何获取 refresh_token？"
        description={
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>打开阿里云盘网页版（https://www.alipan.com）并登录</li>
            <li>按 F12 打开开发者工具 → Application → Local Storage</li>
            <li>
              找到 <code>token</code> 键，复制其中的 <code>refresh_token</code> 字段（约 30 天有效）
            </li>
            <li>或使用开源工具 <code>aliyundrive-webdav</code> / <code>aliyundrive-go</code> 获取</li>
          </ol>
        }
        style={{ marginBottom: 12 }}
      />

      <div className="cloud-credentials-panel__field">
        <label>
          <KeyOutlined /> refresh_token
        </label>
        <Input.Password
          value={token}
          placeholder="粘贴 refresh_token，提交后只在本地以加密形式保存"
          onChange={e => setToken(e.target.value)}
          autoFocus
          disabled={!vaultOk || saving}
        />
        {maskedToken && (
          <div className="cloud-credentials-panel__masked">
            <SafetyOutlined /> 已保存：<Tag color="success">{maskedToken}</Tag>
          </div>
        )}
      </div>

      {accountHint && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message={`已连接 ${providerName}`}
          description={`账号：${accountHint}`}
          style={{ marginBottom: 12 }}
        />
      )}

      <Space>
        <Button type="primary" onClick={onSave} loading={saving || validating} disabled={!token.trim() || !vaultOk}>
          保存并验证
        </Button>
        <Button onClick={onCancel}>关闭</Button>
      </Space>
    </div>
  )
}

export default CloudCredentialsPanel
