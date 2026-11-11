import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type SubPlan, type SubRow } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { STORE_CURRENCY } from '../../lib/store';
import { useLocale } from '../../lib/locale-context';

const S = {
  en: {
    title: 'Subscriptions',
    help: 'Put a plan on any product: “every month at this price”. Each cycle becomes an ordinary order, and the customer gets a pay link by e-mail (mobile money cannot be charged automatically). Unpaid orders are cancelled after a grace period and the subscription pauses. Customers can pause, skip or stop from a private link.',
    tabs: { subs: 'Subscribers', plans: 'Plans', settings: 'Settings' },
    every: (n: number, u: string) => (u === 'week' ? (n === 1 ? 'every week' : `every ${n} weeks`) : n === 1 ? 'every month' : `every ${n} months`),
    status: { active: 'Active', paused: 'Paused', canceled: 'Stopped', ended: 'Finished' } as Record<string, string>, all: 'All',
    search: 'Search name, e-mail, product', empty: 'No subscribers yet.', next: 'Next', cycles: 'paid cycles', waiting: 'Waiting for stock', unpaidPause: 'Paused: unpaid', last: 'Last order', open: 'Waiting for payment',
    pause: 'Pause', resume: 'Resume', skip: 'Skip next', cancel: 'Stop', cancelConfirm: 'Stop this subscription for good?', renew: 'Create next order now', copyLink: 'Copy customer link', copied: 'Copied.', noLink: 'Open this tab once more: the link needs the shop address.', orders: 'Renewal orders', details: 'Details', hide: 'Hide',
    add: 'Add a subscriber', plan: 'Plan', email: 'E-mail', name: 'Name', phone: 'Phone / WhatsApp', qty: 'Quantity', lang: 'Language', start: 'First order on', note: 'Note', address: 'Delivery address (physical products)', line1: 'Address', city: 'City', country: 'Country (2 letters, e.g. BJ)', create: 'Add', fixed: 'Saved.', needPlan: 'Create a plan first.',
    planHelp: 'A plan is a product variant plus a rhythm and a price per cycle. A price change applies to new subscribers only; existing ones keep theirs. A product can have several plans.',
    product: 'Product', pick: 'Choose…', planName: 'Plan name (shown to customers)', unit: 'Rhythm', week: 'weeks', month: 'months', price: 'Price per cycle', maxCycles: 'Number of cycles (empty = until stopped)', active: 'Open to new subscribers', save: 'Save', remove: 'Delete', removeConfirm: 'Delete this plan?', subscribers: 'subscribers', invalid: 'Check the fields.', in_use: 'This plan has subscribers: switch it off instead.',
    lead: 'Create each order this many days before it is due', remind: 'Send one reminder this many days before the due date (0 = none)', grace: 'Cancel an unpaid order this many days after the due date (the subscription then pauses)', settingsHelp: 'The customer gets the pay link when the order is created, so a longer lead time means more time to pay.',
  },
  fr: {
    title: 'Abonnements',
    help: 'Mettez un abonnement sur n’importe quel produit : « chaque mois à ce prix ». Chaque échéance devient une commande ordinaire et le client reçoit un lien de paiement par e-mail (le mobile money ne peut pas être débité automatiquement). Une commande impayée est annulée après un délai de grâce et l’abonnement se met en pause. Le client peut mettre en pause, sauter ou arrêter depuis un lien privé.',
    tabs: { subs: 'Abonnés', plans: 'Formules', settings: 'Réglages' },
    every: (n: number, u: string) => (u === 'week' ? (n === 1 ? 'chaque semaine' : `toutes les ${n} semaines`) : n === 1 ? 'chaque mois' : `tous les ${n} mois`),
    status: { active: 'Actif', paused: 'En pause', canceled: 'Arrêté', ended: 'Terminé' } as Record<string, string>, all: 'Tous',
    search: 'Rechercher nom, e-mail, produit', empty: 'Aucun abonné pour le moment.', next: 'Prochaine', cycles: 'cycles payés', waiting: 'En attente de stock', unpaidPause: 'En pause : impayé', last: 'Dernière commande', open: 'En attente de paiement',
    pause: 'Pause', resume: 'Reprendre', skip: 'Sauter la prochaine', cancel: 'Arrêter', cancelConfirm: 'Arrêter définitivement cet abonnement ?', renew: 'Créer la prochaine commande maintenant', copyLink: 'Copier le lien du client', copied: 'Copié.', noLink: 'Rouvrez cet onglet une fois : le lien a besoin de l’adresse de la boutique.', orders: 'Commandes de renouvellement', details: 'Détails', hide: 'Masquer',
    add: 'Ajouter un abonné', plan: 'Formule', email: 'E-mail', name: 'Nom', phone: 'Téléphone / WhatsApp', qty: 'Quantité', lang: 'Langue', start: 'Première commande le', note: 'Note', address: 'Adresse de livraison (produits physiques)', line1: 'Adresse', city: 'Ville', country: 'Pays (2 lettres, ex. BJ)', create: 'Ajouter', fixed: 'Enregistré.', needPlan: 'Créez d’abord une formule.',
    planHelp: 'Une formule = une variante de produit + un rythme + un prix par cycle. Un changement de prix ne vaut que pour les nouveaux abonnés ; les anciens gardent le leur. Un produit peut avoir plusieurs formules.',
    product: 'Produit', pick: 'Choisir…', planName: 'Nom de la formule (vu par les clients)', unit: 'Rythme', week: 'semaines', month: 'mois', price: 'Prix par cycle', maxCycles: 'Nombre de cycles (vide = jusqu’à l’arrêt)', active: 'Ouverte aux nouveaux abonnés', save: 'Enregistrer', remove: 'Supprimer', removeConfirm: 'Supprimer cette formule ?', subscribers: 'abonnés', invalid: 'Vérifiez les champs.', in_use: 'Cette formule a des abonnés : désactivez-la plutôt.',
    lead: 'Créer chaque commande ce nombre de jours avant l’échéance', remind: 'Envoyer un rappel ce nombre de jours avant l’échéance (0 = aucun)', grace: 'Annuler une commande impayée ce nombre de jours après l’échéance (l’abonnement se met alors en pause)', settingsHelp: 'Le client reçoit le lien de paiement à la création de la commande : plus le délai est long, plus il a de temps pour payer.',
  },
};
type L = (typeof S)['en'];

