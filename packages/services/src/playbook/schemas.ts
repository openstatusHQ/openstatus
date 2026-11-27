import {
  playbookContentSchema,
  playbookDescriptionSchema,
  playbookSlugSchema,
  playbookTitleSchema,
  playbookVariablesSchema,
} from "@openstatus/db/src/schema/playbooks/validation";
import { z } from "zod";

// Reads and deletes take any stored slug, so a row written before the slug
// format existed can still be opened and removed.
export const PlaybookSlugInput = z.object({ slug: z.string().min(1) });
export type PlaybookSlugInput = z.infer<typeof PlaybookSlugInput>;

export const SavePlaybookInput = z.object({
  slug: playbookSlugSchema,
  /** Omitted keeps the stored title; a new built-in slug takes its default, a new custom slug needs one. */
  title: playbookTitleSchema.optional(),
  /** Omitted keeps the stored description; a new built-in slug takes its default, a new custom slug needs one. */
  description: playbookDescriptionSchema.optional(),
  content: playbookContentSchema,
  /** Values for the `{{name}}` variables in `content`; others are dropped. */
  variables: playbookVariablesSchema.optional(),
});
export type SavePlaybookInput = z.infer<typeof SavePlaybookInput>;
