import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MsStageInput, type MsView } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { useLocale } from '../../lib/locale-context';

const S = {
  en: {
    title: 'Milestone payments',
    help: 'Split an order into stages (deposit, delivery, balance…). The customer sees the whole schedule on the payment page and in e-mails; you request each stage when it is reached, which e-mails the pay link. Money received fills the stages in order. A paid stage cannot be changed.',
    search: 'Search order number, name, e-mail', none: 'No schedules yet.', add: 'New schedule', progress: 'stages paid', next: 'Next', due: 'Due now', upcoming: 'Upcoming', paid: 'Paid',
    open: 'Open', hide: 'Close', request: 'Request next stage', requestNoMail: 'Get the link only', copy: 'Copy pay link', copied: 'Copied.', sent: 'Requested and e-mailed.', sentNoMail: 'Requested. No e-mail sent (no usable address): share the link yourself.', linkOnly: 'Requested.',
    edit: 'Edit schedule', del: 'Remove schedule', delConfirm: 'Remove this schedule? Payments already received stay on the order.', save: 'Save schedule', saved: 'Saved.', savedTold: 'Saved. The customer was e-mailed the new schedule.',
    pickOrder: 'Order', findOrder: 'Find an order waiting for payment (number, name, e-mail)', noOrders: 'No order waiting for payment matches.', total: 'Order total', paidSoFar: 'already paid', preset: 'Start from', blank: 'Blank',
    stage: 'Stage name', amount: 'Amount', percent: 'Percent', byAmount: 'Amount', byPercent: '%', expected: 'Expected on', addStage: 'Add a stage', removeStage: 'Remove', note: 'Note for yourself (optional)', sum: 'Stages add up to', mismatch: 'must equal the total', locked: 'Paid, locked', needOrder: 'Choose an order first.', customer: 'Customer', cancel: 'Cancel',
    presets: { three: '30% / 40% / 30%', two: '50% / 50%', four: '25% × 4' },
  },
  fr: {
    title: 'Paiements par étapes',
    help: 'Découpez une commande en étapes (acompte, livraison, solde…). Le client voit tout le calendrier sur la page de paiement et dans les e-mails ; vous demandez chaque étape quand elle est atteinte, ce qui envoie le lien de paiement par e-mail. L’argent reçu remplit les étapes dans l’ordre. Une étape payée ne peut plus changer.',
    search: 'Rechercher n° de commande, nom, e-mail', none: 'Aucun calendrier pour le moment.', add: 'Nouveau calendrier', progress: 'étapes payées', next: 'Prochaine', due: 'À régler', upcoming: 'À venir', paid: 'Payée',
    open: 'Ouvrir', hide: 'Fermer', request: 'Demander la prochaine étape', requestNoMail: 'Obtenir le lien seulement', copy: 'Copier le lien de paiement', copied: 'Copié.', sent: 'Demandée et envoyée par e-mail.', sentNoMail: 'Demandée. Aucun e-mail envoyé (pas d’adresse utilisable) : partagez le lien vous-même.', linkOnly: 'Demandée.',
    edit: 'Modifier le calendrier', del: 'Supprimer le calendrier', delConfirm: 'Supprimer ce calendrier ? Les paiements déjà reçus restent sur la commande.', save: 'Enregistrer le calendrier', saved: 'Enregistré.', savedTold: 'Enregistré. Le client a reçu le nouveau calendrier par e-mail.',
    pickOrder: 'Commande', findOrder: 'Trouver une commande en attente de paiement (numéro, nom, e-mail)', noOrders: 'Aucune commande en attente de paiement ne correspond.', total: 'Total de la commande', paidSoFar: 'déjà payé', preset: 'Partir de', blank: 'Vide',
    stage: 'Nom de l’étape', amount: 'Montant', percent: 'Pourcentage', byAmount: 'Montant', byPercent: '%', expected: 'Prévue le', addStage: 'Ajouter une étape', removeStage: 'Retirer', note: 'Note pour vous (facultatif)', sum: 'Les étapes totalisent', mismatch: 'doit égaler le total', locked: 'Payée, verrouillée', needOrder: 'Choisissez d’abord une commande.', customer: 'Client', cancel: 'Annuler',
    presets: { three: '30 % / 40 % / 30 %', two: '50 % / 50 %', four: '25 % × 4' },
  },
};
type L = (typeof S)['en'];

