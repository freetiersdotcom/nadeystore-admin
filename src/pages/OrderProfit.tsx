import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useLocale } from '../lib/locale-context';

const S = {
  en: { show: 'Show profit', hide: 'Hide profit', revenue: 'Revenue (after discount and refunds)', cost: 'Cost', fees: 'Payment fees', margin: 'Profit', pct: 'Margin', missing: 'Profit is not shown: some items have no cost yet. Add them under Profit > Costs.', noCost: 'no cost', unitCost: 'Cost of the whole line', save: 'Save cost', setHelp: 'Enter what each line without a cost cost you (for the whole line). Only this order changes.', refundNote: 'The cost of refunded goods is not recovered.', private: 'Private: only people with cost access see this.' },
  fr: { show: 'Voir le bénéfice', hide: 'Masquer le bénéfice', revenue: 'Chiffre d’affaires (après remise et remboursements)', cost: 'Coût', fees: 'Frais de paiement', margin: 'Bénéfice', pct: 'Marge', missing: 'Bénéfice non affiché : certains articles n’ont pas encore de coût. Ajoutez-les dans Bénéfice > Coûts.', noCost: 'sans coût', unitCost: 'Coût de toute la ligne', save: 'Enregistrer le coût', setHelp: 'Indiquez ce que chaque ligne sans coût vous a coûté (pour toute la ligne). Seule cette commande change.', refundNote: 'Le coût des produits remboursés n’est pas récupéré.', private: 'Privé : visible seulement par les personnes ayant accès aux coûts.' },
};
const zero = (c: string) => ['XOF', 'GNF', 'JPY', 'KRW', 'VND'].includes(c.toUpperCase());
/** "12,50" -> 1250; null when empty, undefined when it is not a valid amount for this currency. */
function toMinor(text: string, c: string): number | null | undefined {
  const t = text.trim().replace(/\s/g, '').replace(',', '.'); if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  if (zero(c)) return /\./.test(t) ? undefined : parseInt(t, 10);
  const [a, b = ''] = t.split('.'); if (b.length > 2) return undefined;
  return parseInt(a, 10) * 100 + parseInt((b + '00').slice(0, 2), 10);
}
const box = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const muted = { color: 'var(--text-secondary)' };

/** Hidden by default; shown on demand so a margin is never on screen when the order is opened in front of a customer. */
function LineCost({ line, currency, s, onSaved }: { line: { id: string; title: string; qty: number; cost_cents: number | null }; currency: string; s: typeof S.en; onSaved: () => void }) {
  const [v, setV] = useState(''); const [err, setErr] = useState('');
  const parsed = toMinor(v, currency);
  const save = useMutation({ mutationFn: () => api.setOrderLineCost(line.id, parsed as number | null), onSuccess: () => { setV(''); setErr(''); onSaved(); }, onError: (e: any) => setErr(e.message) });
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span>{line.qty} × {line.title} — {line.cost_cents == null ? s.noCost : formatPrice(line.cost_cents, currency)}</span>
      {line.cost_cents == null && (<>
        <input inputMode="decimal" aria-label={`${s.unitCost}: ${line.title}`} placeholder={s.unitCost} value={v} onChange={(e) => setV(e.target.value)} className="px-2 py-1 text-xs rounded-lg w-36" style={{ background: 'var(--bg-card)', border: `1px solid ${v && parsed === undefined ? '#dc2626' : 'var(--border)'}`, color: 'var(--text)' }} />
        <button type="button" disabled={!v || parsed === undefined || save.isPending} onClick={() => save.mutate()} className="tap text-xs font-medium px-2 py-1 rounded-lg disabled:opacity-50" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>{s.save}</button>
        {err && <span style={{ color: '#dc2626' }}>{err}</span>}
      </>)}
    </li>
  );
}

export function OrderProfit({ orderId }: { orderId: string }) {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr'];
  const qc = useQueryClient(); const [open, setOpen] = useState(false);
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
            {data.lines.map((l) => <LineCost key={l.id} line={l} currency={data.currency} s={s} onSaved={() => qc.invalidateQueries({ queryKey: ['order-profit', orderId] })} />)}
          </ul>
          {!data.complete && <p className="text-xs" style={muted}>{s.setHelp}</p>}
          {data.refunded_cents > 0 && <p className="text-xs" style={muted}>{s.refundNote}</p>}
          <p className="text-xs" style={muted}>{s.private}</p>
        </div>
      )}
    </div>
  );
}
