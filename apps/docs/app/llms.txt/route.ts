import { NextResponse } from "next/server";

const content = `# openstatus docs

> openstatus is an open-source status page platform with global monitoring (HTTP, TCP, DNS).

## Documentation Sets

- [Abridged documentation](https://docs.openstatus.dev/llms-small.txt): a compact version of the documentation for openstatus docs, with non-essential content removed
- [Complete documentation](https://docs.openstatus.dev/llms-full.txt): the full documentation for openstatus docs

## Notes

- The complete documentation includes all content from the official documentation
- The content is automatically generated from the same source as the official documentation
`;

export function GET() {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
