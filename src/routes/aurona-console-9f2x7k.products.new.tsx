import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/new")({
  component: () => <Navigate to="/aurona-console-9f2x7k/products/$id" params={{ id: "new" }} replace />,
});
