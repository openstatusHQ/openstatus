import {
  playbookContentSchema,
  playbookTypeSchema,
  playbookVariablesSchema,
} from "@openstatus/db/src/schema/playbooks/validation";
import { z } from "zod";

export const PlaybookTypeInput = z.object({ type: playbookTypeSchema });
export type PlaybookTypeInput = z.infer<typeof PlaybookTypeInput>;

export const SavePlaybookInput = z.object({
  type: playbookTypeSchema,
  content: playbookContentSchema,
  /** Values for the `{{name}}` variables in `content`; others are dropped. */
  variables: playbookVariablesSchema.optional(),
});
export type SavePlaybookInput = z.infer<typeof SavePlaybookInput>;
