import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CostItem } from '../lib/api';
import { formatPrice } from '../lib/format';
import { useLocale } from '../lib/locale-context';

const S = {
  en: {
    title: 'Profit', help: 'Costs are private: they never appear on the shop or in customer data. Profit is only counted on orders where every item has a cost.',
    report: 'Report', costs: 'Costs', fees: 'Payment fees', from: 'From', to: 'To', apply: 'Show',
    orders: 'Orders', revenue: 'Revenue', cost: 'Cost', feesL: 'Fees', margin: 'Profit', marginPct: 'Margin', coverage: 'Coverage',
    cov: (n: number, u: number) => `${n}% of revenue has known costs. ${u} order(s) have an item without a cost and are left out of the profit.`,
    refundNote: 'Revenue is after discounts and refunds; shipping is not counted. The cost of refunded goods is not recovered.',
    byProduct: 'By product', product: 'Product', units: 'Units', none: 'No paid orders in this period.', trunc: 'Only the first 5000 orders are counted — choose a shorter period.',
    byDay: 'By day', day: 'Day',
    search: 'Search product or SKU', missing: 'Only items without a cost', sku: 'SKU', price: 'Price', costCol: 'Cost', save: 'Save', saved: 'Saved.',
    exportCsv: 'Export CSV', importCsv: 'Import CSV', importHelp: 'A file with columns "sku" and "cost" (in the shop currency, e.g. 12.50). Nothing is changed if any line has a problem.',
    check: 'Check the file', checked: (n: number) => `The file is fine: ${n} cost(s) would be updated.`, imported: (n: number) => `${n} cost(s) updated.`, line: 'Line',
    feesHelp: 'Percentage the payment method takes (e.g. 2.9 for a card). Leave empty for none. Fees are taken off the profit.', saveFees: 'Save fees', pct: '%',
    emptyCosts: 'No products yet.',
  },
  fr: {
    title: 'Bénéfice', help: 'Les coûts sont privés : ils n’apparaissent jamais sur la boutique ni dans les données clients. Le bénéfice n’est compté que sur les commandes dont tous les articles ont un coût.',
    report: 'Rapport', costs: 'Coûts', fees: 'Frais de paiement', from: 'Du', to: 'Au', apply: 'Afficher',
    orders: 'Commandes', revenue: 'Chiffre d’affaires', cost: 'Coût', feesL: 'Frais', margin: 'Bénéfice', marginPct: 'Marge', coverage: 'Couverture',
    cov: (n: number, u: number) => `${n} % du chiffre d’affaires a un coût connu. ${u} commande(s) ont un article sans coût et sont exclues du bénéfice.`,
    refundNote: 'Le chiffre d’affaires est après remises et remboursements ; la livraison n’est pas comptée. Le coût des produits remboursés n’est pas récupéré.',
    byProduct: 'Par produit', product: 'Produit', units: 'Unités', none: 'Aucune commande payée sur cette période.', trunc: 'Seules les 5000 premières commandes sont comptées — choisissez une période plus courte.',
    byDay: 'Par jour', day: 'Jour',
    search: 'Chercher un produit ou un SKU', missing: 'Seulement les articles sans coût', sku: 'SKU', price: 'Prix', costCol: 'Coût', save: 'Enregistrer', saved: 'Enregistré.',
    exportCsv: 'Exporter en CSV', importCsv: 'Importer un CSV', importHelp: 'Un fichier avec les colonnes « sku » et « cost » (dans la devise de la boutique, ex. 12.50). Rien n’est modifié si une ligne pose problème.',
    check: 'Vérifier le fichier', checked: (n: number) => `Le fichier est correct : ${n} coût(s) seraient mis à jour.`, imported: (n: number) => `${n} coût(s) mis à jour.`, line: 'Ligne',
    feesHelp: 'Pourcentage prélevé par le moyen de paiement (ex. 2,9 pour une carte). Laisser vide si aucun. Les frais sont déduits du bénéfice.', saveFees: 'Enregistrer les frais', pct: '%',
    emptyCosts: 'Aucun produit pour le moment.',
  },
};
const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const box = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const th = 'text-left text-xs font-medium uppercase tracking-wide px-2 py-2';
const td = 'px-2 py-2 text-sm';

