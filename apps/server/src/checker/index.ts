import { Hono } from "hono";

import { checker } from "./checker";
import { middleware } from "./middleware";
import type { Payload } from "./schema";

export type Variables = {
  payload: Payload;
};

export const checkerRoute = new Hono<{ Variables: Variables }>();

checkerRoute.use("/*", middleware);

// TODO: only use checkerRoute.post("/checker", checker);
checkerRoute.post("/checker", async (c) => {
  const payload = c.get("payload");
  try {
    checker(payload);
  } catch (e) {
    console.error(e);
  }
});
