import { MarketingLayout } from "@/components/layout/marketing-layout";
import type { ReactNode } from "react";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
