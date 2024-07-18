import { SessionProvider } from "next-auth/react";

import { PHProvider } from "@/providers/posthog";

const PostHogPageview = dynamic( () =>  import('@/app/PostHogPageView'), {
  ssr: false,
})

import { Bubble } from "@/components/support/bubble";
import dynamic from "next/dynamic";

export default function AuthLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode;
}) {
  return (
    <PHProvider>
      <PostHogPageview />
      <SessionProvider>
        {children}
        <Bubble />
      </SessionProvider>
    </PHProvider>
  );
}
