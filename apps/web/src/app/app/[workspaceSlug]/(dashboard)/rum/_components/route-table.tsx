import {
  Table,
  TableCaption,
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
              <TableHead className="max-w-6 w-4">Page</TableHead>
              <TableHead>Total Events</TableHead>
              <TableHead>CLS</TableHead>
              <TableHead>FCP</TableHead>
              <TableHead>INP</TableHead>
              <TableHead>LCP</TableHead>
              <TableHead>TTFB</TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>
    </div>
  );
};

export { RouteTable };
