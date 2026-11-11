import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AdsRow } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { STORE_CURRENCY } from '../../lib/store';
import { useLocale } from '../../lib/locale-context';

const S = {
  en: {
    title: 'Ad tracking',
    help: 'Shows which campaign brought each order, what it earned after the cost of the goods, and what you spent on it. A visitor is only tracked after accepting measurement cookies on the shop, so some orders will show as direct.',
    tabs: { report: 'Report', spend: 'Ad spend', links: 'Tracking links' },
    from: 'From', to: 'To', d7: '7 days', d30: '30 days', d90: '90 days',
    campaign: 'Campaign', source: 'Source', orders: 'Orders', revenue: 'Sales', profit: 'Profit', spend: 'Spend', roas: 'Sales per 1 spent', after: 'Profit after spend',
    totals: 'Total', attributed: 'Brought by campaigns', share: 'of sales', none: 'No paid orders in this period.', coverage: 'Profit counts only orders whose items all have a cost: coverage', unknown: '—',
    truncated: 'Only the first 5000 orders are counted. Choose a shorter period.',
    spendHelp: 'Type what you paid the platform, with the campaign name exactly as in the link (the utm_campaign). A payment covering several days is spread evenly over them.',
    platform: 'Platform', amount: 'Amount', currency: 'Currency', note: 'Note', add: 'Add', remove: 'Remove', period: 'Period', saved: 'Saved.', invalid: 'Check the amount and the dates.', empty: 'No ad spend entered yet.',
    linksHelp: 'Paste the result as the destination link of your ad. Meta and TikTok add their own click id automatically, so tracking works even without these parameters, but named campaigns make the report readable.',
    page: 'Page address', pagePh: 'https://your-shop.com/fr/', name: 'Campaign name', namePh: 'black-friday', content: 'Ad / creative (optional)', result: 'Your link', copy: 'Copy', copied: 'Copied.',
  },
  fr: {
    title: 'Suivi des publicités',
    help: 'Montre quelle campagne a amené chaque commande, ce qu’elle a rapporté après le coût des marchandises, et ce que vous y avez dépensé. Un visiteur n’est suivi qu’après avoir accepté les cookies de mesure sur la boutique : certaines commandes apparaîtront donc comme directes.',
    tabs: { report: 'Rapport', spend: 'Dépenses pub', links: 'Liens de suivi' },
    from: 'Du', to: 'Au', d7: '7 jours', d30: '30 jours', d90: '90 jours',
    campaign: 'Campagne', source: 'Source', orders: 'Commandes', revenue: 'Ventes', profit: 'Bénéfice', spend: 'Dépenses', roas: 'Ventes pour 1 dépensé', after: 'Bénéfice après dépenses',
    totals: 'Total', attributed: 'Amené par des campagnes', share: 'des ventes', none: 'Aucune commande payée sur cette période.', coverage: 'Le bénéfice ne compte que les commandes dont tous les articles ont un coût : couverture', unknown: '—',
    truncated: 'Seules les 5000 premières commandes sont comptées. Choisissez une période plus courte.',
    spendHelp: 'Saisissez ce que vous avez payé à la plateforme, avec le nom de campagne exactement comme dans le lien (utm_campaign). Un paiement couvrant plusieurs jours est réparti à parts égales.',
    platform: 'Plateforme', amount: 'Montant', currency: 'Devise', note: 'Note', add: 'Ajouter', remove: 'Retirer', period: 'Période', saved: 'Enregistré.', invalid: 'Vérifiez le montant et les dates.', empty: 'Aucune dépense saisie pour le moment.',
    linksHelp: 'Collez le résultat comme lien de destination de votre publicité. Meta et TikTok ajoutent eux-mêmes leur identifiant de clic, donc le suivi marche même sans ces paramètres, mais des campagnes nommées rendent le rapport lisible.',
    page: 'Adresse de la page', pagePh: 'https://votre-boutique.com/fr/', name: 'Nom de la campagne', namePh: 'black-friday', content: 'Annonce / visuel (facultatif)', result: 'Votre lien', copy: 'Copier', copied: 'Copié.',
  },
};

