import type React from "react";

import { CustomImage } from "../../content/mdx-components/custom-image";
import { cn } from "../../lib/utils";

export function ContentBoxImage({
  className,
  disableZoom = true,
  ...props
}: React.ComponentProps<typeof CustomImage>) {
  return (
    <div className="border-border -mx-4 mb-3 border-b px-4 pb-3">
      <CustomImage
        disableZoom={disableZoom}
        className={cn("h-8 w-auto", className)}
        {...props}
      />
    </div>
  );
}
