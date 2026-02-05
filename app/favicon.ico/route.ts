// 简单处理 /favicon.ico 请求，避免开发环境 404 噪音。
// 如果需要真正的站点图标，请在 public/ 下放置 favicon.ico 即可。
import { NextResponse } from 'next/server'

export async function GET() {
  // 返回空内容但 204 状态，浏览器不会再报错。
  return new NextResponse(null, { status: 204 })
}