const zero = (c: string) => ['XOF', 'GNF', 'JPY', 'KRW', 'VND'].includes(c.toUpperCase());
/** "12,50" -> 1250; null when empty, undefined when not a valid amount for this currency. */
function toMinor(text: string, c: string): number | null | undefined {
  const t = text.trim().replace(/\s/g, '').replace(',', '.'); if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  if (zero(c)) return /\./.test(t) ? undefined : parseInt(t, 10);
  const [a, b = ''] = t.split('.'); if (b.length > 2) return undefined;
  return parseInt(a, 10) * 100 + parseInt((b + '00').slice(0, 2), 10);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
const SOURCES: Record<string, { source: string; medium: string }> = { facebook: { source: 'facebook', medium: 'paid' }, tiktok: { source: 'tiktok', medium: 'paid' }, google: { source: 'google', medium: 'cpc' }, whatsapp: { source: 'whatsapp', medium: 'message' }, other: { source: '', medium: 'paid' } };

const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const box = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const th = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide';

export function Ads({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr'];
  const [tab, setTab] = useState<'report' | 'spend' | 'links'>('report');
  return (
    <div className="space-y-5" data-testid="ads-page">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
        <p className="text-xs" style={muted}>{s.help}</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(['report', 'spend', 'links'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={btn} style={tab === k ? solid : ghost} data-testid={`ads-tab-${k}`}>{s.tabs[k]}</button>
        ))}
      </div>
      {tab === 'report' && <Report s={s} />}
      {tab === 'spend' && <Spend s={s} canWrite={canWrite} />}
      {tab === 'links' && <Links s={s} />}
    </div>
  );
}

function Report({ s }: { s: (typeof S)['en'] }) {
  const [from, setFrom] = useState(daysAgo(29)); const [to, setTo] = useState(iso(new Date()));
  const { data, isLoading, error } = useQuery({ queryKey: ['ads-report', from, to], queryFn: () => api.getAdsReport(from, to), enabled: from <= to });
  const preset = (n: number) => { setFrom(daysAgo(n - 1)); setTo(iso(new Date())); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className={labelCls} style={muted}>{s.from}</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} style={inputStyle} /></label>
        <label className="text-sm"><span className={labelCls} style={muted}>{s.to}</span><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} style={inputStyle} /></label>
        {[[7, s.d7], [30, s.d30], [90, s.d90]].map(([n, l]) => <button key={n as number} type="button" className={btn} style={ghost} onClick={() => preset(n as number)}>{l}</button>)}
      </div>
      {error && <p className="text-sm" style={{ color: '#dc2626' }}>{(error as Error).message}</p>}
      {isLoading && <p className="text-sm" style={muted}>…</p>}
      {data?.truncated && <p className="text-xs" style={{ color: '#d97706' }}>{s.truncated}</p>}
      {data && data.currencies.length === 0 && <p className="text-sm" style={muted}>{s.none}</p>}
      {data?.currencies.map((c) => {
        const share = c.totals.revenue_cents > 0 ? Math.round((c.totals.attributed_revenue_cents / c.totals.revenue_cents) * 100) : 0;
        return (
          <div key={c.currency} className="space-y-2" data-testid={`ads-currency-${c.currency}`}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.currency}</h2>
            <p className="text-xs" style={muted}>
              {s.totals}: {c.totals.orders} · {formatPrice(c.totals.revenue_cents, c.currency)} · {s.spend}: {formatPrice(c.totals.spend_cents, c.currency)}
              {c.totals.roas != null ? ` · ${s.roas}: ${c.totals.roas}` : ''} — {s.attributed}: {c.totals.attributed_orders} ({share}% {s.share})
            </p>
            <div className="overflow-x-auto rounded-lg" style={box}>
              <table className="w-full text-sm">
                <thead><tr style={{ color: 'var(--text-secondary)' }}>
                  <th className={th}>{s.campaign}</th><th className={th}>{s.source}</th><th className={th}>{s.orders}</th><th className={th}>{s.revenue}</th>
                  <th className={th}>{s.profit}</th><th className={th}>{s.spend}</th><th className={th}>{s.roas}</th><th className={th}>{s.after}</th>
                </tr></thead>
                <tbody>{c.rows.map((r: AdsRow) => (
                  <tr key={r.key || 'direct'} style={{ borderTop: '1px solid var(--border)', color: r.key === '' ? 'var(--text-secondary)' : 'var(--text)' }}>
                    <td className="px-3 py-2">{r.campaign}</td>
                    <td className="px-3 py-2">{[r.source, r.medium].filter(Boolean).join(' / ') || s.unknown}</td>
                    <td className="px-3 py-2">{r.orders}</td>
                    <td className="px-3 py-2">{formatPrice(r.revenue_cents, c.currency)}</td>
                    <td className="px-3 py-2">{r.known_orders > 0 ? <>{formatPrice(r.margin_cents, c.currency)}{r.coverage_pct < 100 && <span className="text-xs" style={muted}> ({r.coverage_pct}%)</span>}</> : s.unknown}</td>
                    <td className="px-3 py-2">{r.spend_cents > 0 ? formatPrice(r.spend_cents, c.currency) : s.unknown}</td>
                    <td className="px-3 py-2">{r.roas ?? s.unknown}</td>
                    <td className="px-3 py-2">{r.net_cents == null ? s.unknown : formatPrice(r.net_cents, c.currency)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            <p className="text-xs" style={muted}>{s.coverage}.</p>
          </div>
        );
      })}
    </div>
  );
}

function Spend({ s, canWrite }: { s: (typeof S)['en']; canWrite: boolean }) {
  const qc = useQueryClient(); const refresh = () => { qc.invalidateQueries({ queryKey: ['ads-spend'] }); qc.invalidateQueries({ queryKey: ['ads-report'] }); };
  const { data } = useQuery({ queryKey: ['ads-spend'], queryFn: () => api.getAdsSpend() });
  const [f, setF] = useState({ platform: 'facebook', campaign: '', from: daysAgo(6), to: iso(new Date()), amount: '', currency: STORE_CURRENCY, note: '' });
  const [msg, setMsg] = useState(''); const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const cents = toMinor(f.amount, f.currency);
  const add = useMutation({
    mutationFn: () => api.addAdsSpend({ platform: f.platform.trim(), campaign: f.campaign.trim(), from_day: f.from, to_day: f.to, amount_cents: cents as number, currency: f.currency.trim().toUpperCase(), note: f.note.trim() || null }),
    onSuccess: () => { setMsg(s.saved); setF({ ...f, campaign: '', amount: '', note: '' }); refresh(); }, onError: (e: any) => setMsg(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => api.deleteAdsSpend(id), onSuccess: refresh });
  const ok = !!f.platform.trim() && !!f.campaign.trim() && typeof cents === 'number' && cents > 0 && f.from <= f.to && f.currency.trim().length === 3;
  return (
    <div className="space-y-4">
      <p className="text-xs" style={muted}>{s.spendHelp}</p>
      {canWrite && (
        <div className="p-3 grid gap-3 sm:grid-cols-3" style={box}>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.platform}</span>
            <input list="ads-platforms" value={f.platform} onChange={(e) => set({ platform: e.target.value })} className={inputCls} style={inputStyle} />
            <datalist id="ads-platforms"><option value="facebook" /><option value="tiktok" /><option value="google" /></datalist></label>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.campaign}</span><input value={f.campaign} onChange={(e) => set({ campaign: e.target.value })} placeholder="black-friday" className={inputCls} style={inputStyle} data-testid="ads-spend-campaign" /></label>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.note}</span><input value={f.note} onChange={(e) => set({ note: e.target.value })} className={inputCls} style={inputStyle} /></label>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.from}</span><input type="date" value={f.from} max={f.to} onChange={(e) => set({ from: e.target.value })} className={inputCls} style={inputStyle} /></label>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.to}</span><input type="date" value={f.to} min={f.from} onChange={(e) => set({ to: e.target.value })} className={inputCls} style={inputStyle} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm"><span className={labelCls} style={muted}>{s.amount}</span><input inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value })} className={inputCls} style={inputStyle} data-testid="ads-spend-amount" /></label>
            <label className="text-sm"><span className={labelCls} style={muted}>{s.currency}</span><input value={f.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} className={inputCls} style={inputStyle} /></label>
          </div>
          <div className="sm:col-span-3 flex items-center gap-3">
            <button type="button" className={btn} style={solid} disabled={!ok || add.isPending} onClick={() => add.mutate()} data-testid="ads-spend-add">{s.add}</button>
            {f.amount && cents === undefined && <span className="text-xs" style={{ color: '#dc2626' }}>{s.invalid}</span>}
            {msg && <span className="text-xs" role="status" style={muted}>{msg}</span>}
          </div>
        </div>
      )}
      {data && data.items.length === 0 && <p className="text-sm" style={muted}>{s.empty}</p>}
      <ul className="space-y-2">
        {data?.items.map((i) => (
          <li key={i.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={box}>
            <span style={{ color: 'var(--text)' }}><b>{i.campaign}</b> · {i.platform} · {i.from_day === i.to_day ? i.from_day : `${i.from_day} → ${i.to_day}`} · {formatPrice(i.amount_cents, i.currency)}{i.note ? ` · ${i.note}` : ''}</span>
            {canWrite && <button type="button" className={btn} style={ghost} onClick={() => del.mutate(i.id)}>{s.remove}</button>}
          </li>))}
      </ul>
    </div>
  );
}

