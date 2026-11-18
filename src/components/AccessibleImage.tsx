import Image, { type ImageProps } from "next/image";

/* ══ AccessibleImage.tsx — accessibility-enforced image wrapper ═════ */
interface AccessibleImageProps extends Omit<ImageProps, "alt"> {
  alt: string; // Enforce non-optional, descriptive alt text
  caption?: string;
}

export default function AccessibleImage({ alt, caption, ...props }: AccessibleImageProps) {
  if (!caption) {
    return <Image alt={alt} {...props} />;
  }

  return (
    <figure className="inline-block">
      <Image alt={alt} {...props} />
      <figcaption className="text-xs text-cocoa/70 mt-1.5 text-center">
        {caption}
      </figcaption>
    </figure>
  );
}
