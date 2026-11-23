import { z } from "zod";

export const TouchViewerInput = z.object({ id: z.number().int() });
export type TouchViewerInput = z.infer<typeof TouchViewerInput>;
