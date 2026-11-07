import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Quote, type QuoteStatus } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { Modal } from '../../components/Modal';
import { printHtml } from '../../lib/receipt';
import { useLocale } from '../../lib/locale-context';

// Self-contained strings: a module does not touch the core translation file.
const S = {
  en: {
    title: 'Quotations', help: 'Send a customer a link to a quote. They accept or decline online; an accepted quote becomes an order in one click.',
    new: 'New quote', empty: 'No quotes yet.', number: 'Quote', customer: 'Customer', total: 'Total', status: 'Status', valid: 'Valid until',
    name: 'Customer name', email: 'Email', phone: 'Phone / WhatsApp', locale: 'Language', items: 'Items', item: 'Choose an item', qty: 'Qty', price: 'Unit price (optional)',
    addItem: 'Add an item', days: 'Valid for (days)', note: 'Note for the customer', save: 'Save', cancel: 'Cancel', edit: 'Edit', del: 'Delete', send: 'Send / share',
    print: 'Print / PDF', link: 'Customer link', copy: 'Copy link', copied: 'Copied', whatsapp: 'WhatsApp', makeOrder: 'Create order', ordered: 'Order created', invalid: 'Add at least one item with a quantity.',
    sentEmail: 'Link emailed to the customer.', sentNoEmail: 'Marked as sent. Share the link below.', confirmDel: 'Delete this quote?', mail: 'Email notice failed: ',
    st: { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', converted: 'Order created', expired: 'Expired' },
    msg: (n: string, u: string) => `Hello, here is your quote ${n}: ${u}`,
  },
  fr: {
    title: 'Devis', help: "Envoyez au client un lien vers son devis. Il l'accepte ou le refuse en ligne ; un devis accepté devient une commande en un clic.",
    new: 'Nouveau devis', empty: 'Aucun devis pour le moment.', number: 'Devis', customer: 'Client', total: 'Total', status: 'Statut', valid: "Valable jusqu'au",
    name: 'Nom du client', email: 'E-mail', phone: 'Téléphone / WhatsApp', locale: 'Langue', items: 'Articles', item: 'Choisir un article', qty: 'Qté', price: 'Prix unitaire (facultatif)',
    addItem: 'Ajouter un article', days: 'Validité (jours)', note: 'Note pour le client', save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', del: 'Supprimer', send: 'Envoyer / partager',
    print: 'Imprimer / PDF', link: 'Lien client', copy: 'Copier le lien', copied: 'Copié', whatsapp: 'WhatsApp', makeOrder: 'Créer la commande', ordered: 'Commande créée', invalid: 'Ajoutez au moins un article avec une quantité.',
    sentEmail: 'Lien envoyé par e-mail au client.', sentNoEmail: 'Marqué comme envoyé. Partagez le lien ci-dessous.', confirmDel: 'Supprimer ce devis ?', mail: "Échec de l'e-mail : ",
    st: { draft: 'Brouillon', sent: 'Envoyé', accepted: 'Accepté', declined: 'Refusé', converted: 'Commande créée', expired: 'Expiré' },
    msg: (n: string, u: string) => `Bonjour, voici votre devis ${n} : ${u}`,
  },
};

const STATUS_COLOR: Record<QuoteStatus, string> = {
  draft: 'var(--text-muted)', sent: 'var(--accent)', accepted: '#16a34a', declined: '#dc2626', converted: '#16a34a', expired: '#d97706',
};
const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const ZERO = new Set(['XOF', 'GNF', 'JPY', 'KRW', 'VND']);

type Line = { sku: string; qty: string; price: string };
const emptyLine = (): Line => ({ sku: '', qty: '1', price: '' });

export function Quotes({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale();
  const s = S[locale === 'en' ? 'en' : 'fr'];
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Quote | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['quotes'], queryFn: () => api.getQuotes() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['quotes'] });
  const open = data?.items.find((q) => q.id === openId) ?? null;

  return (
    <div className="space-y-4" data-testid="quotes-page">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
          <p className="text-xs" style={muted}>{s.help}</p>
        </div>
        {canWrite && <button className={btn} style={solid} onClick={() => setEditing('new')} data-testid="quote-new">{s.new}</button>}
      </div>

      {data && data.items.length === 0 && <p className="text-sm" style={muted}>{s.empty}</p>}
      {data && data.items.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <table className="rt w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                <th className="p-3">{s.number}</th><th className="p-3">{s.customer}</th><th className="p-3">{s.total}</th><th className="p-3">{s.status}</th><th className="p-3">{s.valid}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((q) => (
                <tr key={q.id} onClick={() => setOpenId(q.id)} className="cursor-pointer border-t" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`quote-row-${q.number}`}>
                  <td className="p-3 font-mono" data-label="">{q.number}</td>
                  <td className="p-3" data-label={s.customer}>{q.customer_name || q.customer_email || '—'}</td>
                  <td className="p-3 font-mono" data-label={s.total}>{formatPrice(q.total_cents, q.currency)}</td>
                  <td className="p-3" data-label={s.status}><span style={{ color: STATUS_COLOR[q.status] }}>{s.st[q.status]}</span></td>
                  <td className="p-3" data-label={s.valid}>{q.valid_until.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <QuoteForm quote={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(q) => { refresh(); setEditing(null); setOpenId(q.id); }} />}
      {open && !editing && <QuoteDetail quote={open} canWrite={canWrite} onClose={() => setOpenId(null)} onChanged={refresh} onEdit={() => setEditing(open)} />}
    </div>
  );
}