function Links({ s }: { s: (typeof S)['en'] }) {
  const [base, setBase] = useState(''); const [plat, setPlat] = useState('facebook'); const [name, setName] = useState(''); const [content, setContent] = useState(''); const [copied, setCopied] = useState(false);
  let link = '';
  try {
    if (base.trim()) {
      const u = new URL(base.trim()); const p = SOURCES[plat];
      if (p.source) u.searchParams.set('utm_source', p.source);
      u.searchParams.set('utm_medium', p.medium);
      if (name.trim()) u.searchParams.set('utm_campaign', name.trim());
      if (content.trim()) u.searchParams.set('utm_content', content.trim());
      link = u.toString();
    }
  } catch { link = ''; }
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };
  return (
    <div className="space-y-3 max-w-xl">
      <p className="text-xs" style={muted}>{s.linksHelp}</p>
      <label className="block text-sm"><span className={labelCls} style={muted}>{s.page}</span><input value={base} onChange={(e) => setBase(e.target.value)} placeholder={s.pagePh} className={inputCls} style={inputStyle} data-testid="ads-link-base" /></label>
      <label className="block text-sm"><span className={labelCls} style={muted}>{s.platform}</span>
        <select value={plat} onChange={(e) => setPlat(e.target.value)} className={inputCls} style={inputStyle}>{Object.keys(SOURCES).map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
      <label className="block text-sm"><span className={labelCls} style={muted}>{s.name}</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder={s.namePh} className={inputCls} style={inputStyle} data-testid="ads-link-name" /></label>
      <label className="block text-sm"><span className={labelCls} style={muted}>{s.content}</span><input value={content} onChange={(e) => setContent(e.target.value)} className={inputCls} style={inputStyle} /></label>
      {link && (
        <div className="p-3 space-y-2" style={box}>
          <p className="text-xs font-medium" style={muted}>{s.result}</p>
          <p className="text-sm break-all" style={{ color: 'var(--text)' }} data-testid="ads-link-result">{link}</p>
          <button type="button" className={btn} style={ghost} onClick={copy}>{copied ? s.copied : s.copy}</button>
        </div>
      )}
    </div>
  );
}
