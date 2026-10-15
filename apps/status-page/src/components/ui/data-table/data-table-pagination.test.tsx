import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";

import { DataTableColumnHeader } from "./data-table-column-header";
import {
  DataTablePagination,
  DataTablePaginationSimple,
} from "./data-table-pagination";

type Row = { n: number };
const rows: Row[] = Array.from({ length: 25 }, (_, n) => ({ n }));

function Pagination({
  pageIndex,
  selected = {},
  simple = false,
}: {
  pageIndex: number;
  selected?: Record<string, boolean>;
  simple?: boolean;
}) {
  const table = useReactTable({
    data: rows,
    columns: [{ accessorKey: "n" }],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex, pageSize: 10 },
      rowSelection: selected,
    },
  });
  return simple ? (
    <DataTablePaginationSimple table={table} />
  ) : (
    <DataTablePagination table={table} />
  );
}

function render(props: Parameters<typeof Pagination>[0]) {
  return renderToStaticMarkup(<Pagination {...props} />);
}

function disabledButtons(html: string) {
  return [...html.matchAll(/<button([^>]*)>\s*<span[^>]*>([^<]+)<\/span>/g)]
    .filter((m) => m[1].includes('disabled=""'))
    .map((m) => m[2]);
}

describe("DataTablePagination", () => {
  it("shows the current page and selection count", () => {
    const html = render({ pageIndex: 1, selected: { "0": true, "3": true } });
    expect(html).toContain("2 of 25 row(s) selected.");
    expect(html).toContain("Page 2 of 3");
  });

  it("disables backwards navigation on the first page", () => {
    expect(disabledButtons(render({ pageIndex: 0 }))).toEqual([
      "Go to first page",
      "Go to previous page",
    ]);
  });

  it("disables forwards navigation on the last page", () => {
    expect(disabledButtons(render({ pageIndex: 2 }))).toEqual([
      "Go to next page",
      "Go to last page",
    ]);
  });

  it("enables everything on a middle page", () => {
    expect(disabledButtons(render({ pageIndex: 1 }))).toEqual([]);
  });
});

describe("DataTablePaginationSimple", () => {
  it("shows the filtered row count", () => {
    expect(render({ pageIndex: 0, simple: true })).toContain(
      "25 of 25 row(s) filtered.",
    );
  });
});

describe("DataTableColumnHeader", () => {
  function Header({
    sorting,
    enableSorting = true,
  }: {
    sorting: SortingState;
    enableSorting?: boolean;
  }) {
    const columns: ColumnDef<Row>[] = [
      {
        accessorKey: "n",
        enableSorting,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Number" />
        ),
      },
    ];
    const table = useReactTable({
      data: rows,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      state: { sorting },
    });
    const header = table.getHeaderGroups()[0].headers[0];
    const render = header.column.columnDef.header;
    return typeof render === "function" ? render(header.getContext()) : null;
  }

  function chevronClasses(html: string) {
    return [...html.matchAll(/<svg[^>]*class="([^"]*)"/g)].map((m) =>
      m[1].includes("text-accent-foreground") ? "active" : "idle",
    );
  }

  it("renders plain text for a column that cannot sort", () => {
    const html = renderToStaticMarkup(
      <Header sorting={[]} enableSorting={false} />,
    );
    expect(html).toMatch(/^<div[^>]*>Number<\/div>$/);
  });

  it("highlights the active sort direction", () => {
    expect(
      chevronClasses(
        renderToStaticMarkup(<Header sorting={[{ id: "n", desc: false }]} />),
      ),
    ).toEqual(["active", "idle"]);
    expect(
      chevronClasses(
        renderToStaticMarkup(<Header sorting={[{ id: "n", desc: true }]} />),
      ),
    ).toEqual(["idle", "active"]);
    expect(
      chevronClasses(renderToStaticMarkup(<Header sorting={[]} />)),
    ).toEqual(["idle", "idle"]);
  });
});
