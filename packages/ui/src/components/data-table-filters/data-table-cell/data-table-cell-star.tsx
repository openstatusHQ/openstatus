import { Star } from "lucide-react";

export function DataTableCellStar({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className="ml-auto inline-flex items-center">
        <Star
          className="h-4 w-4 fill-yellow-400 text-yellow-400"
          aria-hidden="true"
        />
        <span className="sr-only">Favorited</span>
      </span>
    );
  }
  return (
    <span className="ml-auto inline-flex items-center">
      <Star className="text-muted-foreground/40 h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Not favorited</span>
    </span>
  );
}
