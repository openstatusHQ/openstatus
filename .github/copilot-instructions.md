# OpenStatus - GitHub Copilot Instructions

## Project Overview

OpenStatus is an open-source synthetic monitoring platform. This is a **pnpm monorepo** using **Turborepo**.

- **Package Manager:** pnpm 10.26.0 (never use npm/yarn)
- **Monorepo Tool:** Turborepo 2.6.3
- **Primary Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4.1
- **Database:** Turso (libSQL) with Drizzle ORM 0.44.4
- **Backend:** Hono (Bun), Go services, tRPC
- **Linter:** Biome 1.8.3 (not ESLint/Prettier)

## Code Style & Conventions

### TypeScript & Formatting
- **Always use TypeScript** - avoid `any`, prefer proper types
- **Indent:** 2 spaces
- **Line width:** 80 characters
- **Imports:** Biome auto-organizes (external → workspace → relative)

### File Naming
- React Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Configuration: `kebab-case.ts`

### React/Next.js Patterns
- Server Components by default (App Router)
- Add `"use client"` only when needed (hooks, interactivity, browser APIs)
- Forms: React Hook Form + Zod validation
- Client state: TanStack Query 5.81.5
- Type-safe APIs: tRPC (dashboard), Hono with OpenAPI (server)

## Workspace Structure

```
apps/
├── dashboard/        # Next.js - Admin dashboard (uses tRPC)
├── web/              # Next.js - Marketing site
├── status-page/      # Next.js - Public status pages
├── docs/             # Astro - Documentation
├── server/           # Bun/Hono - API server
├── workflows/        # Node.js - Workflow engine
└── [Go services]/    # checker, private-location, ssh-server, railway-proxy

packages/
├── db/               # Drizzle schema + migrations
├── api/              # tRPC procedures
├── ui/               # Shared UI components (shadcn/ui)
├── emails/           # React Email templates
├── notifications/    # Discord, Slack, PagerDuty, etc.
└── [20+ shared packages]
```

## Database Rules (CRITICAL)

- **ALWAYS use Drizzle ORM** - Never write raw SQL
- Schema location: `packages/db/src/schema/`
- Create migrations: `cd packages/db && pnpm generate`
- **Never modify existing migrations**
- **Never create manual migrations**

Example query:
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

## API Development

### tRPC (Dashboard App)
- Location: `packages/api/src/`
- Pattern: Type-safe procedures
- Always use Zod for input/output validation

### Hono (Server App)
- Location: `apps/server/src/`
- Pattern: OpenAPI REST endpoints with @hono/zod-openapi
- Error handling: `throw new HTTPException(status, { message })`

## Common Patterns

### Component Structure
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

## Dependencies

- All workspace packages use `workspace:*` protocol
- Workspace imports: `@openstatus/[package-name]`
- **Never upgrade major versions without approval**
- **Never add dependencies without justification**

## Commands

```bash
# Development
pnpm dev:dashboard    # Dashboard on port 3000
pnpm dev:web         # Marketing site
pnpm dx              # Setup database + migrations + seed

# Code Quality
pnpm format          # Biome format + auto-fix
pnpm lint:fix        # Biome lint + auto-fix
pnpm tsc             # TypeScript type check
pnpm build           # Build all packages

# Database
cd packages/db && pnpm generate  # Generate migration
pnpm migrate         # Apply migrations
pnpm studio          # Open Drizzle Studio
```

## DO ✅

- Fix bugs and implement features in existing apps/packages
- Create components, utilities, hooks, API routes
- Use existing `@openstatus/*` workspace packages
- Write tests and improve error handling
- Add TypeScript types and documentation
- Follow existing code patterns

## DON'T ❌

- Modify database schema without explicit permission
- Change authentication, authorization, or payment logic
- Modify Dockerfiles, fly.toml, or docker-compose.yaml
- Write raw SQL (use Drizzle ORM)
- Create manual migrations (use `pnpm generate`)
- Commit API keys, tokens, or secrets
- Disable security features (CORS, CSRF, auth)
- Change package manager from pnpm
- Upgrade major dependency versions

## Performance Best Practices

- Use React Server Components where possible
- Use Upstash Redis for caching
- Implement database indexes via Drizzle schema
- Use dynamic imports for large components
- Query Tinybird for analytics data

## Environment Variables

- Type-safe with `@t3-oss/env-core` + Zod
- Each app has `env.ts` for validation
- **Never commit .env files**
- Docker: use `.env.docker.example`

---

For complete documentation, see `AGENTS.md` in the repository root.

