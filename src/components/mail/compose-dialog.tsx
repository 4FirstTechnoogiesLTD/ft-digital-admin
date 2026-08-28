import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageComposer, type ComposerDefaults } from "@/components/mail/message-composer";
import type { JSONContent } from "@tiptap/react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mailbox: { address: string; displayName: string; signature?: JSONContent | null } | null;
  defaults?: ComposerDefaults;
  onSent: (threadId: string) => void;
}

export function ComposeDialog({ open, onOpenChange, mailbox, defaults, onSent }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-display text-2xl">New message</DialogTitle>
        </DialogHeader>
        <MessageComposer
          mailbox={mailbox}
          defaults={defaults}
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
