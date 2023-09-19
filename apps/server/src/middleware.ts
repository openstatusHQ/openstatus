import { verifyKey } from "@unkey/api";
import type { Context, Env, Next } from "hono";

export async function middleware(
  c: Context<
    {
      Variables: {
        workspaceId: string;
      };
    },
    "/v1/*",
    {}
  >,
  next: Next,
) {
  const key = c.req.header("x-openstatus-key");
  if (!key) return c.text("Unauthorized", 401);

  if (process.env.NODE_ENV === "production") {
    const { error, result } = await verifyKey(key);

    if (error) return c.text("Bad Request", 400);

    if (!result.valid) return c.text("Unauthorized", 401);
    c.set("workspaceId", `${result.ownerId}`);
  } else {
    c.set("workspaceId", "1");
  }
  await next();
}
