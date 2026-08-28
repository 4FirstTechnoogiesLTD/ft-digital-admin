import { cn } from "@/lib/utils";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-mono-label mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-signal focus:outline-none"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-mono-label mb-1.5 block">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-y border border-border bg-background/50 px-3 py-2.5 text-sm leading-relaxed focus:border-signal focus:outline-none"
      />
    </label>
  );
}

export function ListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <span className="text-mono-label mb-1.5 block">{label}</span>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={v}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="w-full border border-border bg-background/50 px-3 py-2 text-sm focus:border-signal focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="shrink-0 border border-border px-2 text-xs text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          className="text-mono-label hover:text-foreground"
        >
          + Add row
        </button>
      </div>
    </div>
  );
}
