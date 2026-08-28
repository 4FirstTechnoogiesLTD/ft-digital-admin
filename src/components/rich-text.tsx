import type { JSONContent } from "@tiptap/react";
import { docToHtml } from "@/lib/tiptap";
import { cn } from "@/lib/utils";

/** Renders a stored Tiptap document as styled HTML. */
export function RichText({
  doc,
  className,
}: {
  doc: JSONContent | null | undefined;
  className?: string;
}) {
  const html = docToHtml(doc);
  if (!html) return null;
  return (
    <div className={cn("prose-editorial", className)} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
