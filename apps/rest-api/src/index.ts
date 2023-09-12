import { Hono } from "hono";

import { middleware } from "./middleware";
import { DELETE, GET, POST, PUT } from "./monitors";

/**
 * Base Path "/v1" for our api
 */
const app = new Hono().basePath("/v1");

/**
 * Authentification Middleware
 */
app.use("*", middleware);

/**
 * REST API for monitors
 */
const monitors = new Hono();

monitors.get("/:id", GET);
monitors.post("/", POST);
monitors.put("/:id", PUT);
monitors.delete("/:id", DELETE);

app.route("/monitors", monitors);

export default app;
