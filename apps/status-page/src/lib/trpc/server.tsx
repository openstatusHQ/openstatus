import "server-only";
import { createServerHelpers } from "@openstatus/api/src/rsc";

import { auth } from "../auth";
import { makeQueryClient } from "./query-client";

export const {
  trpc,
  getQueryClient,
  HydrateClient,
  prefetch,
  batchPrefetch,
  fetchQueryOrNotFound,
} = createServerHelpers({
  // Lazy: `../auth` imports this module, so referencing `auth` eagerly would
  // hit a circular-init TDZ.
  makeQueryClient,
  auth: () => auth(),
});
