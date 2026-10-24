import { useState } from 'react';
import { api, Order } from '../lib/api';
import { useT } from '../lib/locale-context';

// Deposit / installment follow-up on an order: the date the balance is expected,
// the customer's pay link (copy it, or email it), and an "overdue" flag.
// Shown only while an offline order (deposit, cash on delivery, manual) still has a balance.

type Props = {
  order: Order;
  onOrderChange: (order: Order) => void;
};

export function PlanPanel({ order, onOrderChange }: Props) {
  const t = useT();
  const closed = order.status === 'canceled' || order.status === 'refunded';
  const balance = order.balance_cents ?? 0;
  const [date, setDate] = useState((order.due_at ?? '').slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if ((order.payment_method ?? 'online') === 'online' || closed || balance <= 0) return null;

  const overdue = !!order.due_at && Date.parse(order.due_at) < Date.now();
  const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
  const btnStyle = { background: 'var(--text)', color: 'var(--bg-card)' };

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null); setMessage(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  const saveDate = () => run(async () => {
    // End of the chosen day, local time.
    const iso = date ? new Date(`${date}T23:59:59`).toISOString() : null;
    await api.orderPayLink(order.id, { due_at: iso });
    onOrderChange(await api.getOrder(order.id));
    setMessage(t('plan.saved'));
  });

  const copyLink = () => run(async () => {
    const { pay_url } = await api.orderPayLink(order.id, {});
    try { await navigator.clipboard.writeText(pay_url); setMessage(t('plan.copied')); }
    catch { window.prompt(t('plan.copyManual'), pay_url); }
  });

  const sendLink = () => run(async () => {
    await api.orderPayLink(order.id, { send: true });
    setMessage(t('plan.sent'));
  });

  return (
    <div className="p-3 rounded-lg text-sm space-y-3" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {t('plan.title')}
        </p>
        {overdue && (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-sm bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            {t('plan.overdue')}
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('plan.due')}
          </label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2" style={inputStyle} />
        </div>
        <button type="button" onClick={saveDate} disabled={busy}
          className="px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50" style={btnStyle}>
          {t('common.save')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={copyLink} disabled={busy}
          className="px-3 py-1.5 text-sm font-medium rounded-lg disabled:opacity-50" style={btnStyle}>
          {t('plan.copyLink')}
        </button>
        <button type="button" onClick={sendLink} disabled={busy}
          className="text-sm hover:underline disabled:opacity-50" style={{ color: 'var(--text-secondary)' }}>
          {t('plan.sendLink')}
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('plan.hint')}</p>

      {message && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{message}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
