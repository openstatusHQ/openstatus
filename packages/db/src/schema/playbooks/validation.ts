import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import {
  PLAYBOOK_DESCRIPTION_MAX_CHARS,
  PLAYBOOK_MAX_CHARS,
  PLAYBOOK_SLUG,
  PLAYBOOK_SLUG_MAX_CHARS,
  PLAYBOOK_TITLE_MAX_CHARS,
} from "./constants";
import { playbook } from "./playbook";
import {
  PLAYBOOK_VARIABLE_NAME,
  PLAYBOOK_VARIABLE_VALUE_MAX_CHARS,
} from "./variables";

export const playbookSlugSchema = z
  .string()
  .max(PLAYBOOK_SLUG_MAX_CHARS)
  .regex(
    PLAYBOOK_SLUG,
    "A slug uses lowercase letters, digits and single hyphens.",
  );

export const playbookTitleSchema = z
  .string()
  .trim()
  .max(PLAYBOOK_TITLE_MAX_CHARS);

export const playbookDescriptionSchema = z
  .string()
  .trim()
  .max(PLAYBOOK_DESCRIPTION_MAX_CHARS);

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