const zero = (c: string) => ['XOF', 'XAF', 'GNF', 'JPY', 'KRW', 'VND'].includes(c.toUpperCase());
function toMinor(text: string, c: string): number | null | undefined {
  const t = text.trim().replace(/\s/g, '').replace(',', '.'); if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  if (zero(c)) return /\./.test(t) ? undefined : parseInt(t, 10);
  const [a, b = ''] = t.split('.'); if (b.length > 2) return undefined;
  return parseInt(a, 10) * 100 + parseInt((b + '00').slice(0, 2), 10);
}
const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const box = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const day = (iso: string) => iso.slice(0, 10);

export function Subs({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr'];
  const [tab, setTab] = useState<'subs' | 'plans' | 'settings'>('subs');
  return (
    <div className="space-y-5" data-testid="subs-page">
      <div><h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1><p className="text-xs" style={muted}>{s.help}</p></div>
      <div className="flex gap-2 flex-wrap">
        {(['subs', 'plans', 'settings'] as const).map((k) => <button key={k} type="button" onClick={() => setTab(k)} className={btn} style={tab === k ? solid : ghost} data-testid={`subs-tab-${k}`}>{s.tabs[k]}</button>)}
      </div>
      {tab === 'subs' && <Subscribers s={s} canWrite={canWrite} />}
      {tab === 'plans' && <Plans s={s} canWrite={canWrite} />}
      {tab === 'settings' && <Settings s={s} canWrite={canWrite} />}
    </div>
  );
}

function Subscribers({ s, canWrite }: { s: L; canWrite: boolean }) {
  const qc = useQueryClient(); const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null); const [adding, setAdding] = useState(false); const [msg, setMsg] = useState('');
  const { data } = useQuery({ queryKey: ['subs', status, q], queryFn: () => api.getSubs(status || undefined, q.trim() || undefined) });
  const plans = useQuery({ queryKey: ['sub-plans'], queryFn: () => api.getSubPlans() });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['subs'] }); qc.invalidateQueries({ queryKey: ['sub-plans'] }); qc.invalidateQueries({ queryKey: ['sub'] }); };
  const act = useMutation({ mutationFn: (v: { id: string; a: 'pause' | 'resume' | 'skip' | 'cancel' }) => api.subAction(v.id, v.a), onSuccess: () => { setMsg(''); refresh(); }, onError: (e: any) => setMsg(e.message) });
  const renew = useMutation({ mutationFn: (id: string) => api.renewSub(id), onSuccess: () => { setMsg(''); refresh(); }, onError: (e: any) => setMsg(e.message) });
  const totals = data?.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className={labelCls} style={muted}>&nbsp;</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls} style={inputStyle} data-testid="subs-filter">
            <option value="">{s.all}</option>{Object.keys(s.status).map((k) => <option key={k} value={k}>{s.status[k]} ({totals[k] ?? 0})</option>)}
          </select></label>
        <label className="text-sm flex-1 min-w-[12rem]"><span className={labelCls} style={muted}>&nbsp;</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.search} className={inputCls} style={inputStyle} /></label>
        {canWrite && <button type="button" className={btn} style={solid} onClick={() => setAdding(!adding)} data-testid="subs-add-toggle">{s.add}</button>}
      </div>
      {adding && canWrite && <AddSub s={s} plans={(plans.data?.items ?? []).filter((p) => p.active)} onDone={() => { setAdding(false); refresh(); }} />}
      {msg && <p className="text-xs" role="alert" style={{ color: '#dc2626' }}>{msg}</p>}
      {data && data.items.length === 0 && <p className="text-sm" style={muted}>{s.empty}</p>}
      <ul className="space-y-2">
        {data?.items.map((r) => (
          <li key={r.id} className="p-3 space-y-2" style={box} data-testid="sub-row">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="text-sm" style={{ color: 'var(--text)' }}>
                <b>{r.name || r.email}</b>{r.name && <span style={muted}> · {r.email}</span>}<br />
                {r.qty > 1 ? `${r.qty} × ` : ''}{r.title} · {formatPrice(r.unit_price_cents * r.qty, r.currency)} · {s.every(r.every_n, r.unit)}
              </div>
              <span className="text-xs px-2 py-1 rounded-full" style={{ ...ghost, color: r.status === 'active' ? '#16a34a' : 'var(--text-secondary)' }}>{s.status[r.status]}</span>
            </div>
            <p className="text-xs" style={muted}>
              {r.status === 'active' && <>{s.next}: {day(r.next_due_at)} · </>}{r.cycles_done}{r.max_cycles ? ` / ${r.max_cycles}` : ''} {s.cycles}
              {r.open_order_id && <> · {s.open}</>}{r.waiting_stock ? <> · <b>{s.waiting}</b></> : null}{r.pause_reason === 'unpaid' && r.status === 'paused' ? <> · {s.unpaidPause}</> : null}{r.last_order_number ? <> · {s.last}: {r.last_order_number}</> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {canWrite && r.status === 'active' && <><button type="button" className={btn} style={ghost} onClick={() => act.mutate({ id: r.id, a: 'pause' })}>{s.pause}</button><button type="button" className={btn} style={ghost} onClick={() => act.mutate({ id: r.id, a: 'skip' })}>{s.skip}</button><button type="button" className={btn} style={ghost} onClick={() => renew.mutate(r.id)}>{s.renew}</button></>}
              {canWrite && r.status === 'paused' && <button type="button" className={btn} style={ghost} onClick={() => act.mutate({ id: r.id, a: 'resume' })}>{s.resume}</button>}
              {canWrite && (r.status === 'active' || r.status === 'paused') && <button type="button" className={btn} style={ghost} onClick={() => { if (window.confirm(s.cancelConfirm)) act.mutate({ id: r.id, a: 'cancel' }); }}>{s.cancel}</button>}
              <button type="button" className={btn} style={ghost} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? s.hide : s.details}</button>
            </div>
            {open === r.id && <Detail s={s} row={r} canWrite={canWrite} onSaved={refresh} />}
          </li>))}
      </ul>
    </div>
  );
}

