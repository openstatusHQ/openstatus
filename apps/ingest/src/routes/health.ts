import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/ping", (c) => c.text("pong"));
