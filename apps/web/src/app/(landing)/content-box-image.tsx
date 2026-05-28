import { CustomImage } from "@/content/mdx-components/custom-image";
import { cn } from "@/lib/utils";
import type React from "react";

export function ContentBoxImage({
  className,
  disableZoom = true,
  ...props
}: React.ComponentProps<typeof CustomImage>) {
  return (
    <div className="-mx-4 mb-3 border-border border-b px-4 pb-3">
      <CustomImage
        disableZoom={disableZoom}
        className={cn("h-8 w-auto", className)}
        {...props}
      />
    </div>
  );
}
