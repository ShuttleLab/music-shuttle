import { useCallback, useRef, useState } from 'react'

/**
 * useAudioPlayer Hook
 *
 * 功能说明：
 * - 管理音频播放的核心逻辑
 * - 支持播放/暂停控制
 * - 跟踪当前播放时间和总时长
 * - 支持随机播放和顺序播放
 * - 处理播放结束时的自动下一首
 *
 * 返回状态和控制方法
 */
export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [randomMode, setRandomMode] = useState(false)

  /**
   * 切换播放/暂停状态
   */
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return

    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {
        console.warn('[Audio] Play failed')
      })
      setIsPlaying(true)
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  /**
   * 播放指定的音频 URL
   * @param src - 音频源 URL（可以是 HTTP URL 或 blob: URL）
   * @param autoPlay - 是否自动播放
   */
  const play = useCallback(async (src: string, autoPlay = true) => {
    if (!audioRef.current) return

    try {
      // 停止当前播放（避免 AbortError）
      audioRef.current.pause()

      // 设置新源
      audioRef.current.src = src
      audioRef.current.load()

      // 自动播放
      if (autoPlay) {
        await audioRef.current.play()
        setIsPlaying(true)
      }

      console.log('[Audio] Playing:', src.substring(0, 50))
    } catch (err) {
      console.error('[Audio] Play error:', err)
    }
  }, [])

  /**
   * 切换随机播放模式
   */
  const toggleRandomMode = useCallback(() => {
    setRandomMode(prev => !prev)
  }, [])

  /**
   * 设置播放进度
   */
  const seek = useCallback((time: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = time
  }, [])

  return {
    audioRef,
    isPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    randomMode,
    togglePlay,
    toggleRandomMode,
    play,
    seek,
  }
}
