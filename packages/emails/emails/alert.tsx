import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import { z } from "zod";

export const EmailDataSchema = z.object({
  monitorName: z.string(),
  monitorUrl: z.string().url(),
  recipientName: z.string(),
});

const Alert = ({ data }: { data: z.infer<typeof EmailDataSchema> }) => {
  return (
    <Html>
      <Head>
        <title>New incident detected 🚨</title>
        <Preview>New incident detected : {data.monitorName} 🚨</Preview>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-[40px] w-[465px] rounded border border-solid border-[#eaeaea] p-[20px]">
            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
              New incident detected!
            </Heading>
            <Text className="text-[14px] leading-[24px] text-black">
              Hello {data.recipientName}, <br />
              We have detected a new incident.
            </Text>

            <Section className="my-[30px]  rounded border border-solid border-gray-200 bg-gray-100 p-2">
              <Row>
                <Column className="text-lg">Monitor</Column>
                <Column>{data.monitorName}</Column>
              </Row>
              <Row className="mt-2">
                <Column className="text-lg">URL</Column>
                <Column>{data.monitorUrl}</Column>
              </Row>
            </Section>

            <Section className="mb-[32px] mt-[32px] text-center">
              <Button
                pX={20}
                pY={12}
                className="rounded bg-[#000000] text-center text-[14px] font-semibold text-white no-underline"
                href="https://www.openstatus.dev/app"
              >
                See incident
              </Button>
            </Section>
          </Container>
        </Body>
      </Head>
    </Html>
  );
};

export default Alert;
