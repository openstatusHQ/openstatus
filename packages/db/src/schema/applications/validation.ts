import { createSelectSchema } from "drizzle-zod";
import { application } from "./application";

export const selectApplicationSchema = createSelectSchema(application);
