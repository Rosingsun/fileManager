import React from 'react'
import { Modal, Button, Typography } from 'antd'
import { ArrowLeftOutlined, CloseOutlined } from '@ant-design/icons'
import classNames from 'classnames'
import './tools.css'

interface ToolModalProps {
  open?: boolean
  visible?: boolean
  onClose: () => void
  title: React.ReactNode
  width?: number
  footer: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const ToolModal: React.FC<ToolModalProps> = ({
  open,
  visible,
  onClose,
  title,
  width = 960,
  footer,
  children,
  className,
}) => (
  <Modal
    open={open ?? visible ?? false}
    onCancel={onClose}
    width={width}
    centered
    destroyOnClose
    maskClosable={false}
    className={classNames('app-tool-modal', className)}
    title={
      <div className="app-tool-modal__title-row">
        <Button
          type="text"
          size="small"
          className="app-tool-modal__back"
          icon={<ArrowLeftOutlined />}
          onClick={onClose}
          aria-label="返回工具列表"
        />
        <span className="app-tool-modal__title-text">{title}</span>
      </div>
    }
    footer={<div className="app-tool-modal__footer">{footer}</div>}
  >
    <div className="app-tool-modal__body">{children}</div>
  </Modal>
)

interface ToolModalLayoutProps {
  sidebar: React.ReactNode
  main: React.ReactNode
}

export const ToolModalLayout: React.FC<ToolModalLayoutProps> = ({ sidebar, main }) => (
  <div className="app-tool-modal__layout">
    <aside className="app-tool-modal__sidebar">{sidebar}</aside>
    <section className="app-tool-modal__main">{main}</section>
  </div>
)

interface ToolModalPanelProps {
  title?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const ToolModalPanel: React.FC<ToolModalPanelProps> = ({ title, children, className }) => (
  <div className={classNames('app-tool-modal__panel', className)}>
    {title ? <div className="app-tool-modal__panel-head">{title}</div> : null}
    <div className="app-tool-modal__panel-body">{children}</div>
  </div>
)

interface ToolModalMainSectionProps {
  title: React.ReactNode
  extra?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

export const ToolModalMainSection: React.FC<ToolModalMainSectionProps> = ({
  title,
  extra,
  children,
  footer,
}) => (
  <>
    <div className="app-tool-modal__main-head">
      <span className="app-tool-modal__main-title">{title}</span>
      {extra}
    </div>
    {children}
    {footer}
  </>
)

interface ToolModalPreviewProps {
  empty?: React.ReactNode
  children?: React.ReactNode
  padded?: boolean
}

export const ToolModalPreview: React.FC<ToolModalPreviewProps> = ({ empty, children, padded }) => {
  const hasContent =
    children != null &&
    !(Array.isArray(children) && children.every((c) => c == null || c === false))

  return (
    <div className="app-tool-modal__preview">
      {!hasContent && empty ? (
        <div className="app-tool-modal__preview-empty">{empty}</div>
      ) : (
        <div className={classNames('app-tool-modal__preview-scroll', padded && 'is-padded')}>
          {padded ? <div style={{ padding: 8 }}>{children}</div> : children}
        </div>
      )}
    </div>
  )
}

interface ToolConfirmModalProps {
  open: boolean
  onClose: () => void
  prompt: React.ReactNode
  children: React.ReactNode
  width?: number
}

export const ToolConfirmModal: React.FC<ToolConfirmModalProps> = ({
  open,
  onClose,
  prompt,
  children,
  width = 360,
}) => (
  <Modal
    open={open}
    onCancel={onClose}
    footer={null}
    closable={false}
    centered
    width={width}
    className="app-tool-confirm-modal"
    destroyOnClose
  >
    <div className="app-tool-confirm-modal__body">
      <Typography.Text className="app-tool-confirm-modal__prompt">{prompt}</Typography.Text>
      <div className="app-tool-confirm-modal__actions">{children}</div>
      <Button
        type="text"
        className="app-tool-confirm-modal__close"
        icon={<CloseOutlined />}
        onClick={onClose}
        aria-label="关闭"
      />
    </div>
  </Modal>
)
