'use client'

import { useI18n } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border-2 border-border bg-muted/50 p-0.5"
      role="group"
      aria-label={t('lang.switcherAria')}
    >
      {(['zh', 'en'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLocale(lang as Locale)}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
            locale === lang
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-pressed={locale === lang}
          aria-label={t(`lang.${lang}`)}
        >
          {t(`lang.${lang}`)}
        </button>
      ))}
    </div>
  )
}
