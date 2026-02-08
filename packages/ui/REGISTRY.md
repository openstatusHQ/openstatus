# OpenStatus UI Registry

This package provides a shadcn/ui registry that can be used to install OpenStatus UI components.

## Building the Registry

The registry is automatically built when building the web app. To manually build:

```bash
pnpm registry:build
```

This will:
1. Transform all `@openstatus/ui/*` imports to `@/*`
2. Build the shadcn registry
3. Copy the registry files to `apps/web/public/r/`

## Using the Registry

Once deployed, the registry will be available at:

```
https://openstatus.dev/r/registry.json
```

Users can install components from this registry using:

```bash
npx shadcn@latest add https://openstatus.dev/r/example
```

Or configure it as their registry in `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "registry": "https://openstatus.dev/r"
}
```

## Adding Components to the Registry

To add a new component to the registry, update `packages/ui/registry.json`:

```json
{
  "items": [
    {
      "name": "your-component",
      "type": "registry:block",
      "title": "Your Component",
      "description": "Description of your component",
      "registryDependencies": ["button", "card"],
      "files": [
        {
          "path": "src/components/blocks/your-component.tsx",
          "type": "registry:ui",
          "target": "components/blocks/your-component.tsx"
        }
      ]
    }
  ]
}
```

Then run `pnpm registry:build` to regenerate the registry.

## Build Process

The build process is integrated with Turborepo:

- The web app build depends on `@openstatus/ui#registry:build`
- This ensures the registry is always up-to-date when deploying the web app
- Registry files are copied to `apps/web/public/r/` and served statically

## Development

The registry source files are in `packages/ui/src/`:
- `src/components/ui/*` - UI components
- `src/components/blocks/*` - Component blocks
- `src/lib/*` - Utility functions

All imports use `@openstatus/ui/*` internally, which are transformed to `@/*` during the registry build.
