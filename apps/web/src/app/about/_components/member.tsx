import Image from "next/image";

export interface MemberProps {
  name: string;
  role: string;
  image: { src: string };
  socials?: { label: string; href: string }[];
}

export function Member({ name, role, image, socials }: MemberProps) {
  return (
    <div className="grid w-full gap-3">
      <div className="border-border relative aspect-square max-h-48 overflow-hidden rounded-lg border">
        <Image src={image.src} alt={name} layout="fill" objectFit="contain" />
      </div>
      <div className="grid gap-1">
        <h3 className="font-medium">{name}</h3>
        <p className="text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}
