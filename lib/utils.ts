/**
 * 辅助工具函数
 */

/**
 * 交换到 blob URL 进行本地播放
 *
 * 功能说明：
 * - 在预取完成后，将音频源从 HTTP URL 切换到 blob URL
 * - 好处：减少网络请求，提升播放稳定性，支持离线播放
 * - 切换过程：暂停 -> 更新源 -> 恢复播放位置 -> 继续播放
 *
 * @param audio - audio 元素
 * @param newUrl - 新的 blob URL
 * @param resumeTime - 恢复播放时间
 */
export async function swapAudioSource(
  audio: HTMLAudioElement,
  newUrl: string,
  resumeTime: number
): Promise<void> {
  return new Promise(resolve => {
    const wasPlaying = !audio.paused

    // 暂停当前播放
    audio.pause()

    // 监听元数据加载完成
    const handleLoadedMetadata = () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)

      // 恢复播放位置
      audio.currentTime = resumeTime

      // 继续播放
      if (wasPlaying) {
        audio.play().catch(() => {
          console.warn('[Audio] Resume play failed')
        })
      }

      resolve()
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })

    // 设置新源
    audio.src = newUrl
    audio.load()
  })
}

/**
 * 撤销 blob URL
 *
 * 功能说明：
 * - 释放由 URL.createObjectURL 创建的对象 URL
 * - 防止内存泄漏
 * - 应在组件卸载或不再使用时调用
 *
 * @param url - blob URL
 */
export function revokeBlobUrl(url: string | null | undefined): void {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url)
    } catch (err) {
      console.warn('[Blob] Revoke failed:', err)
    }
  }
}

/**
 * 格式化时间为 MM:SS
 *
 * @param seconds - 秒数
 * @returns 格式化的时间字符串
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 计算进度百分比
 *
 * @param current - 当前时间
 * @param total - 总时长
 * @returns 百分比 (0-100)
 */
export function calculateProgress(current: number, total: number): number {
  if (!isFinite(current) || !isFinite(total) || total === 0) return 0
  return Math.min(100, (current / total) * 100)
}

/**
 * 从进度百分比计算时间
 *
 * @param progress - 百分比 (0-100)
 * @param total - 总时长
 * @returns 对应的时间（秒）
 */
export function progressToTime(progress: number, total: number): number {
  return (Math.min(100, Math.max(0, progress)) / 100) * total
}
