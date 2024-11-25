import { Button } from "@openstatus/ui/src/components/button";

export function EnterpricePlan() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-cal text-2xl">Custom</p>
            <p className="text-muted-foreground">
              Want more regions? Want to host it on your own server? Want
              something else? We can help you with that.
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