function QuoteForm({ quote, onClose, onSaved }: { quote: Quote | null; onClose: () => void; onSaved: (q: Quote) => void }) {
  const { locale } = useLocale();
  const s = S[locale === 'en' ? 'en' : 'fr'];
  const currency = quote?.currency ?? 'XOF';
  const factor = ZERO.has(currency.toUpperCase()) ? 1 : 100;
  const [name, setName] = useState(quote?.customer_name ?? '');
  const [email, setEmail] = useState(quote?.customer_email ?? '');
  const [phone, setPhone] = useState(quote?.customer_phone ?? '');
  const [lang, setLang] = useState<'fr' | 'en'>(quote?.locale ?? (locale === 'en' ? 'en' : 'fr'));
  const [days, setDays] = useState('14');
  const [note, setNote] = useState(quote?.note ?? '');
  const [lines, setLines] = useState<Line[]>(
    quote ? quote.items.map((i) => ({ sku: i.sku, qty: String(i.qty), price: String(i.unit_price_cents / factor) })) : [emptyLine()]
  );
  const [error, setError] = useState<string | null>(null);
  const { data: products } = useQuery({ queryKey: ['quote-products'], queryFn: () => api.getProducts({ limit: 100 }) });
  const variants = (products?.items ?? []).flatMap((p) =>
    p.variants.map((v) => ({ sku: v.sku, label: `${p.title}${v.title && v.title !== p.title ? ' — ' + v.title : ''} (${v.sku})`, price: v.price_cents }))
  );
  const toCents = (x: string) => Math.round(Number(x.replace(',', '.')) * factor);
  const save = useMutation({
    mutationFn: (b: Parameters<typeof api.createQuote>[0]) => (quote ? api.updateQuote(quote.id, b) : api.createQuote(b)),
    onSuccess: onSaved,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });
  function submit() {
    const items = lines.filter((l) => l.sku).map((l) => ({ sku: l.sku, qty: parseInt(l.qty, 10), unit_price_cents: l.price.trim() !== '' ? toCents(l.price) : undefined }));
    if (items.length === 0 || items.some((i) => !Number.isInteger(i.qty) || i.qty <= 0 || (i.unit_price_cents !== undefined && !Number.isFinite(i.unit_price_cents)))) { setError(s.invalid); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(s.invalid); return; }
    setError(null);
    save.mutate({
      currency, items, locale: lang,
      customer_name: name.trim() || undefined, customer_email: email.trim() || undefined, customer_phone: phone.trim() || undefined,
      note: note.trim() || undefined, valid_days: parseInt(days, 10) || 14,
    });
  }
  const upd = (i: number, p: Partial<Line>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <Modal open onClose={onClose} title={quote ? `${s.edit} ${quote.number}` : s.new} size="lg">
      <div className="md:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls} style={muted}>{s.name}</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={muted}>{s.email}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={muted}>{s.phone}</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={muted}>{s.locale}</label>
            <select value={lang} onChange={(e) => setLang(e.target.value as 'fr' | 'en')} className={inputCls} style={inputStyle}><option value="fr">Français</option><option value="en">English</option></select>
          </div>
        </div>
        <div>
          <label className={labelCls} style={muted}>{s.items} *</label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] md:grid-cols-[1fr_70px_150px_auto] gap-2 items-center pb-3 border-b md:pb-0 md:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <select value={l.sku} onChange={(e) => upd(i, { sku: e.target.value })} className={inputCls + ' col-span-3 md:col-span-1'} style={inputStyle} data-testid={`quote-sku-${i}`}>
                  <option value="">{s.item}</option>
                  {variants.map((v) => <option key={v.sku} value={v.sku}>{v.label} · {formatPrice(v.price, currency)}</option>)}
                </select>
                <input inputMode="numeric" value={l.qty} placeholder={s.qty} onChange={(e) => upd(i, { qty: e.target.value })} className={inputCls} style={inputStyle} />
                <input inputMode="decimal" value={l.price} placeholder={s.price} onChange={(e) => upd(i, { price: e.target.value })} className={inputCls} style={inputStyle} />
                <button type="button" aria-label="remove" className="px-2 h-10 w-10 md:h-auto md:w-auto text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 text-sm font-medium hover:underline" style={{ color: 'var(--accent)' }} onClick={() => setLines([...lines, emptyLine()])}>+ {s.addItem}</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
          <div><label className={labelCls} style={muted}>{s.days}</label><input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={muted}>{s.note}</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} style={inputStyle} /></div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }} onClick={onClose}>{s.cancel}</button>
          <button type="button" className={btn} style={solid} disabled={save.isPending} onClick={submit} data-testid="quote-save">{s.save}</button>
        </div>
      </div>
    </Modal>
  );
}

