import { createSelectSchema } from "drizzle-zod";

import { checkerDecision } from "./checker_decision";

export const selectCheckerDecisionSchema = createSelectSchema(checkerDecision);

export type CheckerDecisionRow = typeof checkerDecision.$inferSelect;
