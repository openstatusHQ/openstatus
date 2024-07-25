import Image from "next/image";
import Link from "next/link";

import { Button } from "@openstatus/ui/src/components/button";
import { cn } from "@openstatus/ui/src/lib/utils";

import { Icons } from "@/components/icons";
import type { ValidIcon } from "@/components/icons";

export interface MemberProps {
  name: string;
  role: string;
  image: { src: string };
  socials?: { label: string; href: string; icon: ValidIcon }[];
}

export function Member({ name, role, image, socials }: MemberProps) {
  return (
    <div className="grid w-full gap-3">
      <div className="relative aspect-square max-w-full overflow-hidden rounded-lg border border-border">
        <Image src={image.src} alt={name} layout="fill" objectFit="contain" />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-1">
          <h3 className="font-medium">{name}</h3>
          <p className="text-muted-foreground">{role}</p>
        </div>
        <div className="grid gap-1">
          {socials?.map((item) => {
            const Icon = Icons[item.icon];
            return (
              <Button key={item.href} variant="ghost" size="icon" asChild>
                <Link href={item.href} target="_blank">
                  {item.icon ? <Icon className={cn("h-4 w-4")} /> : null}
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
