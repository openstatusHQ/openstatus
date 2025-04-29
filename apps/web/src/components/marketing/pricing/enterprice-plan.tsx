import { Button } from "@openstatus/ui/src/components/button";
import { CheckIcon } from "lucide-react";

const features = [
  "Custom Integration",
  "Custom Limits",
  "Custom Support",
  "Custom regions",
  "SSO/SAML",
  "BYOC (Bring Your Own Cloud)",
];

export function EnterpricePlan() {
  return (
    <div>
      <p className="mb-2 font-cal text-2xl">Enterprise</p>
      <p className="text-muted-foreground">If you are looking for:</p>
      <div className="my-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {features.map((feature) => (
          <div key={feature} className="flex items-center">
            <CheckIcon className="mr-1.5 h-4 w-4 shrink-0" />
            <span className="text-foreground text-sm">{feature}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="sm:col-span-3">
          <p className="text-muted-foreground">
            We can help you with that. Speak with us today to build your own
            custom solution that fits your needs.
          </p>
        </div>
        <div className="sm:col-span-1 w-full">
          <Button className="rounded-full w-full" asChild>
            <a
              href="https://cal.com/team/openstatus/30min"
              target="_blank"
              rel="noreferrer"
              className="text-nowrap"
            >
              Talk to us
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
