import React from 'react'
import { createPortal } from 'react-dom'
import { Button, ConfigProvider } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

/** 高于 .image-editor-shell (1100)，避免 Select/Dropdown 被全屏层挡住 */
const EDITOR_POPUP_Z_INDEX_BASE = 1200

interface ImageEditorShellProps {
  open: boolean
  title: string
  meta?: string
  onClose: () => void
  toolbarExtra?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

const ImageEditorShell: React.FC<ImageEditorShellProps> = ({
  open,
  title,
  meta,
  onClose,
  toolbarExtra,
  footer,
  children,
}) => {
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <ConfigProvider theme={{ token: { zIndexPopupBase: EDITOR_POPUP_Z_INDEX_BASE } }}>
    <div className="image-editor-shell" role="dialog" aria-modal="true" aria-label="图片编辑">
      <header className="image-editor-shell__toolbar">
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onClose} aria-label="关闭编辑器" />
          <span className="image-editor-shell__toolbar-title">{title}</span>
          {meta ? <span className="image-editor-shell__toolbar-meta">{meta}</span> : null}
        </div>
        {toolbarExtra}
      </header>
      <div className="image-editor-shell__body">{children}</div>
      {footer ? (
        <footer
          style={{
            flexShrink: 0,
            padding: '8px 16px',
            borderTop: '1px solid var(--app-border)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          {footer}
        </footer>
      ) : null}
    </div>
    </ConfigProvider>,
    document.body
  )
}

export default ImageEditorShell
