import { useQuery } from "@tanstack/react-query";
import { getBroadcastProgress } from "@/fn/broadcast";

/** Live progress strip for a queued broadcast. Polls until the queue is empty. */
export function BroadcastProgress({
  broadcastId,
  onDismiss,
}: {
  broadcastId: string;
  onDismiss: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["mail", "broadcast", broadcastId],
    queryFn: () => getBroadcastProgress({ data: { broadcastId } }),
    refetchInterval: (q) => (q.state.data && q.state.data.queued === 0 ? false : 2500),
  });
  if (!data) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-2 border border-border bg-surface px-4 py-2 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">
        {data.queued > 0
          ? `Sending “${data.subject}” · ${data.sent}/${data.total} sent`
          : `Broadcast done · ${data.sent}/${data.total} sent`}
        {data.failed > 0 && ` · ${data.failed} failed`}
      </span>
      {data.queued === 0 && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
