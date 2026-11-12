import {
  StatusPageMain,
  StatusPageShell,
} from "@openstatus/ui/components/blocks/status-page-shell";
import { Suspense } from "react";

import { EmbedShell } from "../../../../../components/layout/embed-shell";
import { Footer } from "../../../../../components/nav/footer";
import { Header } from "../../../../../components/nav/header";

export default function Layout({ children }: { children: React.ReactNode }) {
  const baseUrlOverride =
    process.env.STATUS_PAGE_BASE_URL?.trim() ||
    process.env.OPENSTATUS_STATUS_PAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_STATUS_PAGE_BASE_URL?.trim() ||
    undefined;

  return (
    <Suspense>
      <EmbedShell>
        <StatusPageShell className="group-data-[embed=true]/embed:min-h-0">
          <Header
            className="w-full border-b"
            baseUrlOverride={baseUrlOverride}
          />
          <StatusPageMain className="group-data-[embed=true]/embed:mx-0 group-data-[embed=true]/embed:max-w-none">
            {children}
          </StatusPageMain>
          <Footer className="w-full border-t" />
        </StatusPageShell>
      </EmbedShell>
    </Suspense>
  );
}
