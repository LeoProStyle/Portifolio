'use client';

import { OrderItem } from '@/types';
import { useState } from 'react';
import { useRestaurant } from '@/context/RestaurantContext';
import { Check, X, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItemCardProps {
  item: OrderItem;
  orderId: string;
  isBarStaff: boolean;
}

export default function OrderItemCard({ item, orderId, isBarStaff }: OrderItemCardProps) {
  const { updateOrderItemStatus } = useRestaurant();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusUpdate = (status: OrderItem['status']) => {
    setIsUpdating(true);
    updateOrderItemStatus(orderId, item.id, status);
    setTimeout(() => setIsUpdating(false), 500);
  };

  const getStatusBadge = (status: OrderItem['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </span>
        );
      case 'preparing':
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Preparando
          </span>
        );
      case 'ready':
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center">
            <Check className="h-3 w-3 mr-1" />
            Pronto
          </span>
        );
      case 'delivered':
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 flex items-center">
            <Check className="h-3 w-3 mr-1" />
            Entregue
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 flex items-center">
            <X className="h-3 w-3 mr-1" />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 flex items-center">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Desconhecido
          </span>
        );
    }
  };

  return (
    <div className={cn(
      "border rounded-lg p-4 transition-all duration-300", 
      isUpdating ? "scale-105 shadow-md border-primary" : "",
      item.status === 'pending' ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/10" : "",
      item.status === 'preparing' ? "border-blue-200 bg-blue-50/50 dark:bg-blue-950/10" : "",
      item.status === 'ready' ? "border-green-200 bg-green-50/50 dark:bg-green-950/10" : "",
      item.status === 'delivered' ? "border-gray-200 bg-gray-50/50 dark:bg-gray-950/5" : "",
      item.status === 'cancelled' ? "border-red-200 bg-red-50/50 dark:bg-red-950/10" : ""
    )}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium">{item.menuItemName}</h4>
          <div className="text-sm text-muted-foreground">
            {item.quantity}x · R$ {item.price.toFixed(2)}
          </div>
        </div>
        <div>{getStatusBadge(item.status)}</div>
      </div>

      {item.notes && (
        <div className="text-sm italic text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
          "{item.notes}"
        </div>
      )}

      {isBarStaff && (item.status === 'pending' || item.status === 'preparing') && (
        <div className="flex justify-end gap-2 mt-4">
          {item.status === 'pending' && (
            <button
              onClick={() => handleStatusUpdate('preparing')}
              className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
            >
              Preparar
            </button>
          )}
          {item.status === 'preparing' && (
            <button
              onClick={() => handleStatusUpdate('ready')}
              className="px-3 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
            >
              Pronto
            </button>
          )}
          <button
            onClick={() => handleStatusUpdate('cancelled')}
            className="px-3 py-1 text-xs rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}