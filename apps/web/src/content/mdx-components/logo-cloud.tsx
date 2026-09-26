import { existsSync } from "node:fs";
import { join } from "node:path";

import Image from "next/image";

import { customers } from "../../data/customers";
import { getImageDimensions } from "../../lib/image-dimensions";
import { CustomLink } from "./custom-link";
import { Grid } from "./grid";

function darkVariant(src: string) {
  const dark = src.replace(/(\.[^.]+)$/, ".dark$1");
  return existsSync(join(process.cwd(), "public", dark)) ? dark : undefined;
}

function Logo({ src, alt }: { src: string; alt: string }) {
  const size = getImageDimensions(src) ?? { width: 160, height: 32 };
  const dark = darkVariant(src);
  const className = "h-6 w-auto max-w-[140px] object-contain";
  return (
    <>
      <Image
        src={src}
        alt={alt}
        width={size.width}
        height={size.height}
        className={dark ? `${className} dark:hidden` : className}
      />
      {dark ? (
        <Image
          src={dark}
          alt={alt}
          width={size.width}
          height={size.height}
          className={`${className} hidden dark:block`}
        />
      ) : null}
    </>
  );
}

/** Customer cells from `data/customers.ts`; a name in text until its logo lands. */
export function LogoCloud({ limit = 8 }: { limit?: number }) {
  return (
    <Grid cols={4} className="not-prose">
      {customers.slice(0, limit).map((customer) => (
        <CustomLink
          key={customer.name}
          href={customer.story ?? customer.href}
          className="hover:bg-muted flex min-h-16 items-center justify-center font-medium no-underline!"
          aria-label={customer.name}
        >
          {customer.logo ? (
            <Logo src={customer.logo} alt={customer.name} />
          ) : (
            customer.name
          )}
        </CustomLink>
      ))}
    </Grid>
  );
}
