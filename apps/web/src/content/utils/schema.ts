import { z } from "zod";

// Structured data schemas
const howtoStepSchema = z.object({
  name: z.string(),
  text: z.string(),
  image: z.string().optional(),
  url: z.string().optional(),
});

const howtoSchema = z.object({
  totalTime: z.string().optional(), // ISO 8601 duration format (e.g., "PT2H")
  steps: z.array(howtoStepSchema),
});

const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const metadataSchema = z.object({
  title: z.string(),
  publishedAt: z.coerce.date(),
  description: z.string(),
  category: z.string(),
  author: z.string(),
  image: z.string().optional(),
  // Structured data fields
  howto: howtoSchema.optional(),
  faq: z.array(faqItemSchema).optional(),
});

export type Metadata = z.infer<typeof metadataSchema>;
export type HowToStep = z.infer<typeof howtoStepSchema>;
export type HowToData = z.infer<typeof howtoSchema>;
export type FAQItem = z.infer<typeof faqItemSchema>;
