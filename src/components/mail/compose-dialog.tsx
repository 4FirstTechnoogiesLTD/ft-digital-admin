import { Sun, Moon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageComposer, type ComposerDefaults } from "@/components/mail/message-composer";
import { useMailBodyTheme } from "@/hooks/use-mail-body-theme";
import type { JSONContent } from "@tiptap/react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mailbox: { address: string; displayName: string; signature?: JSONContent | null } | null;
  defaults?: ComposerDefaults;
  onSent: (threadId: string) => void;
}

export function ComposeDialog({ open, onOpenChange, mailbox, defaults, onSent }: Props) {
  const { lightBody, toggleBodyTheme } = useMailBodyTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl">
        <DialogHeader className="sticky top-0 z-10 -mx-6 -mt-6 flex-row items-center justify-between gap-2 space-y-0 bg-background px-6 pb-3 pr-12 pt-6">
          <DialogTitle className="text-display text-2xl">New message</DialogTitle>
          <button
            type="button"
            onClick={toggleBodyTheme}
            title={lightBody ? "Dark email background" : "White email background"}
            className="grid size-8 place-items-center rounded text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {lightBody ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>
        </DialogHeader>
        <MessageComposer
          mailbox={mailbox}
          defaults={defaults}
          lightBody={lightBody}
          onSent={(id) => {
            onOpenChange(false);
            onSent(id);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
