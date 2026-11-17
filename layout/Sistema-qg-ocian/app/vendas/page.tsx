import type { Metadata } from "next";
import { VendasApp } from "@/components/vendas/VendasApp";

export const metadata: Metadata = { title: "Vendas — QG Ocian" };

export default function VendasPage() {
  return <VendasApp />;
}
