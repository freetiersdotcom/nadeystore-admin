import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useLocale } from '../lib/locale-context';

const S = {
  en: { show: 'Show profit', hide: 'Hide profit', revenue: 'Revenue (after discount and refunds)', cost: 'Cost', fees: 'Payment fees', margin: 'Profit', pct: 'Margin', missing: 'Profit is not shown: some items have no cost yet. Add them under Profit > Costs.', noCost: 'no cost', refundNote: 'The cost of refunded goods is not recovered.', private: 'Private: only people with cost access see this.' },
  fr: { show: 'Voir le bénéfice', hide: 'Masquer le bénéfice', revenue: 'Chiffre d’affaires (après remise et remboursements)', cost: 'Coût', fees: 'Frais de paiement', margin: 'Bénéfice', pct: 'Marge', missing: 'Bénéfice non affiché : certains articles n’ont pas encore de coût. Ajoutez-les dans Bénéfice > Coûts.', noCost: 'sans coût', refundNote: 'Le coût des produits remboursés n’est pas récupéré.', private: 'Privé : visible seulement par les personnes ayant accès aux coûts.' },
};
const box = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const muted = { color: 'var(--text-secondary)' };

/** Hidden by default; shown on demand so a margin is never on screen when the order is opened in front of a customer. */
export function OrderProfit({ orderId }: { orderId: string }) {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr'];
  const [open, setOpen] = useState(false);
  const { data, error } = useQuery({ queryKey: ['order-profit', orderId], queryFn: () => api.getOrderProfit(orderId), enabled: open });
  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between gap-3 text-sm"><span style={muted}>{label}</span><span className={strong ? 'font-semibold' : ''} style={{ color: 'var(--text)' }}>{value}</span></div>
  );
  return (
    <div data-testid="order-profit">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="tap text-sm font-medium px-3 py-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
        {open ? s.hide : s.show}
      </button>
      {open && error && <p className="text-sm mt-2" style={{ color: '#dc2626' }}>{(error as Error).message}</p>}
      {open && data && (
        <div className="mt-2 p-3 space-y-1.5" style={box}>
          {row(s.revenue, formatPrice(data.revenue_cents, data.currency))}
          {data.complete ? (<>
            {row(s.cost, formatPrice(data.cost_cents ?? 0, data.currency))}
            {data.fees_cents ? row(s.fees, formatPrice(data.fees_cents, data.currency)) : null}
            {row(s.margin, formatPrice(data.margin_cents ?? 0, data.currency), true)}
            {data.margin_pct != null && row(s.pct, `${data.margin_pct}%`)}
          </>) : <p className="text-xs" style={{ color: '#d97706' }}>{s.missing}</p>}
          <ul className="text-xs pt-1" style={muted}>
            {data.lines.map((l) => <li key={l.sku}>{l.qty} × {l.title} — {l.cost_cents == null ? s.noCost : formatPrice(l.cost_cents, data.currency)}</li>)}
          </ul>
          {data.refunded_cents > 0 && <p className="text-xs" style={muted}>{s.refundNote}</p>}
          <p className="text-xs" style={muted}>{s.private}</p>
        </div>
      )}
    </div>
  );
}
