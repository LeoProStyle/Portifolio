'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Table, Order, MenuItem, OrderItem } from '@/types';
import { mockTables, mockMenuItems } from '@/data/mockData';

interface RestaurantContextType {
  tables: Table[];
  orders: Order[];
  menuItems: MenuItem[];
  activeOrders: Order[];
  completedOrders: Order[];

  // Table operations
  getTable: (id: string) => Table | undefined;
  updateTableStatus: (id: string, status: Table['status'], waiterId?: string) => void;
  
  // Order operations
  createOrder: (tableId: string, waiterId: string, waiterName: string) => Order;
  getOrder: (id: string) => Order | undefined;
  addItemToOrder: (orderId: string, item: Omit<OrderItem, 'id' | 'status'>) => void;
  updateOrderItemStatus: (orderId: string, itemId: string, status: OrderItem['status']) => void;
  completeOrder: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  
  // Menu operations
  getMenuItemsByCategory: (category: MenuItem['category']) => MenuItem[];
  getMenuItem: (id: string) => MenuItem | undefined;
}

const RestaurantContext = createContext<RestaurantContextType>({
  tables: [],
  orders: [],
  menuItems: [],
  activeOrders: [],
  completedOrders: [],
  
  // Placeholder functions
  getTable: () => undefined,
  updateTableStatus: () => {},
  createOrder: () => ({ id: '', tableId: '', tableNumber: 0, waiterId: '', waiterName: '', items: [], status: 'active', createdAt: '', updatedAt: '', total: 0, isPaid: false }),
  getOrder: () => undefined,
  addItemToOrder: () => {},
  updateOrderItemStatus: () => {},
  completeOrder: () => {},
  cancelOrder: () => {},
  getMenuItemsByCategory: () => [],
  getMenuItem: () => undefined,
});

export const useRestaurant = () => useContext(RestaurantContext);

export const RestaurantProvider = ({ children }: { children: ReactNode }) => {
  const [tables, setTables] = useState<Table[]>(mockTables);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems] = useState<MenuItem[]>(mockMenuItems);

  // Derived states
  const activeOrders = orders.filter((order) => order.status === 'active');
  const completedOrders = orders.filter((order) => order.status === 'completed');

  // Load data from localStorage on mount
  useEffect(() => {
    const storedTables = localStorage.getItem('tables');
    const storedOrders = localStorage.getItem('orders');
    
    if (storedTables) {
      try {
        setTables(JSON.parse(storedTables));
      } catch (error) {
        console.error('Failed to parse stored tables', error);
      }
    }
    
    if (storedOrders) {
      try {
        setOrders(JSON.parse(storedOrders));
      } catch (error) {
        console.error('Failed to parse stored orders', error);
      }
    }
  }, []);

  // Save data to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('tables', JSON.stringify(tables));
  }, [tables]);

  useEffect(() => {
    localStorage.setItem('orders', JSON.stringify(orders));
  }, [orders]);

  // Table operations
  const getTable = (id: string) => tables.find((table) => table.id === id);

  const updateTableStatus = (id: string, status: Table['status'], waiterId?: string) => {
    setTables((prevTables) =>
      prevTables.map((table) =>
        table.id === id
          ? { ...table, status, ...(waiterId ? { waiter: waiterId } : {}) }
          : table
      )
    );
  };

  // Order operations
  const createOrder = (tableId: string, waiterId: string, waiterName: string): Order => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) throw new Error(`Table with ID ${tableId} not found`);

    const timestamp = new Date().toISOString();
    const newOrder: Order = {
      id: `order-${Date.now()}`,
      tableId,
      tableNumber: table.number,
      waiterId,
      waiterName,
      items: [],
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      total: 0,
      isPaid: false,
    };

    setOrders((prevOrders) => [...prevOrders, newOrder]);
    
    // Update table status and assign active order
    setTables((prevTables) =>
      prevTables.map((t) =>
        t.id === tableId
          ? { ...t, status: 'occupied', waiter: waiterId, activeOrderId: newOrder.id }
          : t
      )
    );

    return newOrder;
  };

  const getOrder = (id: string) => orders.find((order) => order.id === id);

  const addItemToOrder = (orderId: string, itemData: Omit<OrderItem, 'id' | 'status'>) => {
    const orderIndex = orders.findIndex((order) => order.id === orderId);
    if (orderIndex === -1) return;

    const menuItem = menuItems.find((item) => item.id === itemData.menuItemId);
    if (!menuItem) return;

    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'pending',
      ...itemData,
    };

    setOrders((prevOrders) => {
      const updatedOrder = { 
        ...prevOrders[orderIndex],
        items: [...prevOrders[orderIndex].items, newItem],
        total: prevOrders[orderIndex].total + (itemData.price * itemData.quantity),
        updatedAt: new Date().toISOString(),
      };

      return [
        ...prevOrders.slice(0, orderIndex),
        updatedOrder,
        ...prevOrders.slice(orderIndex + 1),
      ];
    });
  };

  const updateOrderItemStatus = (orderId: string, itemId: string, status: OrderItem['status']) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id !== orderId) return order;

        const updatedItems = order.items.map((item) =>
          item.id === itemId ? { ...item, status } : item
        );

        return {
          ...order,
          items: updatedItems,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const completeOrder = (orderId: string) => {
    const orderIndex = orders.findIndex((order) => order.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    const timestamp = new Date().toISOString();

    setOrders((prevOrders) => [
      ...prevOrders.slice(0, orderIndex),
      {
        ...order,
        status: 'completed',
        completedAt: timestamp,
        updatedAt: timestamp,
        isPaid: true,
      },
      ...prevOrders.slice(orderIndex + 1),
    ]);

    // Update table status
    setTables((prevTables) =>
      prevTables.map((table) =>
        table.id === order.tableId
          ? { ...table, status: 'available', waiter: undefined, activeOrderId: undefined }
          : table
      )
    );
  };

  const cancelOrder = (orderId: string) => {
    const orderIndex = orders.findIndex((order) => order.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    const timestamp = new Date().toISOString();

    setOrders((prevOrders) => [
      ...prevOrders.slice(0, orderIndex),
      {
        ...order,
        status: 'cancelled',
        updatedAt: timestamp,
      },
      ...prevOrders.slice(orderIndex + 1),
    ]);

    // Update table status
    setTables((prevTables) =>
      prevTables.map((table) =>
        table.id === order.tableId
          ? { ...table, status: 'available', waiter: undefined, activeOrderId: undefined }
          : table
      )
    );
  };

  // Menu operations
  const getMenuItemsByCategory = (category: MenuItem['category']) => 
    menuItems.filter((item) => item.category === category);

  const getMenuItem = (id: string) => menuItems.find((item) => item.id === id);

  return (
    <RestaurantContext.Provider
      value={{
        tables,
        orders,
        menuItems,
        activeOrders,
        completedOrders,
        getTable,
        updateTableStatus,
        createOrder,
        getOrder,
        addItemToOrder,
        updateOrderItemStatus,
        completeOrder,
        cancelOrder,
        getMenuItemsByCategory,
        getMenuItem,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};