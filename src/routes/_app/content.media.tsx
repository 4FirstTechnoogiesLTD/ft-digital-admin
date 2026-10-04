import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, Copy, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listMedia, recordMedia, updateMediaAlt, deleteMedia } from "@/fn/content";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/content/media")({
  loader: () => listMedia(),
  component: MediaLibrary,
});

function MediaLibrary() {
  const media = Route.useLoaderData();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const supabase = getSupabaseBrowserClient();
    try {
      for (const file of Array.from(files)) {
        const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.\- ]+/g, "_")}`;
        const { error } = await supabase.storage.from("media").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          toast.error(`Upload failed: ${file.name}`);
          continue;
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(path);
        await recordMedia({
          data: {
            path,
            url: publicUrl,
            size: file.size,
            content_type: file.type,
          },
        });
      }
      toast.success("Uploaded");
      router.invalidate();
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="§ Content"
        title="Media library"
        description="Images available to the marketing site. Public URLs — safe to embed anywhere."
        actions={
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 border border-border-strong bg-signal px-3 py-2 text-sm font-medium text-signal-foreground hover:brightness-110 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Upload
          </button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />

      <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        {media.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nothing uploaded yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {media.map((m) => (
              <MediaCard key={m.id} m={m} onChange={() => router.invalidate()} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MediaCard({
  m,
  onChange,
}: {
  m: { id: string; url: string; path: string; alt: string | null; content_type: string | null };
  onChange: () => void;
}) {
  const [alt, setAlt] = useState(m.alt ?? "");
  return (
    <div className="border border-border bg-surface">
      <div className="aspect-video overflow-hidden bg-background">
        <img src={m.url} alt={m.alt ?? ""} className="h-full w-full object-contain" />
      </div>
      <div className="space-y-2 p-3">
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={async () => {
            if (alt !== (m.alt ?? "")) {
              await updateMediaAlt({ data: { id: m.id, alt } });
              onChange();
            }
          }}
          placeholder="Alt text"
          className="w-full border border-border bg-background/50 px-2 py-1.5 text-xs focus:border-signal focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              navigator.clipboard.writeText(m.url);
              toast.success("URL copied");
            }}
            className="flex items-center gap-1 text-mono-label hover:text-foreground"
          >
            <Copy className="size-3" /> Copy URL
          </button>
          <button
            onClick={async () => {
              if (!confirm("Delete this image?")) return;
              await deleteMedia({ data: { id: m.id, path: m.path } });
              toast.success("Deleted");
              onChange();
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
