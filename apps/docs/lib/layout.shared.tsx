import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-bold">
          <Image
            src="/icon.png"
            alt="OpenStatus"
            width={24}
            height={24}
            className="rounded-full"
          />
          openstatus
        </span>
      ),
    },
    links: [
      {
        text: "GitHub",
        url: "https://github.com/openstatusHQ/openstatus",
        external: true,
      },
      {
        text: "Discord",
        url: "https://www.openstatus.dev/discord",
        external: true,
      },
    ],
  };
}