function Detail({ s, row, canWrite, onSaved }: { s: L; row: SubRow; canWrite: boolean; onSaved: () => void }) {
  const { data } = useQuery({ queryKey: ['sub', row.id], queryFn: () => api.getSub(row.id) });
  const [qty, setQty] = useState(String(row.qty)); const [price, setPrice] = useState(String(zero(row.currency) ? row.unit_price_cents : row.unit_price_cents / 100)); const [note, setNote] = useState(row.note ?? ''); const [msg, setMsg] = useState('');
  const save = useMutation({
    mutationFn: () => { const p = toMinor(price, row.currency); const n = parseInt(qty, 10); if (p == null || !Number.isFinite(n) || n < 1) throw new Error(s.invalid); return api.updateSub(row.id, { qty: n, unit_price_cents: p, note: note.trim() || null }); },
    onSuccess: () => { setMsg(s.fixed); onSaved(); }, onError: (e: any) => setMsg(e.message),
  });
  const copy = async () => { if (!row.manage_url) { setMsg(s.noLink); return; } try { await navigator.clipboard.writeText(row.manage_url); setMsg(s.copied); } catch { setMsg(row.manage_url); } };
  return (
    <div className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
      {canWrite && (
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="text-sm"><span className={labelCls} style={muted}>{s.qty}</span><input value={qty} inputMode="numeric" onChange={(e) => setQty(e.target.value)} className={inputCls} style={inputStyle} /></label>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.price} ({row.currency})</span><input value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} className={inputCls} style={inputStyle} /></label>
          <label className="text-sm sm:col-span-2"><span className={labelCls} style={muted}>{s.note}</span><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} style={inputStyle} /></label>
        </div>)}
      <div className="flex flex-wrap items-center gap-2">
        {canWrite && <button type="button" className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate()}>{s.save}</button>}
        <button type="button" className={btn} style={ghost} onClick={copy}>{s.copyLink}</button>{msg && <span className="text-xs" role="status" style={muted}>{msg}</span>}
      </div>
      <div><p className="text-xs font-medium" style={muted}>{s.orders}</p>
        <ul className="text-xs space-y-1 pt-1" style={{ color: 'var(--text)' }}>
          {data?.orders.map((o) => <li key={o.order_id}>#{o.cycle} · {o.number ?? '—'} · {day(o.due_at)} · {o.status ?? '—'}{o.total_cents != null && o.currency ? ` · ${formatPrice(o.amount_paid_cents ?? 0, o.currency)} / ${formatPrice(o.total_cents, o.currency)}` : ''}{o.closed ? ` · ${o.closed}` : ''}</li>)}
        </ul></div>
    </div>
  );
}

