import { Hono } from "hono";

import { drainOnce } from "../inbox/drain";
import { pruneOnce } from "../inbox/retention";
import { sweepOnce } from "../inbox/sweep";

export const cronRoute = new Hono();

cronRoute.get("/inbox", async (c) => c.json(await drainOnce()));
cronRoute.get("/sweep", async (c) => c.json(await sweepOnce()));
cronRoute.get("/retention", async (c) => c.json(await pruneOnce()));
