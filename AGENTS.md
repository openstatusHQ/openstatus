# AGENTS.md

This document provides guidance for AI coding agents (GitHub Copilot, Cursor, ChatGPT, etc.) working on the OpenStatus codebase.

## Project Overview

OpenStatus is an open-source synthetic monitoring platform built as a monorepo. It monitors websites and APIs globally, providing status pages and alerting capabilities.

**Repository Structure:** pnpm workspace monorepo with Turborepo for build orchestration.

## Tech Stack

### Core Technologies

- **Package Manager:** pnpm 10.26.0 (specified in `packageManager` field)
- **Monorepo Tool:** Turborepo 2.6.3
- **Runtime Requirements:**
  - Node.js >= 20.0.0
  - Bun (for specific scripts)
  - Go 1.x (for checker, private-location, ssh-server, railway-proxy services)

### Frontend Applications

All Next.js applications use:
- **Framework:** Next.js 16.0.10
- **React:** 19.2.2
- **TypeScript:** 5.9.3
- **Styling:** Tailwind CSS 4.1.11
- **UI Components:** Radix UI primitives, shadcn/ui patterns
- **State Management:** TanStack Query (React Query) 5.81.5
- **Form Handling:** React Hook Form 7.68.0 with Zod validation
- **Authentication:** NextAuth.js 5.0.0-beta.29

#### Applications

1. **apps/web** - Marketing website
2. **apps/dashboard** - Main dashboard application
3. **apps/status-page** - Status page viewer
4. **apps/docs** - Documentation site (Astro framework)

### Backend Services

#### Node.js/TypeScript Services

- **apps/server** - Hono API server (Bun runtime)
  - Framework: Hono 4.5.3
  - OpenAPI: @hono/zod-openapi
  - Validation: Zod

- **apps/workflows** - Workflow engine (Node.js/TypeScript)
- **apps/screenshot-service** - Screenshot generation service (Node.js/TypeScript)

#### Go Services

- **apps/checker** - HTTP checking service
- **apps/private-location** - Private location agent
- **apps/ssh-server** - SSH server for remote access
- **apps/railway-proxy** - Railway proxy service

### Database & Data

- **Database:** Turso (libSQL)
- **ORM:** Drizzle 0.44.4
- **Client:** @libsql/client 0.15.15
- **Migrations:** Drizzle Kit 0.31.4
- **Analytics:** Tinybird (time-series data)
- **Cache/Queue:** Upstash Redis

### Infrastructure

- **Containerization:** Docker (Dockerfiles present in multiple apps)
- **Observability:** Sentry 10.31.0 (Next.js apps)
- **Email:** Resend (via @openstatus/emails package)
- **Payments:** Stripe 13.8.0
- **Auth Provider:** Unkey (@unkey/api)
- **Analytics:** OpenPanel (@openpanel/nextjs)

## Monorepo Structure

### Workspace Organization

```
apps/
├── checker/           # Go - HTTP monitoring service
├── dashboard/         # Next.js - Main admin dashboard
├── docs/             # Astro - Documentation site
├── private-location/ # Go - Private monitoring agent
├── railway-proxy/    # Go - Proxy service
├── screenshot-service/ # Node.js - Screenshot generation
├── server/           # Bun/Hono - API server
├── ssh-server/       # Go - SSH access server
├── status-page/      # Next.js - Public status pages
├── web/              # Next.js - Marketing site
└── workflows/        # Node.js - Workflow orchestration

packages/
├── analytics/        # Analytics utilities
├── api/             # tRPC API definitions
├── assertions/      # Monitoring assertions
├── db/              # Drizzle schema and database client
├── emails/          # Email templates (React Email)
├── error/           # Error handling utilities
├── header-analysis/ # HTTP header analysis
├── icons/           # Shared icon components
├── notifications/   # Notification integrations (Discord, Slack, PagerDuty, etc.)
├── proto/           # Protocol buffer definitions
├── react/           # Shared React components
├── regions/         # Geographic region definitions
├── theme-store/     # Theme state management
├── tinybird/        # Tinybird integration and pipes
├── tracker/         # Event tracking
├── tsconfig/        # Shared TypeScript configurations
├── ui/              # Shared UI component library
├── upstash/         # Upstash Redis client
└── utils/           # Utility functions
```

### Package Dependencies

All workspace packages are referenced with `workspace:*` protocol in package.json.

## Code Quality & Standards

### Linting and Formatting

- **Primary Linter:** Biome 1.8.3
- **Supplementary:** oxlint 1.30.0 (optional)
- **Configuration:** `biome.jsonc`

#### Biome Configuration

- **Indent:** 2 spaces
- **Line Width:** 80 characters
- **Import Organization:** Enabled (automatic)
- **Unused Variables:** Warning
- **Unused Imports:** Error
- **Sorted Classes:** Warning (nursery rule)

