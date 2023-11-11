import { ClerkProvider } from "@clerk/nextjs";
import PlausibleProvider from "next-plausible";

import { MarketingFooter } from "./marketing-footer";
import { MarketingHeader } from "./marketing-header";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlausibleProvider domain="openstatus.dev">
      <ClerkProvider>
        <main className="flex min-h-screen w-full flex-col items-center justify-center space-y-6 p-4 md:p-8">
          <MarketingHeader className="mx-auto w-full max-w-4xl" />
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start justify-center">
            {children}
          </div>
          <MarketingFooter className="mx-auto w-full max-w-4xl" />
        </main>
      </ClerkProvider>
    </PlausibleProvider>
  );
}
