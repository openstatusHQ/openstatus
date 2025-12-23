# OpenStatus AI Assistant Instructions

This file provides guidance for AI coding assistants working on the OpenStatus codebase.

## Quick Reference

**Project:** OpenStatus - Open-source synthetic monitoring platform  
**Architecture:** pnpm workspace monorepo with Turborepo  
**Package Manager:** pnpm 10.26.0 (REQUIRED - never use npm/yarn)  
**Monorepo Tool:** Turborepo 2.6.3

## Tech Stack Summary

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend Framework | Next.js | 16.0.10 |
| React | React | 19.2.2 |
| TypeScript | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 4.1.11 |
| Database | Turso (libSQL) | - |
| ORM | Drizzle | 0.44.4 |
| API (Dashboard) | tRPC | 11.4.4 |
| API (Server) | Hono | 4.5.3 |
| Forms | React Hook Form | 7.68.0 |
| Validation | Zod | 3.25.76 |
| State | TanStack Query | 5.81.5 |
| Auth | NextAuth.js | 5.0.0-beta.29 |
| Linter | Biome | 1.8.3 |

## Essential Commands

```bash
# Development
pnpm install                    # Install dependencies
pnpm dx                        # Setup database + migrate + seed
pnpm dev:dashboard             # Start dashboard (port 3000)
pnpm dev:web                   # Start marketing site
pnpm dev:status-page           # Start status page viewer

# Code Quality
pnpm format                    # Format with Biome
pnpm lint:fix                  # Lint with Biome (auto-fix)
pnpm tsc                       # Type check

# Database
cd packages/db && pnpm generate  # Create migration
pnpm migrate                     # Apply migrations
pnpm studio                      # Drizzle Studio UI
```

## Critical Rules

### Database
- ✅ **ALWAYS** use Drizzle ORM query builder
- ❌ **NEVER** write raw SQL queries
- ❌ **NEVER** create manual migrations (use `pnpm generate`)
- ❌ **NEVER** modify existing migrations
- 📁 Schema location: `packages/db/src/schema/`

### Code Style
- **Indent:** 2 spaces
- **Line width:** 80 characters
- **Linter:** Biome 1.8.3 (NOT ESLint/Prettier)
- **Import order:** External → Workspace (`@openstatus/*`) → Relative

### React/Next.js
- Server Components by default (Next.js App Router)
- `"use client"` only for: hooks, interactivity, browser APIs
- Forms: React Hook Form + Zod validation
- Client state: TanStack Query
- Type-safe APIs: tRPC (dashboard), Hono with OpenAPI (server)

### TypeScript
- Always use TypeScript for new files
- Avoid `any` - use proper types
- Validate all external input with Zod schemas
- Component props: Define explicit interfaces

### File Naming
```
StatusPage.tsx       # React components (PascalCase)
formatDate.ts        # Utilities (camelCase)
next.config.ts       # Configuration (kebab-case)
```

## Monorepo Structure

**Apps** (`apps/`):
- `dashboard/` - Next.js admin dashboard (tRPC)
- `web/` - Next.js marketing site
- `status-page/` - Next.js public status pages
- `docs/` - Astro documentation
- `server/` - Bun/Hono API server
- `workflows/` - Node.js workflow engine
- `checker/` - Go HTTP checking service
- `private-location/` - Go private agent
- `ssh-server/` - Go SSH server
- `railway-proxy/` - Go proxy service
- `screenshot-service/` - Node.js screenshots

**Packages** (`packages/`):
- `db/` - Drizzle schema + migrations
- `api/` - tRPC procedures
- `ui/` - Shared UI components (shadcn/ui)
- `emails/` - React Email templates
- `notifications/` - Notification integrations
- Plus 15+ utility packages

## Code Examples

### Component Pattern
```typescript
import { cn } from "@/lib/utils";

interface MyComponentProps {
  title: string;
  className?: string;
}

export function MyComponent({ title, className }: MyComponentProps) {
  return <div className={cn("base-classes", className)}>{title}</div>;
}
```

### Database Query (Drizzle)
```typescript
import { db } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import { eq } from "drizzle-orm";

const result = await db
  .select()
  .from(monitor)
  .where(eq(monitor.id, monitorId))
  .get();
```

### Error Handling
```typescript
// tRPC
throw new TRPCError({ code: "NOT_FOUND", message: "Resource not found" });

// Hono
throw new HTTPException(400, { message: "Invalid request" });
```

### Authentication
```typescript
import { auth } from "@/lib/auth";

const session = await auth();
if (!session) redirect("/login");
```

## Allowed Actions ✅

- Fix bugs and implement features
- Create components, utilities, hooks, API routes
- Refactor while maintaining functionality
- Add TypeScript types and improve type safety
- Write tests and improve error handling
- Add JSDoc comments for complex functions
- Update dependencies (with justification)

## Forbidden Actions ❌

**Require Explicit Approval:**
- Database schema changes
- Authentication/authorization logic changes
- Payment/billing code modifications
- Dockerfile or docker-compose.yaml changes
- Deployment configuration (fly.toml, etc.)
- Major dependency version upgrades
- Public API contract changes

**Never Do:**
- Write raw SQL queries (use Drizzle ORM)
- Create manual migrations (use `pnpm generate`)
- Commit API keys, tokens, or secrets
- Disable security features (CORS, CSRF, auth)
- Change package manager from pnpm
- Modify existing migrations
- Log sensitive user data

## Performance Best Practices

- Use React Server Components where possible
- Cache with Upstash Redis
- Implement proper database indexes (Drizzle schema)
- Use dynamic imports for large components
- Query Tinybird for analytics data
- Optimize bundle size

## Getting Help

- **Complete Guidelines:** `AGENTS.md` (root directory)
- **Contributing:** `CONTRIBUTING.MD`
- **Docker Setup:** `DOCKER.md`
- **Documentation:** https://docs.openstatus.dev
- **Website:** https://www.openstatus.dev

---

**Last Updated:** December 2025  
**Primary Languages:** TypeScript 5.9.3, Go 1.x

