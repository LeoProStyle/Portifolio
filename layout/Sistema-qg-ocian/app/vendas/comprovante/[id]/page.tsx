import type { Metadata } from "next";
import { Receipt } from "@/components/vendas/Receipt";

export const metadata: Metadata = { title: "Comprovante — QG Ocian" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> };

export default async function ReceiptPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { print } = await searchParams;
  return <Receipt id={id} autoPrint={print === "1"} />;
}
