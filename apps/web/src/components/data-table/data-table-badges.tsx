import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

export function DataTableBadges({ names }: { names: string[] }) {
  const [first, second, ...rest] = names;

  if (names.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="flex max-w-[150px] gap-2 truncate font-medium sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[350px]">
        <Badge variant="outline">{first}</Badge>
        {second ? <Badge variant="outline">{second}</Badge> : null}
      </span>
      {rest.length > 0 ? (
        <TooltipProvider>
          <Tooltip delayDuration={200}>
            <TooltipTrigger>
              <Badge variant="secondary" className="border">
                +{rest.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="flex gap-2">
              {rest.map((name, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                <Badge key={i} variant="outline">
                  {name}
                </Badge>
              ))}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
