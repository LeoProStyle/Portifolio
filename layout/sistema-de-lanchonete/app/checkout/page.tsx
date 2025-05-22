'use client';

import { useAuth } from '@/context/AuthContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Search } from 'lucide-react';
import { Table } from '@/types';
import Link from 'next/link';

export default function CheckoutPage() {
  const { currentStaff, isAuthenticated } = useAuth();
  const { tables, getOrder } = useRestaurant();
  const router = useRouter();
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    if (isAuthenticated && currentStaff) {
      // Restrict access to cashier and admin only
      if (currentStaff.role !== 'cashier' && currentStaff.role !== 'admin') {
        router.push('/');
      }
    }
  }, [currentStaff, isAuthenticated, router]);

  // If not authenticated or not authorized, don't render the content
  if (!isAuthenticated || !currentStaff || 
      (currentStaff.role !== 'cashier' && 
       currentStaff.role !== 'admin')) {
    return null;
  }

  // Get tables with bill requested first, then other occupied tables
  const tablesToShow = tables
    .filter(table => table.status !== 'available')
    .sort((a, b) => {
      // Bill requested tables first
      if (a.status === 'bill-requested' && b.status !== 'bill-requested') return -1;
      if (a.status !== 'bill-requested' && b.status === 'bill-requested') return 1;
      // Then by table number
      return a.number - b.number;
    })
    .filter(table => {
      if (!filter) return true;
      return table.number.toString().includes(filter);
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Caixa</h1>
      </div>
      
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border rounded-md bg-background border-input focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="Filtrar por número da mesa..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tablesToShow.map((table) => (
          <TableCheckoutCard key={table.id} table={table} getOrder={getOrder} />
        ))}
        
        {tablesToShow.length === 0 && (
          <div className="col-span-full text-center py-12 border rounded-lg bg-muted/30">
            <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-medium mb-2">Nenhuma mesa para fechar</h2>
            <p className="text-muted-foreground">
              Todas as mesas estão disponíveis ou não há mesas que correspondam ao filtro.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface TableCheckoutCardProps {
  table: Table;
  getOrder: (id: string) => any;
}

function TableCheckoutCard({ table, getOrder }: TableCheckoutCardProps) {
  const order = table.activeOrderId ? getOrder(table.activeOrderId) : undefined;
  
  // Calculate total
  const total = order ? order.total : 0;
  
  // Count items
  const itemCount = order ? order.items.length : 0;
  
  return (
    <div className={`border rounded-lg overflow-hidden ${
      table.status === 'bill-requested' 
        ? 'border-amber-300 dark:border-amber-700 shadow-md' 
        : ''
    }`}>
      <div className={`p-4 ${
        table.status === 'bill-requested'
          ? 'bg-amber-50 dark:bg-amber-950/20'
          : 'bg-card'
      }`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Mesa {table.number}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            table.status === 'bill-requested'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {table.status === 'bill-requested' ? 'Conta Solicitada' : 'Ocupada'}
          </span>
        </div>
        
        {order && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens:</span>
              <span>{itemCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold">R$ {total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3 border-t bg-card">
        <Link 
          href={`/checkout/${table.id}`}
          className={`block w-full py-2 rounded-md text-center ${
            table.status === 'bill-requested'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
          } transition-colors`}
        >
          <CreditCard className="h-4 w-4 inline-block mr-2" />
          {table.status === 'bill-requested' ? 'Fechar Mesa' : 'Ver Detalhes'}
        </Link>
      </div>
    </div>
  );
}