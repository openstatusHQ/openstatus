import { SessionProvider } from "next-auth/react";

import { Bubble } from "@/components/support/bubble";

export default function AuthLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      {children}
      <Bubble />
    </SessionProvider>
  );
}
