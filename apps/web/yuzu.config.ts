export default {
  defaultLocale: 'en',
  locales: [{
    code: 'en',
    name: 'English',
  }, {
    code: 'es',
    name: 'Español',
  }, {
    code: 'fr',
    name: 'Français',
  }, {
    code: 'de',
    name: 'Deutsch',
  }],
  resources: 'src/yuzu',
  content: [
    'src/app/**/*.{tsx,ts,jsx,js}',
    'src/components/**/*.{tsx,ts,jsx,js}',
  ],
  transformers: ['t', 'scopedT', 'yuzu', 'yz', 'i18n', '<Trans>'],
  framework: 'nextjs',
  tsx: true,
} as const