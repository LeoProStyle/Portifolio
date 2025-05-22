'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { ChevronLeft } from 'lucide-react';
import BillSummary from '@/components/checkout/BillSummary';

interface CheckoutClientProps {
  tableId: string;
}

export default function CheckoutClient({ tableId }: CheckoutClientProps) {
  const router = useRouter();
  const { currentStaff, isAuthenticated } = useAuth();
  const { getTable, getOrder } = useRestaurant();

  const table = getTable(tableId);
  const order = table?.activeOrderId ? getOrder(table.activeOrderId) : undefined;

  // Restrict access to cashier and admin only
  useEffect(() => {
    if (isAuthenticated && currentStaff) {
      if (currentStaff.role !== 'cashier' && currentStaff.role !== 'admin') {
        router.push('/');
      }
    }
  }, [currentStaff, isAuthenticated, router]);

  if (!table) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-500">Mesa não encontrada</h1>
        <button
          onClick={() => router.push('/checkout')}
          className="mt-4 inline-flex items-center text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar para o caixa
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-amber-500">Pedido não encontrado</h1>
        <p className="text-muted-foreground mt-2">
          Não há pedido ativo para esta mesa.
        </p>
        <button
          onClick={() => router.push('/checkout')}
          className="mt-4 inline-flex items-center text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar para o caixa
        </button>
      </div>
    );
  }

  // If not authenticated or not authorized, don't render the content
  if (!isAuthenticated || !currentStaff || (currentStaff.role !== 'cashier' && currentStaff.role !== 'admin')) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.push('/checkout')}
          className="mr-4 p-2 rounded-full hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Fechamento - Mesa {table.number}</h1>
          <p className="text-muted-foreground">
            Status: <span className={table.status === 'bill-requested' ? 'font-medium text-amber-600 dark:text-amber-400' : 'font-medium'}>
              {table.status === 'bill-requested' ? 'Conta Solicitada' : 'Ocupada'}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-medium mb-4">Detalhes do Pedido</h2>
          <div className="border rounded-lg p-4 space-y-4">
            <div className="border-b pb-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pedido ID:</span>
                <span>#{order.id.slice(-8)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Atendente:</span>
                <span>{order.waiterName}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Criado em:</span>
                <span>{new Date(order.createdAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-medium">Itens do Pedido</h3>
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <div>
                    <span>{item.quantity}x {item.menuItemName}</span>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground ml-5 italic">
                        "{item.notes}"
                      </p>
                    )}
                  </div>
                  <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-medium mb-4">Pagamento</h2>
          <BillSummary order={order} />
        </div>
      </div>
    </div>
  );
}