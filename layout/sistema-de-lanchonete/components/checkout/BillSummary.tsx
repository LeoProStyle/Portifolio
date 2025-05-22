'use client';

import { Order } from '@/types';
import { useState } from 'react';
import { useRestaurant } from '@/context/RestaurantContext';
import { CreditCard, Banknote, QrCode, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';

interface BillSummaryProps {
  order: Order;
}

type PaymentMethod = 'credit' | 'cash' | 'pix';

export default function BillSummary({ order }: BillSummaryProps) {
  const { completeOrder } = useRestaurant();
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate subtotal
  const subtotal = order.items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  // Service charge (10%)
  const serviceCharge = subtotal * 0.1;
  const total = subtotal + serviceCharge;

  // Calculate change if paying with cash
  const change = parseFloat(cashAmount) > total
    ? parseFloat(cashAmount) - total
    : 0;

  const handleCompleteOrder = () => {
    setIsProcessing(true);

    // Simulate payment processing delay
    setTimeout(() => {
      completeOrder(order.id);
      toast.success('Pagamento processado com sucesso!');
      setIsProcessing(false);
      router.push('/tables');
    }, 1500);
  };

  return (
    <div className="rounded-lg border p-6 space-y-6">
      <h3 className="text-xl font-bold border-b pb-4">
        Resumo da Conta - Mesa {order.tableNumber}
      </h3>

      <div className="space-y-4">
        {/* Items summary */}
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>
                {item.quantity}x {item.menuItemName}
              </span>
              <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Bill details */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxa de Serviço (10%)</span>
            <span>R$ {serviceCharge.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment method selection */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Método de Pagamento</h4>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('credit')}
              className={`p-3 border rounded-md flex flex-col items-center justify-center transition-colors ${
                paymentMethod === 'credit'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <CreditCard className="h-5 w-5 mb-1" />
              <span className="text-sm">Cartão</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`p-3 border rounded-md flex flex-col items-center justify-center transition-colors ${
                paymentMethod === 'cash'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <Banknote className="h-5 w-5 mb-1" />
              <span className="text-sm">Dinheiro</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('pix')}
              className={`p-3 border rounded-md flex flex-col items-center justify-center transition-colors ${
                paymentMethod === 'pix'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <QrCode className="h-5 w-5 mb-1" />
              <span className="text-sm">PIX</span>
            </button>
          </div>
        </div>

        {/* Cash amount input */}
        {paymentMethod === 'cash' && (
          <div className="space-y-2">
            <label className="block text-sm">Valor em Dinheiro</label>
            <input
              type="number"
              min={total}
              step="0.01"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              className="w-full rounded-md border border-input px-3 py-2"
              placeholder={`Mínimo: R$ ${total.toFixed(2)}`}
            />
            {parseFloat(cashAmount) > 0 && (
              <div className="flex justify-between font-medium mt-2">
                <span>Troco:</span>
                <span
                  className={
                    change > 0 ? 'text-green-600 dark:text-green-400' : ''
                  }
                >
                  R$ {change.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Process payment button */}
        <button
          type="button"
          onClick={handleCompleteOrder}
          disabled={
            isProcessing || 
            (paymentMethod === 'cash' && parseFloat(cashAmount) < total)
          }
          className={`w-full py-3 rounded-md font-medium transition-colors flex items-center justify-center
            ${
              isProcessing
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }
          `}
        >
          {isProcessing ? (
            <>
              <span className="animate-pulse mr-2">Processando...</span>
            </>
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Finalizar Pagamento
            </>
          )}
        </button>
      </div>
    </div>
  );
}