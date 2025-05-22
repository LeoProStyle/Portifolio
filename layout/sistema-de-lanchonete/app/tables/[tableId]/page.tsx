import TableDetailClient from '@/components/tables/TableDetailClient';
import { mockTables } from '@/data/mockData';

// Esta função é necessária para o Next.js gerar as páginas estáticas
export function generateStaticParams() {
  return mockTables.map((table) => ({
    tableId: table.id,
  }));
}

export default function TableDetailPage({
  params,
}: {
  params: { tableId: string };
}) {
  return <TableDetailClient tableId={params.tableId} />;
}