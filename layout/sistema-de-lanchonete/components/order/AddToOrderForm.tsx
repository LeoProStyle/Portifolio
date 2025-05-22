'use client';

import { useState } from 'react';
import { MenuItem, OrderItem } from '@/types';
import { useRestaurant } from '@/context/RestaurantContext';
import { Minus, Plus } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'react-toastify';

interface AddToOrderFormProps {
  menuItem: MenuItem;
  orderId: string;
  onAddComplete: () => void;
}

export default function AddToOrderForm({ menuItem, orderId, onAddComplete }: AddToOrderFormProps) {
  const { addItemToOrder } = useRestaurant();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const incrementQuantity = () => setQuantity(prev => prev + 1);
  const decrementQuantity = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const handleAddToOrder = () => {
    const newItem: Omit<OrderItem, 'id' | 'status'> = {
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      price: menuItem.price,
      quantity,
      notes: notes.trim() || undefined,
    };
    
    addItemToOrder(orderId, newItem);
    toast.success('Item adicionado ao pedido!');
    onAddComplete();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative h-48 md:h-auto md:w-1/3 rounded-lg overflow-hidden">
          {menuItem.image ? (
            <Image
              src={menuItem.image}
              alt={menuItem.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <span className="text-muted-foreground">Sem imagem</span>
            </div>
          )}
        </div>
        <div className="md:w-2/3">
          <h3 className="text-2xl font-bold">{menuItem.name}</h3>
          <p className="text-muted-foreground mt-1">{menuItem.description}</p>
          <p className="text-xl font-bold mt-2 text-primary">
            R$ {menuItem.price.toFixed(2)}
          </p>

          <div className="mt-6">
            <label className="block text-sm font-medium mb-2">Quantidade</label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={decrementQuantity}
                className="w-10 h-10 rounded-full flex items-center justify-center border hover:bg-muted transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center font-bold">{quantity}</span>
              <button
                type="button"
                onClick={incrementQuantity}
                className="w-10 h-10 rounded-full flex items-center justify-center border hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Observações (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2 text-sm"
              placeholder="Ex: Sem cebola, molho à parte..."
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between font-bold text-lg mb-4">
          <span>Total:</span>
          <span>R$ {(menuItem.price * quantity).toFixed(2)}</span>
        </div>
        <button
          type="button"
          onClick={handleAddToOrder}
          className="w-full py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Adicionar ao Pedido
        </button>
      </div>
    </div>
  );
}