import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CircleCheck, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { STORE_CURRENCY } from '../lib/store';
import { useLocale } from '../lib/locale-context';

// Self-contained strings (this banner does not touch the core translation file).
const UI = {
  fr: {
    some: (n: number, cur: string, from: string) => `${n} variante${n > 1 ? 's' : ''} ${n > 1 ? 'portent' : 'porte'} encore une ancienne devise (${from}) au lieu de ${cur}.`,
    help: 'Les prix ne sont pas modifiés : ils sont déjà exprimés dans la devise de la boutique, seule l’étiquette change. Les commandes déjà passées gardent leur devise.',
    go: (cur: string) => `Passer toutes les variantes en ${cur}`, confirm: 'Confirmer', cancel: 'Annuler',
    done: (n: number, cur: string) => `${n} variante${n > 1 ? 's' : ''} passée${n > 1 ? 's' : ''} en ${cur}.`,
    env: (api: string, adm: string) => `L’admin affiche les prix en ${adm}, mais l’API a ${api} comme devise de la boutique (Livraison → devise de base). Alignez VITE_STORE_CURRENCY ou la devise de base.`,
  },
  en: {
    some: (n: number, cur: string, from: string) => `${n} variant${n > 1 ? 's' : ''} still ${n > 1 ? 'carry' : 'carries'} an old currency label (${from}) instead of ${cur}.`,
    help: 'Prices are not changed: they are already written in the store currency, only the label changes. Orders already placed keep their currency.',
    go: (cur: string) => `Set all variants to ${cur}`, confirm: 'Confirm', cancel: 'Cancel',
    done: (n: number, cur: string) => `${n} variant${n > 1 ? 's' : ''} set to ${cur}.`,
    env: (api: string, adm: string) => `The admin shows prices in ${adm}, but the API's store currency is ${api} (Shipping → base currency). Align VITE_STORE_CURRENCY or the base currency.`,
  },
};

/** Banner for the products page: offers to relabel old variants (USD) with the store currency. Hidden when everything matches. */
export function CurrencyAlign({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale(); const u = UI[locale === 'en' ? 'en' : 'fr'];
  const qc = useQueryClient(); const [asking, setAsking] = useState(false); const [doneMsg, setDoneMsg] = useState('');
  const { data } = useQuery({ queryKey: ['currency-audit'], queryFn: () => api.currencyAudit(), retry: false });
  const align = useMutation({
    mutationFn: () => api.alignCurrency(),
    onSuccess: (r) => { setAsking(false); setDoneMsg(u.done(r.updated, r.store_currency)); qc.invalidateQueries({ queryKey: ['currency-audit'] }); qc.invalidateQueries({ queryKey: ['products'] }); },
  });
  if (!data) return null;
  const box = 'mb-4 p-3 rounded-lg text-sm flex flex-wrap items-center gap-x-3 gap-y-2';
  const envNote = data.store_currency !== STORE_CURRENCY
    ? <div className={box} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: '#b42318' }} data-testid="currency-env"><AlertTriangle size={16} />{u.env(data.store_currency, STORE_CURRENCY)}</div>
    : null;
  if (data.mismatched === 0) {
    return doneMsg
      ? <div className={box} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} data-testid="currency-done"><CircleCheck size={16} style={{ color: 'var(--accent)' }} />{doneMsg}</div>
      : envNote;
  }
  const from = data.by_currency.filter((r) => r.currency !== data.store_currency).map((r) => r.currency).join(', ');
  return (
    <>
      {envNote}
      <div className={box} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} data-testid="currency-banner">
        <AlertTriangle size={16} style={{ color: '#b42318' }} />
        <div className="flex-1 min-w-[220px]">
          <p style={{ color: 'var(--text)' }}>{u.some(data.mismatched, data.store_currency, from)}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{u.help}</p>
          {align.error && <p className="text-xs mt-1" style={{ color: '#b42318' }}>{align.error instanceof Error ? align.error.message : String(align.error)}</p>}
        </div>
        {canWrite && (asking ? (
          <span className="flex gap-2">
            <button type="button" className="px-3 py-1.5 text-sm rounded font-semibold inline-flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }} disabled={align.isPending} onClick={() => align.mutate()}>
              {align.isPending && <Loader2 size={14} className="animate-spin" />}{u.confirm}
            </button>
            <button type="button" className="px-3 py-1.5 text-sm rounded" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} disabled={align.isPending} onClick={() => setAsking(false)}>{u.cancel}</button>
          </span>
        ) : (
          <button type="button" className="px-3 py-1.5 text-sm rounded font-semibold" style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }} onClick={() => setAsking(true)}>{u.go(data.store_currency)}</button>
        ))}
      </div>
    </>
  );
}
