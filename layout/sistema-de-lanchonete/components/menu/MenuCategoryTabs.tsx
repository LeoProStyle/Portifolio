'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MenuItemGrid from './MenuItemGrid';
import { useRestaurant } from '@/context/RestaurantContext';

interface MenuCategoryTabsProps {
  onSelectItem: (itemId: string) => void;
}

export default function MenuCategoryTabs({ onSelectItem }: MenuCategoryTabsProps) {
  const { getMenuItemsByCategory } = useRestaurant();
  const [activeTab, setActiveTab] = useState('food');

  return (
    <Tabs defaultValue="food" value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid grid-cols-3 mb-6">
        <TabsTrigger value="food">Comidas</TabsTrigger>
        <TabsTrigger value="drink">Bebidas</TabsTrigger>
        <TabsTrigger value="dessert">Sobremesas</TabsTrigger>
      </TabsList>
      
      <TabsContent value="food" className="space-y-4">
        <MenuItemGrid 
          items={getMenuItemsByCategory('food')} 
          onSelectItem={onSelectItem} 
        />
      </TabsContent>
      
      <TabsContent value="drink" className="space-y-4">
        <MenuItemGrid 
          items={getMenuItemsByCategory('drink')} 
          onSelectItem={onSelectItem} 
        />
      </TabsContent>
      
      <TabsContent value="dessert" className="space-y-4">
        <MenuItemGrid 
          items={getMenuItemsByCategory('dessert')} 
          onSelectItem={onSelectItem} 
        />
      </TabsContent>
    </Tabs>
  );
}