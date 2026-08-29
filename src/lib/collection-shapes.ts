export type FieldKind = "text" | "textarea" | "list";

export interface ShapeField {
  key: string;
  label: string;
  kind: FieldKind;
}

/**
 * Field definitions per collection `item_shape`, mirroring the marketing site's
 * data model (`web-unwrapped-3d/src/content/defaults.ts`).
 */
export const SHAPES: Record<string, ShapeField[]> = {
  // Numbered "step" card — n / title / description (home principles & capabilities,
  // services process, products "how it works").
  step: [
    { key: "n", label: "Number", kind: "text" },
    { key: "t", label: "Title", kind: "text" },
    { key: "d", label: "Description", kind: "textarea" },
  ],
  // About — "what we build" disciplines.
  discipline: [
    { key: "n", label: "Number", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "tag", label: "Tag line", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
  ],
  // Numbered prose point — n / title / body (about convictions, mission points,
  // products audiences).
  point: [
    { key: "n", label: "Number", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
  ],
  // Services — practice with deliverables.
  service: [
    { key: "n", label: "Number", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "tag", label: "Tag line", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
    { key: "deliverables", label: "Deliverables", kind: "list" },
  ],
  // Work — selected case.
  case: [
    { key: "year", label: "Year", kind: "text" },
    { key: "kind", label: "Kind", kind: "text" },
    { key: "tag", label: "Practice tag", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
  ],
  // About — timeline row.
  timeline: [
    { key: "y", label: "Year", kind: "text" },
    { key: "t", label: "Title", kind: "text" },
    { key: "d", label: "Description", kind: "textarea" },
  ],
  // Vision — numbered point with optional pull-quote / arrow chain / bullet list.
  vision_point: [
    { key: "n", label: "Number", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
    { key: "quote", label: "Pull quote (optional)", kind: "textarea" },
    { key: "chain", label: "Arrow chain (optional)", kind: "text" },
    { key: "list", label: "Bullet list (optional)", kind: "list" },
  ],
  // Bare list entry — a single label (products platform, contact interests).
  feature: [{ key: "label", label: "Label", kind: "text" }],
  // Standalone narrative / section-intro block. Single row per collection.
  // Use `body` for paragraphs (blank line between each), `quote` for a blockquote.
  prose: [
    { key: "eyebrow", label: "Eyebrow", kind: "text" },
    { key: "heading", label: "Heading (wrap accent in [[brackets]])", kind: "text" },
    { key: "body", label: "Body paragraphs (blank line between each)", kind: "textarea" },
    { key: "quote", label: "Blockquote", kind: "textarea" },
    { key: "footnote", label: "Footnote line", kind: "textarea" },
  ],
  generic: [
    { key: "title", label: "Title", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
  ],
};

export function shapeFields(shape: string): ShapeField[] {
  return SHAPES[shape] ?? SHAPES.generic;
}

export function itemHeadline(shape: string, data: Record<string, unknown>): string {
  const d = data as Record<string, string>;
  return (
    d.title || d.heading || d.label || d.t || d.eyebrow || d.year || d.n || d.y || "Untitled"
  );
}
