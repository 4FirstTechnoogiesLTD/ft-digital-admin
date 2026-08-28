export type FieldKind = "text" | "textarea" | "list";

export interface ShapeField {
  key: string;
  label: string;
  kind: FieldKind;
}

/** Field definitions per collection `item_shape`, mirroring the marketing site's data. */
export const SHAPES: Record<string, ShapeField[]> = {
  numbered: [
    { key: "n", label: "Number", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
  ],
  capability: [
    { key: "k", label: "Name", kind: "text" },
    { key: "d", label: "Description", kind: "textarea" },
  ],
  discipline: [
    { key: "n", label: "Number", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "tag", label: "Tag line", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
  ],
  service: [
    { key: "n", label: "Number", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "tag", label: "Tag line", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
    { key: "deliverables", label: "Deliverables", kind: "list" },
  ],
  process: [
    { key: "n", label: "Number", kind: "text" },
    { key: "t", label: "Title", kind: "text" },
    { key: "d", label: "Description", kind: "textarea" },
  ],
  stack_group: [
    { key: "k", label: "Group name", kind: "text" },
    { key: "items", label: "Items", kind: "list" },
  ],
  timeline: [
    { key: "y", label: "Year", kind: "text" },
    { key: "t", label: "Title", kind: "text" },
    { key: "d", label: "Description", kind: "textarea" },
  ],
  case: [
    { key: "year", label: "Year", kind: "text" },
    { key: "kind", label: "Kind", kind: "text" },
    { key: "tag", label: "Practice tag", kind: "text" },
    { key: "title", label: "Title", kind: "text" },
    { key: "body", label: "Body", kind: "textarea" },
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
  return d.title || d.k || d.t || d.year || d.n || "Untitled";
}
