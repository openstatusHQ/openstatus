import { Container, Img, Link, Section } from "@react-email/components";
import { Footer } from "./footer";
import { styles } from "./styles";

interface LayoutProps {
  children?: React.ReactNode;
  img?: {
    src: string;
    alt: string;
  };
}

const defaultImg = {
  src: "https://openstatus.dev/assets/logos/OpenStatus.png",
  alt: "OpenStatus",
};

export function Layout({ children, img = defaultImg }: LayoutProps) {
  return (
    <Container style={styles.container}>
      <Link href="https://openstatus.dev">
        <Img src={img.src} width="36" height="36" alt={img.alt} />
      </Link>
      <Section style={styles.section}>{children}</Section>
      <Footer />
    </Container>
  );
}
