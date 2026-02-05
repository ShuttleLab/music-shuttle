import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'

// Cloudflare next-on-pages 要求所有动态 API 路由必须声明运行时环境。
export const runtime = 'edge'

// 定义 R2 Bucket 类型
interface R2Object {
  body: ReadableStream
  httpMetadata?: {
    contentType?: string
  }
  size: number
}

interface R2Bucket {
  get(key: string, options?: { range?: { offset?: number; length?: number } }): Promise<R2Object | null>
}

interface CloudflareEnv {
  R2_BUCKET: R2Bucket
}

/**
 * 获取音频文件
 *
 * 功能说明：
 * - 从 R2 存储桶获取音频文件
 * - 使用 R2 Bindings（更安全，无需密钥）
 * - 支持 Range 请求（206 Partial Content），实现流式播放
 * - 缓存策略：长期缓存（max-age=31536000）
 *
 * 请求参数：
 * - key: 音频文件在 R2 中的 key（必填）
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const key = url.searchParams.get('key')

  if (!key) {
    return NextResponse.json(
      { error: 'key 参数是必需的' },
      { status: 400 }
    )
  }

  try {
    // 获取 Cloudflare 环境（包含 R2 Bindings）
    let bucket: R2Bucket | undefined
    
    try {
      const { env } = getRequestContext()
      bucket = (env as CloudflareEnv).R2_BUCKET
    } catch (e) {
      // 本地开发环境，getRequestContext 不可用
      return NextResponse.json(
        {
          error: '本地开发模式：音频文件仅在 Cloudflare Pages 环境可用',
          hint: '要测试完整功能，请部署到 Cloudflare Pages',
          requestedKey: key
        },
        { status: 503 }
      )
    }

    if (!bucket) {
      throw new Error('R2_BUCKET binding not found. Make sure it is configured in wrangler.toml and Cloudflare Pages settings.')
    }

    console.log('[api/audio] fetching:', key)

    // 解析 Range 请求
    const rangeHeader = request.headers.get('range')
    let rangeOptions: { range?: { offset?: number; length?: number } } = {}

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : undefined
        rangeOptions = {
          range: {
            offset: start,
            length: end !== undefined ? end - start + 1 : undefined,
          },
        }
      }
    }

    // 从 R2 获取对象
    const object = await bucket.get(key, rangeOptions)

    if (!object) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // 构造响应头
    const contentType = object.httpMetadata?.contentType || 'audio/mpeg'
    const responseHeaders: HeadersInit = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      'CDN-Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
    }

    // 如果是 Range 请求，返回 206
    if (rangeOptions.range) {
      const start = rangeOptions.range.offset || 0
      const length = rangeOptions.range.length || object.size - start
      const end = start + length - 1
      
      responseHeaders['Content-Range'] = `bytes ${start}-${end}/${object.size}`
      responseHeaders['Content-Length'] = length.toString()

      return new NextResponse(object.body, {
        status: 206,
        headers: responseHeaders,
      })
    }

    // 完整文件响应
    responseHeaders['Content-Length'] = object.size.toString()

    return new NextResponse(object.body, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error: any) {
    console.error('[api/audio] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

