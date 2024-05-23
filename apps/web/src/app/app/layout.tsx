import { SessionProvider } from "next-auth/react";

import { PHProvider } from "@/providers/posthog";

export default function AuthLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return (
    <PHProvider>
      <SessionProvider>{children}</SessionProvider>
    </PHProvider>
  );
}
