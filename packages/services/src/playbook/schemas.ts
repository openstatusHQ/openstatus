import {
  playbookContentSchema,
  playbookDescriptionSchema,
  playbookSlugSchema,
  playbookTitleSchema,
  playbookVariablesSchema,
} from "@openstatus/db/src/schema/playbooks/validation";
import { z } from "zod";

// Any string: a slug that cannot exist reads as missing, not as a validation error.
export const GetPlaybookInput = z.object({ slug: z.string().min(1) });
export type GetPlaybookInput = z.infer<typeof GetPlaybookInput>;

export const DeletePlaybookInput = GetPlaybookInput;
export type DeletePlaybookInput = z.infer<typeof DeletePlaybookInput>;

export const CreatePlaybookInput = z.object({
  slug: playbookSlugSchema,
  title: playbookTitleSchema,
  description: playbookDescriptionSchema,
  content: playbookContentSchema,
  /** Values for the `{{name}}` variables in `content`; others are dropped. */
  variables: playbookVariablesSchema.optional(),
});
export type CreatePlaybookInput = z.infer<typeof CreatePlaybookInput>;

export const UpdatePlaybookInput = CreatePlaybookInput.extend({
  /** Omitted keeps the stored title, or the default on a built-in slug's first write. */
  title: playbookTitleSchema.optional(),
  /** Omitted keeps the stored description, or the default on a built-in slug's first write. */
  description: playbookDescriptionSchema.optional(),
  /** The `updatedAt` the caller read; the write is refused when the playbook changed since. */
  expectedUpdatedAt: z.coerce.date().optional(),
});
export type UpdatePlaybookInput = z.infer<typeof UpdatePlaybookInput>;
