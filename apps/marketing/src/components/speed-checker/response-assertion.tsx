import {
  numberCompareDictionary,
  stringCompareDictionary,
} from "@openstatus/assertions";
import type { Assertion } from "@openstatus/assertions";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/src/components/table";

export function ResponseAssertion({ assertions }: { assertions: Assertion[] }) {
  return (
    <Table>
      <TableCaption className="mt-2">Response Assertions</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Source</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Comparison</TableHead>
          <TableHead>Target</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assertions.map((a, i) => {
          if (a.schema.type === "status") {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">
                  Status Code
                </TableCell>
                <TableCell />
                <TableCell>
                  {numberCompareDictionary[a.schema.compare]}
                </TableCell>
                <TableCell className="font-mono">{a.schema.target}</TableCell>
              </TableRow>
            );
          }
          if (a.schema.type === "header") {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">Header</TableCell>
                <TableCell className="font-mono">{a.schema.key}</TableCell>
                <TableCell>
                  {stringCompareDictionary[a.schema.compare]}
                </TableCell>
                <TableCell className="font-mono">{a.schema.target}</TableCell>
              </TableRow>
            );
          }
          return null;
        })}
      </TableBody>
    </Table>
  );
}
