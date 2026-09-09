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
      <DialogContent className="max-h-[90dvh] max-w-2xl">
        <DialogHeader className="sticky top-0 z-10 -mx-6 -mt-6 bg-background px-6 pb-3 pr-12 pt-6">
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
