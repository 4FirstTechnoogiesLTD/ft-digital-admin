import { cn } from "@/lib/utils";

export function StatusBadge({ status, expired }: { status: string; expired?: boolean }) {
  const label = expired ? "expired" : status === "published" ? "open" : status.replace("_", " ");
  const tone =
    expired || status === "closed" || status === "rejected"
      ? "text-destructive"
      : status === "published" || status === "shortlisted" || status === "hired"
        ? "text-signal"
        : "text-muted-foreground";
  return <span className={cn("text-mono-label", tone)}>{label}</span>;
}

export const APPLICATION_STATUSES = [
  "received",
  "under_review",
  "shortlisted",
  "interview",
  "rejected",
  "hired",
  "withdrawn",
] as const;
