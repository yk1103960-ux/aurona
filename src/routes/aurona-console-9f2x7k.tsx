import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/aurona-console-9f2x7k")({
  head: () => ({ meta: [{ title: "Admin — Aurona", name: "robots", content: "noindex" }] }),
  component: AdminShell,
});