const zero = (c: string) => ['XOF', 'GNF', 'JPY', 'KRW', 'VND'].includes(c.toUpperCase());
const toMajor = (cents: number | null, c: string) => (cents == null ? '' : zero(c) ? String(cents) : (cents / 100).toFixed(2));
/** "12,50" -> 1250. Returns undefined when the text is not a valid amount, null when empty. */
function toMinor(text: string, c: string): number | null | undefined {
  const t = text.trim().replace(/\s/g, '').replace(',', '.'); if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  if (zero(c)) return /\./.test(t) ? undefined : parseInt(t, 10);
  const [a, b = ''] = t.split('.'); if (b.length > 2) return undefined;
  return parseInt(a, 10) * 100 + parseInt((b + '00').slice(0, 2), 10);
}
const day = (d: Date) => d.toISOString().slice(0, 10);

export function Profit() {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr'];
  const [tab, setTab] = useState<'report' | 'costs' | 'fees'>('report');
  const tabs: ['report' | 'costs' | 'fees', string][] = [['report', s.report], ['costs', s.costs], ['fees', s.fees]];
  return (
    <div className="space-y-5" data-testid="profit-page">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
        <p className="text-xs" style={muted}>{s.help}</p>
      </div>
      <div className="flex gap-2 flex-wrap" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={btn} style={tab === id ? solid : ghost}>{label}</button>
        ))}
      </div>
      {tab === 'report' && <ReportTab s={s} />}
      {tab === 'costs' && <CostsTab s={s} />}
      {tab === 'fees' && <FeesTab s={s} />}
    </div>
  );
}

type Str = typeof S.en;