#### Ignored Paths

- `node_modules/`
- `.next/`
- `dist/`
- `.wrangler/`
- `.react-email/`
- `.content-collections/`
- `packages/ui/src/components/*.tsx` (UI components from shadcn)
- `apps/dashboard/src/scripts/*.ts`
- `.devbox/`
- `*.astro` files (Astro handles its own formatting)

### TypeScript Configuration

- **Version:** 5.9.3
- **Shared Configs:** Located in `packages/tsconfig/`
- Each app/package extends shared tsconfig

## Development Workflow

### Setup Commands

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm dx

# Development (choose one)
pnpm dev:web          # Marketing site
pnpm dev:dashboard    # Dashboard app
pnpm dev:status-page  # Status page app
```

### Common Commands

```bash
# Formatting
pnpm format           # Format and auto-fix with Biome
pnpm format:fix       # Format with unsafe fixes

# Linting
pnpm lint             # Lint all files
pnpm lint:fix         # Lint with unsafe auto-fixes
pnpm lint:turbo       # Run lint via Turborepo (all packages)

# Type Checking
pnpm tsc              # Run TypeScript compiler

# Building
pnpm build            # Build all apps/packages via Turborepo

# Testing
pnpm test             # Run tests via Turborepo
```

### Database Workflow

Database is managed through `packages/db/`:

```bash
# Generate migrations
cd packages/db && pnpm generate

# Run migrations
pnpm migrate

# Seed database
pnpm seed

# Open Drizzle Studio
pnpm studio