function AddSub({ s, plans, onDone }: { s: L; plans: SubPlan[]; onDone: () => void }) {
  const [f, setF] = useState({ plan_id: plans[0]?.id ?? '', email: '', name: '', phone: '', qty: '1', locale: 'fr' as 'fr' | 'en', start: new Date().toISOString().slice(0, 10), line1: '', city: '', country: '' });
  const [msg, setMsg] = useState(''); const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const add = useMutation({
    mutationFn: () => api.addSub({ plan_id: f.plan_id || plans[0]?.id, email: f.email.trim(), name: f.name.trim() || undefined, phone: f.phone.trim() || undefined, qty: Math.max(1, parseInt(f.qty, 10) || 1), locale: f.locale, start_date: f.start,
      ...(f.line1.trim() ? { address: { line1: f.line1.trim(), city: f.city.trim(), country: f.country.trim().toUpperCase(), ...(f.phone.trim() ? { phone: f.phone.trim() } : {}) } } : {}) }),
    onSuccess: onDone, onError: (e: any) => setMsg(e.message),
  });
  if (plans.length === 0) return <p className="text-sm" style={muted}>{s.needPlan}</p>;
  return (
    <div className="p-3 grid gap-3 sm:grid-cols-3" style={box}>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.plan}</span><select value={f.plan_id} onChange={(e) => set({ plan_id: e.target.value })} className={inputCls} style={inputStyle}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.product_title ?? p.sku}</option>)}</select></label>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.email}</span><input value={f.email} onChange={(e) => set({ email: e.target.value })} className={inputCls} style={inputStyle} data-testid="subs-new-email" /></label>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.name}</span><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} style={inputStyle} /></label>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.phone}</span><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} style={inputStyle} /></label>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.qty}</span><input value={f.qty} inputMode="numeric" onChange={(e) => set({ qty: e.target.value })} className={inputCls} style={inputStyle} /></label>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.lang}</span><select value={f.locale} onChange={(e) => set({ locale: e.target.value as 'fr' | 'en' })} className={inputCls} style={inputStyle}><option value="fr">Français</option><option value="en">English</option></select></label>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.start}</span><input type="date" value={f.start} onChange={(e) => set({ start: e.target.value })} className={inputCls} style={inputStyle} /></label>
      <p className="sm:col-span-3 text-xs font-medium" style={muted}>{s.address}</p>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.line1}</span><input value={f.line1} onChange={(e) => set({ line1: e.target.value })} className={inputCls} style={inputStyle} /></label>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.city}</span><input value={f.city} onChange={(e) => set({ city: e.target.value })} className={inputCls} style={inputStyle} /></label>
      <label className="text-sm"><span className={labelCls} style={muted}>{s.country}</span><input value={f.country} maxLength={2} onChange={(e) => set({ country: e.target.value })} className={inputCls} style={inputStyle} /></label>
      <div className="sm:col-span-3 flex items-center gap-3"><button type="button" className={btn} style={solid} disabled={add.isPending || !f.email.trim()} onClick={() => add.mutate()} data-testid="subs-new-save">{s.create}</button>{msg && <span className="text-xs" role="alert" style={{ color: '#dc2626' }}>{msg}</span>}</div>
    </div>
  );
}

