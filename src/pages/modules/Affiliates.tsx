import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AffiliateDetail, type AffiliateListItem, type AffiliateOrder } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { Modal } from '../../components/Modal';
import { useLocale } from '../../lib/locale-context';

// Self-contained strings: a module does not touch the core translation file.
const S = {
  en: {
    title: 'Affiliates', help: 'Partners share a link or a code and earn a percentage of paid sales. A refunded order cancels its commission. You pay them yourself and record it here.',
    new: 'New affiliate', empty: 'No affiliates yet.', name: 'Name', code: 'Code', rate: 'Rate (%)', email: 'Email', phone: 'Phone / WhatsApp', discountCode: 'Linked discount code (optional)',
    discountHelp: 'Orders that use this existing discount code also count for this affiliate.', note: 'Private note', status: 'Status', active: 'Active', paused: 'Paused',
    owed: 'To pay', onHold: 'On hold', paidOut: 'Paid', save: 'Save', cancel: 'Cancel', edit: 'Edit', del: 'Delete', confirmDel: 'Delete this affiliate?', invalid: 'Enter a name and a rate between 0 and 100.',
    hold: 'Hold period (days)', holdHelp: 'A commission becomes payable this many days after the order is paid, so refunds can come through first.',
    link: 'Link to share', portal: 'Affiliate’s own page', copy: 'Copy', copied: 'Copied', whatsapp: 'Share on WhatsApp', orders: 'Orders', order: 'Order', date: 'Date', commission: 'Commission', state: 'Status',
    payouts: 'Payouts', noOrders: 'No orders yet.', noPayouts: 'No payouts yet.', pay: 'Record a payout', amount: 'Amount', currency: 'Currency', method: 'Method', reference: 'Reference (optional)', record: 'Record',
    nothingOwed: 'Nothing is payable right now.', removePayout: 'Remove', confirmRemove: 'Remove this payout record?', negative: 'Negative: refunds came after a payout. It will be deducted from the next one.',
    st: { awaiting_payment: 'Awaiting payment', pending: 'On hold', available: 'Payable', canceled: 'Canceled' },
    m: { mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', cash: 'Cash', other: 'Other' },
    msg: (n: string, l: string) => `Hello ${n}, here is your affiliate link: ${l}`,
  },
  fr: {
    title: 'Affiliation', help: 'Des partenaires partagent un lien ou un code et touchent un pourcentage des ventes payées. Une commande remboursée annule sa commission. Vous les payez vous-même et le notez ici.',
    new: 'Nouvel affilié', empty: 'Aucun affilié pour le moment.', name: 'Nom', code: 'Code', rate: 'Taux (%)', email: 'E-mail', phone: 'Téléphone / WhatsApp', discountCode: 'Code de réduction lié (facultatif)',
    discountHelp: 'Les commandes qui utilisent ce code de réduction existant comptent aussi pour cet affilié.', note: 'Note privée', status: 'Statut', active: 'Actif', paused: 'En pause',
    owed: 'À payer', onHold: 'En attente', paidOut: 'Versé', save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', del: 'Supprimer', confirmDel: 'Supprimer cet affilié ?', invalid: 'Saisissez un nom et un taux entre 0 et 100.',
    hold: 'Délai d’attente (jours)', holdHelp: 'Une commission devient payable ce nombre de jours après le paiement de la commande, le temps que d’éventuels remboursements passent.',
    link: 'Lien à partager', portal: 'Page de l’affilié', copy: 'Copier', copied: 'Copié', whatsapp: 'Partager sur WhatsApp', orders: 'Commandes', order: 'Commande', date: 'Date', commission: 'Commission', state: 'Statut',
    payouts: 'Versements', noOrders: 'Aucune commande pour le moment.', noPayouts: 'Aucun versement pour le moment.', pay: 'Noter un versement', amount: 'Montant', currency: 'Devise', method: 'Moyen', reference: 'Référence (facultatif)', record: 'Enregistrer',
    nothingOwed: 'Rien à payer pour le moment.', removePayout: 'Retirer', confirmRemove: 'Retirer ce versement ?', negative: 'Négatif : des remboursements sont arrivés après un versement. Ce sera déduit du prochain.',
    st: { awaiting_payment: 'Paiement attendu', pending: 'En attente', available: 'Payable', canceled: 'Annulée' },
    m: { mobile_money: 'Mobile money', bank_transfer: 'Virement', cash: 'Espèces', other: 'Autre' },
    msg: (n: string, l: string) => `Bonjour ${n}, voici votre lien d’affilié : ${l}`,
  },
};

const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const ZERO = new Set(['XOF', 'GNF', 'JPY', 'KRW', 'VND']);
const STATE_COLOR: Record<AffiliateOrder['state'], string> = { awaiting_payment: 'var(--text-muted)', pending: '#d97706', available: '#16a34a', canceled: '#dc2626' };

export function Affiliates({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale();
  const s = S[locale === 'en' ? 'en' : 'fr'];
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AffiliateListItem | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['affiliates'], queryFn: () => api.getAffiliates() });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['affiliates'] }); qc.invalidateQueries({ queryKey: ['affiliate'] }); };
  const [hold, setHold] = useState<string | null>(null);
  const saveHold = useMutation({ mutationFn: (d: number) => api.setAffiliateHold(d), onSuccess: () => { setHold(null); refresh(); } });
  const sum = (a: AffiliateListItem, k: 'balance_cents' | 'pending_cents') =>
    a.totals.filter((t) => t[k] !== 0).map((t) => formatPrice(t[k], t.currency)).join(' + ') || '—';

  return (
    <div className="space-y-4" data-testid="affiliates-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
          <p className="text-xs" style={muted}>{s.help}</p>
        </div>
        {canWrite && <button className={btn} style={solid} onClick={() => setEditing('new')} data-testid="aff-new">{s.new}</button>}
      </div>

      {data && canWrite && (
        <div className="flex flex-wrap items-end gap-2 p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div>
            <label className={labelCls} style={muted}>{s.hold}</label>
            <input inputMode="numeric" className={inputCls} style={{ ...inputStyle, width: 90 }} value={hold ?? String(data.hold_days)} onChange={(e) => setHold(e.target.value)} data-testid="aff-hold" />
          </div>
          {hold !== null && hold !== String(data.hold_days) && <button className={btn} style={ghost} onClick={() => saveHold.mutate(parseInt(hold, 10) || 0)}>{s.save}</button>}
          <p className="text-xs flex-1 min-w-[200px]" style={muted}>{s.holdHelp}</p>
        </div>
      )}

      {data && data.items.length === 0 && <p className="text-sm" style={muted}>{s.empty}</p>}
      {data && data.items.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <table className="rt w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                <th className="p-3">{s.name}</th><th className="p-3">{s.code}</th><th className="p-3">{s.rate}</th><th className="p-3">{s.owed}</th><th className="p-3">{s.onHold}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} onClick={() => setOpenId(a.id)} className="cursor-pointer border-t" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`aff-row-${a.code}`}>
                  <td className="p-3" data-label="">{a.name}{a.status === 'paused' ? ` (${s.paused})` : ''}</td>
                  <td className="p-3 font-mono" data-label={s.code}>{a.code}</td>
                  <td className="p-3" data-label={s.rate}>{a.rate_percent} %</td>
                  <td className="p-3 font-mono" data-label={s.owed}>{sum(a, 'balance_cents')}</td>
                  <td className="p-3 font-mono" data-label={s.onHold}>{sum(a, 'pending_cents')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <AffiliateForm affiliate={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(id) => { refresh(); setEditing(null); setOpenId(id); }} />}
      {openId && !editing && (
        <AffiliateDetailModal
          id={openId} canWrite={canWrite} onClose={() => setOpenId(null)} onChanged={refresh}
          onEdit={(d) => setEditing(data?.items.find((x) => x.id === d.id) ?? null)}
        />
      )}
    </div>
  );
}

