import { Shell } from "@/components/dashboard/shell";
import { Button } from "@openstatus/ui/src/components/button";
import Link from "next/link";

export function Banner() {
  return (
    <Shell className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <p className="max-w-xl font-medium text-lg">
        Learn how your services are performing over time, and notify your users
        of any issues.
      </p>
      <div className="flex items-center gap-2 self-end">
        <Button variant="outline" className="min-w-max rounded-full" asChild>
          <Link href="/cal">Book a call</Link>
        </Button>
        <Button className="min-w-max rounded-full" asChild>
          <Link href="/app/login">Get started</Link>
        </Button>
      </div>
    </Shell>
  );
}
