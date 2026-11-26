import {
  playbookContentSchema,
  playbookDescriptionSchema,
  playbookSlugSchema,
  playbookTitleSchema,
  playbookVariablesSchema,
} from "@openstatus/db/src/schema/playbooks/validation";
import { z } from "zod";

export const PlaybookSlugInput = z.object({ slug: playbookSlugSchema });
export type PlaybookSlugInput = z.infer<typeof PlaybookSlugInput>;

export const SavePlaybookInput = z.object({
  slug: playbookSlugSchema,
  /** Omitted keeps the stored title; empty goes back to the slug's default. */
  title: playbookTitleSchema.nullish(),
  /** Omitted keeps the stored description; empty goes back to the slug's default. */
  description: playbookDescriptionSchema.nullish(),
  content: playbookContentSchema,
  /** Values for the `{{name}}` variables in `content`; others are dropped. */
  variables: playbookVariablesSchema.optional(),
});
export type SavePlaybookInput = z.infer<typeof SavePlaybookInput>;
