import { useCallback, useRef } from 'react'
import { useAudioCache } from './useAudioCache'

/**
 * useAudioPrefetch Hook
 *
 * 功能说明：
 * - 在后台预取完整的音频文件到浏览器 Cache API
 * - 支持智能重试机制，网络不稳定时自动重试
 * - 预取的文件会被缓存，下次播放时秒开（0 网络请求）
 * - 防止重复预取：同一文件只会发起一个网络请求
 *
 * 核心概念 - 为什么需要预取？
 * =======================
 * 
 * 问题：单靠 HTTP Range 流式播放有缺陷
 * - 拖动进度条时，需要从新位置重新下载
 * - 网络突然中断，播放中断
 * - 用户切换网络（WiFi → 4G），可能重新下载
 * 
 * 解决方案：预取完整文件到本地缓存
 * - 下载一次，本地保存，永久可用
 * - 拖动进度条，直接跳转（离线可用）
 * - 用户切换网络，继续用缓存（零影响）
 * 
 * 流程概览：
 * -------
 * 1. 检查 Cache API：如果文件已缓存，返回缓存 URL
 * 2. 检查进行中：如果正在预取，等待现有请求完成（不重复下载）
 * 3. 网络下载：发起 HTTP 请求，下载完整文件
 * 4. 保存缓存：将 Blob 保存到 Cache API
 * 5. 生成 URL：创建 blob: URL 供播放器使用
 * 6. 重试机制：下载失败时自动重试（指数退避）
 * 
 * 重试策略详解：
 * --------
 * 高优先级（用户主动播放）：
 *   - 最多重试 2 次（共 3 次尝试）
 *   - 延迟：1s, 2s, 4s（指数增长）
 *   - 超时：30 秒
 *   - 目标：快速完成，不让用户等太久
 * 
 * 低优先级（后台继续预取）：
 *   - 不重试（只尝试 1 次）
 *   - 超时：60 秒
 *   - 目标：静默下载，不消耗优先级
 * 
 * 防止重复请求的关键机制：
 * --------
 * 
 * 考虑用户操作：点击 A → 点击 B（3 秒前） → 点击 C
 * 
 * 没有防重的情况（坏）：
 *   const blobUrl1 = prefetchFullAudio('A', url)  // 创建请求 1
 *   const blobUrl2 = prefetchFullAudio('A', url)  // 创建请求 2（重复！）
 *   // 同一时间发起 2 个请求下载同一个文件，浪费带宽
 * 
 * 有防重的情况（好）：
 *   const blobUrl1 = prefetchFullAudio('A', url)  // 创建请求 1，存入 Map
 *   const blobUrl2 = prefetchFullAudio('A', url)  // 检查 Map，返回请求 1
 *   // Promise.all([blobUrl1, blobUrl2]) 两个都完成，只用 1 个请求
 * 
 * 代码：
 *   const existing = prefetchCacheRef.current.get(key)
 *   if (existing) return existing  // 直接返回进行中的 Promise
 * 
 * 这样 prefetchCacheRef 充当了一个"去重表"：
 * - 键：文件 key
 * - 值：正在进行的 Promise
 * - 作用：确保同一文件最多 1 个并发请求
 * 
 * 缓存 vs Blob URL：
 * --------
 * 
 * Cache API（浏览器缓存）：
 *   - 持久化存储：刷新页面后仍存在
 *   - 容量：通常 50MB-100MB（可配置）
 *   - 访问：await cache.match(key)
 *   - 好处：离线可用，减少网络
 * 
 * Blob URL（内存引用）：
 *   - 内存存储：仅在当前标签页有效
 *   - 容量：受浏览器可用内存限制
 *   - 访问：直接 URL.createObjectURL(blob)
 *   - 好处：创建速度快，不占用磁盘
 * 
 * 使用流程：
 *   1. 从 Cache API 读取 Blob: const cached = await cache.match(key)
 *   2. 创建 Blob URL: const url = URL.createObjectURL(cached)
 *   3. 播放器播放: <audio src={url} />
 *   4. 完成后释放: URL.revokeObjectURL(url)
 * 
 * 超时控制的细节：
 * --------
 * 
 * 为什么要设置不同的超时？
 * 
 * 高优先级（30 秒）：
 *   - 用户已经点击播放了
 *   - 不能等太久（用户会以为卡住了）
 *   - 30 秒通常足够（除非网络真的太差）
 * 
 * 低优先级（60 秒）：
 *   - 后台静默预取
 *   - 可以多等等（用户看不到）
 *   - 增加完成概率
 *   - 不重试（避免消耗太多资源）
 * 
 * 实际网络估算：
 *   - 3MB 文件 @ 1Mbps = 24 秒
 *   - 5MB 文件 @ 1Mbps = 40 秒
 *   - 高优先级 30 秒 = 足够大多数情况
 *   - 低优先级 60 秒 = 给予第二次机会
 */