# Local development database
turso dev --db-file openstatus-dev.db
```

## Coding Conventions

### File Naming

- **React Components:** PascalCase (e.g., `StatusPage.tsx`)
- **Utilities:** camelCase (e.g., `formatDate.ts`)
- **Configuration:** kebab-case (e.g., `next.config.ts`)

### Import Organization

Biome automatically organizes imports. Follow this order:
1. External dependencies
2. Workspace packages (`@openstatus/*`)
3. Relative imports (`./ or ../`)

### React/Next.js Patterns

- **Use TypeScript** for all new files
- **Server Components by default** (Next.js 13+ App Router)
- **"use client" directive** only when necessary (interactivity, hooks, browser APIs)
- **Zod schemas** for all form validation and API contracts
- **React Hook Form** for form state management
- **TanStack Query** for server state (client components)
- **tRPC** for type-safe API calls (dashboard app)

### Component Structure

```typescript
// Example component structure
import { type ComponentProps } from "react";
import { cn } from "@/lib/utils"; // Tailwind merge utility

interface MyComponentProps {
  title: string;
  description?: string;
  className?: string;
}

export function MyComponent({ 
  title, 
  description, 
  className 
}: MyComponentProps) {
  return (
    <div className={cn("base-classes", className)}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
```

### Database Schema

- **Location:** `packages/db/src/schema/`
- **Pattern:** Drizzle ORM table definitions
- Always create migrations after schema changes: `pnpm generate`

### API Development

#### tRPC (Dashboard)

- **Location:** `packages/api/src/`
- **Pattern:** Procedure-based API routes
- Use Zod for input/output validation

#### Hono (Server)

- **Location:** `apps/server/src/`
- **Pattern:** OpenAPI-documented REST endpoints
- Use Zod with @hono/zod-openapi

### Environment Variables

- **Type Safety:** All apps use env.ts with `@t3-oss/env-core`
- **Validation:** Zod schemas for environment variables
- **Docker:** Use `.env.docker.example` for Docker setup
- **Never commit** `.env` files

## AI Agent Guidelines

### ALLOWED Actions

✅ **Code Modifications:**
- Fix bugs in existing code
- Implement new features in existing apps/packages
- Refactor code while maintaining functionality
- Add TypeScript types and improve type safety
- Update dependencies (with justification)
- Write tests for new or existing functionality
- Improve error handling and logging
- Add JSDoc comments for complex functions

✅ **File Operations:**
- Create new components, utilities, or hooks
- Create new API routes (tRPC procedures or Hono endpoints)
- Create new database migrations via Drizzle
- Add new packages to the monorepo (if justified)
- Create test files

✅ **Configuration:**
- Update Biome rules (with justification)
- Modify Turborepo tasks (with justification)
- Add necessary devDependencies
- Update TypeScript configurations for compatibility

✅ **Documentation:**
- Update code comments
- Add JSDoc annotations
- Update inline documentation
- Clarify complex logic with comments

### DISALLOWED Actions

❌ **Breaking Changes:**
- Do NOT modify database schema without explicit permission
- Do NOT change public API contracts without migration strategy
- Do NOT remove existing functionality without confirmation
- Do NOT change authentication/authorization logic without review
- Do NOT modify payment/billing code without explicit approval

❌ **Infrastructure:**
- Do NOT modify Dockerfile configurations without confirmation
- Do NOT change deployment configurations (fly.toml, etc.)
- Do NOT modify docker-compose.yaml without justification
- Do NOT change CI/CD workflows (if present)

❌ **Dependencies:**
- Do NOT upgrade major versions without explicit approval
- Do NOT add dependencies without justification
- Do NOT change package manager (must use pnpm)
- Do NOT modify pnpm workspace structure without approval

❌ **Security & Secrets:**
- Do NOT commit API keys, tokens, or secrets
- Do NOT modify .gitignore to expose sensitive files
- Do NOT disable security features (CORS, CSRF, auth checks)
- Do NOT log sensitive user data

❌ **Database:**
- Do NOT write raw SQL queries (use Drizzle ORM)
- Do NOT create migrations manually (use `pnpm generate`)
- Do NOT modify existing migrations
- Do NOT seed production data

❌ **External Services:**
- Do NOT modify third-party API integrations without review
- Do NOT change notification service configurations
- Do NOT alter email templates without preview
- Do NOT modify analytics tracking without approval

### Decision-Making Guidelines

When implementing features:

1. **Check existing patterns** - Look for similar implementations in the codebase
2. **Use workspace packages** - Leverage existing `@openstatus/*` packages
3. **Follow conventions** - Match existing code style and patterns
4. **Type safety first** - Always use TypeScript, avoid `any`
5. **Validate inputs** - Use Zod schemas for all external data
6. **Handle errors** - Use the `@openstatus/error` package patterns
7. **Consider performance** - Use appropriate caching strategies
8. **Document complexity** - Add comments for non-obvious logic

### Testing Strategy

- Unit tests for utilities and pure functions
- Integration tests for API endpoints
- E2E tests for critical user flows (if framework exists)
- Always test edge cases and error conditions

### Performance Considerations

- Use React Server Components where possible (Next.js apps)
- Implement proper database indexing (via Drizzle schema)
- Use Upstash Redis for caching frequently accessed data
- Optimize bundle size (check imports, use dynamic imports)
- Use appropriate Tinybird pipes for analytics queries

## Common Patterns

### Error Handling

```typescript
import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";

// tRPC example
if (!result) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Resource not found",
  });
}

// Hono example
import { HTTPException } from "hono/http-exception";

if (!valid) {
  throw new HTTPException(400, { message: "Invalid request" });
}
```

### Database Queries

```typescript
import { db } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { eq } from "drizzle-orm";

// Always use Drizzle query builder
const result = await db
  .select()
  .from(monitor)
  .where(eq(monitor.id, monitorId))
  .get();
```

### Authentication

```typescript
// Use existing auth utilities
import { auth } from "@/lib/auth";

// Server component
const session = await auth();
if (!session) {
  redirect("/login");
}

// API route
const session = await auth();
if (!session?.user?.id) {
  throw new TRPCError({ code: "UNAUTHORIZED" });
}
```

## Troubleshooting

### Common Issues

**Build Failures:**
- Ensure all workspace dependencies are built: `pnpm build`
- Check TypeScript errors: `pnpm tsc`
- Clear `.next` cache in affected apps

**Database Issues:**
- Ensure migrations are applied: `cd packages/db && pnpm migrate`
- Check DATABASE_URL environment variable
- Verify Turso dev server is running

**Dependency Issues:**
- Delete `node_modules` and reinstall: `pnpm install`
- Check for peer dependency warnings
- Verify pnpm version matches packageManager field

**Linting Errors:**
- Run auto-fix: `pnpm format:fix && pnpm lint:fix`
- Check biome.jsonc for ignored paths
- Some generated files are intentionally ignored

## Additional Resources

- **Contributing Guide:** See `CONTRIBUTING.MD`
- **Docker Setup:** See `DOCKER.md`
- **Documentation:** https://docs.openstatus.dev (apps/docs)
- **Main Website:** https://www.openstatus.dev

## Notes for AI Agents

- **Be Conservative:** When in doubt, ask for clarification rather than making assumptions
- **Context Matters:** Check related files before making changes
- **Follow Examples:** Look for similar implementations in the codebase
- **Test Changes:** Ensure code compiles and follows conventions
- **Explain Decisions:** Comment why you made specific choices
- **Workspace Aware:** Remember this is a monorepo - changes may affect multiple packages
- **Version Consistency:** Keep dependency versions consistent across workspace packages
- **No Assumptions:** Do not assume features exist if not visible in the codebase

---

**Last Updated:** December 2025  
**Monorepo Version:** pnpm 10.26.0 + Turborepo 2.6.3  
**Primary Languages:** TypeScript 5.9.3, Go 1.x