function QuoteDetail({ quote: q, canWrite, onClose, onChanged, onEdit }: { quote: Quote; canWrite: boolean; onClose: () => void; onChanged: () => void; onEdit: () => void }) {
  const { locale } = useLocale();
  const s = S[locale === 'en' ? 'en' : 'fr'];
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fail = (e: unknown) => setMsg(e instanceof Error ? e.message : String(e));
  const send = useMutation({
    mutationFn: () => api.sendQuote(q.id),
    onSuccess: (r) => { setMsg(r.emailed ? s.sentEmail : r.email_error ? s.mail + r.email_error : s.sentNoEmail); onChanged(); },
    onError: fail,
  });
  const del = useMutation({ mutationFn: () => api.deleteQuote(q.id), onSuccess: () => { onChanged(); onClose(); }, onError: fail });
  const order = useMutation({
    mutationFn: async () => {
      const o = await api.createManualOrder({
        customer_email: q.customer_email ?? undefined, customer_name: q.customer_name ?? undefined, currency: q.currency, locale: q.locale,
        items: q.items.map((i) => ({ sku: i.sku, qty: i.qty, unit_price_cents: i.unit_price_cents })),
      });
      await api.quoteConverted(q.id, o.order_id);
      return o;
    },
    onSuccess: (o) => { setMsg(`${s.ordered}: ${o.order_number}`); onChanged(); },
    onError: fail,
  });
  const digits = (q.customer_phone ?? '').replace(/\D/g, '');
  const wa = `https://wa.me/${digits}?text=${encodeURIComponent(s.msg(q.number, q.public_url))}`;
  const locked = q.status === 'accepted' || q.status === 'converted';

  return (
    <Modal open onClose={onClose} title={`${s.number} ${q.number}`} size="lg">
      <div className="md:p-6 space-y-4" data-testid="quote-detail">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium" style={{ color: STATUS_COLOR[q.status] }} data-testid="quote-status">{s.st[q.status]}</span>
          <span style={muted}>{s.valid} {q.valid_until.slice(0, 10)}</span>
          <span className="font-mono ml-auto">{formatPrice(q.total_cents, q.currency)}</span>
        </div>
        <p className="text-sm" style={muted}>{[q.customer_name, q.customer_email, q.customer_phone].filter(Boolean).join(' · ') || '—'}</p>
        <ul className="text-sm divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {q.items.map((i, k) => (
            <li key={k} className="py-2 flex gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="flex-1 min-w-0">{i.title}</span><span style={muted}>{i.qty} × {formatPrice(i.unit_price_cents, q.currency)}</span>
            </li>
          ))}
        </ul>
        {q.note && <p className="text-sm italic" style={muted}>{q.note}</p>}
        {(
          <div>
            <label className={labelCls} style={muted}>{s.link}</label>
            <input readOnly value={q.public_url} onFocus={(e) => e.target.select()} className={inputCls + ' font-mono'} style={inputStyle} data-testid="quote-link" />
            <div className="flex flex-wrap gap-2 mt-2">
              <button className={btn} style={ghost} onClick={async () => { try { await navigator.clipboard.writeText(q.public_url); setCopied(true); } catch { /* the field is selectable */ } }}>{copied ? s.copied : s.copy}</button>
              <button className={btn} style={ghost} onClick={async () => { try { printHtml((await api.getQuotePrint(q.id, q.locale === 'en' ? 'en' : 'fr')).html); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } }} data-testid="quote-print">{s.print}</button>
              {digits.length >= 8 && <a className={btn} style={ghost} href={wa} target="_blank" rel="noreferrer">{s.whatsapp}</a>}
            </div>
          </div>
        )}
        {msg && <p className="text-sm" style={muted} data-testid="quote-msg">{msg}</p>}
        {canWrite && (
          <div className="flex flex-wrap gap-2 pt-1">
            {!locked && <button className={btn} style={solid} disabled={send.isPending} onClick={() => { setMsg(null); send.mutate(); }} data-testid="quote-send">{s.send}</button>}
            {q.status === 'accepted' && <button className={btn} style={solid} disabled={order.isPending} onClick={() => { setMsg(null); order.mutate(); }} data-testid="quote-order">{s.makeOrder}</button>}
            {!locked && <button className={btn} style={ghost} onClick={onEdit}>{s.edit}</button>}
            {(q.status === 'draft' || q.status === 'declined' || q.status === 'expired') && (
              <button className={btn} style={{ ...ghost, color: '#dc2626' }} disabled={del.isPending} onClick={() => { if (window.confirm(s.confirmDel)) del.mutate(); }}>{s.del}</button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
