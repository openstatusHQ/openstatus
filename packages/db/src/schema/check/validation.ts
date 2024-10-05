import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { check } from "./check";
import { regionsToArraySchema } from "../monitors";

export const selectCheckSchema = createSelectSchema(check).extend({
  regions: regionsToArraySchema,
});

export type Check = z.infer<typeof selectCheckSchema>;
