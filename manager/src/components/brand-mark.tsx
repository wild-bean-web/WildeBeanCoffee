import Image from "next/image";

export function BrandMark({
  large = false,
}: {
  large?: boolean;
}) {
  return (
    <div
      className={large ? "brand-mark brand-mark-large" : "brand-mark"}
      aria-hidden="true"
    >
      <Image
        src="/brand/wild-bean-logo.jpg"
        alt=""
        width={512}
        height={512}
        priority={large}
      />
    </div>
  );
}
