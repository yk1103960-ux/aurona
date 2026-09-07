import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "./aurona-console-9f2x7k.products.$id";

export const Route = createFileRoute("/aurona-console-9f2x7k/products/new")({
  component: NewProduct,
});

function NewProduct() {
  return <ProductEditor productId="new" />;
}
