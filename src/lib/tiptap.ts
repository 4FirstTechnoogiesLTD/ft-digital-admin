import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { JSONContent } from "@tiptap/react";
import { generateHTML } from "@tiptap/html";

export const tiptapExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    codeBlock: false,
    horizontalRule: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: { rel: "noopener noreferrer nofollow" },
  }),
];

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function docToHtml(doc: JSONContent | null | undefined): string {
  if (!doc || !doc.type) return "";
  try {
    return generateHTML(doc, tiptapExtensions);
  } catch {
    return "";
  }
}

export function isEmptyDoc(doc: JSONContent | null | undefined): boolean {
  if (!doc?.content?.length) return true;
  return !doc.content.some((n) => (n.content?.length ?? 0) > 0 || n.type === "image");
}
