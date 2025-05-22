export interface Staff {
  id: string;
  name: string;
  role: 'waiter' | 'bar' | 'kitchen' | 'cashier' | 'admin';
  pin: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'food' | 'drink' | 'dessert';
  preparationArea: 'bar' | 'kitchen';
  image?: string;
}

export interface Table {
  id: string;
  number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'bill-requested';
  waiter?: string; // Staff ID
  activeOrderId?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  price: number;
  quantity: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  notes?: string;
}

export interface Order {
  id: string;
  tableId: string;
  tableNumber: number;
  waiterId: string;
  waiterName: string;
  items: OrderItem[];
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  total: number;
  isPaid: boolean;
}