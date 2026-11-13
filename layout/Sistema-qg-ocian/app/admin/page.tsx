import type { Metadata } from "next";
import { ProductsAdmin } from "@/components/admin/ProductsAdmin";

export const metadata: Metadata = { title: "Admin — QG Ocian" };

export default function AdminPage() {
  return <ProductsAdmin />;
}
