import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Order } from '../lib/api';
import { Modal } from '../components/Modal';
import { useLocale } from '../lib/locale-context';
import { buildReceiptHtml, printHtml, whatsappLink, type ShopProfile } from '../lib/receipt';

const S = {
  en: {
    open: 'Receipt / invoice', title: 'Receipt', kind: 'Document', receipt: 'Receipt', invoice: 'Invoice', lang: 'Language', paper: 'Paper', ticket: 'Ticket (80 mm)', a4: 'A4',
    print: 'Print', whatsapp: 'Send by WhatsApp', noPhone: 'No phone number on this order for WhatsApp.', shop: 'Shop details', edit: 'Edit shop details', hide: 'Hide shop details',
    name: 'Name', address: 'Address', phone: 'Phone', email: 'E-mail', taxId: 'Tax number (shown as is)', footerFr: 'Footer text (French)', footerEn: 'Footer text (English)', defPaper: 'Default paper',
    save: 'Save', saved: 'Saved.', missing: 'Add your address and phone in the shop details so they appear on the receipt.',
    note: 'A receipt is a proof of sale. Where tax law requires a certified invoice, this document does not replace it.',
  },
  fr: {
    open: 'Reçu / facture', title: 'Reçu', kind: 'Document', receipt: 'Reçu', invoice: 'Facture', lang: 'Langue', paper: 'Papier', ticket: 'Ticket (80 mm)', a4: 'A4',
    print: 'Imprimer', whatsapp: 'Envoyer par WhatsApp', noPhone: 'Pas de numéro de téléphone sur cette commande pour WhatsApp.', shop: 'Informations de la boutique', edit: 'Modifier les informations', hide: 'Masquer les informations',
    name: 'Nom', address: 'Adresse', phone: 'Téléphone', email: 'E-mail', taxId: 'Numéro fiscal (affiché tel quel)', footerFr: 'Texte de bas de page (français)', footerEn: 'Texte de bas de page (anglais)', defPaper: 'Papier par défaut',
    save: 'Enregistrer', saved: 'Enregistré.', missing: 'Ajoutez votre adresse et votre téléphone dans les informations de la boutique pour qu’ils apparaissent sur le reçu.',
    note: 'Un reçu est une preuve de vente. Là où la loi fiscale impose une facture certifiée, ce document ne la remplace pas.',
  },
};
const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };

export function ReceiptButton({ order, canEditShop }: { order: Order; canEditShop: boolean }) {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr'];
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn} style={ghost} data-testid="receipt-open">{s.open}</button>
      {open && <ReceiptDialog order={order} canEditShop={canEditShop} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReceiptDialog({ order, canEditShop, onClose }: { order: Order; canEditShop: boolean; onClose: () => void }) {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr'];
  const qc = useQueryClient();
  const { data: shop } = useQuery({ queryKey: ['shop-profile'], queryFn: () => api.getShopProfile() });
  const { data: pay } = useQuery({ queryKey: ['order-payments-receipt', order.id], queryFn: () => api.getOrderPayments(order.id) });
  const [kind, setKind] = useState<'receipt' | 'invoice'>('receipt');
  const [lang, setLang] = useState<'fr' | 'en'>(locale === 'en' ? 'en' : 'fr');
  const [paper, setPaper] = useState<'ticket' | 'a4' | null>(null);
  const [editing, setEditing] = useState(false); const [form, setForm] = useState<ShopProfile | null>(null); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: (v: ShopProfile) => api.saveShopProfile(v),
    onSuccess: () => { setNote(s.saved); setErr(''); setEditing(false); qc.invalidateQueries({ queryKey: ['shop-profile'] }); },
    onError: (e: any) => { setNote(''); setErr(e.message); },
  });
  const chosenPaper = paper ?? shop?.paper ?? 'ticket';
  const html = useMemo(() => (shop ? buildReceiptHtml(order, pay ?? null, shop, { lang, paper: chosenPaper, kind }) : ''), [order, pay, shop, lang, chosenPaper, kind]);
  const wa = shop ? whatsappLink(order, pay ?? null, shop, lang, order.shipping?.phone) : null;
  const f = form ?? shop;
  const field = (k: keyof ShopProfile, label: string, multi = false) => f && (
    <label className="block"><span className={labelCls} style={muted}>{label}</span>
      {multi ? <textarea rows={2} className={inputCls} style={inputStyle} value={f[k] as string} onChange={(e) => setForm({ ...f, [k]: e.target.value })} />
        : <input className={inputCls} style={inputStyle} value={f[k] as string} onChange={(e) => setForm({ ...f, [k]: e.target.value })} />}
    </label>
  );
  const seg = <T extends string>(value: T, set: (v: T) => void, opts: [T, string][]) => (
    <div className="flex gap-1 flex-wrap">{opts.map(([v, label]) => <button key={v} type="button" onClick={() => set(v)} aria-pressed={value === v} className={btn} style={value === v ? solid : ghost}>{label}</button>)}</div>
  );
  return (
    <Modal open onClose={onClose} title={`${s.title} ${order.number || order.id.slice(0, 8)}`} size="lg">
      <div className="space-y-4" data-testid="receipt-dialog">
        <div className="grid sm:grid-cols-3 gap-3">
          <div><span className={labelCls} style={muted}>{s.kind}</span>{seg(kind, setKind, [['receipt', s.receipt], ['invoice', s.invoice]])}</div>
          <div><span className={labelCls} style={muted}>{s.lang}</span>{seg(lang, setLang, [['fr', 'FR'], ['en', 'EN']])}</div>
          <div><span className={labelCls} style={muted}>{s.paper}</span>{seg(chosenPaper, setPaper, [['ticket', s.ticket], ['a4', s.a4]])}</div>
        </div>
        {shop && !shop.address && !shop.phone && <p className="text-xs" style={{ color: '#d97706' }}>{s.missing}</p>}
        {html && <iframe title="preview" srcDoc={html} className="w-full rounded-lg bg-white" style={{ height: chosenPaper === 'ticket' ? 360 : 420, border: '1px solid var(--border)' }} />}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} style={solid} disabled={!html} onClick={() => printHtml(html)}>{s.print}</button>
          {wa ? <a className={btn} style={ghost} href={wa} target="_blank" rel="noopener noreferrer">{s.whatsapp}</a> : <span className="text-xs self-center" style={muted}>{s.noPhone}</span>}
          {canEditShop && <button type="button" className={btn} style={ghost} onClick={() => { setEditing(!editing); setForm(null); }}>{editing ? s.hide : s.edit}</button>}
        </div>
        {note && <p className="text-xs" role="status" style={{ color: 'var(--text)' }}>{note}</p>}
        {editing && f && (
          <div className="p-3 space-y-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.shop}</h3>
            {field('name', s.name)}{field('address', s.address, true)}
            <div className="grid sm:grid-cols-2 gap-3">{field('phone', s.phone)}{field('email', s.email)}</div>
            {field('tax_id', s.taxId)}{field('footer_fr', s.footerFr, true)}{field('footer_en', s.footerEn, true)}
            <div><span className={labelCls} style={muted}>{s.defPaper}</span>{seg(f.paper, (v) => setForm({ ...f, paper: v }), [['ticket', s.ticket], ['a4', s.a4]])}</div>
            {err && <p className="text-sm" style={{ color: '#dc2626' }}>{err}</p>}
            <button type="button" className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate(f)}>{s.save}</button>
          </div>
        )}
        <p className="text-xs" style={muted}>{s.note}</p>
      </div>
    </Modal>
  );
}
