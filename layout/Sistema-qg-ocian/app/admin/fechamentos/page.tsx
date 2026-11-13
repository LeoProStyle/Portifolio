import type { Metadata } from "next";
import { ClosingsAdmin } from "@/components/admin/finance/ClosingsAdmin";

export const metadata: Metadata = { title: "Fechamentos — QG Ocian" };

export default function ClosingsPage() {
  return <ClosingsAdmin />;
}