function Plans({ s, canWrite }: { s: L; canWrite: boolean }) {
  const qc = useQueryClient(); const { data } = useQuery({ queryKey: ['sub-plans'], queryFn: () => api.getSubPlans() });
  const products = useQuery({ queryKey: ['products', 'for-subs'], queryFn: () => api.getProducts({ limit: 100 }), enabled: canWrite });
  const refresh = () => qc.invalidateQueries({ queryKey: ['sub-plans'] });
  const variants = (products.data?.items ?? []).flatMap((p) => (p.variants ?? []).filter((v) => v.sku).map((v) => ({ sku: v.sku, price: v.price_cents, currency: (v as any).currency || STORE_CURRENCY, label: `${p.title}${v.title && v.title !== 'Default' ? ' — ' + v.title : ''} (${v.sku})` })));
  const [f, setF] = useState({ sku: '', name: '', unit: 'month' as 'week' | 'month', every: '1', price: '', max: '' }); const [msg, setMsg] = useState(''); const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const cur = variants.find((v) => v.sku === f.sku)?.currency ?? STORE_CURRENCY;
  const create = useMutation({
    mutationFn: () => { const price = toMinor(f.price, cur); const every = parseInt(f.every, 10); const max = f.max.trim() ? parseInt(f.max, 10) : null;
      if (!f.sku || !f.name.trim() || price == null || !Number.isFinite(every) || every < 1 || (max != null && (!Number.isFinite(max) || max < 1))) throw new Error(s.invalid);
      return api.createSubPlan({ sku: f.sku, name: f.name.trim(), unit: f.unit, every_n: every, price_cents: price, max_cycles: max }); },
    onSuccess: () => { setMsg(s.fixed); setF({ ...f, name: '', price: '', max: '' }); refresh(); }, onError: (e: any) => setMsg(e.message),
  });
  const toggle = useMutation({ mutationFn: (p: SubPlan) => api.updateSubPlan(p.id, { sku: p.sku, name: p.name, unit: p.unit, every_n: p.every_n, price_cents: p.price_cents, max_cycles: p.max_cycles, active: !p.active }), onSuccess: refresh });
  const del = useMutation({ mutationFn: (id: string) => api.deleteSubPlan(id), onSuccess: refresh, onError: (e: any) => setMsg(/subscribers/i.test(e.message) ? s.in_use : e.message) });
  return (
    <div className="space-y-4">
      <p className="text-xs" style={muted}>{s.planHelp}</p>
      {canWrite && (
        <div className="p-3 grid gap-3 sm:grid-cols-3" style={box}>
          <label className="text-sm sm:col-span-2"><span className={labelCls} style={muted}>{s.product}</span><select value={f.sku} onChange={(e) => { const v = variants.find((x) => x.sku === e.target.value); set({ sku: e.target.value, price: v ? String(zero(v.currency) ? v.price : v.price / 100) : f.price }); }} className={inputCls} style={inputStyle} data-testid="plan-sku"><option value="">{s.pick}</option>{variants.map((v) => <option key={v.sku} value={v.sku}>{v.label}</option>)}</select></label>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.planName}</span><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} style={inputStyle} data-testid="plan-name" /></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-sm"><span className={labelCls} style={muted}>{s.unit}</span><input value={f.every} inputMode="numeric" onChange={(e) => set({ every: e.target.value })} className={inputCls} style={inputStyle} /></label>
            <label className="text-sm"><span className={labelCls} style={muted}>&nbsp;</span><select value={f.unit} onChange={(e) => set({ unit: e.target.value as 'week' | 'month' })} className={inputCls} style={inputStyle}><option value="week">{s.week}</option><option value="month">{s.month}</option></select></label></div>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.price} ({cur})</span><input value={f.price} inputMode="decimal" onChange={(e) => set({ price: e.target.value })} className={inputCls} style={inputStyle} data-testid="plan-price" /></label>
          <label className="text-sm"><span className={labelCls} style={muted}>{s.maxCycles}</span><input value={f.max} inputMode="numeric" onChange={(e) => set({ max: e.target.value })} className={inputCls} style={inputStyle} /></label>
          <div className="sm:col-span-3 flex items-center gap-3"><button type="button" className={btn} style={solid} disabled={create.isPending} onClick={() => create.mutate()} data-testid="plan-save">{s.save}</button>{msg && <span className="text-xs" role="status" style={muted}>{msg}</span>}</div>
        </div>)}
      <ul className="space-y-2">
        {data?.items.map((p) => (
          <li key={p.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm" style={box} data-testid="plan-row">
            <span style={{ color: 'var(--text)' }}><b>{p.name}</b> · {p.product_title ?? p.sku}{p.variant_title && p.variant_title !== 'Default' ? ` — ${p.variant_title}` : ''} · {formatPrice(p.price_cents, p.currency ?? STORE_CURRENCY)} · {s.every(p.every_n, p.unit)}{p.max_cycles ? ` × ${p.max_cycles}` : ''} · {p.active_subscribers}/{p.subscribers} {s.subscribers}{p.active ? '' : ` · ${s.status.paused}`}</span>
            {canWrite && <span className="flex gap-2"><button type="button" className={btn} style={ghost} onClick={() => toggle.mutate(p)}>{p.active ? s.status.paused : s.status.active}</button>{p.subscribers === 0 && <button type="button" className={btn} style={ghost} onClick={() => { if (window.confirm(s.removeConfirm)) del.mutate(p.id); }}>{s.remove}</button>}</span>}
          </li>))}
      </ul>
    </div>
  );
}

