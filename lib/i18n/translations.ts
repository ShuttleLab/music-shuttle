/**
 * Music Shuttle i18n messages (zh / en)
 */

export const messages = {
  zh: {
    nav: {
      home: '音乐穿梭机',
      about: '关于',
      mainAria: '主导航',
      githubAria: '在 GitHub 上查看 Music Shuttle',
    },
    player: {
      title: '音乐穿梭机',
      loadedCount: '已加载 {count} 首',
      searchPlaceholder: '搜索音乐名…',
      loading: '加载中…',
      noTracks: '未找到音乐，请检查 R2 配置',
      noSearchResults: '没有找到音乐',
      notSelected: '未选择',
      shuffle: '随机播放',
      shuffleOn: '随机中',
      playAria: '播放',
      pauseAria: '暂停',
    },
    about: {
      title: '关于音乐穿梭机',
      intro: {
        title: '服务介绍',
        body: 'Music Shuttle 是一款基于 Next.js 与 Cloudflare R2 的无服务器音乐播放器。音频存储在云端，支持流式播放与智能缓存，兼顾速度与隐私。',
      },
      security: {
        title: '安全与隐私',
        local: {
          title: '流式播放',
          desc: '支持 Range 请求，边下边播，无需等待完整下载。',
        },
        noUpload: {
          title: '云端存储',
          desc: '音乐文件存放在 Cloudflare R2，通过 CDN 加速，无出站费用。',
        },
        openSource: {
          title: '开源透明',
          desc: '代码可审计，可自托管部署。',
        },
        privacy: {
          title: '本地缓存',
          desc: '智能缓存与预取在浏览器本地完成，不收集个人数据。',
        },
      },
      useCases: {
        title: '使用场景',
        items: '个人音乐库、播客、有声书、演示与分享。',
      },
      support: {
        title: '支持我们',
        supportDesc: 'Music Shuttle 免费使用。若对您有帮助，欢迎 Star 或分享。',
        supportBtn: '支持项目',
        shareBtn: '分享给朋友',
        copiedHint: '已复制链接',
        paymentModalTitle: '请支持我',
        paymentModalClose: '关闭',
        alipay: '支付宝',
        paypal: 'PayPal',
        wechat: '微信',
      },
      contact: {
        title: '联系方式',
        email: '邮箱：',
        emailValue: 'support@shuttlelab.org',
      },
    },
    footer: {
      rights: '保留所有权利。',
      navAria: '页脚导航',
    },
    common: {
      appName: 'ShuttleLab',
    },
    lang: {
      zh: '中文',
      en: 'EN',
      switcherAria: '切换语言',
    },
  },
  en: {
    nav: {
      home: 'Music Shuttle',
      about: 'About',
      mainAria: 'Main navigation',
      githubAria: 'View Music Shuttle on GitHub',
    },
    player: {
      title: 'Music Shuttle',
      loadedCount: '{count} tracks loaded',
      searchPlaceholder: 'Search music…',
      loading: 'Loading…',
      noTracks: 'No tracks found. Check R2 configuration.',
      noSearchResults: 'No matching tracks',
      notSelected: 'Not selected',
      shuffle: 'Shuffle',
      shuffleOn: 'Shuffle on',
      playAria: 'Play',
      pauseAria: 'Pause',
    },
    about: {
      title: 'About Music Shuttle',
      intro: {
        title: 'About',
        body: 'Music Shuttle is a serverless music player built with Next.js and Cloudflare R2. Tracks are stored in the cloud with streaming and smart caching for a fast, private experience.',
      },
      security: {
        title: 'Security & Privacy',
        local: {
          title: 'Streaming',
          desc: 'Range requests enable play-before-download; no need to wait for full files.',
        },
        noUpload: {
          title: 'Cloud Storage',
          desc: 'Files are stored on Cloudflare R2 with CDN and zero egress fees.',
        },
        openSource: {
          title: 'Open Source',
          desc: 'Code is auditable and self-hostable.',
        },
        privacy: {
          title: 'Local Cache',
          desc: 'Caching and prefetch run in your browser; no personal data is collected.',
        },
      },
      useCases: {
        title: 'Use Cases',
        items: 'Personal music library, podcasts, audiobooks, demos and sharing.',
      },
      support: {
        title: 'Support Us',
        supportDesc: 'Music Shuttle is free. If it helps you, consider starring or sharing.',
        supportBtn: 'Support Project',
        shareBtn: 'Share',
        copiedHint: 'Link copied',
        paymentModalTitle: 'Support',
        paymentModalClose: 'Close',
        alipay: 'Alipay',
        paypal: 'PayPal',
        wechat: 'WeChat',
      },
      contact: {
        title: 'Contact',
        email: 'Email: ',
        emailValue: 'support@shuttlelab.org',
      },
    },
    footer: {
      rights: 'All rights reserved.',
      navAria: 'Footer navigation',
    },
    common: {
      appName: 'ShuttleLab',
    },
    lang: {
      zh: '中文',
      en: 'EN',
      switcherAria: 'Switch language',
    },
  },
} as const

export type Locale = keyof typeof messages
export type MessageKey = keyof (typeof messages)['zh']
