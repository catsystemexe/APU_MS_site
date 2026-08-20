type ApuLogoProps = {
  className?: string;
  variant?: "flower" | "horizontal";
};

export default function ApuLogo({
  className = "",
  variant = "flower",
}: ApuLogoProps) {
  const source = variant === "horizontal"
    ? "/apu-logo-horizontal.png"
    : "/apu-flower.svg";

  return (
    <img
      className={`apu-logo apu-logo--${variant} ${className}`.trim()}
      src={source}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
