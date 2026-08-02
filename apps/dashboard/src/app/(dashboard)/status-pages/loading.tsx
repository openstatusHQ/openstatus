import { PageSkeleton } from "@/components/content/page-skeleton";

// Sits above `[id]/layout.tsx`, whose `fetchQueryOrNotFound` gate suspends.
export default function Loading() {
  return <PageSkeleton />;
}