export function useAudioPrefetch() {
  const prefetchCacheRef = useRef<Map<string, Promise<string | null>>>(new Map())
  const { getCachedAudio, setCachedAudio } = useAudioCache()

  /**
   * 预取整个音频文件
   *
   * @param key - 文件 key（唯一标识）
   * @param audioUrl - 完整的音频 URL（/api/audio?key=xxx）
   * @param priority - 优先级：'high' 用户点击时，'low' 后台继续
   * @returns Promise<string | null> - 成功返回 blob URL，失败返回 null
   *
   * 实现细节：
   * --------
   * 
   * 1. 去重检查（防止重复请求）
   *    if (existing) return existing
   *    - 如果这个文件正在预取，直接返回现有 Promise
   *    - 这样 3 个并发调用只会发起 1 个网络请求
   * 
   * 2. 缓存检查（减少网络请求）
   *    const cachedUrl = await getCachedAudio(key)
   *    if (cachedUrl) return cachedUrl
   *    - 检查 Cache API 中是否已有此文件
   *    - 有的话直接返回，零网络请求
   * 
   * 3. 网络下载（核心步骤）
   *    const response = await fetch(audioUrl)
   *    const blob = await response.blob()
   *    - 发起 HTTP 请求（不带 Range 头，下载完整文件）
   *    - 将响应转为 Blob 对象
   * 
   * 4. 缓存保存（持久化）
   *    await setCachedAudio(key, blob)
   *    - 将 Blob 保存到 Cache API
   *    - 即使浏览器关闭也不会丢失
   * 
   * 5. Blob URL 生成（播放准备）
   *    return URL.createObjectURL(blob)
   *    - 创建 blob: 开头的 URL
   *    - 直接供 <audio> 元素播放
   * 
   * 6. 重试逻辑（容错机制）
   *    for (let attempt = 0; attempt <= maxRetries; attempt++)
   *    - 下载失败自动重试
   *    - 重试延迟：1s, 2s, 4s（指数增长）
   *    - 指数增长好处：
   *      * 第 1 次失败：等 1 秒，可能是网络抖动，能恢复
   *      * 第 2 次失败：等 2 秒，可能是服务器忙，给他们时间
   *      * 第 3 次失败：放弃，用户已等很久，改用流式播放
   * 
   * 优先级影响：
   * 
   * 高优先级（'high'）：
   *   priority: 'high'
   *   maxRetries: 2  （共 3 次尝试）
   *   timeout: 30s
   *   - 用于用户主动播放的歌曲
   *   - 重试尽力争取完成
   *   - 30 秒是合理的用户忍耐度
   *   - 如果 30 秒还没完成，说明网络真的太差
   * 
   * 低优先级（'low'）：
   *   priority: 'low'
   *   maxRetries: 0  （只尝试 1 次）
   *   timeout: 60s
   *   - 用于后台继续下载
   *   - 不重试（避免反复请求）
   *   - 60 秒足够大多数场景
   *   - 静默完成，用户无感知
   * 
   * 错误处理：
   * 
   * 可能的失败情况：
   * 1. 网络错误（ERR_NETWORK）
   *    - 用户断网或信号丢失
   *    - 会自动重试
   * 
   * 2. 文件不存在（404 Not Found）
   *    - R2 中没有这个文件
   *    - 重试也没用，直接失败
   *    - 用户会收到"文件未找到"提示
   * 
   * 3. 权限问题（403 Forbidden）
   *    - R2 Binding 配置错误
   *    - 或者文件访问权限不足
   *    - 需要检查 wrangler.toml 配置
   * 
   * 4. 超时（AbortSignal timeout）
   *    - 网络太慢，超过设定时间
   *    - 高优先级会重试，低优先级放弃
   */
  const prefetchFullAudio = useCallback(
    async (key: string, audioUrl: string, priority: 'high' | 'low' = 'high'): Promise<string | null> => {
      // 如果已在预取中，直接返回 Promise
      const existing = prefetchCacheRef.current.get(key)
      if (existing) {
        console.log(`[Prefetch] Already fetching: ${key}`)
        return existing
      }

      // 创建新的预取 Promise
      const promise = (async () => {
        // 第一步：检查缓存是否已有
        const cachedUrl = await getCachedAudio(key)
        if (cachedUrl) {
          console.log(`[Prefetch] Cache hit: ${key}`)
          return cachedUrl
        }

        // 第二步：网络预取（带重试）
        const maxRetries = priority === 'high' ? 2 : 0 // 高优先级重试 2 次，低优先级不重试
        const baseDelay = 1000 // 初始延迟 1000ms
        const timeout = priority === 'high' ? 30000 : 60000 // 高优先级 30s，低优先级 60s

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[Prefetch] Fetching ${key} (priority: ${priority}, attempt ${attempt + 1}/${maxRetries + 1})`)

            const response = await fetch(audioUrl, {
              cache: 'no-store',
              signal: AbortSignal.timeout(timeout),
            })

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }

            const blob = await response.blob()
            console.log(`[Prefetch] Success: ${key}`)

            // 保存到缓存
            await setCachedAudio(key, blob)

            // 生成 blob URL 供播放使用
            return URL.createObjectURL(blob)
          } catch (err) {
            const isLastAttempt = attempt === maxRetries

            if (isLastAttempt) {
              console.warn(`[Prefetch] Failed after ${maxRetries + 1} attempts: ${key}`, err)
              return null
            }

            // 计算延迟时间：1s, 2s, 4s
            const delay = baseDelay * Math.pow(2, attempt)
            console.log(`[Prefetch] Retry in ${delay}ms: ${key}`)

            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }

        return null
      })()

      // 缓存 Promise，避免重复预取
      prefetchCacheRef.current.set(key, promise)
      return promise
    },
    [getCachedAudio, setCachedAudio]
  )

  /**
   * 清除预取缓存
   */
  const clearPrefetchCache = useCallback(() => {
    prefetchCacheRef.current.clear()
    console.log('[Prefetch] Cache cleared')
  }, [])

  return {
    prefetchFullAudio,
    clearPrefetchCache,
  }
}
