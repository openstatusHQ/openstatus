import { cn } from "@/lib/utils";

export function Background({
  children,
  tw,
}: {
  children: React.ReactNode;
  tw?: string;
}) {
  return (
    <div
      tw={cn(
        "relative flex flex-col bg-white items-center justify-center w-full h-full",
        tw,
      )}
    >
      <div
        tw="flex w-full h-full absolute inset-0"
        // not every css variable is supported
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 10%, transparent 10%)",
          backgroundSize: "16px 16px",
        }}
      />
      <div
        tw="flex w-full h-full absolute inset-0 opacity-70"
        style={{
          backgroundColor: "white",
          backgroundImage:
            "radial-gradient(farthest-corner at 100px 100px, #cbd5e1, white 80%)", // tbd: switch color position
        }}
      />
      {children}
    </div>
  );
}
