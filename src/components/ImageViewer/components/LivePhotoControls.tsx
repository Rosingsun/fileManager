/**
 * Live Photo 播放模式控制（单播 / 循环）
 */

import React from 'react'
import { Segmented } from 'antd'
import type { LivePlaybackMode } from './LivePhotoPlayer'
import './LivePhotoPlayer.css'

export interface LivePhotoControlsProps {
  playbackMode: LivePlaybackMode
  onPlaybackModeChange: (mode: LivePlaybackMode) => void
}

const LivePhotoControls: React.FC<LivePhotoControlsProps> = ({
  playbackMode,
  onPlaybackModeChange
}) => {
  return (
    <div className="live-photo-controls">
      <div className="live-photo-controls__title">Live 播放</div>
      <Segmented
        block
        value={playbackMode}
        onChange={(v) => onPlaybackModeChange(v as LivePlaybackMode)}
        options={[
          { label: '单播', value: 'once' },
          { label: '循环', value: 'loop' }
        ]}
      />
    </div>
  )
}

export default LivePhotoControls
