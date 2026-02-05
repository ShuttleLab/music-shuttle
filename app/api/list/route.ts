import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'

// Cloudflare next-on-pages 要求所有动态 API 路由必须声明运行时环境。
export const runtime = 'edge'

// 定义 R2 Bucket 类型
interface R2Bucket {
  list(options?: { prefix?: string; limit?: number }): Promise<{
    objects: Array<{
      key: string
      size: number
      uploaded: Date
    }>
  }>
}

interface CloudflareEnv {
  R2_BUCKET: R2Bucket
}

/**
 * 获取音乐列表
 *
 * 功能说明：
 * - 从 Cloudflare R2 存储桶列出所有音频文件
 * - 使用 R2 Bindings（更安全，无需密钥）
 * - 支持前缀搜索（folder/）
 * - 只返回支持的音频格式文件（mp3, m4a, wav, ogg, flac, mp4）
 *
 * 查询参数：
 * - prefix: 文件夹前缀（可选）
 * - limit: 限制返回数量，默认 1000
 * - debug: 启用调试模式（有错时返回详细错误信息）
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const prefix = url.searchParams.get('prefix') || undefined
  const limit = Number(url.searchParams.get('limit') || '1000')
  const debug = url.searchParams.has('debug')

  try {
    // 获取 Cloudflare 环境（包含 R2 Bindings）
    let bucket: R2Bucket | undefined
    
    try {
      const { env } = getRequestContext()
      bucket = (env as CloudflareEnv).R2_BUCKET
    } catch (e) {
      // 本地开发环境，getRequestContext 不可用
      console.log('[api/list] Running in local development mode, returning demo data')
      return NextResponse.json({
        message: '本地开发模式：R2 Bindings 仅在 Cloudflare Pages 环境可用',
        hint: '要测试完整功能，请部署到 Cloudflare Pages',
        tracks: [
          { key: 'demo/song1.mp3', size: 3500000, lastModified: new Date().toISOString() },
          { key: 'demo/song2.mp3', size: 4200000, lastModified: new Date().toISOString() },
          { key: 'demo/song3.mp3', size: 5100000, lastModified: new Date().toISOString() }
        ]
      })
    }

    if (!bucket) {
      throw new Error('R2_BUCKET binding not found. Make sure it is configured in wrangler.toml and Cloudflare Pages settings.')
    }

    console.log('[api/list] listing objects with prefix:', prefix || '(none)')

    // 使用 R2 原生 API 列出对象
    const listed = await bucket.list({
      prefix,
      limit,
    })

    console.log('[api/list] found objects:', listed.objects.length)

    // 过滤音频文件
    const audioFormats = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.mp4']
    const audioFiles = listed.objects.filter((obj) =>
      audioFormats.some(fmt => obj.key.toLowerCase().endsWith(fmt))
    ).map(obj => ({
      key: obj.key,
      size: obj.size,
      lastModified: obj.uploaded,
    }))

    return NextResponse.json({
      objects: audioFiles,
      total: audioFiles.length,
    })
  } catch (error: any) {
    console.error('[api/list] Error:', error)

    return NextResponse.json({
      error: error?.message || 'Internal server error',
      stack: debug ? String(error?.stack || '') : undefined,
    }, { status: 500 })
  }
}
