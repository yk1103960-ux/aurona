import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute('/aurona-console-9f2x7k/affiliate-system')({
  component: AffiliateSystem,
});

function AffiliateSystem() {
  return <Navigate to="/aurona-console-9f2x7k/affiliates" replace />;
}
