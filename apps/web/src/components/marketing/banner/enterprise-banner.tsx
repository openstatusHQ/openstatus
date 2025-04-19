import { Button } from "@openstatus/ui";
import Link from "next/link";
import { GenericBanner } from "./generic-banner";

export function EnterpriseBanner() {
  return (
    <GenericBanner
      title="Looking for an enterprise solution?"
      description="We offer custom solutions for large organizations."
      actions={
        <div className="flex gap-2">
          <Button className="rounded-full" variant="outline" asChild>
            <Link href="/app/login" className="text-nowrap">
              Start for free
            </Link>
          </Button>
          <Button className="rounded-full" asChild>
            <a
              target="_blank"
              rel="noreferrer"
              href="https://cal.com/team/openstatus/30min"
              className="text-nowrap"
            >
              Book a call
            </a>
          </Button>
        </div>
      }
    />
  );
}
