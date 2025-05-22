import CheckoutClient from '@/components/checkout/CheckoutClient';
import { mockTables } from '@/data/mockData';

// Esta função é necessária para o Next.js gerar as páginas estáticas
export function generateStaticParams() {
  return mockTables.map((table) => ({
    tableId: table.id,
  }));
}

export default function CheckoutPage({
  params,
}: {
  params: { tableId: string };
}) {
  return <CheckoutClient tableId={params.tableId} />;
}