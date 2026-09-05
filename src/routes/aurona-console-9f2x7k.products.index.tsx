import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute(
  "/aurona-console-9f2x7k/products/new",
)({
  component: NewProductPage,
});

function NewProductPage() {
  useEffect(() => {
    window.location.replace(
      "/aurona-console-9f2x7k/products/new-product",
    );
  }, []);

  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="text-sm text-slate-500">
        Opening product editor…
      </div>
    </div>
  );
}
}