import { Hono } from "hono";
import { cors } from "hono/cors";
import { timing } from "hono/timing";

import { status } from "./status";

export const publicRoute = new Hono();
publicRoute.use("*", cors());
publicRoute.use("*", timing());

publicRoute.route("/status", status);
