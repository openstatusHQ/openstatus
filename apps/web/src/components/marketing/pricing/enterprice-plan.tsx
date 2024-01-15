import { Button } from "@openstatus/ui";

export function EnterpricePlan() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-cal mb-2 text-xl">Enterprise</p>
            <p className="text-muted-foreground">
              Dedicated support and needs for your company.
            </p>
          </div>
          <p className="shrink-0">
            <span className="font-cal text-2xl">Lets talk</span>
          </p>
        </div>
      </div>
      <div>
        <Button asChild>
          <a
            href="https://cal.com/team/openstatus/30min"
            target="_blank"
            rel="noreferrer"
          >
            Schedule call
          </a>
        </Button>
      </div>
    </div>
  );
}
