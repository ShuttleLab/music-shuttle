'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

const footerLinks = [
  { href: '/', key: 'nav.home' },
  { href: '/about', key: 'nav.about' },
] as const

export default function Footer() {
  const { t } = useI18n()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-base font-medium text-muted-foreground">
            © {currentYear} {t('common.appName')}. {t('footer.rights')}
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-4 sm:gap-6"
            aria-label={t('footer.navAria')}
          >
            {footerLinks.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
