'use client';

import { useAuth } from '@/context/AuthContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OrderList from '@/components/orders/OrderList';

export default function OrdersPage() {
  const { currentStaff, isAuthenticated } = useAuth();
  const { activeOrders } = useRestaurant();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && currentStaff) {
      // Restrict access to relevant roles only
      if (currentStaff.role !== 'bar' && 
          currentStaff.role !== 'kitchen' && 
          currentStaff.role !== 'admin') {
        router.push('/');
      }
    }
  }, [currentStaff, isAuthenticated, router]);

  // If not authenticated or not authorized, don't render the content
  if (!isAuthenticated || !currentStaff || 
      (currentStaff.role !== 'bar' && 
       currentStaff.role !== 'kitchen' && 
       currentStaff.role !== 'admin')) {
    return null;
  }

  // Filter orders based on staff role
  const filteredOrders = activeOrders.filter(order => {
    return order.items.some(item => {
      if (currentStaff.role === 'bar') {
        return item.status !== 'delivered' && item.status !== 'cancelled';
      }
      if (currentStaff.role === 'kitchen') {
        return item.status !== 'delivered' && item.status !== 'cancelled';
      }
      return true;
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {currentStaff.role === 'bar' 
            ? 'Pedidos do Bar' 
            : currentStaff.role === 'kitchen' 
              ? 'Pedidos da Cozinha' 
              : 'Todos os Pedidos'}
        </h1>
        <div>
          <span className="text-sm text-muted-foreground">
            {filteredOrders.length} pedidos ativos
          </span>
        </div>
      </div>
      
      <OrderList orders={filteredOrders} showTable={true} />
    </div>
  );
}