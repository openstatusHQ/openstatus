import { ArrowUpRight } from "lucide-react";

export function Partners() {
  return (
    <div className="flex flex-wrap items-end gap-8 px-3 md:mx-6">
      <a
        href="https://status.hanko.io"
        target="_blank"
        rel="noreferrer"
        className="group inline-flex items-center justify-center underline underline-offset-4 hover:no-underline"
      >
        Hanko
        <ArrowUpRight className="text-muted-foreground group-hover:text-foreground ml-1 h-4 w-4 flex-shrink-0" />
      </a>
      <a
        href="https://status.documenso.com"
        target="_blank"
        rel="noreferrer"
        className="group inline-flex items-center justify-center underline underline-offset-4 hover:no-underline"
      >
        Documenso
        <ArrowUpRight className="text-muted-foreground group-hover:text-foreground ml-1 h-4 w-4 flex-shrink-0" />
      </a>
      <p className="text-muted-foreground text-xs">Your logo</p>
    </div>
  );
}
