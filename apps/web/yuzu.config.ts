export default {
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
    'src/**/*.{tsx,ts,jsx,js}'
  ],
  transformers: ['t', 'scopedT'],
  framework: 'nextjs',
  tsx: true,
} as const