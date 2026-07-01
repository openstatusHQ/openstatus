/// <reference lib="deno.ns" />

import "./lib/native-fetch";
import { getLogger } from "@logtape/logtape";

import { env } from "./env";
import { app } from "./index";

const { NODE_ENV, PORT } = env();

getLogger(["workflow"]).info("Starting server", {
  port: PORT,
  environment: NODE_ENV,
});

Deno.serve({ port: PORT }, app.fetch);
