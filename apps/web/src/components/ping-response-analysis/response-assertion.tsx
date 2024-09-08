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
import { nanoid } from "nanoid";

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
        {assertions.map((a) => {
          if (a.schema.type === "status") {
            return (
              <TableRow key={`response-assertion-${nanoid(6)}`}>
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
              <TableRow key={`response-assertion-${nanoid(6)}`}>
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
