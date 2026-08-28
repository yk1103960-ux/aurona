import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/customer-service")({
  beforeLoad: () => {
    throw redirect({ to: "/faq" });
  },
});
