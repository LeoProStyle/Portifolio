'use client';

import TableCard from './TableCard';
import { useRestaurant } from '@/context/RestaurantContext';
import { useState } from 'react';
import { Filter } from 'lucide-react';

export default function TableGrid() {
  const { tables } = useRestaurant();
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied' | 'bill-requested'>('all');

  const filteredTables = filter === 'all' 
    ? tables 
    : tables.filter(table => table.status === filter);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
          }`}
        >
          <Filter className="h-4 w-4 inline mr-1" />
          Todas
        </button>
        <button
          onClick={() => setFilter('available')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === 'available'
              ? 'bg-green-600 text-white'
              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          }`}
        >
          Disponíveis
        </button>
        <button
          onClick={() => setFilter('occupied')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === 'occupied'
              ? 'bg-blue-600 text-white'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
          }`}
        >
          Ocupadas
        </button>
        <button
          onClick={() => setFilter('bill-requested')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === 'bill-requested'
              ? 'bg-amber-600 text-white'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
          }`}
        >
          Conta Solicitada
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <TableCard key={table.id} table={table} />
        ))}
      </div>
    </div>
  );
}