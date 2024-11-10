import starlightPlugin from '@astrojs/starlight-tailwind';
import colors from 'tailwindcss/colors';
import { fontFamily } from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-sans)", ...fontFamily.sans],
                cal: ["CalSanS"],
            },
            // colors: {
            //     // Your preferred accent color. Indigo is closest to Starlight’s defaults.
            //     accent: colors.stone,
            //     // // Your preferred gray scale. Zinc is closest to Starlight’s defaults.
            //     gray: colors.zinc,
            // },
            // fontFamily: {
            //     // Your preferred text font. Starlight uses a system font stack by default.
            //     sans: ['"Atkinson Hyperlegible"'],
            //     // Your preferred code font. Starlight uses system monospace fonts by default.
            //     mono: ['"IBM Plex Mono"'],
            // },
        },
    },
    plugins: [starlightPlugin()],
};