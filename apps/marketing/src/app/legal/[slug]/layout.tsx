import { Layout } from "@/components/layout/layout";
import type { ReactNode } from "react";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
