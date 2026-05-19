/**
 * Apple Live Photo 播放层：静帧上叠加，点击播放配对 MOV
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import { toMediaLocalUrl } from '../../../utils'
import './LivePhotoPlayer.css'

export type LivePlaybackMode = 'once' | 'loop'

export interface LivePhotoPlayerProps {
  liveVideoPath: string
  playbackMode: LivePlaybackMode
  disabled?: boolean
  onPlaybackModeChange?: (mode: LivePlaybackMode) => void
}

const LivePhotoPlayer: React.FC<LivePhotoPlayerProps> = ({
  liveVideoPath,
  playbackMode,
  disabled = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const videoSrc = toMediaLocalUrl(liveVideoPath)

  const stopPlayback = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    stopPlayback()
  }, [liveVideoPath, stopPlayback])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.loop = playbackMode === 'loop'
  }, [playbackMode])

  const handlePlayClick = useCallback(async () => {
    if (disabled) return
    const video = videoRef.current
    if (!video) return
    try {
      video.loop = playbackMode === 'loop'
      await video.play()
      setIsPlaying(true)
    } catch (err) {
      console.error('[LivePhoto] 播放失败:', err)
    }
  }, [disabled, playbackMode])

  const handlePauseClick = useCallback(() => {
    stopPlayback()
  }, [stopPlayback])

  const handleEnded = useCallback(() => {
    if (playbackMode === 'once') {
      stopPlayback()
    }
  }, [playbackMode, stopPlayback])

  return (
    <div className="live-photo-player" data-playing={isPlaying ? 'true' : 'false'}>
      <video
        ref={videoRef}
        className="live-photo-player__video"
        src={videoSrc}
        playsInline
        muted
        preload="metadata"
        style={{ visibility: isPlaying ? 'visible' : 'hidden' }}
        onEnded={handleEnded}
      />
      {!isPlaying && (
        <div className="live-photo-player__overlay">
          <span className="live-photo-player__badge">LIVE</span>
          <button
            type="button"
            className="live-photo-player__play-btn"
            onClick={handlePlayClick}
            disabled={disabled}
            aria-label="播放 Live Photo"
          >
            <PlayCircleOutlined />
          </button>
        </div>
      )}
      {isPlaying && (
        <button
          type="button"
          className="live-photo-player__pause-btn"
          onClick={handlePauseClick}
          aria-label="暂停"
        >
          <PauseCircleOutlined />
        </button>
      )}
    </div>
  )
}

export default LivePhotoPlayer