function AffiliateForm({ affiliate, onClose, onSaved }: { affiliate: AffiliateListItem | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { locale } = useLocale();
  const s = S[locale === 'en' ? 'en' : 'fr'];
  const [name, setName] = useState(affiliate?.name ?? '');
  const [rate, setRate] = useState(affiliate ? String(affiliate.rate_percent) : '10');
  const [code, setCode] = useState(affiliate?.code ?? '');
  const [email, setEmail] = useState(affiliate?.email ?? '');
  const [phone, setPhone] = useState(affiliate?.phone ?? '');
  const [discount, setDiscount] = useState(affiliate?.discount_code ?? '');
  const [note, setNote] = useState(affiliate?.note ?? '');
  const [status, setStatus] = useState<'active' | 'paused'>(affiliate?.status ?? 'active');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (b: Parameters<typeof api.createAffiliate>[0]) => (affiliate ? api.updateAffiliate(affiliate.id, b) : api.createAffiliate(b)),
    onSuccess: (a) => onSaved(a.id),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });
  function submit() {
    const r = Number(rate.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(r) || r < 0 || r > 100) { setError(s.invalid); return; }
    setError(null);
    save.mutate({ name: name.trim(), rate_percent: r, code: code.trim() || undefined, email: email.trim(), phone: phone.trim(), discount_code: discount.trim(), note: note.trim(), status });
  }
  return (
    <Modal open onClose={onClose} title={affiliate ? `${s.edit} ${affiliate.name}` : s.new} size="lg">
      <div className="md:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls} style={muted}>{s.name} *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle} data-testid="aff-name" /></div>
          <div><label className={labelCls} style={muted}>{s.rate} *</label><input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} style={inputStyle} data-testid="aff-rate" /></div>
          <div><label className={labelCls} style={muted}>{s.code}</label><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="auto" className={inputCls + ' font-mono'} style={inputStyle} /></div>
          <div><label className={labelCls} style={muted}>{s.status}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'paused')} className={inputCls} style={inputStyle}><option value="active">{s.active}</option><option value="paused">{s.paused}</option></select>
          </div>
          <div><label className={labelCls} style={muted}>{s.email}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={muted}>{s.phone}</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={inputStyle} /></div>
        </div>
        <div><label className={labelCls} style={muted}>{s.discountCode}</label><input value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls + ' font-mono'} style={inputStyle} /><p className="text-xs mt-1" style={muted}>{s.discountHelp}</p></div>
        <div><label className={labelCls} style={muted}>{s.note}</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} style={inputStyle} /></div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }} onClick={onClose}>{s.cancel}</button>
          <button type="button" className={btn} style={solid} disabled={save.isPending} onClick={submit} data-testid="aff-save">{s.save}</button>
        </div>
      </div>
    </Modal>
  );
}

