import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Link2,
  Undo2,
  Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tiptapExtensions } from "@/lib/tiptap";

interface Props {
  value: JSONContent | null | undefined;
  onChange: (doc: JSONContent) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
}

export function RichEditor({ value, onChange, placeholder, className, minHeight = 160 }: Props) {
  const editor = useEditor({
    extensions: [
      ...tiptapExtensions,
      Placeholder.configure({ placeholder: placeholder ?? "Write…" }),
    ],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: "prose-editorial tiptap focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  // keep external value in sync when it changes structurally (e.g. switching records)
  useEffect(() => {
    if (!editor || !value) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(value)) {
      editor.commands.setContent(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, JSON.stringify(value)]);

  if (!editor) return null;

  return (
    <div className={cn("border border-border bg-background/50", className)}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-background p-1">
        <Btn on={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-3.5" />
        </Btn>
        <Btn
          on={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </Btn>
        <Btn
          on={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-3.5" />
        </Btn>
        <Sep />
        <Btn
          on={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-3.5" />
        </Btn>
        <Btn
          on={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="size-3.5" />
        </Btn>
        <Sep />
        <Btn
          on={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </Btn>
        <Btn
          on={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </Btn>
        <Btn
          on={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-3.5" />
        </Btn>
        <Btn
          on={editor.isActive("link")}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") editor.chain().focus().unsetLink().run();
            else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <Link2 className="size-3.5" />
        </Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="size-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="size-3.5" />
        </Btn>
      </div>
      <div className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  on,
}: {
  children: React.ReactNode;
  onClick: () => void;
  on?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded transition-colors",
        on ? "bg-signal text-signal-foreground" : "text-muted-foreground hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-4 w-px bg-border" />;
}
