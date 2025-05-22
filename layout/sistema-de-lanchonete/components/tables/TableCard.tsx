'use client';

import { Table } from '@/types';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Utensils, AlertCircle, Clock } from 'lucide-react';

interface TableCardProps {
  table: Table;
}

export default function TableCard({ table }: TableCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/tables/${table.id}`);
  };

  const getStatusColor = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'occupied':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'bill-requested':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return <Utensils className="h-5 w-5" />;
      case 'occupied':
        return <Utensils className="h-5 w-5" />;
      case 'bill-requested':
        return <Clock className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getStatusText = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'occupied':
        return 'Ocupada';
      case 'bill-requested':
        return 'Conta Solicitada';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex flex-col rounded-lg border shadow-sm p-4 transition-all hover:shadow-md cursor-pointer",
        table.status === 'available' ? 'hover:border-green-400' : '',
        table.status === 'occupied' ? 'hover:border-blue-400' : '',
        table.status === 'bill-requested' ? 'hover:border-amber-400' : ''
      )}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Mesa {table.number}</h3>
        <span className={cn(
          'px-2 py-1 rounded-full text-xs font-medium flex items-center',
          getStatusColor(table.status)
        )}>
          {getStatusIcon(table.status)}
          <span className="ml-1">{getStatusText(table.status)}</span>
        </span>
      </div>
      
      <div className="text-sm text-muted-foreground mb-2">
        Capacidade: {table.capacity} pessoas
      </div>
      
      {table.waiter && (
        <div className="mt-auto pt-2 text-xs text-muted-foreground border-t">
          Atendente: {table.waiter}
        </div>
      )}
    </div>
  );
}