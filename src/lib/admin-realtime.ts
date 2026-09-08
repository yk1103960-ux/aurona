import type { RealtimeChannel } from "@supabase/supabase-js";

export type AdminRealtimeStatus = "connecting" | "live" | "disconnected";
let subscriptionSequence = 0;

/** One uniquely named channel per hook owner; disposal never affects another page. */
export function subscribeAdminChanges(
  client: {
    channel: (name: string) => RealtimeChannel;
    removeChannel: (channel: RealtimeChannel) => unknown;
  },
  tables: string[],
  onChange: () => void,
  onStatus: (status: AdminRealtimeStatus) => void,
  ownerId: string,
) {
  let disposed = false;
  let disconnected = false;
  // Cleanup is async in Supabase; a new effect must not reuse a closing channel.
  const channel = client.channel(`admin-${ownerId}-${++subscriptionSequence}`);
  const notify = () => {
    if (!disposed) onChange();
  };
  for (const table of new Set(tables)) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, notify);
  }
  onStatus("connecting");
  channel.subscribe((status) => {
    if (disposed) return;
    if (status === "SUBSCRIBED") {
      onStatus("live");
      if (disconnected) notify();
      disconnected = false;
    } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
      disconnected = true;
      onStatus("disconnected");
    }
  });
  return () => {
    disposed = true;
    void client.removeChannel(channel);
  };
}
