import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { api } from "@/trpc/server";

const RouteTable = async () => {
  const data = await api.rumRouter.GetAggregatedPerPage.query();
  if (!data) {
    return null;
  }
  return (
    <div className="">
      <h2 className="font-semibold text-lg">Page Performance</h2>
      <div className="">
        <Table>
          <TableCaption>An overview of your page performance.</TableCaption>
          <TableHeader>
            <TableRow className="sticky top-0">
              <TableHead className="w-4 max-w-6">Page</TableHead>
              <TableHead>Total Events</TableHead>
              <TableHead>CLS</TableHead>
              <TableHead>FCP</TableHead>
              <TableHead>INP</TableHead>
              <TableHead>LCP</TableHead>
              <TableHead>TTFB</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((page) => {
              return (
                <TableRow key={`${page.href}`}>
                  <TableCell className="w-2 max-w-6 truncate font-medium">
                    {page.href}
                  </TableCell>
                  <TableCell>{page.total_event}</TableCell>
                  <TableCell className="">
                    {page.clsValue?.toFixed(2)}
                  </TableCell>
                  <TableCell className="">
                    {page.fcpValue ? (page.fcpValue / 1000).toFixed(2) : "-"}
                  </TableCell>
                  <TableCell className="">
                    {page.inpValue ? (page.inpValue / 1000).toFixed(2) : "-"}
                  </TableCell>
                  <TableCell className="">
                    {page.lcpValue ? (page.lcpValue / 1000).toFixed(2) : "-"}
                  </TableCell>
                  <TableCell className="">
                    {page.ttfbValue ? (page.ttfbValue / 1000).toFixed(2) : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export { RouteTable };
