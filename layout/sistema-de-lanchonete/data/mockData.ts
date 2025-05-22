import { Staff, Table, MenuItem } from '@/types';

export const mockStaff: Staff[] = [
  {
    id: 'staff-1',
    name: 'João Silva',
    role: 'waiter',
    pin: '1234',
  },
  {
    id: 'staff-2',
    name: 'Ana Santos',
    role: 'bar',
    pin: '2345',
  },
  {
    id: 'staff-3',
    name: 'Carlos Oliveira',
    role: 'kitchen',
    pin: '3456',
  },
  {
    id: 'staff-4',
    name: 'Maria Costa',
    role: 'cashier',
    pin: '4567',
  },
  {
    id: 'staff-5',
    name: 'Admin',
    role: 'admin',
    pin: '0000',
  },
];

export const mockTables: Table[] = [
  { id: 'table-1', number: 1, capacity: 2, status: 'available' },
  { id: 'table-2', number: 2, capacity: 2, status: 'available' },
  { id: 'table-3', number: 3, capacity: 4, status: 'available' },
  { id: 'table-4', number: 4, capacity: 4, status: 'available' },
  { id: 'table-5', number: 5, capacity: 6, status: 'available' },
  { id: 'table-6', number: 6, capacity: 6, status: 'available' },
  { id: 'table-7', number: 7, capacity: 8, status: 'available' },
  { id: 'table-8', number: 8, capacity: 8, status: 'available' },
];

export const mockMenuItems: MenuItem[] = [
  // Food Items
  {
    id: 'item-1',
    name: 'Hambúrguer Clássico',
    description: 'Pão, hambúrguer, alface, tomate, queijo',
    price: 25.90,
    category: 'food',
    preparationArea: 'kitchen',
    image: 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'item-2',
    name: 'Batata Frita',
    description: 'Porção de batatas fritas crocantes',
    price: 15.90,
    category: 'food',
    preparationArea: 'kitchen',
    image: 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=600', 
  },
  {
    id: 'item-3',
    name: 'Pizza Margherita',
    description: 'Molho de tomate, queijo mozzarella, manjericão',
    price: 45.90,
    category: 'food',
    preparationArea: 'kitchen',
    image: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'item-4',
    name: 'Salada Caesar',
    description: 'Alface romana, croutons, queijo parmesão, molho caesar',
    price: 22.90,
    category: 'food',
    preparationArea: 'kitchen',
    image: 'https://images.pexels.com/photos/2097090/pexels-photo-2097090.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  
  // Drink Items
  {
    id: 'item-5',
    name: 'Refrigerante',
    description: 'Cola, laranja ou limão',
    price: 6.90,
    category: 'drink',
    preparationArea: 'bar',
    image: 'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'item-6',
    name: 'Suco Natural',
    description: 'Laranja, abacaxi ou maracujá',
    price: 9.90,
    category: 'drink',
    preparationArea: 'bar',
    image: 'https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'item-7',
    name: 'Cerveja',
    description: 'Garrafa 600ml',
    price: 12.90,
    category: 'drink',
    preparationArea: 'bar',
    image: 'https://images.pexels.com/photos/1552630/pexels-photo-1552630.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'item-8',
    name: 'Água Mineral',
    description: 'Com ou sem gás',
    price: 4.90,
    category: 'drink',
    preparationArea: 'bar',
    image: 'https://images.pexels.com/photos/327090/pexels-photo-327090.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  
  // Dessert Items
  {
    id: 'item-9',
    name: 'Pudim',
    description: 'Pudim de leite condensado',
    price: 12.90,
    category: 'dessert',
    preparationArea: 'kitchen',
    image: 'https://images.pexels.com/photos/3186789/pexels-photo-3186789.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    id: 'item-10',
    name: 'Sorvete',
    description: 'Duas bolas de sorvete com calda',
    price: 14.90,
    category: 'dessert',
    preparationArea: 'kitchen',
    image: 'https://images.pexels.com/photos/2846337/pexels-photo-2846337.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
];