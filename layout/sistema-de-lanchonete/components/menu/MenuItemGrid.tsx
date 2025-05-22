'use client';

import { MenuItem } from '@/types';
import Image from 'next/image';

interface MenuItemGridProps {
  items: MenuItem[];
  onSelectItem: (itemId: string) => void;
}

export default function MenuItemGrid({ items, onSelectItem }: MenuItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Nenhum item encontrado nesta categoria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onSelectItem(item.id)}
        >
          <div className="relative h-48">
            {item.image ? (
              <Image
                src={item.image}
                alt={item.name}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <span className="text-muted-foreground">Sem imagem</span>
              </div>
            )}
          </div>
          <div className="p-4">
            <div className="flex justify-between items-start">
              <h3 className="font-medium">{item.name}</h3>
              <span className="font-bold text-primary">
                R$ {item.price.toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}