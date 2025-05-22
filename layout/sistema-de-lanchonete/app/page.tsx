'use client';

import { useAuth } from '@/context/AuthContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BarChart3, Coffee, Utensils, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentStaff, isAuthenticated } = useAuth();
  const { tables, activeOrders, completedOrders } = useRestaurant();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !currentStaff) {
    return null;
  }

  // Count tables by status
  const availableTables = tables.filter(table => table.status === 'available').length;
  const occupiedTables = tables.filter(table => table.status === 'occupied').length;
  const billRequestedTables = tables.filter(table => table.status === 'bill-requested').length;

  // Count orders that need attention based on role
  const pendingOrders = activeOrders.filter(order => {
    return order.items.some(item => {
      if (currentStaff.role === 'bar') {
        return item.status === 'pending' && /* item is drink */true;
      }
      if (currentStaff.role === 'kitchen') {
        return item.status === 'pending' && /* item is food */true;
      }
      return item.status === 'pending';
    });
  }).length;

  // Today's completed orders count and revenue
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayCompletedOrders = completedOrders.filter(
    order => new Date(order.completedAt || '') >= todayStart
  );
  
  const todayRevenue = todayCompletedOrders.reduce(
    (sum, order) => sum + order.total, 
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('pt-BR')}</p>
          <p className="font-medium">Olá, {currentStaff.name}</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Mesas Disponíveis" 
          value={availableTables.toString()} 
          icon={<Utensils className="h-8 w-8 text-green-500" />}
          description={`${availableTables} de ${tables.length} mesas livres`}
          trend="up"
        />
        <StatsCard 
          title="Mesas Ocupadas" 
          value={occupiedTables.toString()} 
          icon={<Utensils className="h-8 w-8 text-blue-500" />}
          description={`${occupiedTables} de ${tables.length} mesas ocupadas`}
          trend={occupiedTables > tables.length / 2 ? "up" : "neutral"}
        />
        <StatsCard 
          title="Pedidos Pendentes" 
          value={pendingOrders.toString()} 
          icon={<Coffee className="h-8 w-8 text-amber-500" />}
          description="Aguardando preparação"
          trend={pendingOrders > 0 ? "up" : "down"}
        />
        <StatsCard 
          title="Faturamento de Hoje" 
          value={`R$ ${todayRevenue.toFixed(2)}`} 
          icon={<CreditCard className="h-8 w-8 text-emerald-500" />}
          description={`${todayCompletedOrders.length} pedidos completos`}
          trend="up"
        />
      </div>

      {/* Role-based Quick Actions */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(currentStaff.role === 'waiter' || currentStaff.role === 'admin') && (
            <QuickActionCard 
              title="Gerenciar Mesas" 
              description="Ver, ocupar e liberar mesas" 
              icon={<Utensils className="h-6 w-6" />}
              href="/tables"
            />
          )}
          
          {(currentStaff.role === 'bar' || currentStaff.role === 'kitchen' || currentStaff.role === 'admin') && (
            <QuickActionCard 
              title="Ver Pedidos" 
              description="Gerenciar pedidos pendentes" 
              icon={<Coffee className="h-6 w-6" />}
              href="/orders"
            />
          )}
          
          {(currentStaff.role === 'cashier' || currentStaff.role === 'admin') && (
            <QuickActionCard 
              title="Fechar Mesas" 
              description="Processar pagamentos" 
              icon={<CreditCard className="h-6 w-6" />}
              href="/checkout"
            />
          )}
          
          {(currentStaff.role === 'admin') && (
            <QuickActionCard 
              title="Relatórios" 
              description="Ver estatísticas e vendas" 
              icon={<BarChart3 className="h-6 w-6" />}
              href="/reports"
            />
          )}
        </div>
      </div>

      {/* Recently Active Tables */}
      {(currentStaff.role === 'waiter' || currentStaff.role === 'admin') && (
        <div>
          <h2 className="font-semibold text-lg mb-4">Mesas com Pedidos Ativos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables
              .filter(table => table.status !== 'available')
              .slice(0, 4)
              .map(table => (
                <div key={table.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">Mesa {table.number}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      table.status === 'occupied' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {table.status === 'occupied' ? 'Ocupada' : 'Conta Solicitada'}
                    </span>
                  </div>
                  <Link
                    href={`/tables/${table.id}`}
                    className="block mt-4 text-sm text-center py-1 border border-primary/20 rounded hover:bg-primary/10 transition-colors"
                  >
                    Ver Detalhes
                  </Link>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  trend: 'up' | 'down' | 'neutral';
}

function StatsCard({ title, value, icon, description, trend }: StatsCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        </div>
        {icon}
      </div>
      <div className="mt-2 text-sm text-muted-foreground flex items-center">
        <span>{description}</span>
      </div>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}

function QuickActionCard({ title, description, icon, href }: QuickActionCardProps) {
  return (
    <Link href={href}>
      <div className="rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow hover:border-primary/40 cursor-pointer">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            {icon}
          </div>
          <div>
            <h3 className="font-medium text-center sm:text-left">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center sm:text-left">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}