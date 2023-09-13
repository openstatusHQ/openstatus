import { Hono } from "hono";

import { middleware } from "./middleware";
import { DELETE, GET, POST, PUT } from "./monitors";

/**
 * Base Path "/v1" for our api
 */
const app = new Hono();

app.get("/ping", (c) => c.text("pong"));
/**
 * Authentification Middleware
 */

/**
 * REST API for monitors
 */
const monitors = new Hono().basePath("/v1");

monitors.use("*", middleware);
monitors.get("/:id", GET);
monitors.post("/", POST);
monitors.put("/:id", PUT);
monitors.delete("/:id", DELETE);

app.route("/monitors", monitors);

console.log("Starting server on port 3000");

export default app;
