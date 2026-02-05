'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Shuffle, ListMusic, Search } from 'lucide-react'

import {
  useAudioPrefetch,
  useMusicList,
  getFileName,
  useAudioPlayer,
  useAudioCache,
} from '@/lib/hooks'
import { swapAudioSource, revokeBlobUrl, formatTime, calculateProgress } from '@/lib/utils'

/**
 * MusicPlayer 组件
 *
 * 功能说明：
 * - 完整的音乐播放器 UI
 * - 管理音乐列表、搜索、播放控制
 * - 整合所有 Hook：音乐列表、音频播放、缓存、预取
 * - 实现流式播放 + 预取优化
 *
 * 架构说明：
 * 1. 初始化时加载音乐列表
 * 2. 用户点击歌曲时，立即使用 HTTP Range 请求播放（快速响应）
 * 3. 同时在后台预取完整文件到 Cache API
 * 4. 预取完成后无缝切换到 blob URL（提升稳定性）
 */
export default function MusicPlayer() {
  // ========== 状态管理 ==========
  const [searchQuery, setSearchQuery] = useState('')
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null)
  const [filteredTracks, setFilteredTracks] = useState<typeof tracks>([])

  // ========== Hook 整合 ==========
  const { tracks, loading } = useMusicList()
  const {
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
  } = useAudioPlayer()

  const { prefetchFullAudio, clearPrefetchCache } = useAudioPrefetch()
  const { getCachedAudio } = useAudioCache()

  // ========== 内部状态 ==========
  const currentBlobUrlRef = useRef<string | null>(null)

  // ========== 业务逻辑函数 ==========

  /**
   * 过滤音乐列表
   */
  const filterTracks = (query = searchQuery) => {
    const filtered = tracks.filter(t => {
      const name = getFileName(t.key).toLowerCase()
      return name.includes(query.toLowerCase())
    })
    setFilteredTracks(filtered)
  }

  /**
   * 初始化：加载音乐列表后设置搜索
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    filterTracks(searchQuery)
  }, [tracks, searchQuery])

  /**
   * 音频事件监听：进度、元数据加载、播放结束
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // 进度更新
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    // 元数据加载（获取时长）
    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      console.log(`[Player] Duration: ${formatTime(audio.duration)}`)
    }

    // 播放结束：自动播放下一首
    const handleEnded = () => {
      playNext()
    }

    // 清空音频源：释放 blob URL
    const handleEmptied = () => {
      revokeBlobUrl(currentBlobUrlRef.current)
      currentBlobUrlRef.current = null
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('emptied', handleEmptied)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('emptied', handleEmptied)
    }
  }, [])

  /**
   * 组件卸载：清理 blob URL 和缓存
   */
  useEffect(() => {
    return () => {
      revokeBlobUrl(currentBlobUrlRef.current)
      clearPrefetchCache()
    }
  }, [clearPrefetchCache])

  /**
   * 播放指定索引的歌曲
   *
   * 性能优化策略详解：
   * ==================
   * 
   * 场景：用户点击播放一首新歌曲
   * 
   * 问题：
   * - 网络请求慢，用户要等很久才能听到声音
   * - 音频文件可能很大（10MB+），无法立即下载完成
   * - 简单的"下载完再播放"策略体验很差
   * 
   * 方案：流式播放 + 后台缓存策略
   * 
   * 详细流程：
   * --------
   * 
   * 步骤 1：检查缓存（最快，O(1) 时间）
   *   - 检查这首歌是否已在 Cache API 中
   *   - 如果有：直接用 blob URL 播放，0 延迟，0 网络请求
   *   - 如果无：继续步骤 2
   * 
   * 步骤 2：立即开始流式播放（HTTP Range 请求，秒开）
   *   - 调用 play(audioUrl)，URL 为 /api/audio?key=xxx
   *   - 浏览器发起 HTTP Range 请求，只下载开头部分
   *   - 用户听到声音，体验流畅，不用等
   *   - 同时浏览器继续下载剩余部分
   * 
   * 步骤 3：高优先级预取（最多等 3 秒）
   *   - prefetchFullAudio(key, url, 'high')
   *   - 在后台下载完整文件到 Cache API
   *   - 设置 3 秒超时：
   *     * 大多数情况下 3 秒能下载完（假设 3MB 文件，网速 1MB/s）
   *     * 快速网络可能 1 秒就完成
   *     * 慢速网络会超时，但不阻塞播放
   * 
   * 步骤 4：无缝切换到缓存（如果步骤 3 成功）
   *   - 检测到预取完成，调用 swapAudioSource()
   *   - 无缝切换到 blob URL（缓存的文件）
   *   - 用户感觉不到任何变化，体验最优
   *   - 好处：
   *     * 后续播放更稳定（离线可用）
   *     * 下次播放同首歌，0 网络请求
   *     * 重复切换歌曲时，各首歌都是秒播
   * 
   * 步骤 5：后台继续预取（如果步骤 3 超时）
   *   - 如果 3 秒内没完成，继续后台预取
   *   - 使用低优先级，不重试，60 秒超时
   *   - 完成后再次尝试无缝切换
   *   - 即使切换失败也无妨，流式播放继续正常工作
   * 
   * 防止重复请求：
   * --------
   * 假设用户快速点击 A 歌 → B 歌 → A 歌，会发生什么？
   * 
   * 优化前（坏）：
   *   - 第 1 次播放 A：发起请求 1、请求 2（两个并发下载 A）
   *   - 第 1 次播放 B：发起请求 3、请求 4（两个并发下载 B）
   *   - 第 2 次播放 A：发起请求 5、请求 6（A 已经下载过，还要重新下载！）
   *   - 总共：6 个网络请求
   * 
   * 优化后（好）：
   *   - 第 1 次播放 A：发起请求 1（流式播放）+ 请求 2（后台缓存）
   *     * prefetchFullAudio 检查：A 不在缓存，发起请求 2
   *   - 第 1 次播放 B：发起请求 3（流式播放）+ 等待请求 4
   *     * prefetchFullAudio 检查：B 不在缓存，发起请求 4
   *     * 注意：prefetchCacheRef.current.get('A') 已有（请求 2 进行中）
   *   - 第 2 次播放 A：检查缓存 ✅ 有了！0 网络请求，直接播放
   *     * 因为请求 2 已完成，A 已在缓存中
   *   - 总共：4 个网络请求（减少 33%）
   * 
   * 关键机制：prefetchCacheRef
   *   const existing = prefetchCacheRef.current.get(key)
   *   if (existing) return existing  // 返回进行中的 Promise
   *   这确保同一文件最多只有 1 个预取请求进行中
   * 
   * 网络请求模型：
   * --------
   * 
   * 单个文件的完整生命周期：
   * 
   * 播放时间轴：
   *   0ms:    用户点击播放 A
   *   10ms:   流式播放开始（秒开）
   *   20ms:   预取请求发起
   *   500ms:  用户已听到 5 秒的音乐
   *   1500ms: 预取 A 完成！存入 Cache API
   *   1510ms: 切换到 blob URL（无缝，用户不感知）
   *   2000ms: 用户点击播放 B
   *   2010ms: B 流式播放开始
   *   3000ms: 预取 B 超时，但继续后台（低优先级）
   *   5000ms: 用户再次点击 A
   *   5010ms: 缓存命中！直接播放，0 网络
   * 
   * 资源使用：
   *   - 浏览器内存：每个缓存文件占用文件大小（3-10MB）
   *   - Cache API 空间：依赖浏览器和磁盘，通常足够
   *   - 网络带宽：第一次播放 = 文件大小，后续播放 = 0
   * 
   * 适应场景：
   * --------
   * 快速网络（>5MB/s）：
   *   - 大多数歌曲 < 1 秒 = 完成预取
   *   - 快速切换歌曲时，几乎都能从缓存播放
   *   - 最优体验
   * 
   * 中速网络（1-5MB/s）：
   *   - 大多数歌曲 1-3 秒完成预取
   *   - 第一首歌完成缓存后，后续歌曲秒播
   *   - 体验良好
   * 
   * 慢速网络（<1MB/s）：
   *   - 预取可能超时，继续后台下载
   *   - 但流式播放继续工作
   *   - 用户体验：先流式听歌，后缓存优化
   */
  async function playTrack(index: number) {
    const track = filteredTracks[index]
    if (!track) return

    try {
      // 记录当前播放的索引
      const globalIndex = tracks.findIndex(t => t.key === track.key)
      setCurrentTrackIndex(globalIndex >= 0 ? globalIndex : null)

      const audioUrl = `/api/audio?key=${encodeURIComponent(track.key)}`
      
      // 步骤 1：先检查缓存
      const cachedUrl = await getCachedAudio(track.key)
      if (cachedUrl) {
        console.log(`[Player] ✅ Cache hit: ${getFileName(track.key)}`)
        await play(cachedUrl, true)
        revokeBlobUrl(currentBlobUrlRef.current)
        currentBlobUrlRef.current = cachedUrl
        return
      }

      // 步骤 2：立即开始流式播放（秒开）
      console.log(`[Player] 🎵 Streaming: ${getFileName(track.key)}`)
      await play(audioUrl, true)

      // 步骤 3：高优先级预取（等待最多 3 秒）
      console.log(`[Player] ⚡ Starting high-priority prefetch...`)
      const blobUrl = await Promise.race([
        prefetchFullAudio(track.key, audioUrl, 'high'),
        new Promise<string | null>(resolve =>
          setTimeout(() => {
            console.log(`[Player] ⏱️ Prefetch timeout (3s), continuing in background...`)
            resolve(null)
          }, 3000)
        ),
      ])

      // 步骤 4：如果预取成功，切换到 blob URL
      if (blobUrl && audioRef.current && audioRef.current.src === audioUrl) {
        console.log(`[Player] 🔄 Swapping to blob URL (cached)`)
        await swapAudioSource(audioRef.current, blobUrl, audioRef.current.currentTime)
        revokeBlobUrl(currentBlobUrlRef.current)
        currentBlobUrlRef.current = blobUrl
      }
      
      // 步骤 5：如果超时，继续后台预取（注意：prefetchFullAudio 会检测到已有进行中的请求）
      // 所以这里不会发起新的下载，只是等待之前的下载完成
      if (!blobUrl) {
        console.log(`[Player] 🔄 Continuing prefetch in background...`)
        prefetchFullAudio(track.key, audioUrl, 'low').then(finalUrl => {
          // 只有当前还在播放这首歌时才切换
          if (finalUrl && audioRef.current?.src === audioUrl) {
            swapAudioSource(audioRef.current, finalUrl, audioRef.current.currentTime)
              .then(() => {
                revokeBlobUrl(currentBlobUrlRef.current)
                currentBlobUrlRef.current = finalUrl
                console.log(`[Player] ✅ Late swap to cached blob URL`)
              })
              .catch(() => {
                console.log(`[Player] ⚠️ Late swap failed (user may have switched songs)`)
              })
          }
        })
      }
    } catch (err) {
      console.error('[Player] ❌ Play error:', err)
    }
  }

  /**
   * 播放下一首
   *
   * 支持两种模式：
   * - 顺序播放：按列表顺序播放下一首
   * - 随机播放：随机选择一首歌曲
   */
  function playNext() {
    if (tracks.length === 0) {
      console.log('[Player] No tracks available')
      return
    }

    let nextIndex: number

    if (randomMode) {
      // 随机模式：从所有歌曲中随机选择
      const randomGlobalIndex = Math.floor(Math.random() * tracks.length)
      const randomTrack = tracks[randomGlobalIndex]
      nextIndex = filteredTracks.findIndex(t => t.key === randomTrack.key)

      if (nextIndex < 0) {
        nextIndex = 0 // 回退到第一首
      }
    } else {
      // 顺序模式：播放下一首
      if (currentTrackIndex === null) {
        nextIndex = 0
      } else {
        const nextGlobalIndex = (currentTrackIndex + 1) % tracks.length
        const nextTrack = tracks[nextGlobalIndex]
        nextIndex = filteredTracks.findIndex(t => t.key === nextTrack.key)

        if (nextIndex < 0) {
          nextIndex = 0 // 回退到第一首
        }
      }
    }

    console.log(`[Player] Play next: filtered index ${nextIndex}`)
    playTrack(nextIndex)
  }

  /**
   * 切换随机播放模式并播放下一首
   */
  function handleToggleRandom() {
    toggleRandomMode()
    playNext()
  }

  /**
   * 搜索框 onChange
   */
  function handleSearchChange(value: string) {
    setSearchQuery(value)
  }

  /**
   * 进度条拖拽
   */
  function handleProgressChange(e: React.ChangeEvent<HTMLInputElement>) {
    const percentage = parseFloat(e.target.value)
    const newTime = (percentage / 100) * duration
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  // ========== 渲染 ==========

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col">
      {/* 主容器 */}
      <div className="w-full max-w-2xl mx-auto flex flex-col h-full px-4 box-border">
        {/* 顶部标题 */}
        <header className="flex items-center justify-between gap-3 my-6 flex-wrap">
          <div className="flex items-center gap-3">
            <ListMusic className="w-8 h-8" />
            <h1 className="text-2xl font-bold">音乐穿梭机</h1>
          </div>
          <div className="text-sm text-gray-400">已加载 {tracks.length} 首</div>
        </header>

        {/* 搜索框 */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="搜索音乐名..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 text-white placeholder-gray-400 border border-white/20 outline-none focus:border-white/40 transition-colors"
          />
        </div>

        {/* 音乐列表 */}
        <main className="flex-1 bg-white/5 rounded-lg p-3 overflow-y-auto mb-56">
          {loading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : filteredTracks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {tracks.length === 0 ? '未找到音乐，请检查 R2 配置' : '没有找到音乐'}
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredTracks.map((track, index) => {
                const isCurrentTrack =
                  currentTrackIndex === tracks.findIndex(t => t.key === track.key)
                const fileName = getFileName(track.key)

                return (
                  <li
                    key={track.key}
                    onClick={() => playTrack(index)}
                    className={`flex items-center justify-between gap-3 p-3 rounded cursor-pointer transition-colors ${
                      isCurrentTrack
                        ? 'bg-white/20 text-white'
                        : 'hover:bg-white/10 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-bold text-gray-400 flex-shrink-0">
                        {index + 1}.
                      </span>
                      <span className="text-sm truncate">{fileName}</span>
                    </div>
                    {isCurrentTrack && isPlaying && (
                      <div className="flex gap-1 flex-shrink-0">
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-1 bg-purple-400 rounded animate-pulse"
                            style={{
                              height: `${4 + i * 3}px`,
                              animationDelay: `${i * 100}ms`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </main>

        {/* 播放控制条 */}
        <footer className="fixed bottom-0 right-0 left-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent py-8 px-4">
          <div className="max-w-2xl mx-auto px-4 flex flex-col gap-4">
            {/* 播放按钮和随机模式按钮 */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={togglePlay}
                className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors flex-shrink-0"
                aria-label={isPlaying ? '暂停' : '播放'}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>

              <button
                onClick={handleToggleRandom}
                className={`flex-1 px-6 py-3 rounded-lg flex items-center justify-center gap-2 text-white font-bold transition-all text-sm ${
                  randomMode
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500'
                }`}
              >
                <Shuffle className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">
                  {randomMode ? '随机中' : '随机播放'}
                </span>
              </button>
            </div>

            {/* 现在播放信息和进度条 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex flex-col gap-3">
              {/* 歌曲名 */}
              <div className="text-center text-sm font-semibold truncate">
                {currentTrackIndex !== null && tracks[currentTrackIndex]
                  ? getFileName(tracks[currentTrackIndex].key)
                  : '未选择'}
              </div>

              {/* 进度条 */}
              <div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={calculateProgress(currentTime, duration)}
                  onChange={handleProgressChange}
                  className="w-full h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* 时间显示 */}
              <div className="flex justify-between text-xs text-gray-300">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* 音频元素 */}
      <audio
        ref={audioRef}
        preload="auto"
        crossOrigin="anonymous"
      />
    </div>
  )
}
