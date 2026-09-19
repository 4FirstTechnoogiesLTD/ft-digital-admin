import { cn } from "@/lib/utils";

/** Stable hue per address so the same sender always gets the same colour. */
function hueFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function initialsFor(name: string | null | undefined, email: string) {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0][0];
    return letters.toUpperCase();
  }
  return (email.trim()[0] ?? "?").toUpperCase();
}

interface Props {
  email: string;
  name?: string | null;
  src?: string | null;
  /** px — the box is square. */
  size?: number;
  className?: string;
}

/**
 * Sender portrait. Falls back to coloured initials when we have no image, which
 * is the common case for external correspondents.
 */
export function UserAvatar({ email, name, src, size = 36, className }: Props) {
  const hue = hueFor(email.toLowerCase() || "?");
  return (
    <span
      className={cn(
        "inline-grid shrink-0 select-none place-items-center overflow-hidden rounded-full border border-border",
        className,
      )}
      style={{ width: size, height: size }}
      title={name ? `${name} · ${email}` : email}
    >
      {src ? (
        <img src={src} alt="" width={size} height={size} className="size-full object-cover" />
      ) : (
        <span
          className="grid size-full place-items-center font-medium"
          style={{
            fontSize: Math.max(10, Math.round(size * 0.38)),
            backgroundColor: `hsl(${hue} 45% 88%)`,
            color: `hsl(${hue} 55% 28%)`,
          }}
        >
          {initialsFor(name, email)}
        </span>
      )}
    </span>
  );
}
