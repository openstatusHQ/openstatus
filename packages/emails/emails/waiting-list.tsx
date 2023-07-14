import { Body, Head, Html, Link, Preview } from "@react-email/components";

const WaitingList = () => {
  return (
    <Html>
      <Head>
        <title>Thanks for joining OpenStatus waiting list</title>
        <Preview>
          Thanks for joining OpenStatus waiting list waiting list
        </Preview>
        <Body>
          Hello,
          <br />
          <br />
          We are working hard to get you access to our app. You can follow our
          progress on our{" "}
          <Link href="https://github.com/mxkaske/openstatus">
            Github repository
          </Link>
          .
          <br />
          <br />
          If you have any questions, I will be happy to answer them.
          <br />
          <br />
          Thank you
          <br />
          Thibault Le Ouay Ducasse
        </Body>
      </Head>
    </Html>
  );
};

export default WaitingList;
