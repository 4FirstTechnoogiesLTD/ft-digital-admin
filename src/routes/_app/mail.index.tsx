import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/_app/mail/")({
  component: () => (
    <div className="grid h-full place-items-center text-center">
      <div>
        <Mail className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-mono-label">Select a conversation</p>
      </div>
    </div>
  ),
});
