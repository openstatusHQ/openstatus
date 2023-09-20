import {
  Skeleton, // @/components/skeleton
  Table, // @/components/table
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

const rows = 3;

export function DataTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead>
              <Skeleton className="my-2 h-6 w-24" />
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              <Skeleton className="my-2 h-6 w-32" />
            </TableHead>
            <TableHead className="hidden md:table-cell">
              <Skeleton className="my-2 h-6 w-16" />
            </TableHead>
            <TableHead>
              <Skeleton className="my-2 h-6 w-20" />
            </TableHead>
            <TableHead className="flex items-center justify-end"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {new Array(rows).fill(0).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell>
                <Skeleton className="my-2 h-6 w-full max-w-[10rem]" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="my-2 h-6 w-full max-w-[13rem]" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="my-2 h-6 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="my-2 h-6 w-full max-w-[10rem]" />
              </TableCell>
              <TableCell className="flex justify-end">
                <Skeleton className="my-2 h-6 w-6" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
