import { Button } from "@openstatus/ui/src/components/button";
import { CheckIcon } from "lucide-react";

export function EnterpricePlan() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-cal text-2xl">Enterprise</p>
            <p className="text-muted-foreground">If you are looking for:</p>
            <div className="my-4 grid grid-cols-3 gap-4">
              <div className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" /> Custom integration
              </div>
              <div className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" /> Custom limits
              </div>
              <div className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" /> Custom support
              </div>
              <div className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" /> Custom regions
              </div>
              <div className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" /> SSO/SAML
              </div>
              <div className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" /> BYOC (Bring Your Own Cloud)
              </div>
              <div className="flex items-center">
                <CheckIcon className="mr-2 h-4 w-4" /> Something else
              </div>
            </div>

            <p className="text-muted-foreground">
              We can help you with that. Speak with us today to build your own
              custom solution that fits your needs.
            </p>
          </div>
        </div>
      </div>
      <div>
        <Button className="rounded-full" asChild>
          <a
            href="https://cal.com/team/openstatus/30min"
            target="_blank"
            rel="noreferrer"
          >
            Talk to us
          </a>
        </Button>
      </div>
    </div>
  );
}
