import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@openstatus/ui";

const links = [
  {
    title: "Monitors",
    description: "Create and manage monitors",
    href: "/monitors",
  },
  {
    title: "Status Pages",
    description: "Create and manage pages",
    href: "/status-pages",
  },
  {
    title: "Status Reports",
    description: "Create and manage reports",
    href: "/status-reports",
  },
  {
    title: "Documentation",
    description: "Learn more about OpenStatus",
    href: "https://docs.openstatus.dev",
  },
];

export function LinkCards({ slug }: { slug: string }) {
  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
      {links.map((link) => {
        const isExternal = link.href.startsWith("http");
        const href = isExternal ? link.href : `/app/${slug}${link.href}`;
        const target = isExternal ? "_blank" : undefined;
        return (
          <Link
            key={link.href}
            href={href}
            target={target}
            className="group flex w-full flex-1"
          >
            <Card className="flex w-full flex-col">
              <CardHeader className="flex-1">
                <CardTitle>{link.title}</CardTitle>
                <div className="flex flex-1 justify-between gap-2">
                  <CardDescription>{link.description}</CardDescription>
                  {isExternal ? (
                    <ArrowUpRight className="h-4 w-4 shrink-0 self-end text-muted-foreground group-hover:text-foreground" />
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 self-end text-muted-foreground group-hover:text-foreground" />
                  )}
                </div>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
