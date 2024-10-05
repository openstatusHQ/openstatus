import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { regionsToArraySchema } from "../monitors";
import { check } from "./check";

export const selectCheckSchema = createSelectSchema(check).extend({
  regions: regionsToArraySchema,
  metadata: z
    .preprocess((val) => {
      try {
        if (typeof val === "object") return val;
        if (typeof val === "string" && val.length > 0) {
          return JSON.parse(String(val));
        }
        return {};
      } catch (e) {
        console.error(e);
        return {};
      }
    }, z.record(z.string()))
    .default({}),
});

export type Check = z.infer<typeof selectCheckSchema>;
