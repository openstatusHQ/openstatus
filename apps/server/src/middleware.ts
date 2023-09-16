import { verifyKey } from "@unkey/api";
import type { Context, Env, Next } from "hono";

export async function middleware(c: Context<Env, "/v1/*", {}>, next: Next) {
  const key = c.req.header("x-openstatus-key");
  if (!key) return c.text("Unauthorized", 401);

  if (process.env.NODE_ENV === "production") {
    const { error, result } = await verifyKey(key);

    if (error) return c.text("Bad Request", 400);

    if (!result.valid) return c.text("Unauthorized", 401);

    c.req.raw.headers.append("x-workspace-id", `${result.ownerId}`);
  } else {
    c.req.raw.headers.append("x-workspace-id", "1");
  }
  await next();
}
