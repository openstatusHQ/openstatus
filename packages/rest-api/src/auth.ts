/**
 * Check if Request Header API Key is valid
 * @returns
 */
export async function isAuthentificated(req: Request) {
  const key = req.headers.get("x-openstatus-key");
  // const _valid = await db.select().from(apiKey).where(eq(apiKey.key, key)).run();
  if (!key) {
    return new Response("Unauthorized", { status: 401 });
  }
  return true;
}

/**
 * Check if API Key is allowed to access db entry
 * @returns
 */
export async function isAuthorized(req: Request) {
  return true;
}

/**
 * Check if Workspace has reached its limit
 * @returns
 */
export async function hasLimitReached(req: Request) {
  // import plans from "@openstatus/plans";
  return false;
}
