import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 优化配置
  reactStrictMode: true,
  poweredByHeader: false,
  
  // 图片优化
  images: {
    unoptimized: true,
  },

  // Cloudflare Pages 兼容性配置
  // 保持 SSR 模式以支持动态 API routes
  // output: 'export' 会禁用 API routes，所以不使用静态导出
  
  // 如果使用 Cloudflare Pages，确保 API routes 正确处理
  // API routes 将通过 Cloudflare Functions 提供服务
}

export default nextConfig
