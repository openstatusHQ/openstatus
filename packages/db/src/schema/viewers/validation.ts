import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { viewer } from "./viewer";

export const insertViewerSchema = createInsertSchema(viewer);

export const selectViewerSchema = createSelectSchema(viewer);

export type InsertViewer = z.infer<typeof insertViewerSchema>;
export type Viewer = z.infer<typeof selectViewerSchema>;
