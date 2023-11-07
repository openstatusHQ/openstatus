import { createI18nServer } from 'next-international/server'

export const { getCurrentLocale, getI18n, getScopedI18n, getStaticParams } = createI18nServer({
  'en': () => import('./en.json'),
  'es': () => import('./es.json'),
  'fr': () => import('./fr.json'),
  'de': () => import('./de.json')
})