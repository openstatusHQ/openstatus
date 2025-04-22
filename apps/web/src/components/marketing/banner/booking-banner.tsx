import { Button } from "@openstatus/ui";
import Link from "next/link";
import { GenericBanner } from "./generic-banner";

export function BookingBanner() {
  return (
    <GenericBanner
      title="Don't talk to Sales. Talk to Founders."
      description="We are here to help you with any questions or concerns you may have."
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
              Talk to us
            </a>
          </Button>
        </div>
      }
    />
  );
}
