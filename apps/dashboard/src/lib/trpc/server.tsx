import "server-only";
import { createServerHelpers } from "@openstatus/api/src/rsc";

import { auth } from "@/lib/auth";

import { makeQueryClient } from "./query-client";

export const {
  trpc,
  getQueryClient,
  HydrateClient,
  prefetch,
  batchPrefetch,
  fetchQueryOrNotFound,
} = createServerHelpers({ makeQueryClient, auth });
