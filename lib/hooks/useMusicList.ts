import { useEffect, useState } from 'react'

/**
 * 音乐文件接口定义
 */
export interface Track {
  key: string
  size?: number
  lastModified?: string
}

/**
 * useMusicList Hook
 *
 * 功能说明：
 * - 从服务器获取音乐列表
 * - 管理加载状态和错误处理
 * - 支持搜索和过滤
 * - 自动解码文件名（处理 URL 编码）
 */
export function useMusicList() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 加载音乐列表
   */
  const loadList = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/list')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const objects: Track[] = (data.objects || [])
        // 过滤出支持的音频格式
        .filter((obj: any) => {
          const key = (obj.key || '').toLowerCase()
          return ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.mp4'].some(ext =>
            key.endsWith(ext)
          )
        })
        // 提取关键字段
        .map((obj: any) => ({
          key: obj.key,
          size: obj.size,
          lastModified: obj.lastModified,
        }))

      setTracks(objects)
      console.log(`[MusicList] Loaded ${objects.length} tracks`)
    } catch (err: any) {
      console.error('[MusicList] Load failed:', err)
      setError(err?.message || 'Failed to load music list')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 初始化时加载列表
   */
  useEffect(() => {
    loadList()
  }, [])

  return {
    tracks,
    loading,
    error,
    loadList,
  }
}

/**
 * 从文件路径中提取文件名
 * @param key - 文件 key（可能包含文件夹路径）
 * @returns 文件名（已解码）
 */
export function getFileName(key: string): string {
  try {
    // 获取最后一个 / 后的部分
    const parts = key.split('/')
    const name = parts[parts.length - 1]
    // 解码 URL 编码的文件名
    return decodeURIComponent(name)
  } catch {
    return key
  }
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的大小字符串
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
