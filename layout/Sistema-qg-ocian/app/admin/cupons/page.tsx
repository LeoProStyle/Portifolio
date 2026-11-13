import type { Metadata } from "next";
import { InvoicesAdmin } from "@/components/admin/finance/InvoicesAdmin";

export const metadata: Metadata = { title: "Cupons — QG Ocian" };

export default function InvoicesPage() {
  return <InvoicesAdmin />;
}
