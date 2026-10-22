import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute('/aurona-console-9f2x7k/blog-system')({
  component: BlogSystem,
});

function BlogSystem() {
  return <Navigate to="/aurona-console-9f2x7k/editorial" replace />;
}
