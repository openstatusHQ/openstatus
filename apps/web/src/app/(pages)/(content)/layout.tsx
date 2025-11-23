import { MarketingLayout } from "@/components/layout/marketing-layout";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const DASHBOARD_V2 = true;

export default function ContentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {DASHBOARD_V2 ? <Banner /> : null}
      <MarketingLayout>{children}</MarketingLayout>
    </>
  );
}

function Banner() {
  return (
    <div className="border-b bg-muted/50 px-2 py-3 backdrop-blur-3xl">
      <Link href="https://openstatus.dev">
        <div className="group mx-auto flex w-full max-w-4xl flex-row items-center justify-between">
          <p className="font-medium">This is our v1 marketing page.</p>
          <div className="text-nowrap">
            <span className="mr-1">Go to current version</span>
            <ArrowRight className="relative mb-px inline h-4 w-0 transition-all group-hover:w-4" />
            <ChevronRight className="relative mb-px inline h-4 w-4 transition-all group-hover:w-0" />
          </div>
        </div>
      </Link>
    </div>
  );
}
