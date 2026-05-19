import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Space, Slider, Radio, message, Typography, Empty } from 'antd'
import {
  FolderOpenOutlined,
  FolderOutlined,
  EyeOutlined,
  ExportOutlined
} from '@ant-design/icons'
import {
  ToolModal,
  ToolModalPanel
} from '../ToolModal'
import type { FocusAdjustMode, FocusAdjustOptions, PhotoFocusPoint } from '../../../types'
import { getPhotoFocusPoints, logSignedInUserAction } from '../../../utils'
import { useToolOutputPathStore } from '../../../stores'
import { useLocalImageThumbnail } from '../../../hooks'
import FocusAdjustCanvas from './FocusAdjustCanvas'
import './focus-adjust.css'

const { Text } = Typography

interface FocusAdjustProps {
  visible: boolean
  onClose: () => void
}

const MODE_PRESETS: Record<
  FocusAdjustMode,
  { sharpen: number; blur: number; radius: number; feather: number }
> = {
  subjectRecover: { sharpen: 72, blur: 42, radius: 30, feather: 38 },
  regionSharpen: { sharpen: 82, blur: 0, radius: 36, feather: 32 }
}

interface FocusAdjustPropsInner {
  filePath: string
  mode: FocusAdjustMode
  focusX: number
  focusY: number
  radiusPercent: number
  sharpenStrength: number
  backgroundBlur: number
  feather: number
  hasFocusPoint: boolean
}

function buildOptions(
  p: FocusAdjustPropsInner,
  outputPath?: string
): FocusAdjustOptions {
  return {
    mode: p.mode,
    focusX: p.focusX,
    focusY: p.focusY,
    radius: p.radiusPercent / 100,
    sharpenStrength: p.sharpenStrength,
    backgroundBlur: p.backgroundBlur,
    feather: p.feather,
    outputPath
  }
}

