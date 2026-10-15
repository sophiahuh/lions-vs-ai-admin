/* eslint-disable @next/next/no-img-element */
export default function Avatar({
  url,
  name,
  size = 40,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?";

  return url ? (
    <img
      src={url}
      alt={name}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-cu-blue font-semibold text-navy"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}