function AffiliateDetailModal({ id, canWrite, onClose, onChanged, onEdit }: { id: string; canWrite: boolean; onClose: () => void; onChanged: () => void; onEdit: (d: AffiliateDetail) => void }) {
  const { locale } = useLocale();
  const s = S[locale === 'en' ? 'en' : 'fr'];
  const qc = useQueryClient();
  const { data: d } = useQuery({ queryKey: ['affiliate', id], queryFn: () => api.getAffiliate(id) });
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [reference, setReference] = useState('');
  const fail = (e: unknown) => setMsg(e instanceof Error ? e.message : String(e));
  const changed = () => { qc.invalidateQueries({ queryKey: ['affiliate', id] }); onChanged(); };
  const pay = useMutation({ mutationFn: (b: Parameters<typeof api.payAffiliate>[1]) => api.payAffiliate(id, b), onSuccess: () => { setAmount(''); setReference(''); setMsg(null); changed(); }, onError: fail });
  const rm = useMutation({ mutationFn: (pid: string) => api.removeAffiliatePayout(id, pid), onSuccess: changed, onError: fail });
  const del = useMutation({ mutationFn: () => api.deleteAffiliate(id), onSuccess: () => { onChanged(); onClose(); }, onError: fail });
  if (!d) return null;

  const cur = currency || d.totals.find((t) => t.balance_cents > 0)?.currency || d.totals[0]?.currency || '';
  const due = d.totals.find((t) => t.currency === cur)?.balance_cents ?? 0;
  const factor = ZERO.has(cur) ? 1 : 100;
  const copy = async (k: string, v: string) => { try { await navigator.clipboard.writeText(v); setCopied(k); } catch { /* the field is selectable */ } };
  const digits = (d.phone ?? '').replace(/\D/g, '');
  const wa = `https://wa.me/${digits}?text=${encodeURIComponent(s.msg(d.name, d.link))}`;
  const field = (label: string, value: string, k: string) => (
    <div>
      <label className={labelCls} style={muted}>{label}</label>
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.target.select()} className={inputCls + ' font-mono'} style={inputStyle} data-testid={`aff-${k}`} />
        <button className={btn} style={ghost} onClick={() => copy(k, value)}>{copied === k ? s.copied : s.copy}</button>
      </div>
    </div>
  );
  function submitPay() {
    const cents = Math.round(Number(amount.replace(',', '.')) * factor);
    if (!Number.isInteger(cents) || cents <= 0) { setMsg(s.invalid); return; }
    setMsg(null);
    pay.mutate({ amount_cents: cents, currency: cur, method, reference: reference.trim() || undefined });
  }

  return (
    <Modal open onClose={onClose} title={`${d.name} · ${d.code}`} size="lg">
      <div className="md:p-6 space-y-4" data-testid="aff-detail">
        <p className="text-sm" style={muted}>{d.rate_percent} % · {[d.email, d.phone].filter(Boolean).join(' · ') || '—'}{d.status === 'paused' ? ` · ${s.paused}` : ''}</p>
        {field(s.link, d.link, 'link')}
        {field(s.portal, d.portal_url, 'portal')}
        <div className="flex flex-wrap gap-2">
          {digits.length >= 8 && <a className={btn} style={ghost} href={wa} target="_blank" rel="noreferrer">{s.whatsapp}</a>}
          {canWrite && <button className={btn} style={ghost} onClick={() => onEdit(d)}>{s.edit}</button>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {d.totals.length === 0 && <p className="text-sm sm:col-span-3" style={muted}>{s.noOrders}</p>}
          {d.totals.map((t) => (
            <div key={t.currency} className="contents">
              <Tile label={`${s.owed} · ${t.currency}`} value={formatPrice(t.balance_cents, t.currency)} testid={`aff-owed-${t.currency}`} />
              <Tile label={`${s.onHold} · ${t.currency}`} value={formatPrice(t.pending_cents, t.currency)} />
              <Tile label={`${s.paidOut} · ${t.currency}`} value={formatPrice(t.paid_out_cents, t.currency)} />
              {t.balance_cents < 0 && <p className="text-xs sm:col-span-3" style={{ color: '#d97706' }}>{s.negative}</p>}
            </div>
          ))}
        </div>

        {canWrite && d.totals.length > 0 && (
          <div className="p-3 space-y-2" style={{ border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.pay}</h3>
            {due <= 0 ? <p className="text-xs" style={muted}>{s.nothingOwed}</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_90px_1fr_1fr_auto] gap-2 items-end">
                <div><label className={labelCls} style={muted}>{s.amount}</label><input inputMode="decimal" value={amount} placeholder={String(due / factor)} onChange={(e) => setAmount(e.target.value)} className={inputCls} style={inputStyle} data-testid="aff-pay-amount" /></div>
                <div><label className={labelCls} style={muted}>{s.currency}</label>
                  <select value={cur} onChange={(e) => setCurrency(e.target.value)} className={inputCls} style={inputStyle}>{d.totals.map((t) => <option key={t.currency}>{t.currency}</option>)}</select></div>
                <div><label className={labelCls} style={muted}>{s.method}</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls} style={inputStyle}>{Object.entries(s.m).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className={labelCls} style={muted}>{s.reference}</label><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} style={inputStyle} /></div>
                <button className={btn + ' col-span-2 sm:col-span-1'} style={solid} disabled={pay.isPending} onClick={submitPay} data-testid="aff-pay">{s.record}</button>
              </div>
            )}
          </div>
        )}
        {msg && <p className="text-sm text-red-500" data-testid="aff-msg">{msg}</p>}

        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.orders}</h3>
        {d.orders.length === 0 ? <p className="text-xs" style={muted}>{s.noOrders}</p> : (
          <table className="rt w-full text-sm">
            <thead><tr className="text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}><th className="p-2">{s.order}</th><th className="p-2">{s.date}</th><th className="p-2">{s.state}</th><th className="p-2">{s.commission}</th></tr></thead>
            <tbody>
              {d.orders.map((o) => (
                <tr key={o.order_id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="p-2 font-mono" data-label="">{o.number}</td>
                  <td className="p-2" data-label={s.date}>{o.created_at.slice(0, 10)}</td>
                  <td className="p-2" data-label={s.state}><span style={{ color: STATE_COLOR[o.state] }}>{s.st[o.state]}</span></td>
                  <td className="p-2 font-mono" data-label={s.commission}>{formatPrice(o.commission_cents, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.payouts}</h3>
        {d.payouts.length === 0 ? <p className="text-xs" style={muted}>{s.noPayouts}</p> : (
          <ul className="text-sm divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {d.payouts.map((p) => (
              <li key={p.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-mono">{formatPrice(p.amount_cents, p.currency)}</span>
                <span style={muted}>{p.created_at.slice(0, 10)} · {(s.m as Record<string, string>)[p.method] ?? p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                {canWrite && <button className="tap ml-auto underline text-xs" style={muted} onClick={() => { if (window.confirm(s.confirmRemove)) rm.mutate(p.id); }}>{s.removePayout}</button>}
              </li>
            ))}
          </ul>
        )}

        {canWrite && d.orders.length === 0 && d.payouts.length === 0 && (
          <button className={btn} style={{ ...ghost, color: '#dc2626' }} onClick={() => { if (window.confirm(s.confirmDel)) del.mutate(); }}>{s.del}</button>
        )}
      </div>
    </Modal>
  );
}

function Tile({ label, value, testid }: { label: string; value: string; testid?: string }) {
  return (
    <div className="p-3" style={{ border: '1px solid var(--border)' }}>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-mono text-base" style={{ color: 'var(--text)' }} data-testid={testid}>{value}</p>
    </div>
  );
}
