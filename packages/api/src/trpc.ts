import type { NextRequest } from "next/server";
import { inferAsyncReturnType, initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { clickhouseClient, db, eq, schema } from "@openstatus/db";
import type { User, Workspace } from "@openstatus/db/src/schema";

// TODO: create a package for this
import {
  auth,
  DefaultSession as Session,
} from "../../../apps/web/src/lib/auth";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API
 *
 * These allow you to access things like the database, the session, etc, when
 * processing a request
 *
 */
type CreateContextOptions = {
  session: Session | null;
  workspace?: Workspace | null;
  user?: User | null;
  req?: NextRequest;
};

/**
 * This helper generates the "internals" for a tRPC context. If you need to use
 * it, you can export it from here
 *
 * Examples of things you may need it for:
 * - testing, so we dont have to mock Next.js' req/res
 * - trpc's `createSSGHelpers` where we don't have req/res
 * @see https://create.t3.gg/en/usage/trpc#-servertrpccontextts
 */
export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    ...opts,
    db,
    clickhouseClient,
  };
};

/**
 * This is the actual context you'll use in your router. It will be used to
 * process every request that goes through your tRPC endpoint
 * @link https://trpc.io/docs/context
 */
export const createTRPCContext = async (opts: {
  req: NextRequest;
  serverSideCall?: boolean;
}) => {
  const session = await auth();
  const workspace = null;
  const user = null;

  return createInnerTRPCContext({
    session,
    workspace,
    user,
    req: opts.req,
  });
};

export type Context = inferAsyncReturnType<typeof createTRPCContext>;

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
export const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;
export const mergeRouters = t.mergeRouters;

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure;

/**
 * Reusable middleware that enforces users are logged in before running the
 * procedure
 */
const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // /**
  //  * Attach `user` and `workspace` | `activeWorkspace` infos to context by
  //  * comparing the `user.tenantId` to clerk's `auth.userId`
  //  */
  const userAndWorkspace = await db.query.user.findFirst({
    where: eq(schema.user.id, Number(ctx.session.user.id)),
    with: {
      usersToWorkspaces: {
        with: {
          workspace: true,
        },
      },
    },
  });

  const { usersToWorkspaces, ...userProps } = userAndWorkspace || {};

  /**
   * We need to include the active "workspace-slug" cookie in the request found in the
   * `/app/[workspaceSlug]/.../`routes. We pass them either via middleware if it's a
   * server request or via the client cookie, set via `<WorspaceClientCookie />`
   * if it's a client request.
   *
   * REMINDER: We only need the client cookie because of client side mutations.
   */
  const workspaceSlug = ctx.req?.cookies.get("workspace-slug")?.value;

  // if (!workspaceSlug) {
  //   throw new TRPCError({
  //     code: "UNAUTHORIZED",
  //     message: "Workspace Slug Not Found",
  //   });
  // }

  const activeWorkspace = usersToWorkspaces?.find(({ workspace }) => {
    // If there is a workspace slug in the cookie, use it to find the workspace
    if (workspaceSlug) return workspace.slug === workspaceSlug;
    return true;
  })?.workspace;

  if (!activeWorkspace) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Workspace Not Found",
    });
  }

  if (!userProps) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "User Not Found" });
  }

  const user = schema.selectUserSchema.parse(userProps);
  const workspace = schema.selectWorkspaceSchema.parse(activeWorkspace);

  return next({
    ctx: {
      ...ctx,
      user,
      workspace,
    },
  });
});

/**
 * Middleware to parse form data and put it in the rawInput
 */
export const formdataMiddleware = t.middleware(async (opts) => {
  const formData = await opts.ctx.req?.formData?.();
  if (!formData) throw new TRPCError({ code: "BAD_REQUEST" });

  return opts.next({
    rawInput: formData,
  });
});
/**
 * Protected (authed) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use
 * this. It verifies the session is valid and guarantees ctx.session.user is not
 * null
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
