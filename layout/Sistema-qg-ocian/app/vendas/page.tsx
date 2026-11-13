import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Printer, Receipt, ShoppingCart } from "lucide-react";

export const metadata: Metadata = { title: "Vendas — QG Ocian" };

const PLANNED = [
  { icon: ShoppingCart, title: "Carrinho de venda", text: "Monte o pedido tocando nos produtos." },
  { icon: CreditCard, title: "Forma de pagamento", text: "Dinheiro, Pix, débito ou crédito." },
  { icon: Printer, title: "Impressão", text: "Comprovante na impressora térmica." },
  { icon: Receipt, title: "Cupom fiscal (NFC-e)", text: "Emissão integrada com a SEFAZ." },
];

export default function VendasPage() {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
        Em breve
      </span>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Vendas</h1>
      <p className="mt-2 text-muted">
        Esta aba vai registrar as vendas com pagamento e emitir cupom. Enquanto isso, as vendas seguem na maquininha e
        o controle do que sai fica na aba <strong className="text-ink">Saída</strong>.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {PLANNED.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-2xl border border-line bg-surface p-4">
            <Icon className="text-brand" aria-hidden />
            <p className="mt-2 font-bold">{title}</p>
            <p className="text-sm text-muted">{text}</p>
          </li>
        ))}
      </ul>
      <Link href="/saida" className="mt-6 inline-block rounded-xl bg-ink px-5 py-2.5 font-bold text-bg">
        Ir para Saída de produtos
      </Link>
    </div>
  );
}
