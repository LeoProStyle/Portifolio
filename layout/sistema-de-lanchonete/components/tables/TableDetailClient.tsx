'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { ChevronLeft, PlusCircle, CreditCard, ClipboardCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AddToOrderForm from '@/components/order/AddToOrderForm';
import OrderItemCard from '@/components/orders/OrderItemCard';
import { toast } from 'react-toastify';
import { MenuItem } from '@/types';
import MenuCategoryTabs from '@/components/menu/MenuCategoryTabs';

interface TableDetailClientProps {
  tableId: string;
}

export default function TableDetailClient({ tableId }: TableDetailClientProps) {
  const router = useRouter();
  const { currentStaff, isAuthenticated } = useAuth();
  const { 
    getTable, 
    updateTableStatus, 
    createOrder, 
    getOrder,
    getMenuItem
  } = useRestaurant();
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [isMenuItemDialogOpen, setIsMenuItemDialogOpen] = useState(false);

  const table = getTable(tableId);
  const order = table?.activeOrderId ? getOrder(table.activeOrderId) : undefined;

  // Restrict access for non-waiter roles (except admin)
  useEffect(() => {
    if (isAuthenticated && currentStaff) {
      if (currentStaff.role !== 'waiter' && currentStaff.role !== 'admin') {
        router.push('/');
      }
    }
  }, [currentStaff, isAuthenticated, router]);

  if (!table) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-500">Mesa não encontrada</h1>
        <button
          onClick={() => router.push('/tables')}
          className="mt-4 inline-flex items-center text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar para lista de mesas
        </button>
      </div>
    );
  }

  // If not authenticated or not authorized, don't render the content
  if (!isAuthenticated || !currentStaff || (currentStaff.role !== 'waiter' && currentStaff.role !== 'admin')) {
    return null;
  }

  const handleOccupyTable = () => {
    if (!currentStaff) return;
    
    updateTableStatus(tableId, 'occupied', currentStaff.id);
    createOrder(tableId, currentStaff.id, currentStaff.name);
    toast.success('Mesa ocupada com sucesso!');
  };

  const handleRequestBill = () => {
    updateTableStatus(tableId, 'bill-requested');
    toast.success('Solicitação de conta enviada para o caixa!');
  };

  const handleSelectMenuItem = (itemId: string) => {
    const menuItem = getMenuItem(itemId);
    if (menuItem) {
      setSelectedMenuItem(menuItem);
      setIsMenuItemDialogOpen(true);
    }
  };

  const getStatusText = (status: 'available' | 'occupied' | 'bill-requested') => {
    switch (status) {
      case 'available':
        return 'Disponível';
      case 'occupied':
        return 'Ocupada';
      case 'bill-requested':
        return 'Conta Solicitada';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.push('/tables')}
          className="mr-4 p-2 rounded-full hover:bg-accent"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Mesa {table.number}</h1>
          <p className="text-muted-foreground">
            Status: <span className="font-medium">{getStatusText(table.status)}</span> · 
            Capacidade: <span className="font-medium">{table.capacity} pessoas</span>
          </p>
        </div>
      </div>

      {table.status === 'available' ? (
        <div className="bg-muted/30 border rounded-lg p-8 text-center">
          <h2 className="text-xl font-medium mb-4">Mesa Disponível</h2>
          <p className="text-muted-foreground mb-6">
            Esta mesa está livre. Clique no botão abaixo para ocupá-la.
          </p>
          <button
            onClick={handleOccupyTable}
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Ocupar Mesa
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Order details for occupied table */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left column - Current order */}
            <div className="lg:w-1/2 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-medium">Pedido Atual</h2>
                {table.status === 'occupied' && (
                  <button
                    onClick={handleRequestBill}
                    className="inline-flex items-center px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors"
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    Solicitar Conta
                  </button>
                )}
              </div>

              {order && order.items.length > 0 ? (
                <div className="space-y-3 border rounded-lg p-4">
                  {order.items.map((item) => (
                    <OrderItemCard
                      key={item.id}
                      item={item}
                      orderId={order.id}
                      isBarStaff={false}
                    />
                  ))}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between font-medium">
                      <span>Total:</span>
                      <span>R$ {order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-6 text-center">
                  <p className="text-muted-foreground">
                    Nenhum item adicionado ao pedido ainda.
                  </p>
                </div>
              )}

              {table.status === 'bill-requested' && (
                <div className="rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 p-4 flex items-center">
                  <ClipboardCheck className="h-5 w-5 mr-2" />
                  <p>Conta solicitada. Aguardando processamento pelo caixa.</p>
                </div>
              )}
            </div>

            {/* Right column - Add items (only if status is occupied) */}
            {table.status === 'occupied' && order && (
              <div className="lg:w-1/2">
                <h2 className="text-xl font-medium mb-4">Adicionar Itens</h2>
                <MenuCategoryTabs onSelectItem={handleSelectMenuItem} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item detail dialog */}
      <Dialog 
        open={isMenuItemDialogOpen} 
        onOpenChange={setIsMenuItemDialogOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Adicionar ao Pedido</DialogTitle>
          <DialogDescription>
            Selecione a quantidade e adicione observações se necessário.
          </DialogDescription>
          {selectedMenuItem && order && (
            <AddToOrderForm
              menuItem={selectedMenuItem}
              orderId={order.id}
              onAddComplete={() => setIsMenuItemDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}