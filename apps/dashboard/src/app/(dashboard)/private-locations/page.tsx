import type { SearchParams } from "nuqs";
import { Client } from "./client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return <Client />;
}
