import { ArrowUpRight } from "lucide-react";

export function Partners() {
  return (
    <div className="grid gap-4">
      <h3 className="text-muted-foreground font-cal text-center text-sm">
        Trusted By
      </h3>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-4 sm:gap-16">
        <div className="flex items-center justify-center">
          <a
            href="https://status.hanko.io"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-center underline underline-offset-4 hover:no-underline"
          >
            <img
              src="/assets/partners/hanko.svg"
              alt="hanko"
              className="h-8 w-16 object-contain"
            />
            <ArrowUpRight className="text-muted-foreground group-hover:text-foreground ml-1 h-4 w-4 flex-shrink-0" />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <a
            href="https://status.documenso.com"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-center underline underline-offset-4 hover:no-underline"
          >
            <img
              src="/assets/partners/documenso.svg"
              alt="hanko"
              className="h-8 w-32 object-contain"
            />
            <ArrowUpRight className="text-muted-foreground group-hover:text-foreground ml-1 h-4 w-4 flex-shrink-0" />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <a
            href="https://status.trigger.dev"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-center underline underline-offset-4 hover:no-underline"
          >
            <img
              src="/assets/partners/triggerdev.svg"
              alt="trigger.dev"
              className="h-8 w-32 object-contain"
            />
            <ArrowUpRight className="text-muted-foreground group-hover:text-foreground ml-1 h-4 w-4 flex-shrink-0" />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground text-sm">You</p>
        </div>
      </div>
    </div>
  );
}
