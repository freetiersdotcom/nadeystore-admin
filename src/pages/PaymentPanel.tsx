import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Order } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useT } from '../lib/locale-context';

// Payments received on an order: totals, history, "record a payment", void.
// Works for every order; online orders simply show their single online payment.

const METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'other'] as const;
const ZERO_DECIMAL = new Set(['XOF', 'GNF', 'JPY', 'KRW', 'VND']);

type Props = {
  order: Order;
  /** Called with the refreshed order after a payment is recorded or voided. */
  onOrderChange: (order: Order) => void;
};

export function PaymentPanel({ order, onOrderChange }: Props) {
  const t = useT();
  const queryClient = useQueryClient();
  const currency = order.amounts.currency;
  const factor = ZERO_DECIMAL.has((currency || '').toUpperCase()) ? 1 : 100;

  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['order-payments', order.id],
    queryFn: () => api.getOrderPayments(order.id),
  });

  async function refresh() {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-payments', order.id] });
    queryClient.invalidateQueries({ queryKey: ['order-refunds', order.id] });
    onOrderChange(await api.getOrder(order.id));
  }

  const addMutation = useMutation({
    mutationFn: (body: Parameters<typeof api.recordPayment>[1]) => api.recordPayment(order.id, body),
    onSuccess: async () => {
      setFormOpen(false);
      setAmount('');
      setReference('');
      setNote('');
      setError(null);
      await refresh();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  const voidMutation = useMutation({
    mutationFn: (paymentId: string) => api.voidPayment(order.id, paymentId),
    onSuccess: refresh,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  const total = order.amounts.total_cents;
  const paid = data?.paid_cents ?? order.paid_cents ?? 0;
  const balance = data?.balance_cents ?? Math.max(total - paid, 0);
  const state = data?.payment_status ?? order.payment_status ?? 'unpaid';
  const closed = order.status === 'canceled' || order.status === 'refunded';
  const offline = (order.payment_method ?? 'online') !== 'online';

  function submit() {
    let amount_cents: number | undefined;
    if (amount.trim() !== '') {
      const parsed = Number(amount.replace(',', '.'));
      amount_cents = Math.round(parsed * factor);
      if (!Number.isFinite(parsed) || amount_cents <= 0 || amount_cents > balance) {
        setError(t('orders.pay.invalidAmount'));
        return;
      }
    }
    setError(null);
    addMutation.mutate({
      amount_cents,
      method,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
  }

  const pill: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    unpaid: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  };

  const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
  const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';

  return (
    <div className="p-3 rounded-lg text-sm space-y-3" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {t('orders.pay.title')}
          </p>
          <p className="font-mono mt-0.5">
            {formatPrice(paid, currency)} {t('orders.pay.of')} {formatPrice(total, currency)}
            {balance > 0 && !closed && (
              <span style={{ color: 'var(--text-secondary)' }}>
                {' · '}{t('orders.pay.balance')}: {formatPrice(balance, currency)}
              </span>
            )}
          </p>
        </div>
        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-sm ${pill[state] ?? pill.unpaid}`}>
          {t(`orders.pay.status.${state}` as Parameters<typeof t>[0])}
        </span>
      </div>

      {data && data.payments.length > 0 ? (
        <ul className="space-y-1">
          {data.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 text-xs font-mono">
              <span style={{ color: 'var(--text-secondary)' }}>
                {new Date(p.created_at.includes('T') ? p.created_at : p.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}
                {' · '}
                {t(`orders.pay.method.${p.method}` as Parameters<typeof t>[0])}
                {p.reference ? ` · ${p.reference}` : ''}
              </span>
              <span className="flex items-center gap-3">
                <span>{formatPrice(p.amount_cents, currency)}</span>
                {p.method !== 'online' && (
                  <button
                    type="button"
                    disabled={voidMutation.isPending}
                    onClick={() => confirm(t('orders.pay.voidConfirm')) && voidMutation.mutate(p.id)}
                    className="hover:underline disabled:opacity-50"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('orders.pay.void')}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('orders.pay.none')}</p>
      )}

      {balance > 0 && !closed && !formOpen && (
        <button
          type="button"
          onClick={() => { setFormOpen(true); setError(null); }}
          className="px-3 py-1.5 text-sm font-medium rounded-lg"
          style={{ background: 'var(--text)', color: 'var(--bg-card)' }}
        >
          {t('orders.pay.record')}
        </button>
      )}

      {formOpen && (
        <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                {t('orders.pay.amount')} ({currency})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={formatPrice(balance, currency)}
                className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2"
                style={inputStyle}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('orders.pay.amountHint')}</p>
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>{t('orders.pay.method')}</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
                className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2"
                style={inputStyle}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{t(`orders.pay.method.${m}` as Parameters<typeof t>[0])}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t('orders.pay.reference')}
              className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2"
              style={inputStyle}
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('orders.pay.note')}
              className="w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={addMutation.isPending}
              className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50"
              style={{ background: 'var(--text)', color: 'var(--bg-card)' }}
            >
              {t('orders.pay.submit')}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-sm hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('orders.manual.cancel')}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {offline && !closed && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('orders.pay.cancelHint')}</p>
      )}
    </div>
  );
}
