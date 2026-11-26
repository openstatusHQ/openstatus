import { createSelectSchema } from "drizzle-orm/zod";

import { application } from "./application";

export const selectApplicationSchema = createSelectSchema(application);
