import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-4 py-5 sm:px-6 sm:py-6 md:px-10 md:py-8">
      <div className="min-w-0">
        {eyebrow && <div className="text-mono-label">{eyebrow}</div>}
        <h1 className="text-display mt-2 break-words text-2xl sm:text-3xl md:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed [overflow-wrap:anywhere]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
