import { Shell } from "@/components/dashboard/shell";
import { Button } from "@openstatus/ui";
import Link from "next/link";

export function Banner() {
  return (
    <Shell className="flex items-center justify-between gap-4">
      <p className="max-w-xl font-medium text-lg">
        Learn how your services are performing over time, and notify your users
        of any issues.
      </p>
      <Button className="min-w-max rounded-full" asChild>
        <Link href="/app/login">Get Started</Link>
      </Button>
    </Shell>
  );
}
