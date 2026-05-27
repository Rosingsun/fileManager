import React, { useState } from 'react'
import { Form, Input, Modal, Typography } from 'antd'
import { parseShareTokenFromInput } from '../utils'

export interface ShareOpenModalProps {
  open: boolean
  onClose: () => void
  onOpenShare: (token: string) => void
}

const ShareOpenModal: React.FC<ShareOpenModalProps> = ({ open, onClose, onOpenShare }) => {
  const [form] = Form.useForm<{ linkOrToken: string }>()
  const [error, setError] = useState<string | null>(null)

  const handleOk = async () => {
    setError(null)
    try {
      const values = await form.validateFields()
      const token = parseShareTokenFromInput(values.linkOrToken)
      if (!token) {
        setError('无法识别分享链接，请粘贴完整链接或 32 位令牌')
        return
      }
      onOpenShare(token)
      form.resetFields()
      setError(null)
      onClose()
    } catch {
      /* validation */
    }
  }

  const handleCancel = () => {
    form.resetFields()
    setError(null)
    onClose()
  }

  return (
    <Modal
      title="打开分享链接"
      open={open}
      onOk={() => void handleOk()}
      onCancel={handleCancel}
      okText="打开"
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
        粘贴他人发给您的分享链接，或直接输入 32 位令牌。支持{' '}
        <Typography.Text code>filedeal://share/…</Typography.Text>、
        <Typography.Text code>#share/…</Typography.Text> 或纯令牌。
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item
          name="linkOrToken"
          label="分享链接或令牌"
          rules={[{ required: true, message: '请输入分享链接或令牌' }]}
          validateStatus={error ? 'error' : undefined}
          help={error ?? undefined}
        >
          <Input.TextArea
            placeholder="例如 filedeal://share/a1b2c3… 或直接粘贴 32 位令牌"
            autoSize={{ minRows: 2, maxRows: 4 }}
            onChange={() => setError(null)}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ShareOpenModal
