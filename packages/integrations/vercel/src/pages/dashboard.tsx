import { BarList, Bold, Card, Flex, Text, Title } from "@tremor/react";

import { getRequestByStatusCode } from "../libs/tinybird";

const VercelDashboardPage = async ({
  params,
}: {
  params: { projectId: string };
}) => {
  console.log(params.projectId);
  const d = await getRequestByStatusCode({
    projectId: params.projectId,
  });
  console.log(d);

  const data = d.data.map((item) => {
    return {
      name: String(item.statusCode),
      value: item.count,
    };
  });

  console.log(data);
  return (
    <>
      <Card className="max-w-lg">
        <Title>Request by status</Title>
        <Flex className="mt-4">
          <Text>
            <Bold>Status code</Bold>
          </Text>
          <Text>
            <Bold>Nb</Bold>
          </Text>
        </Flex>
        <BarList data={data} className="mt-2" />
      </Card>
    </>
  );
};

export { VercelDashboardPage };
