'use client'

import { createI18nClient } from 'next-international/client'

export const { useCurrentLocale, useChangeLocale, useI18n, useScopedI18n, I18nProviderClient } = createI18nClient({
  'en': () => import('./en.json'),
  'es': () => import('./es.json'),
  'fr': () => import('./fr.json'),
  'de': () => import('./de.json')
})