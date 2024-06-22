export default async function PagerDutyPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  console.log(searchParams.config);
  return <></>;
}
