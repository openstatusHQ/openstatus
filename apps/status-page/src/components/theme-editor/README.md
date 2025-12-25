# Theme Editor

This is the complete tweakcn theme editor integrated into OpenStatus as a standalone feature.

## Usage

Navigate to `/theme-editor` to access the full visual theme editor.

## What's Included

- Complete tweakcn editor with all features
- Visual color customization
- Typography controls
- Shadow and spacing controls
- AI-powered theme generation (if configured)
- Theme presets
- Import/Export functionality
- Live preview with multiple component showcases
- Theme inspector
- Undo/Redo functionality

## Technical Details

- **Source**: Copied from [tweakcn](https://github.com/jnsahaj/tweakcn)
- **Location**: `/app/theme-editor` route
- **Components**: Completely standalone in `/components/theme-editor`
- **No modifications** to existing OpenStatus code

## Dependencies Added

- `zustand@5.0.9` - State management
- `culori@4.0.2` - Color manipulation
- `react-resizable-panels@4.0.15` - Resizable layout panels

## Development

All editor code is self-contained in the `theme-editor` directory. The editor uses its own:
- State management (`store/editor-store.ts`)
- Utilities (`utils/`)
- Hooks (`hooks/`)
- Types (`types/`)
- Configuration (`config/`)

This ensures zero conflicts with existing OpenStatus code.


