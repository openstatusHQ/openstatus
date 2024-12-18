import { SessionProvider } from "next-auth/react";

import { PHProvider } from "@/lib/posthog/provider";

import { Bubble } from "@/components/support/bubble";

export default function AuthLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return (
    <PHProvider>
      <SessionProvider>
        {children}
        <Bubble />
      </SessionProvider>
    </PHProvider>
  );
}
