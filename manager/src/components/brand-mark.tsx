export function BrandMark({
  large = false,
  src = "/brand/wild-bean-logo.jpg",
}: {
  large?: boolean;
  src?: string;
}) {
  return (
    <div
      className={large ? "brand-mark brand-mark-large" : "brand-mark"}
      aria-hidden="true"
    >
      <img src={src} alt="" />
    </div>
  );
}
