'use client'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@openstatus/ui'
import { useChangeLocale, useCurrentLocale } from '@/yuzu/client'
import yuzuConfig from '@/../yuzu.config'
const locales = yuzuConfig.locales

export function Switcher() {
  const changeLocale = useChangeLocale()
  const locale = useCurrentLocale()

  function onSwitch(value: typeof locales[number]['code']) {
    changeLocale(value)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Select onValueChange={onSwitch} defaultValue={locale}>
        <SelectTrigger className="bg-background shadow-xl gap-2">
          <svg className="w-4 h-4 flex-none" xmlns="http://www.w3.org/2000/svg"
               width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" x2="22" y1="12" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4
                     10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <SelectValue placeholder="Select a language" />
        </SelectTrigger>
        <SelectContent>
          {locales.map((locale) => (
            <SelectItem key={locale.code} value={locale.code}>{locale.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