function ReportTab({ s }: { s: Str }) {
  const [from, setFrom] = useState(() => day(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => day(new Date()));
  const [range, setRange] = useState({ from, to });
  const { data, error } = useQuery({ queryKey: ['profit', range.from, range.to], queryFn: () => api.getProfit(range.from, range.to) });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs" style={muted}>{s.from}<br /><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} style={inputStyle} /></label>
        <label className="text-xs" style={muted}>{s.to}<br /><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} style={inputStyle} /></label>
        <button className={btn} style={solid} onClick={() => setRange({ from, to })}>{s.apply}</button>
      </div>
      {error && <p className="text-sm" style={{ color: '#dc2626' }}>{(error as Error).message}</p>}
      {data && data.truncated && <p className="text-xs" style={{ color: '#d97706' }}>{s.trunc}</p>}
      {data && data.currencies.length === 0 && <p className="text-sm" style={muted}>{s.none}</p>}
      {data?.currencies.map((c) => {
        const tile = (label: string, value: string, strong = false) => (
          <div className="p-3 rounded-lg" style={box}><div className="text-xs" style={muted}>{label}</div><div className={`text-base ${strong ? 'font-semibold' : ''}`} style={{ color: 'var(--text)' }}>{value}</div></div>
        );
        const prods = data.by_product.filter((p) => p.currency === c.currency);
        const days = data.by_day.filter((d) => d.currency === c.currency);
        return (
          <section key={c.currency} className="space-y-3" data-testid={`profit-${c.currency}`}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.currency}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {tile(s.orders, String(c.orders))}
              {tile(s.revenue, formatPrice(c.revenue_cents, c.currency))}
              {tile(s.cost, formatPrice(c.cost_cents, c.currency))}
              {tile(s.feesL, formatPrice(c.fees_cents, c.currency))}
              {tile(s.margin, formatPrice(c.margin_cents, c.currency), true)}
              {tile(s.marginPct, c.margin_pct == null ? '—' : `${c.margin_pct}%`)}
            </div>
            <p className="text-xs" style={c.coverage_pct < 100 ? { color: '#d97706' } : muted}>{s.coverage}: {s.cov(c.coverage_pct, c.unknown_orders)}</p>
            <p className="text-xs" style={muted}>{s.refundNote}</p>
            {prods.length > 0 && (
              <div className="overflow-x-auto" style={box}>
                <table className="w-full"><caption className="text-left text-sm font-semibold px-2 pt-2" style={{ color: 'var(--text)' }}>{s.byProduct}</caption>
                  <thead><tr style={muted}><th className={th}>{s.product}</th><th className={th}>{s.units}</th><th className={th}>{s.revenue}</th><th className={th}>{s.margin}</th></tr></thead>
                  <tbody>{prods.map((p) => (
                    <tr key={p.sku} style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
                      <td className={td}>{p.title}</td><td className={td}>{p.units}</td><td className={td}>{formatPrice(p.revenue_cents, c.currency)}</td><td className={td}>{formatPrice(p.margin_cents, c.currency)}</td>
                    </tr>))}</tbody></table>
              </div>
            )}
            {days.length > 0 && (
              <div className="overflow-x-auto" style={box}>
                <table className="w-full"><caption className="text-left text-sm font-semibold px-2 pt-2" style={{ color: 'var(--text)' }}>{s.byDay}</caption>
                  <thead><tr style={muted}><th className={th}>{s.day}</th><th className={th}>{s.revenue}</th><th className={th}>{s.margin}</th></tr></thead>
                  <tbody>{days.map((d) => (
                    <tr key={d.day} style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
                      <td className={td}>{d.day}</td><td className={td}>{formatPrice(d.revenue_cents, c.currency)}</td><td className={td}>{formatPrice(d.margin_cents, c.currency)}</td>
                    </tr>))}</tbody></table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function CostRow({ item, s, onSaved }: { item: CostItem; s: Str; onSaved: () => void }) {
  const [v, setV] = useState<string | null>(null); const [err, setErr] = useState('');
  const shown = v ?? toMajor(item.cost_cents, item.currency);
  const save = useMutation({ mutationFn: (c: number | null) => api.setCost(item.sku, c), onSuccess: () => { setV(null); setErr(''); onSaved(); }, onError: (e: any) => setErr(e.message) });
  const parsed = v == null ? undefined : toMinor(v, item.currency);
  const bad = v != null && parsed === undefined;
  return (
    <tr style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
      <td className={td}>{item.product_title}{item.variant_title && item.variant_title !== 'Default' ? ` — ${item.variant_title}` : ''}<div className="text-xs" style={muted}>{item.sku}</div></td>
      <td className={td}>{formatPrice(item.price_cents, item.currency)}</td>
      <td className={td}>
        <div className="flex items-center gap-1">
          <input inputMode="decimal" aria-label={`${s.costCol} ${item.sku}`} value={shown} onChange={(e) => setV(e.target.value)} className={`${inputCls} w-28`} style={{ ...inputStyle, ...(bad ? { borderColor: '#dc2626' } : {}) }} />
          {v != null && !bad && <button className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate(parsed as number | null)}>{s.save}</button>}
        </div>
        {err && <div className="text-xs" style={{ color: '#dc2626' }}>{err}</div>}
      </td>
    </tr>
  );
}

function CostsTab({ s }: { s: Str }) {
  const qc = useQueryClient(); const refresh = () => qc.invalidateQueries({ queryKey: ['costs'] });
  const { data } = useQuery({ queryKey: ['costs'], queryFn: () => api.getCosts() });
  const [q, setQ] = useState(''); const [onlyMissing, setOnlyMissing] = useState(false);
  const [text, setText] = useState(''); const [rep, setRep] = useState<{ ok: boolean; problems: { line: number; message: string }[]; updated: number; to_update?: number } | null>(null); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const run = useMutation({
    mutationFn: (dry: boolean) => api.importCosts(text, dry).then((r) => ({ r, dry })),
    onSuccess: ({ r, dry }) => { setErr(''); setRep(r); setMsg(r.ok ? (dry ? s.checked(r.to_update ?? 0) : s.imported(r.updated)) : ''); if (r.ok && !dry) { setText(''); refresh(); } },
    onError: (e: any) => { setMsg(''); setErr(e.message); },
  });
  if (!data) return null;
  const needle = q.trim().toLowerCase();
  const rows = data.items.filter((i) => (!onlyMissing || i.cost_cents == null) && (!needle || `${i.product_title} ${i.variant_title} ${i.sku}`.toLowerCase().includes(needle)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.search} className={`${inputCls} flex-1 min-w-[12rem]`} style={inputStyle} />
        <label className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text)' }}><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />{s.missing}</label>
        <button className={btn} style={ghost} onClick={() => api.exportCosts().catch((e) => setErr(e.message))}>{s.exportCsv}</button>
      </div>
      {err && <p className="text-sm" style={{ color: '#dc2626' }}>{err}</p>}
      {rows.length === 0 ? <p className="text-sm" style={muted}>{s.emptyCosts}</p> : (
        <div className="overflow-x-auto" style={box}>
          <table className="w-full"><thead><tr style={muted}><th className={th}>{s.product}</th><th className={th}>{s.price}</th><th className={th}>{s.costCol}</th></tr></thead>
            <tbody>{rows.map((i) => <CostRow key={i.sku} item={i} s={s} onSaved={refresh} />)}</tbody></table>
        </div>
      )}
      <div className="p-3 space-y-2" style={box}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.importCsv}</h2>
        <p className="text-xs" style={muted}>{s.importHelp}</p>
        <input ref={file} type="file" accept=".csv,text/csv" className="text-sm" style={{ color: 'var(--text)' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); setRep(null); setMsg(''); } }} />
        {text && (
          <div className="flex gap-2">
            <button className={btn} style={ghost} disabled={run.isPending} onClick={() => run.mutate(true)}>{s.check}</button>
            <button className={btn} style={solid} disabled={run.isPending} onClick={() => run.mutate(false)}>{s.importCsv}</button>
          </div>
        )}
        {msg && <p className="text-sm" role="status" style={{ color: 'var(--text)' }}>{msg}</p>}
        {rep && !rep.ok && (
          <ul className="text-sm space-y-0.5" style={{ color: '#dc2626' }}>{rep.problems.map((p, i) => <li key={i}>{s.line} {p.line}: {p.message}</li>)}</ul>
        )}
      </div>
    </div>
  );
}

function FeesTab({ s }: { s: Str }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['profit-fees'], queryFn: () => api.getProfitFees() });
  const [f, setF] = useState<Record<string, string> | null>(null); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: (fees: Record<string, number>) => api.saveProfitFees(fees),
    onSuccess: () => { setErr(''); setNote(s.saved); setF(null); qc.invalidateQueries({ queryKey: ['profit-fees'] }); qc.invalidateQueries({ queryKey: ['profit'] }); },
    onError: (e: any) => { setNote(''); setErr(e.message); },
  });
  if (!data) return null;
  const cur = f ?? Object.fromEntries(data.methods.map((m) => [m, data.fees[m] != null ? String(data.fees[m]) : '']));
  const submit = () => {
    const out: Record<string, number> = {};
    for (const [m, v] of Object.entries(cur)) { const t = v.trim().replace(',', '.'); if (!t) continue; const n = Number(t); if (!Number.isFinite(n) || n < 0 || n > 100) { setErr(`${m}: 0–100`); return; } out[m] = n; }
    save.mutate(out);
  };
  return (
    <div className="p-3 space-y-3 max-w-md" style={box}>
      <p className="text-xs" style={muted}>{s.feesHelp}</p>
      {data.methods.map((m) => (
        <label key={m} className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--text)' }}>
          <span>{m}</span>
          <span className="flex items-center gap-1"><input inputMode="decimal" value={cur[m] ?? ''} onChange={(e) => setF({ ...cur, [m]: e.target.value })} className={`${inputCls} w-24`} style={inputStyle} />{s.pct}</span>
        </label>
      ))}
      {err && <p className="text-sm" style={{ color: '#dc2626' }}>{err}</p>}
      {note && <p className="text-xs" role="status" style={{ color: 'var(--text)' }}>{note}</p>}
      <button className={btn} style={solid} disabled={save.isPending} onClick={submit}>{s.saveFees}</button>
    </div>
  );
}
