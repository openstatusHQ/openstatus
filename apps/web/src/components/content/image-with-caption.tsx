// TODO: use following instead https://github.com/rehypejs/rehype-unwrap-images
// as figcaption is supported in prose plugin https://github.com/tailwindlabs/tailwindcss-typography?tab=readme-ov-file#element-modifiers

export interface ImageWithCaptionProps {
  src: string;
  alt?: string;
  caption: string;
}

export function ImageWithCaption({ src, alt, caption }: ImageWithCaptionProps) {
  return (
    <figure>
      <figcaption>{caption}</figcaption>
      <img src={src} alt={alt ?? caption} />
    </figure>
  );
}
