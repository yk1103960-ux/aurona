import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products/new")({
  component: () => <Navigate to="/admin/products/$id" params={{ id: "new" }} replace />,
});
