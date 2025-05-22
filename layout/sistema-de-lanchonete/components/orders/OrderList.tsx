'use client';

import { Order } from '@/types';
import { useState } from 'react';
import { formatDistance } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import OrderItemCard from './OrderItemCard';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface OrderListProps {
  orders: Order[];
  showTable?: boolean;
}

export default function OrderList({ orders, showTable = true }: OrderListProps) {
  const { currentStaff } = useAuth();
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const isBarOrKitchenStaff = 
    currentStaff?.role === 'bar' || 
    currentStaff?.role === 'kitchen' || 
    currentStaff?.role === 'admin';

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Filter items by preparation area if user is bar/kitchen staff
  const getFilteredItems = (order: Order) => {
    if (currentStaff?.role === 'bar') {
      return order.items.filter(item => 
        item.status !== 'delivered' && 
        item.status !== 'cancelled'
      );
    }
    if (currentStaff?.role === 'kitchen') {
      return order.items.filter(item => 
        item.status !== 'delivered' && 
        item.status !== 'cancelled'
      );
    }
    return order.items;
  };

  // Sort orders - pending first, then by creation time
  const sortedOrders = [...orders].sort((a, b) => {
    // First sort by status (active first)
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    
    // Then sort by creation time (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (orders.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/30">
        <p className="text-muted-foreground">Nenhum pedido encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedOrders.map(order => {
        const isExpanded = expandedOrders[order.id] || false;
        const filteredItems = getFilteredItems(order);
        
        // Skip orders with no items for bar/kitchen staff
        if (isBarOrKitchenStaff && filteredItems.length === 0) {
          return null;
        }
        
        return (
          <div key={order.id} className="border rounded-lg overflow-hidden">
            <div 
              className="p-4 flex justify-between items-center bg-accent/50 cursor-pointer hover:bg-accent"
              onClick={() => toggleOrderExpand(order.id)}
            >
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {showTable && `Mesa ${order.tableNumber} · `}
                    Pedido #{order.id.slice(-4)}
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {formatDistance(new Date(order.createdAt), new Date(), { 
                      addSuffix: true,
                      locale: pt 
                    })}
                  </div>
                </div>
                <div className="text-sm flex flex-wrap gap-2 mt-1">
                  <span className="text-muted-foreground">
                    Garçom: {order.waiterName}
                  </span>
                  <span className="text-muted-foreground">
                    Itens: {order.items.length}
                  </span>
                  <span className="font-medium">
                    Total: R$ {order.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="ml-2">
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>
            
            {isExpanded && (
              <div className="p-4 space-y-3 bg-card">
                {filteredItems.map(item => (
                  <OrderItemCard 
                    key={item.id} 
                    item={item} 
                    orderId={order.id}
                    isBarStaff={isBarOrKitchenStaff}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}