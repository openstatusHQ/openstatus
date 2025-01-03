/** @jsxImportSource react */

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
  Text,
} from "@react-email/components";

interface AlertProps {
  monitorName: string;
  monitorUrl: string;
  recipientName: string;
}

const Alert = ({ monitorName, monitorUrl, recipientName }: AlertProps) => {
  return (
    <Html>
      <Head>
        <title>New incident detected 🚨</title>
        <Preview>New incident detected : {monitorName} 🚨</Preview>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-[40px] w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              New incident detected!
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">
              Hello {recipientName}, <br />
              We have detected a new incident.
            </Text>

            <Section className="my-[30px] rounded border border-gray-200 border-solid bg-gray-100 p-2">
              <Row>
                <Column className="text-lg">Monitor</Column>
                <Column>{monitorName}</Column>
              </Row>
              <Row className="mt-2">
                <Column className="text-lg">URL</Column>
                <Column>{monitorUrl}</Column>
              </Row>
            </Section>

            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[14px] text-white no-underline"
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

Alert.PreviewProps = {
  monitorName: "My Monitor",
  monitorUrl: "https://www.example.com",
  recipientName: "John Doe",
} satisfies AlertProps;

export { Alert };
export default Alert;