const zero = (c: string) => ['XOF', 'XAF', 'GNF', 'JPY', 'KRW', 'VND'].includes(c.toUpperCase());
const toMinor = (text: string, c: string): number | undefined => {
  const t = text.trim().replace(/\s/g, '').replace(',', '.'); if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  if (zero(c)) return /\./.test(t) ? undefined : parseInt(t, 10);
  const [a, b = ''] = t.split('.'); if (b.length > 2) return undefined; return parseInt(a, 10) * 100 + parseInt((b + '00').slice(0, 2), 10);
};
const fromMinor = (n: number, c: string) => String(zero(c) ? n : n / 100);
const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const box = { background: 'var(--bg-card)', border: '1px solid var(--border)' };

type Row = { label: string; mode: 'amount' | 'percent'; value: string; date: string; locked?: boolean };
const pct = (v: string): Row => ({ label: '', mode: 'percent', value: v, date: '' });
const presetRows = (k: 'blank' | 'three' | 'two' | 'four'): Row[] =>
  k === 'three' ? [pct('30'), pct('40'), pct('30')] : k === 'two' ? [pct('50'), pct('50')] : k === 'four' ? [pct('25'), pct('25'), pct('25'), pct('25')] : [pct(''), pct('')];

export function Milestones({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr'];
  const qc = useQueryClient(); const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  const { data } = useQuery({ queryKey: ['ms', q], queryFn: () => api.getMilestones(q.trim() || undefined) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ms'] }); qc.invalidateQueries({ queryKey: ['ms-one'] }); qc.invalidateQueries({ queryKey: ['ms-cand'] }); };
  return (
    <div className="space-y-5" data-testid="ms-page">
      <div><h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1><p className="text-xs" style={muted}>{s.help}</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm flex-1 min-w-[12rem]"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.search} className={inputCls} style={inputStyle} /></label>
        {canWrite && <button type="button" className={btn} style={solid} onClick={() => setAdding(!adding)} data-testid="ms-add">{s.add}</button>}
      </div>
      {adding && canWrite && <Editor s={s} onDone={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />}
      {data && data.items.length === 0 && <p className="text-sm" style={muted}>{s.none}</p>}
      <ul className="space-y-2">
        {data?.items.map((r) => (
          <li key={r.order_id} className="p-3 space-y-2" style={box} data-testid="ms-row">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="text-sm" style={{ color: 'var(--text)' }}><b>{r.number}</b> · {r.shipping_name || r.customer_email}<br />
                <span style={muted}>{formatPrice(r.paid_cents, r.currency)} / {formatPrice(r.total_cents, r.currency)} · {r.stages_paid}/{r.stages} {s.progress}{r.next ? ` · ${s.next}: ${r.next.label} (${r.next.status === 'due' ? s.due : s.upcoming})` : ''}</span></div>
              <button type="button" className={btn} style={ghost} onClick={() => setOpen(open === r.order_id ? null : r.order_id)}>{open === r.order_id ? s.hide : s.open}</button>
            </div>
            {open === r.order_id && <Detail s={s} orderId={r.order_id} canWrite={canWrite} onChanged={refresh} />}
          </li>))}
      </ul>
    </div>
  );
}

function Detail({ s, orderId, canWrite, onChanged }: { s: L; orderId: string; canWrite: boolean; onChanged: () => void }) {
  const { data } = useQuery({ queryKey: ['ms-one', orderId], queryFn: () => api.getMilestone(orderId) });
  const [editing, setEditing] = useState(false); const [msg, setMsg] = useState('');
  const req = useMutation({ mutationFn: (send: boolean) => api.requestMilestone(orderId, send).then((r) => ({ r, send })), onSuccess: ({ r, send }) => { setMsg(!send ? s.linkOnly : r.emailed ? s.sent : s.sentNoMail); onChanged(); }, onError: (e: any) => setMsg(e.message) });
  const del = useMutation({ mutationFn: () => api.deleteMilestone(orderId), onSuccess: onChanged, onError: (e: any) => setMsg(e.message) });
  if (!data) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(data.pay_url); setMsg(s.copied); } catch { setMsg(data.pay_url); } };
  const label = (st: string) => (st === 'paid' ? s.paid : st === 'due' ? s.due : s.upcoming);
  const active = data.status !== 'canceled' && data.status !== 'refunded' && data.next_pos != null;
  return (
    <div className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
      <ul className="text-sm space-y-1" style={{ color: 'var(--text)' }}>
        {data.stages.map((st) => <li key={st.id} className="flex flex-wrap justify-between gap-2"><span>{st.pos}. {st.label}{st.expected_on && st.status !== 'paid' ? <span style={muted}> · {st.expected_on}</span> : null}</span><span><b>{formatPrice(st.amount_cents, data.currency)}</b> · <span style={{ color: st.status === 'paid' ? '#16a34a' : st.status === 'due' ? '#d97706' : 'var(--text-secondary)' }}>{label(st.status)}{st.status === 'due' && st.paid_cents > 0 ? ` (${formatPrice(st.remaining_cents, data.currency)})` : ''}</span></span></li>)}
      </ul>
      {data.note && <p className="text-xs" style={muted}>{data.note}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        {canWrite && active && <><button type="button" className={btn} style={solid} disabled={req.isPending} onClick={() => req.mutate(true)} data-testid="ms-request">{s.request}</button><button type="button" className={btn} style={ghost} disabled={req.isPending} onClick={() => req.mutate(false)}>{s.requestNoMail}</button></>}
        <button type="button" className={btn} style={ghost} onClick={copy}>{s.copy}</button>
        {canWrite && active && <button type="button" className={btn} style={ghost} onClick={() => setEditing(!editing)}>{editing ? s.cancel : s.edit}</button>}
        {canWrite && <button type="button" className={btn} style={ghost} onClick={() => { if (window.confirm(s.delConfirm)) del.mutate(); }}>{s.del}</button>}
        {msg && <span className="text-xs" role="status" style={muted}>{msg}</span>}
      </div>
      {editing && canWrite && <Editor s={s} existing={data} onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />}
    </div>
  );
}

function Editor({ s, existing, onDone, onCancel }: { s: L; existing?: MsView; onDone: () => void; onCancel: () => void }) {
  const [oq, setOq] = useState(''); const [pick, setPick] = useState<{ id: string; number: string; currency: string; total_cents: number; paid_cents: number } | null>(existing ? { id: existing.order_id, number: existing.order_number, currency: existing.currency, total_cents: existing.total_cents, paid_cents: existing.paid_cents } : null);
  const cand = useQuery({ queryKey: ['ms-cand', oq], queryFn: () => api.getMilestoneCandidates(oq.trim() || undefined), enabled: !existing && !pick });
  const [rows, setRows] = useState<Row[]>(existing ? existing.stages.map((st) => ({ label: st.label, mode: 'amount' as const, value: fromMinor(st.amount_cents, existing.currency), date: st.expected_on ?? '', locked: st.status === 'paid' })) : presetRows('three'));
  const [note, setNote] = useState(existing?.note ?? ''); const [msg, setMsg] = useState('');
  const cur = pick?.currency ?? 'XOF'; const total = pick?.total_cents ?? 0;
  const set = (i: number, p: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
  // What each row comes to, the way the server will freeze it (the last percentage takes the remainder).
  const amounts = rows.map((r) => (r.mode === 'amount' ? toMinor(r.value, cur) : Number.isFinite(parseFloat(r.value.replace(',', '.'))) ? Math.round((total * parseFloat(r.value.replace(',', '.'))) / 100) : undefined));
  const last = rows.length - 1;
  if (rows[last]?.mode === 'percent' && amounts.slice(0, -1).every((a) => a != null)) amounts[last] = total - (amounts.slice(0, -1) as number[]).reduce((a, b) => a + b, 0);
  const sum = amounts.every((a) => a != null) ? (amounts as number[]).reduce((a, b) => a + b, 0) : null;
  const ok = !!pick && sum === total && rows.every((r, i) => r.label.trim() && (amounts[i] ?? 0) > 0);
  const save = useMutation({
    mutationFn: () => api.saveMilestone(pick!.id, { note: note.trim() || null, stages: rows.map((r, i): MsStageInput => ({ label: r.label.trim(), expected_on: r.date || null, ...(r.mode === 'percent' ? { percent: parseFloat(r.value.replace(',', '.')) } : { amount_cents: amounts[i] as number }) })) }),
    onSuccess: (r) => { setMsg(r.notified ? s.savedTold : s.saved); onDone(); }, onError: (e: any) => setMsg(e.message),
  });
  return (
    <div className="p-3 space-y-3" style={box} data-testid="ms-editor">
      {!existing && (pick ? (
        <p className="text-sm" style={{ color: 'var(--text)' }}><b>{pick.number}</b> · {s.total}: {formatPrice(pick.total_cents, cur)}{pick.paid_cents > 0 ? ` · ${formatPrice(pick.paid_cents, cur)} ${s.paidSoFar}` : ''} <button type="button" className="underline text-xs ml-2" onClick={() => setPick(null)}>×</button></p>
      ) : (
        <div className="space-y-2"><label className="text-sm block"><span className={labelCls} style={muted}>{s.pickOrder}</span><input value={oq} onChange={(e) => setOq(e.target.value)} placeholder={s.findOrder} className={inputCls} style={inputStyle} data-testid="ms-order-search" /></label>
          {cand.data && cand.data.items.length === 0 && <p className="text-xs" style={muted}>{s.noOrders}</p>}
          <ul className="space-y-1">{cand.data?.items.map((o) => <li key={o.id}><button type="button" className="w-full text-left text-sm px-3 py-2 rounded-lg" style={ghost} onClick={() => setPick(o)}><b>{o.number}</b> · {o.shipping_name || o.customer_email} · {formatPrice(o.total_cents, o.currency)}</button></li>)}</ul></div>))}
      {!existing && pick && (
        <div className="flex flex-wrap gap-2 items-center text-xs" style={muted}>{s.preset}:{(['three', 'two', 'four', 'blank'] as const).map((k) => <button key={k} type="button" className={btn} style={ghost} onClick={() => setRows(presetRows(k))}>{k === 'blank' ? s.blank : s.presets[k]}</button>)}</div>)}
      {pick && <>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-12 items-end">
              <label className="text-sm sm:col-span-4"><span className={labelCls} style={muted}>{s.stage}</span><input value={r.label} disabled={r.locked} onChange={(e) => set(i, { label: e.target.value })} className={inputCls} style={inputStyle} data-testid={`ms-label-${i}`} /></label>
              <div className="sm:col-span-3 grid grid-cols-3 gap-1"><label className="text-sm col-span-2"><span className={labelCls} style={muted}>{r.mode === 'percent' ? s.percent : s.amount}</span><input value={r.value} disabled={r.locked} inputMode="decimal" onChange={(e) => set(i, { value: e.target.value })} className={inputCls} style={inputStyle} data-testid={`ms-value-${i}`} /></label>
                <label className="text-sm"><span className={labelCls} style={muted}>&nbsp;</span><select value={r.mode} disabled={r.locked} onChange={(e) => set(i, { mode: e.target.value as 'amount' | 'percent', value: e.target.value === 'amount' && amounts[i] != null ? fromMinor(amounts[i] as number, cur) : r.value })} className={inputCls} style={inputStyle}><option value="percent">{s.byPercent}</option><option value="amount">{s.byAmount}</option></select></label></div>
              <p className="text-xs sm:col-span-2" style={muted}>{amounts[i] != null ? formatPrice(amounts[i] as number, cur) : ''}{r.locked ? ` · ${s.locked}` : ''}</p>
              <label className="text-sm sm:col-span-2"><span className={labelCls} style={muted}>{s.expected}</span><input type="date" value={r.date} disabled={r.locked} onChange={(e) => set(i, { date: e.target.value })} className={inputCls} style={inputStyle} /></label>
              <div className="sm:col-span-1">{!r.locked && rows.length > 2 && <button type="button" className={btn} style={ghost} onClick={() => setRows(rows.filter((_, k) => k !== i))} aria-label={s.removeStage}>×</button>}</div>
            </li>))}
        </ul>
        {rows.length < 12 && <button type="button" className={btn} style={ghost} onClick={() => setRows([...rows, { label: '', mode: 'amount', value: '', date: '' }])}>{s.addStage}</button>}
        <p className="text-xs" style={{ color: sum === total ? '#16a34a' : '#dc2626' }}>{s.sum}: {sum == null ? '—' : formatPrice(sum, cur)} / {formatPrice(total, cur)}{sum !== total ? ` — ${s.mismatch}` : ''}</p>
        <label className="text-sm block"><span className={labelCls} style={muted}>{s.note}</span><input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} style={inputStyle} /></label>
      </>}
      <div className="flex items-center gap-3"><button type="button" className={btn} style={solid} disabled={!ok || save.isPending} onClick={() => save.mutate()} data-testid="ms-save">{s.save}</button><button type="button" className={btn} style={ghost} onClick={onCancel}>{s.cancel}</button>{msg && <span className="text-xs" role="alert" style={muted}>{msg}</span>}</div>
    </div>
  );
}
