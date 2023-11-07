import { Hono } from "hono";
import { logger } from "hono/logger";

import { status } from "./status";

export const publicRoute = new Hono();
publicRoute.use("*", logger());

publicRoute.route("/status", status);
