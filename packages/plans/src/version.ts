import {
  monitorFlyRegionSchema,
  monitorPeriodicitySchema,
} from "@openstatus/db/src/schema/shared/shared";
import { limitsV1 } from "@openstatus/db/src/schema/workspaces/validation";
import { z } from "zod";

// const limitsV2 = limitsV1.extend({
//   version: z.literal("2"),
//   // newField: z.boolean(),
// });

// const migrateFromV1ToV2 = (
//   v1: z.infer<typeof limitsV1>,
// ): z.infer<typeof limitsV2> => {
//   return {
//     ...v1,
//     version: "2",
//   };
// };

const unknownLimit = z.discriminatedUnion("version", [limitsV1]);

// export const limitSchema = unknownLimit.transform((val) => {
//   if (!val.version) {
//     return migrateFromV1ToV2(val);
//   }
//   return val;
// });

export type Limits = z.infer<typeof unknownLimit>;
