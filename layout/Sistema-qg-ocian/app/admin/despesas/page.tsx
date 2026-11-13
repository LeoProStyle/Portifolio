import type { Metadata } from "next";
import { ExpensesAdmin } from "@/components/admin/finance/ExpensesAdmin";

export const metadata: Metadata = { title: "Despesas — QG Ocian" };

export default function ExpensesPage() {
  return <ExpensesAdmin />;
}
