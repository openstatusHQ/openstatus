import { Hono } from "hono";

import { status } from "./status";

export const publicRoute = new Hono();

publicRoute.route("/status", status);
