import { ArrowUpRight } from "lucide-react";

import { Documenso } from "@/components/svg/documenso";
import { Hanko } from "@/components/svg/hanko";
import { Midday } from "@/components/svg/midday";

export function Partners() {
  return (
    <div className="grid gap-4">
      <h3 className="text-center font-cal text-muted-foreground text-sm">
        Trusted By
      </h3>
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-16">
        <div className="flex items-center justify-center">
          <a
            href="https://status.hanko.io"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-center"
          >
            <Hanko className="h-6 w-[3.75rem] sm:h-8 sm:w-24" />
            <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <a
            href="https://status.documenso.com"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-center"
          >
            <Documenso className="h-6 w-24 sm:h-8 sm:w-32" />
            <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <a
            href="https://status.midday.ai"
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center justify-center"
          >
            <Midday className="h-6 w-24 sm:h-8 sm:w-24" />
            <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
          </a>
        </div>
        <div className="flex items-center justify-center">
          <p>
            <a
              href="https://status.cal.com"
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center justify-center"
            >
              <span className="font-cal text-2xl">Cal.com</span>
              <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
