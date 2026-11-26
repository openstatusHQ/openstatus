import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { PLAYBOOK_MAX_CHARS, playbookType } from "./constants";
import { playbook } from "./playbook";
import {
  PLAYBOOK_VARIABLE_NAME,
  PLAYBOOK_VARIABLE_VALUE_MAX_CHARS,
} from "./variables";

export const playbookTypeSchema = z.enum(playbookType);

export const playbookContentSchema = z
  .string()
  .trim()
  .min(1, "A playbook cannot be empty.")
  .max(PLAYBOOK_MAX_CHARS);

export const playbookVariablesSchema = z.record(
  z.string().regex(PLAYBOOK_VARIABLE_NAME),
  z.string().trim().max(PLAYBOOK_VARIABLE_VALUE_MAX_CHARS),
);

export const selectPlaybookSchema = createSelectSchema(playbook, {
  variables: playbookVariablesSchema.nullable(),
});

export type Playbook = z.infer<typeof selectPlaybookSchema>;
