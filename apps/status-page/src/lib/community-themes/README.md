# Community Themes

This directory contains community-contributed themes for openstatus status pages. These themes allow users to customize the visual appearance of their status pages with different color schemes and design styles.

## What are Community Themes?

Community themes are predefined color schemes that users can apply to their status pages. Each theme includes:
- **Light mode** colors for bright environments
- **Dark mode** colors for low-light environments  
- **Consistent design** that works across all status page components
- **Accessibility** considerations for better readability

## Themes Examples

- **Default** - The standard openstatus theme
- **GitHub (High Contrast)** - High contrast theme inspired by GitHub's design
- **Supabase** - Theme matching Supabase's brand colors

## Creating a New Theme

Want to contribute a theme? Follow these steps:

### 1. Fork the Repository
Start by forking the openstatus repository to your GitHub account.

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

## Questions?

Need help creating a theme? Open an issue or reach out to the openstatus community!