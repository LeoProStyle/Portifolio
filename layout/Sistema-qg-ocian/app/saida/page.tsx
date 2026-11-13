import type { Metadata } from "next";
import { SaidaBoard } from "@/components/saida/SaidaBoard";

export const metadata: Metadata = { title: "Saída de produtos — QG Ocian" };

export default function SaidaPage() {
  return <SaidaBoard />;
}
