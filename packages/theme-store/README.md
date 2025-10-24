# Community Themes

This directory contains community-contributed themes for openstatus status pages. These themes allow users to customize the visual appearance of their status pages with different color schemes and design styles.

## What are Community Themes?

Community themes are predefined color schemes that users can apply to their status pages. Each theme includes:
- **Light mode** colors for bright environments
- **Dark mode** colors for low-light environments  
- **Consistent design** that works across all status page components
- **Accessibility** considerations for better readability

## Themes Examples

- **Openstatus** - The standard openstatus theme
- **Openstatus** - The rounded openstatus theme (similar to the legacy page)
- **Supabase** - Theme matching Supabase's brand colors
- **GitHub (High Contrast)** - High contrast theme inspired by GitHub's design

## Creating a New Theme

> **Help us ship an epic palette picker!**
> We are looking for contributions to build an epic [palette picker](https://github.com/openstatusHQ/openstatus/blob/main/apps/status-page/src/components/themes/theme-palette-picker.tsx) to help others generate and export their own themes.

Want to contribute a theme? Follow these steps:

### 1. Run the project
Start by forking the openstatus repository to your GitHub account and run the command `dev:status-page` locally following [Getting Started](https://github.com/openstatusHQ/openstatus?tab=readme-ov-file#getting-started-) steps.

### 2. Create Your Theme File
Create a new TypeScript file in this directory (e.g., `my-theme.ts`). You can copy an existing theme file as a starting template.

### 3. Define Your Theme
Your theme file should export a constant that matches the `Theme` interface:

```typescript
import type { Theme } from "./types";

export const MY_THEME = {
  id: "my-theme", // Unique identifier (kebab-case)
  name: "My Awesome Theme", // Display name
  author: { 
    name: "@yourusername", 
    url: "https://github.com/yourusername" 
  },
  light: {
    // CSS custom properties for light mode
    "--background": "oklch(100% 0 0)",
    "--foreground": "oklch(20% 0 0)",
    // ... more variables
  },
  dark: {
    // CSS custom properties for dark mode
    "--background": "oklch(10% 0 0)",
    "--foreground": "oklch(90% 0 0)",
    // ... more variables
  },
} as const satisfies Theme;
```

You don't need to add every single css var from the `THEME_VAR_NAMES` list.

### 4. Add to Theme Registry
Update `index.ts` to include your theme in the `THEMES_LIST` array.

### 5. Submit a Pull Request
Create a pull request with your theme for review.

## Design Guidelines

### Color System
- Use **OKLCH color space** for better perceptual uniformity
- Ensure sufficient contrast ratios for accessibility
- Test both light and dark modes thoroughly

### Theme Requirements
- ✅ **Consistent design** - All components should feel cohesive
- ✅ **Both modes** - Must support light and dark variants
- ✅ **Accessibility** - Meet WCAG contrast guidelines
- ✅ **Unique ID** - Use descriptive, kebab-case identifiers
- ❌ **No "Christmas tree"** - Avoid overly colorful or distracting designs

### Available CSS Variables
Themes can customize these CSS custom properties:
- `--background`, `--foreground` - Base colors
- `--primary`, `--secondary`, `--accent` - Brand colors  
- `--success`, `--warning`, `--destructive` - Status colors
- `--border`, `--input`, `--ring` - Interactive elements
- `--muted`, `--muted-foreground` - Subtle text and backgrounds
- And many more... (see `types.ts` for the complete list)

## Testing Your Theme

Before submitting:
1. Test your theme on a status page
2. Verify both light and dark modes work correctly
3. Check accessibility with browser dev tools
4. Ensure all status indicators (operational, degraded, etc.) are clearly distinguishable

To test a theme, you can use the `sessionStorage.setItem("community-theme", "true");` on your stpg.dev or vercel preview link. It will open a floating button on the right left corner where you can choose between the themes and dark/light mode.

## Questions?

Need help creating a theme? Open an issue or reach out to the openstatus community!