const FocusAdjust: React.FC<FocusAdjustProps> = ({ visible, onClose }) => {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [mode, setMode] = useState<FocusAdjustMode>('subjectRecover')
  const [focusX, setFocusX] = useState(0.5)
  const [focusY, setFocusY] = useState(0.5)
  const [hasFocusPoint, setHasFocusPoint] = useState(false)
  const [radiusPercent, setRadiusPercent] = useState(30)
  const [sharpenStrength, setSharpenStrength] = useState(72)
  const [backgroundBlur, setBackgroundBlur] = useState(42)
  const [feather, setFeather] = useState(38)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [metaPoints, setMetaPoints] = useState<PhotoFocusPoint[]>([])
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { sharedOutputPath, setSharedOutputPath } = useToolOutputPathStore()
  const outputPath = sharedOutputPath

  const { src: thumbSrc } = useLocalImageThumbnail(visible ? filePath : null, {
    maxEdge: 1200,
    quality: 85
  })

  const applyModePreset = useCallback((nextMode: FocusAdjustMode) => {
    const preset = MODE_PRESETS[nextMode]
    setSharpenStrength(preset.sharpen)
    setBackgroundBlur(preset.blur)
    setRadiusPercent(preset.radius)
    setFeather(preset.feather)
  }, [])

  const handleSelectFile = async () => {
    if (!window.electronAPI?.selectFiles) return
    const selected = await window.electronAPI.selectFiles('image')
    if (!selected?.length) return
    const path = selected[0]
    setFilePath(path)
    setHasFocusPoint(false)
    setPreviewSrc(null)
    setMetaPoints([])
    void getPhotoFocusPoints(path).then(res => {
      if (res.points.length > 0) {
        setMetaPoints(res.points)
        const p = res.points[0]
        setFocusX(p.x)
        setFocusY(p.y)
        setHasFocusPoint(true)
      }
    })
  }

  const handleSelectOutputPath = async () => {
    if (!window.electronAPI?.openDirectory) return
    const dir = await window.electronAPI.openDirectory()
    if (dir) setSharedOutputPath(dir)
  }

  const handleModeChange = (next: FocusAdjustMode) => {
    setMode(next)
    applyModePreset(next)
  }

  const params: FocusAdjustPropsInner = {
    filePath: filePath ?? '',
    mode,
    focusX,
    focusY,
    radiusPercent,
    sharpenStrength,
    backgroundBlur,
    feather,
    hasFocusPoint
  }

  const runPreview = useCallback(async () => {
    if (!filePath || !hasFocusPoint || !window.electronAPI?.previewFocusAdjust) return
    setIsPreviewLoading(true)
    try {
      const dataUrl = await window.electronAPI.previewFocusAdjust(
        filePath,
        buildOptions(params)
      )
      setPreviewSrc(dataUrl)
    } catch (error) {
      message.error('预览失败: ' + (error as Error).message)
    } finally {
      setIsPreviewLoading(false)
    }
  }, [
    filePath,
    hasFocusPoint,
    mode,
    focusX,
    focusY,
    radiusPercent,
    sharpenStrength,
    backgroundBlur,
    feather
  ])

  useEffect(() => {
    if (!visible || !filePath || !hasFocusPoint) return
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    previewTimerRef.current = setTimeout(() => {
      void runPreview()
    }, 300)
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [visible, filePath, hasFocusPoint, runPreview])

  const handleFocusChange = (x: number, y: number) => {
    setFocusX(x)
    setFocusY(y)
    setHasFocusPoint(true)
  }

  const handleExport = async () => {
    if (!filePath) {
      message.warning('请先选择图片')
      return
    }
    if (!hasFocusPoint) {
      message.warning('请点击画面设定对焦点')
      return
    }
    if (!outputPath) {
      message.warning('请选择输出目录')
      return
    }
    if (!window.electronAPI?.applyFocusAdjust) {
      message.warning('请重启应用以加载对焦调整功能')
      return
    }

    setIsExporting(true)
    try {
      const out = await window.electronAPI.applyFocusAdjust(
        filePath,
        buildOptions(params, outputPath)
      )
      message.success(`已导出: ${out.split(/[/\\]/).pop()}`)
      logSignedInUserAction('focus_adjust', '对焦调整导出', out)
      onClose()
    } catch (error) {
      message.error('导出失败: ' + (error as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  const displaySrc = previewSrc ?? thumbSrc

  return (
    <ToolModal
      open={visible}
      onClose={onClose}
      title="对焦调整"
      width={1080}
      className="app-tool-modal--focus-adjust"
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() => void runPreview()}
            disabled={!filePath || !hasFocusPoint}
            loading={isPreviewLoading}
          >
            刷新预览
          </Button>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={() => void handleExport()}
            disabled={!filePath || !hasFocusPoint || !outputPath}
            loading={isExporting}
          >
            导出图片
          </Button>
        </Space>
      }
    >
      <div className="focus-adjust-layout">
        <div className="focus-adjust-layout__sidebar app-tool-modal__sidebar">
          <ToolModalPanel title="选择图片">
            <Button icon={<FolderOpenOutlined />} onClick={() => void handleSelectFile()} block>
              选择图片
            </Button>
            {filePath ? (
              <Text type="secondary" ellipsis style={{ display: 'block', marginTop: 8 }}>
                {filePath.split(/[/\\]/).pop()}
              </Text>
            ) : null}
          </ToolModalPanel>

          <ToolModalPanel title="校正模式">
            <Radio.Group
              value={mode}
              onChange={e => handleModeChange(e.target.value as FocusAdjustMode)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <Radio value="subjectRecover">主体恢复（锐化主体 + 虚化背景）</Radio>
              <Radio value="regionSharpen">区域清晰（突出点击区域）</Radio>
            </Radio.Group>
          </ToolModalPanel>

          <ToolModalPanel title="对焦点">
            <Text type="secondary" style={{ fontSize: 12 }}>
              {hasFocusPoint
                ? `位置 ${(focusX * 100).toFixed(0)}%, ${(focusY * 100).toFixed(0)}%`
                : '未设定'}
            </Text>
            {metaPoints.length > 0 ? (
              <div className="focus-adjust-meta-list">
                <Text type="secondary" style={{ fontSize: 12 }}>
                  元数据建议：
                </Text>
                {metaPoints.map((p, i) => (
                  <Button
                    key={i}
                    size="small"
                    block
                    onClick={() => {
                      setFocusX(p.x)
                      setFocusY(p.y)
                      setHasFocusPoint(true)
                    }}
                  >
                    对焦点 {i + 1}（{Math.round(p.x * 100)}%, {Math.round(p.y * 100)}%）
                  </Button>
                ))}
              </div>
            ) : (
              <Button
                size="small"
                block
                style={{ marginTop: 8 }}
                disabled={!filePath}
                onClick={() => {
                  if (!filePath) return
                  void getPhotoFocusPoints(filePath).then(res => {
                    if (res.points.length === 0) {
                      message.info('未在元数据中找到对焦点，请手动点击画面')
                      return
                    }
                    setMetaPoints(res.points)
                    setFocusX(res.points[0].x)
                    setFocusY(res.points[0].y)
                    setHasFocusPoint(true)
                  })
                }}
              >
                从照片元数据读取
              </Button>
            )}
          </ToolModalPanel>

          <ToolModalPanel title="参数">
            <div className="focus-adjust-slider-block">
              <Text>对焦区域半径: {radiusPercent}%</Text>
              <Slider min={5} max={50} value={radiusPercent} onChange={setRadiusPercent} />
            </div>
            <div className="focus-adjust-slider-block">
              <Text>锐化强度: {sharpenStrength}</Text>
              <Slider min={0} max={100} value={sharpenStrength} onChange={setSharpenStrength} />
            </div>
            <div className="focus-adjust-slider-block">
              <Text>背景虚化: {backgroundBlur}</Text>
              <Slider
                min={0}
                max={100}
                value={backgroundBlur}
                onChange={setBackgroundBlur}
                disabled={mode === 'regionSharpen'}
              />
            </div>
            <div className="focus-adjust-slider-block">
              <Text>边缘过渡: {feather}</Text>
              <Slider min={0} max={100} value={feather} onChange={setFeather} />
            </div>
          </ToolModalPanel>

          <ToolModalPanel title="输出">
            <Button
              type="link"
              icon={<FolderOutlined />}
              onClick={() => void handleSelectOutputPath()}
              style={{ padding: 0 }}
            >
              {outputPath ? outputPath.split(/[/\\]/).pop() : '选择输出目录'}
            </Button>
          </ToolModalPanel>
        </div>

        <div className="focus-adjust-layout__main app-tool-modal__main">
          <p className="focus-adjust-hint">
            无法恢复光学上完全丢失的细节。请在右侧点击设定对焦点；若效果偏弱，可提高「锐化强度」「背景虚化」或略缩小「对焦区域半径」。
          </p>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {!filePath ? (
              <Empty description="请先选择一张图片" style={{ marginTop: 80 }} />
            ) : (
              <FocusAdjustCanvas
                imageSrc={displaySrc}
                focusX={focusX}
                focusY={focusY}
                radiusPercent={radiusPercent}
                hasFocusPoint={hasFocusPoint}
                onFocusChange={handleFocusChange}
              />
            )}
          </div>
        </div>
      </div>
    </ToolModal>
  )
}

export default FocusAdjust
