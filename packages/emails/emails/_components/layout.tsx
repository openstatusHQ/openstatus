/** @jsxImportSource react */

import { Container, Img, Link, Section } from "@react-email/components";
import type * as React from "react";
import { Footer } from "./footer";
import { styles } from "./styles";

interface LayoutProps {
  children?: React.ReactNode;
  img?: {
    src: string;
    alt: string;
    href: string;
  };
}

const defaultImg = {
  src: "https://openstatus.dev/assets/logos/OpenStatus.png",
  alt: "OpenStatus",
  href: "https://openstatus.dev",
};

export function Layout({ children, img = defaultImg }: LayoutProps) {
  return (
    <Container style={styles.container}>
      <Link href={img.href}>
        <Img src={img.src} width="36" height="36" alt={img.alt} />
      </Link>
      <Section style={styles.section}>{children}</Section>
      <Footer />
    </Container>
  );
}
