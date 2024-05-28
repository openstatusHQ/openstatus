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
import { Tab } from "@tremor/react";

const RouteTable = async ({ dsn }: { dsn: string }) => {
  const data = await api.tinybird.rumMetricsForApplicationPerPage.query({
    dsn: dsn,
  });
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
              <TableHead className="w-4 max-w-6">Pages</TableHead>
              <TableHead>Total Session</TableHead>
              <TableHead>CLS</TableHead>
              <TableHead>FCP</TableHead>
              <TableHead>LCP</TableHead>
              <TableHead>TTFB</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => {
              return (
                <TableRow key={d.href}>
                  <TableCell>{d.path}</TableCell>
                  <TableCell>{d.totalSession}</TableCell>
                  <TableCell>{d.cls === 0 ? "-" : d.cls.toFixed(2)}</TableCell>
                  <TableCell>{d.fcp === 0 ? "-" : d.fcp.toFixed(0)}</TableCell>
                  <TableCell> {d.lcp === 0 ? "-" : d.lcp.toFixed(0)}</TableCell>
                  <TableCell>
                    {d.ttfb === 0 ? "-" : d.ttfb.toFixed(0)}
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
