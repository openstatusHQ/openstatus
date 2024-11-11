import starlightPlugin from "@astrojs/starlight-tailwind";
import colors from "tailwindcss/colors";
import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        cal: ["CalSanS"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
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
  },

  plugins: [starlightPlugin()],
};
