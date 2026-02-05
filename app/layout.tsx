import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '音乐穿梭机 | Music Shuttle',
  description: '一个基于 Next.js 和 Cloudflare R2 的无服务器音乐播放器应用',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
