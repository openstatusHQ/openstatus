import Link from "next/link";

import { Button, Icons } from "@openstatus/ui";

import type { Social } from "@/config/socials";

export function SocialIconButton({ href, title, icon }: Social) {
  const Icon = Icons[icon];

  return (
    <Button asChild size="icon" variant="outline">
      <Link href={href} target="_blank" rel="noreferrer">
        <span className="sr-only">{title}</span>
        <Icon className="h-4 w-4" />
      </Link>
    </Button>
  );
}
