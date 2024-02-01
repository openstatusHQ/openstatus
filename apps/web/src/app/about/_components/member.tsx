import Image from "next/image";
import Link from "next/link";

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
      <div className="border-border relative aspect-square h-48 max-h-48 overflow-hidden rounded-lg border">
        <Image src={image.src} alt={name} layout="fill" objectFit="contain" />
      </div>
      <div className="grid gap-1">
        <h3 className="font-medium">{name}</h3>
        <p className="text-muted-foreground">{role}</p>
        <p>
          {socials?.map((item, index) => {
            const Icon = item.icon && Icons[item.icon];

            return (
              <>
                <Link href={item.href} target="_blank">
                  {item.icon ? <Icon className={cn("mr-2 h-4 w-4")} /> : null}
                </Link>
              </>
            );
          })}
        </p>
      </div>
    </div>
  );
}
