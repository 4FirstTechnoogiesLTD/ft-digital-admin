import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, GripVertical, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  getCollection,
  upsertCollectionItem,
  deleteCollectionItem,
  reorderCollection,
} from "@/fn/content";
import { PageHeader } from "@/components/page-header";
import { Field, TextArea, ListField } from "@/components/content/fields";
import { shapeFields, itemHeadline } from "@/lib/collection-shapes";

export const Route = createFileRoute("/_app/content/collections/$key")({
  loader: ({ params }) => getCollection({ data: { key: params.key } }),
  component: CollectionEditor,
});

type Item = {
  id: string;
  collection_key: string;
  position: number;
  data: Record<string, any>;
  is_published: boolean;
};

function CollectionEditor() {
  const { key } = Route.useParams();
  const { collection, items: loaded } = Route.useLoaderData();
  const router = useRouter();
  const fields = shapeFields(collection.item_shape);

  const [items, setItems] = useState<Item[]>(loaded as Item[]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    try {
      await reorderCollection({ data: { key, orderedIds: next.map((i) => i.id) } });
    } catch {
      toast.error("Reorder failed");
      router.invalidate();
    }
  }

  function startEdit(item: Item) {
    setEditing(item.id);
    setDraft({ ...item.data });
  }
  function startNew() {
    setEditing("new");
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.kind === "list" ? [] : ""])));
  }

  async function saveDraft() {
    try {
      await upsertCollectionItem({
        data: {
          id: editing && editing !== "new" ? editing : undefined,
          collection_key: key,
          data: draft,
          is_published: true,
        },
      });
      toast.success("Saved");
      setEditing(null);
      router.invalidate();
      const fresh = await getCollection({ data: { key } });
      setItems(fresh.items as Item[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function togglePublish(item: Item) {
    setItems((xs) =>
      xs.map((x) => (x.id === item.id ? { ...x, is_published: !x.is_published } : x)),
    );
    await upsertCollectionItem({
      data: {
        id: item.id,
        collection_key: key,
        data: item.data,
        is_published: !item.is_published,
      },
    });
    router.invalidate();
  }

  async function remove(id: string) {
    if (!confirm("Delete this item?")) return;
    setItems((xs) => xs.filter((x) => x.id !== id));
    await deleteCollectionItem({ data: { id } });
    toast.success("Deleted");
    router.invalidate();
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/content" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="size-3" /> Content
          </Link>
        }
        title={collection.label}
        description={collection.key}
        actions={
          <button
            onClick={startNew}
            className="inline-flex items-center gap-1.5 border border-border-strong bg-signal px-3 py-2 text-sm font-medium text-signal-foreground hover:brightness-110"
          >
            <Plus className="size-3.5" /> Add item
          </button>
        }
      />

      <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  shape={collection.item_shape}
                  isEditing={editing === item.id}
                  onEdit={() => startEdit(item)}
                  onCancel={() => setEditing(null)}
                  onTogglePublish={() => togglePublish(item)}
                  onDelete={() => remove(item.id)}
                >
                  {editing === item.id && (
                    <ItemForm
                      fields={fields}
                      draft={draft}
                      setDraft={setDraft}
                      onSave={saveDraft}
                      onCancel={() => setEditing(null)}
                    />
                  )}
                </SortableRow>
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {editing === "new" && (
          <div className="mt-4 border border-border-strong bg-surface p-5">
            <div className="text-mono-label mb-3">New item</div>
            <ItemForm
              fields={fields}
              draft={draft}
              setDraft={setDraft}
              onSave={saveDraft}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        {items.length === 0 && editing !== "new" && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No items yet. Add the first one.
          </p>
        )}
      </div>
    </>
  );
}

function SortableRow({
  item,
  shape,
  isEditing,
  onEdit,
  onTogglePublish,
  onDelete,
  children,
}: {
  item: Item;
  shape: string;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="border border-border bg-surface">
      <div className="flex items-center gap-3 px-3 py-3">
        <button
          className="cursor-grab text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button onClick={onEdit} className="min-w-0 flex-1 truncate text-left text-sm">
          {itemHeadline(shape, item.data)}
        </button>
        {!item.is_published && (
          <span className="text-mono-label text-muted-foreground">hidden</span>
        )}
        <button
          onClick={onTogglePublish}
          title={item.is_published ? "Hide from site" : "Show on site"}
          className="text-muted-foreground hover:text-foreground"
        >
          {item.is_published ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      </div>
      {isEditing && <div className="border-t border-border p-4 sm:p-5">{children}</div>}
    </li>
  );
}

function ItemForm({
  fields,
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  fields: ReturnType<typeof shapeFields>;
  draft: Record<string, any>;
  setDraft: (d: Record<string, any>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function set(k: string, v: any) {
    setDraft({ ...draft, [k]: v });
  }
  return (
    <div className="space-y-4">
      {fields.map((f) =>
        f.kind === "list" ? (
          <ListField
            key={f.key}
            label={f.label}
            values={Array.isArray(draft[f.key]) ? draft[f.key] : []}
            onChange={(v) => set(f.key, v)}
          />
        ) : f.kind === "textarea" ? (
          <TextArea
            key={f.key}
            label={f.label}
            value={draft[f.key] ?? ""}
            onChange={(v) => set(f.key, v)}
            rows={4}
          />
        ) : (
          <Field
            key={f.key}
            label={f.label}
            value={draft[f.key] ?? ""}
            onChange={(v) => set(f.key, v)}
          />
        ),
      )}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="border border-border-strong bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Save item
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
