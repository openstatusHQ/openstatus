import { AuthLayout } from "@/components/layout/auth-layout";

// Outside the `(dashboard)` group, like `/login`: no sidebar, no active
// workspace requirement. The proxy middleware still sends signed-out users
// to `/login?redirectTo=…`.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