function Settings({ s, canWrite }: { s: L; canWrite: boolean }) {
  const qc = useQueryClient(); const { data } = useQuery({ queryKey: ['sub-settings'], queryFn: () => api.getSubSettings() });
  const [v, setV] = useState<{ lead: string; remind: string; grace: string } | null>(null); const [msg, setMsg] = useState('');
  const cur = v ?? (data ? { lead: String(data.lead_days), remind: String(data.remind_days), grace: String(data.grace_days) } : null);
  const save = useMutation({ mutationFn: () => api.saveSubSettings({ lead_days: parseInt(cur!.lead, 10), remind_days: parseInt(cur!.remind, 10), grace_days: parseInt(cur!.grace, 10) }), onSuccess: () => { setMsg(s.fixed); qc.invalidateQueries({ queryKey: ['sub-settings'] }); }, onError: (e: any) => setMsg(e.message) });
  if (!cur) return null;
  const f = (k: 'lead' | 'remind' | 'grace', label: string) => <label className="text-sm block"><span className={labelCls} style={muted}>{label}</span><input value={cur[k]} inputMode="numeric" disabled={!canWrite} onChange={(e) => setV({ ...cur, [k]: e.target.value })} className={inputCls} style={inputStyle} /></label>;
  return (
    <div className="space-y-3 max-w-xl"><p className="text-xs" style={muted}>{s.settingsHelp}</p>{f('lead', s.lead)}{f('remind', s.remind)}{f('grace', s.grace)}
      {canWrite && <div className="flex items-center gap-3"><button type="button" className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate()}>{s.save}</button>{msg && <span className="text-xs" role="status" style={muted}>{msg}</span>}</div>}</div>
  );
}
