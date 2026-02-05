import { useCallback } from 'react'

/**
 * useAudioCache Hook
 *
 * 功能说明：
 * - 使用浏览器 Cache API 缓存音频文件
 * - 支持读取和写入缓存
 * - 降级处理：如果 Cache API 不可用，直接返回 null
 *
 * 作用：
 * - 避免重复下载相同的音频文件
 * - 在离线环境下支持播放已缓存的文件
 * - 减少网络带宽占用
 */
export function useAudioCache() {
  /**
   * 获取缓存的音频 blob URL
   */
  const getCachedAudio = useCallback(async (key: string): Promise<string | null> => {
    // 检查浏览器是否支持 Cache API
    if (!('caches' in window)) return null

    try {
      const cache = await caches.open('music-shuttle-v1')
      const cacheKey = `/api/audio?key=${encodeURIComponent(key)}`
      const cached = await cache.match(cacheKey)

      if (cached) {
        const blob = await cached.blob()
        console.log(`[Cache] Hit: ${key}`)
        return URL.createObjectURL(blob)
      }
    } catch (err) {
      console.warn('[Cache] Read failed:', err)
    }

    return null
  }, [])

  /**
   * 将音频 blob 存入缓存
   */
  const setCachedAudio = useCallback(async (key: string, blob: Blob): Promise<void> => {
    if (!('caches' in window)) return

    try {
      const cache = await caches.open('music-shuttle-v1')
      const cacheKey = `/api/audio?key=${encodeURIComponent(key)}`
      const response = new Response(blob, {
        headers: { 'Content-Type': blob.type || 'audio/mpeg' },
      })
      await cache.put(cacheKey, response)
      console.log(`[Cache] Stored: ${key}`)
    } catch (err) {
      console.warn('[Cache] Write failed:', err)
    }
  }, [])

  /**
   * 清除单个缓存
   */
  const removeCachedAudio = useCallback(async (key: string): Promise<void> => {
    if (!('caches' in window)) return

    try {
      const cache = await caches.open('music-shuttle-v1')
      const cacheKey = `/api/audio?key=${encodeURIComponent(key)}`
      await cache.delete(cacheKey)
      console.log(`[Cache] Removed: ${key}`)
    } catch (err) {
      console.warn('[Cache] Delete failed:', err)
    }
  }, [])

  /**
   * 清除所有缓存
   */
  const clearAllCache = useCallback(async (): Promise<void> => {
    if (!('caches' in window)) return

    try {
      const cacheNames = await caches.keys()
      const musicCaches = cacheNames.filter(name => name.startsWith('music-shuttle'))
      await Promise.all(musicCaches.map(name => caches.delete(name)))
      console.log('[Cache] Cleared all')
    } catch (err) {
      console.warn('[Cache] Clear failed:', err)
    }
  }, [])

  return {
    getCachedAudio,
    setCachedAudio,
    removeCachedAudio,
    clearAllCache,
  }
}
