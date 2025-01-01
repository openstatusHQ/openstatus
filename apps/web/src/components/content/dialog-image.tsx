"use client";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@openstatus/ui";
import Image, { type ImageProps } from "next/image";

export interface DialogImageProps extends ImageProps {
  /**
   * If `true`, the dialog zoom click will be disabled.
   */
  disabled?: boolean;
}

export function DialogImage({
  className,
  disabled,
  ...props
}: DialogImageProps) {
  return (
    <Dialog>
      <DialogTrigger disabled={disabled}>
        <Image className={className} {...props} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[80vw] sm:max-h-[80vh] p-0 min-h-[80vh] min-w-[80vw]">
        <Image
          className={cn("object-contain", className)}
          {...props}
          fill={true}
          width={undefined}
          height={undefined}
        />
      </DialogContent>
    </Dialog>
  );
}
