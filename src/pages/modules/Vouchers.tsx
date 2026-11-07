import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type VoucherDelivery, type VoucherLoadReport, type VoucherPlan } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { Modal } from '../../components/Modal';
import { useLocale } from '../../lib/locale-context';

// Self-contained strings: a module does not touch the core translation file.
const S = {
  en: {
    title: 'WiFi vouchers', help: 'Load the codes your router already knows, link them to a product, and every paid order gets its code automatically (page, e-mail, counter receipt). If you run out, paid orders wait and are served first-come-first-served when you load more.',
    empty: 'No voucher product yet. Add one below.', stock: 'In stock', sold: 'Sold', waiting: 'Waiting for a code', low: 'Running low', none: 'Out of stock',
    load: 'Load codes', instr: 'Instructions', remove: 'Remove', confirmRemove: 'Stop selling this product as a code?', newTitle: 'Create a new voucher product', newName: 'Name (e.g. WiFi 1 day)', newPrice: 'Price (smallest unit, e.g. 300 for 300 F)', create: 'Create and sell as a code', createHelp: 'Creates the product (type Digital, no file, no stock, no delivery address) and links it, in one step.', addPlan: 'Add a voucher product', pick: 'Choose a product…', add: 'Add',
    paste: 'Paste the codes, one per line: username or username,password. A header line is fine.', batch: 'Batch name (optional)', check: 'Check', loadNow: 'Load', cancel: 'Cancel', save: 'Save',
    okCheck: (n: number) => `${n} code(s) ready to load.`, added: (n: number) => `${n} code(s) loaded.`, refused: 'Nothing was loaded. Fix these lines and try again:', line: 'Line',
    fr: 'Instructions (French)', en: 'Instructions (English)', instrHelp: 'Shown with the code (e.g. “Connect to WiFi Santé, open any page, enter the code”).',
    sale: 'Counter sale', saleHelp: 'Sell a code in person: it is handed out at once and can be printed or sent by WhatsApp.', qty: 'Quantity', method: 'Paid by', cash: 'Cash', mm: 'Mobile money', sell: 'Sell and show the code',
    phone: 'Customer WhatsApp (optional)', email: 'Customer e-mail (optional)', receipt: 'Receipt', print: 'Print', share: 'Send by WhatsApp', close: 'Close', user: 'Username', pass: 'Password',
    orders: 'Recent deliveries', order: 'Order', codes: 'Codes', mail: 'E-mail', resend: 'Send again', view: 'Show', sent: 'Sent', noMail: '—', pending: 'Waiting for codes', refunded: 'Refunded: disable these codes on the router',
    noOrders: 'No voucher orders yet.', wasent: 'Resent.', notSent: 'Could not send (no e-mail set up or no address).',
    wamsg: (codes: string) => `Your WiFi access:\n${codes}`,
  },
  fr: {
    title: 'Vouchers WiFi', help: 'Chargez les codes que votre routeur connaît déjà, liez-les à un produit, et chaque commande payée reçoit son code automatiquement (page, e-mail, ticket au comptoir). En rupture, les commandes payées attendent et sont servies dans l’ordre dès que vous rechargez.',
    empty: 'Aucun produit voucher pour le moment. Ajoutez-en un ci-dessous.', stock: 'En stock', sold: 'Vendus', waiting: 'En attente de code', low: 'Stock bas', none: 'Rupture',
    load: 'Charger des codes', instr: 'Instructions', remove: 'Retirer', confirmRemove: 'Ne plus vendre ce produit comme un code ?', newTitle: 'Créer un nouveau produit voucher', newName: 'Nom (ex. WiFi 1 jour)', newPrice: 'Prix (plus petite unité, ex. 300 pour 300 F)', create: 'Créer et vendre comme code', createHelp: 'Crée le produit (type Digital, sans fichier, sans stock, sans adresse de livraison) et le relie, en une seule étape.', addPlan: 'Ajouter un produit voucher', pick: 'Choisir un produit…', add: 'Ajouter',
    paste: 'Collez les codes, un par ligne : identifiant ou identifiant,mot de passe. Une ligne d’en-tête est acceptée.', batch: 'Nom du lot (facultatif)', check: 'Vérifier', loadNow: 'Charger', cancel: 'Annuler', save: 'Enregistrer',
    okCheck: (n: number) => `${n} code(s) prêts à charger.`, added: (n: number) => `${n} code(s) chargés.`, refused: 'Rien n’a été chargé. Corrigez ces lignes puis réessayez :', line: 'Ligne',
    fr: 'Instructions (français)', en: 'Instructions (anglais)', instrHelp: 'Affichées avec le code (ex. « Connectez-vous au WiFi Santé, ouvrez une page, saisissez le code »).',
    sale: 'Vente au comptoir', saleHelp: 'Vendez un code en personne : il est remis tout de suite, à imprimer ou envoyer par WhatsApp.', qty: 'Quantité', method: 'Payé par', cash: 'Espèces', mm: 'Mobile money', sell: 'Vendre et afficher le code',
    phone: 'WhatsApp du client (facultatif)', email: 'E-mail du client (facultatif)', receipt: 'Ticket', print: 'Imprimer', share: 'Envoyer par WhatsApp', close: 'Fermer', user: 'Identifiant', pass: 'Mot de passe',
    orders: 'Dernières remises', order: 'Commande', codes: 'Codes', mail: 'E-mail', resend: 'Renvoyer', view: 'Voir', sent: 'Envoyé', noMail: '—', pending: 'En attente de codes', refunded: 'Remboursée : désactivez ces codes sur le routeur',
    noOrders: 'Aucune commande de vouchers pour le moment.', wasent: 'Renvoyé.', notSent: 'Envoi impossible (e-mail non configuré ou pas d’adresse).',
    wamsg: (codes: string) => `Votre accès WiFi :\n${codes}`,
  },
};

const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const LOW = 10;

const codesText = (d: VoucherDelivery) => d.items.flatMap((i) => i.codes.map((c) => c.password ? `${c.username} / ${c.password}` : c.username)).join('\n');

function printReceipt(d: VoucherDelivery, s: typeof S.en, instr: string[]) {
  const w = window.open('', '_blank', 'width=360,height=600'); if (!w) return;
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = d.items.flatMap((i) => i.codes.map((c) => `<div class="c"><small>${esc(i.title)}</small><b>${esc(s.user)}: ${esc(c.username)}</b>${c.password ? `<br><b>${esc(s.pass)}: ${esc(c.password)}</b>` : ''}</div>`)).join('');
  w.document.write(`<!doctype html><title>${esc(d.number)}</title><style>body{font:14px system-ui,sans-serif;margin:12px;max-width:300px}h1{font-size:15px;margin:0 0 8px}.c{border:1px dashed #000;padding:8px;margin:8px 0;font-family:monospace;font-size:16px}small{display:block;font:11px system-ui}p{white-space:pre-wrap;font-size:12px}</style><h1>${esc(s.receipt)} ${esc(d.number)}</h1>${rows}${instr.map((t) => `<p>${esc(t)}</p>`).join('')}<script>setTimeout(function(){window.print()},200)</script>`);
  w.document.close();
}

export function Vouchers({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale();
  const lang = locale === 'en' ? 'en' : 'fr'; const s = S[lang];
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['vouchers'] }); };
  const { data } = useQuery({ queryKey: ['vouchers', 'plans'], queryFn: () => api.getVoucherPlans() });
  const orders = useQuery({ queryKey: ['vouchers', 'orders'], queryFn: () => api.getVoucherOrders() });
  const products = useQuery({ queryKey: ['products', 'for-vouchers'], queryFn: () => api.getProducts({ limit: 100 }), enabled: canWrite });
  const [loading, setLoading] = useState<VoucherPlan | null>(null);
  const [editing, setEditing] = useState<VoucherPlan | null>(null);
  const [receipt, setReceipt] = useState<VoucherDelivery | null>(null);
  const [pick, setPick] = useState('');
  const [note, setNote] = useState('');
  const plans = data?.items ?? [];
  const taken = new Set(plans.map((p) => p.sku));
  const variants = (products.data?.items ?? []).flatMap((p) => (p.variants ?? []).filter((v) => v.sku && !taken.has(v.sku)).map((v) => ({ sku: v.sku, label: `${p.title}${v.title && v.title !== 'Default' ? ' — ' + v.title : ''} (${v.sku})` })));
  const [newName, setNewName] = useState(''); const [newPrice, setNewPrice] = useState('');
  const create = useMutation({
    mutationFn: async () => {
      const price = parseInt(newPrice, 10);
      if (!newName.trim() || !Number.isFinite(price) || price < 0) throw new Error(s.newName);
      const product = await api.createProduct({ title: newName.trim() });
      const sku = `WIFI-${newName.trim().toUpperCase().normalize('NFD').replace(/[^A-Z0-9]+/g, '').slice(0, 8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      try {
        await api.createVariant(product.id, { sku, title: 'Default', price_cents: price, product_type: 'digital' });
        await api.saveVoucherPlan(sku, {});
      } catch (e) { try { await api.deleteProduct(product.id); } catch { /* leave the product; it can be removed in Products */ } throw e; }
    },
    onSuccess: () => { setNewName(''); setNewPrice(''); setNote(''); refresh(); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e: any) => setNote(e.message),
  });
  const addPlan = useMutation({ mutationFn: (sku: string) => api.saveVoucherPlan(sku, {}), onSuccess: () => { setPick(''); refresh(); } });
  const delPlan = useMutation({ mutationFn: (sku: string) => api.deleteVoucherPlan(sku), onSuccess: refresh, onError: (e: any) => setNote(e.message) });
  const resend = useMutation({ mutationFn: (id: string) => api.resendVoucher(id), onSuccess: (r) => { setNote(r.emailed ? s.wasent : s.notSent); refresh(); }, onError: (e: any) => setNote(e.message) });

  return (
    <div className="space-y-5" data-testid="vouchers-page">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
        <p className="text-xs" style={muted}>{s.help}</p>
        {note && <p className="text-xs mt-1" style={{ color: 'var(--text)' }} role="status">{note}</p>}
      </div>

      {plans.length === 0 && <p className="text-sm" style={muted}>{s.empty}</p>}
      <div className="space-y-3">
        {plans.map((p) => {
          const warn = p.waiting > 0 || p.available < LOW;
          return (
            <div key={p.sku} className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} data-testid={`vplan-${p.sku}`}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <b className="text-sm" style={{ color: 'var(--text)' }}>{p.product_title}{p.variant_title && p.variant_title !== 'Default' ? ` — ${p.variant_title}` : ''}</b>
                <span className="text-xs" style={muted}>{p.sku}{p.price_cents != null && p.currency ? ` · ${formatPrice(p.price_cents, p.currency)}` : ''}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span><span style={muted}>{s.stock}: </span><b data-testid="v-avail" style={{ color: p.available === 0 ? '#dc2626' : warn ? '#d97706' : 'var(--text)' }}>{p.available}</b></span>
                <span><span style={muted}>{s.sold}: </span><b>{p.sold}</b></span>
                {p.waiting > 0 && <span style={{ color: '#dc2626' }}><b data-testid="v-waiting">{p.waiting}</b> {s.waiting}</span>}
                {p.available === 0 ? <span className="text-xs font-medium" style={{ color: '#dc2626' }}>{s.none}</span> : p.available < LOW && <span className="text-xs font-medium" style={{ color: '#d97706' }}>{s.low}</span>}
              </div>
              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  <button className={btn} style={solid} onClick={() => setLoading(p)} data-testid={`vload-${p.sku}`}>{s.load}</button>
                  <button className={btn} style={ghost} onClick={() => setEditing(p)}>{s.instr}</button>
                  <button className={btn} style={ghost} onClick={() => { if (confirm(s.confirmRemove)) delPlan.mutate(p.sku); }}>{s.remove}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {canWrite && (
        <div className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} data-testid="v-create">
          <label className={labelCls} style={muted}>{s.newTitle}</label>
          <p className="text-xs" style={muted}>{s.createHelp}</p>
          <div className="flex flex-wrap gap-2">
            <input className={inputCls} style={{ ...inputStyle, flex: '2 1 200px' }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={s.newName} data-testid="v-new-name" />
            <input className={inputCls} style={{ ...inputStyle, flex: '1 1 140px' }} inputMode="numeric" value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder={s.newPrice} data-testid="v-new-price" />
            <button className={btn} style={solid} disabled={create.isPending || !newName.trim() || !newPrice} onClick={() => create.mutate()} data-testid="v-new-go">{s.create}</button>
          </div>
        </div>
      )}

      {canWrite && (
        <div className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <label className={labelCls} style={muted}>{s.addPlan}</label>
          <div className="flex flex-wrap gap-2">
            <select className={inputCls} style={{ ...inputStyle, flex: '1 1 220px' }} value={pick} onChange={(e) => setPick(e.target.value)} data-testid="v-pick">
              <option value="">{s.pick}</option>
              {variants.map((v) => <option key={v.sku} value={v.sku}>{v.label}</option>)}
            </select>
            <button className={btn} style={solid} disabled={!pick || addPlan.isPending} onClick={() => addPlan.mutate(pick)} data-testid="v-add">{s.add}</button>
          </div>
        </div>
      )}

      {canWrite && plans.length > 0 && <CounterSale plans={plans} s={s} onDone={(d) => { setReceipt(d); refresh(); }} />}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.orders}</h2>
        {(orders.data?.items ?? []).length === 0 && <p className="text-sm" style={muted}>{s.noOrders}</p>}
        {(orders.data?.items ?? []).map((d) => {
          const missing = d.items.reduce((n, i) => n + i.waiting, 0);
          const withdrawn = d.order_status === 'refunded' || d.order_status === 'canceled';
          return (
            <div key={d.order_id} className="p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <b style={{ color: 'var(--text)' }}>{d.number}</b>
              <span style={muted}>{d.items.map((i) => `${i.title} × ${i.qty}`).join(', ')}</span>
              <span>{d.items.reduce((n, i) => n + i.codes.length, 0)} {s.codes.toLowerCase()}</span>
              {missing > 0 && <span style={{ color: '#d97706' }}>{s.pending} ({missing})</span>}
              {withdrawn && <span style={{ color: '#dc2626' }}>{s.refunded}</span>}
              <span className="text-xs" style={muted}>{s.mail}: {d.emailed ? s.sent : s.noMail}</span>
              <span className="flex gap-2 ml-auto">
                <button className={btn} style={ghost} onClick={async () => setReceipt(await api.getVoucherOrder(d.order_id))}>{s.view}</button>
                {canWrite && missing === 0 && !withdrawn && <button className={btn} style={ghost} disabled={resend.isPending} onClick={() => resend.mutate(d.order_id)}>{s.resend}</button>}
              </span>
            </div>
          );
        })}
      </div>

      {loading && <LoadModal plan={loading} s={s} onClose={() => { setLoading(null); refresh(); }} />}
      {editing && <InstrModal plan={editing} s={s} onClose={() => { setEditing(null); refresh(); }} />}
      {receipt && <ReceiptModal d={receipt} s={s} lang={lang} plans={plans} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function LoadModal({ plan, s, onClose }: { plan: VoucherPlan; s: typeof S.en; onClose: () => void }) {
  const [text, setText] = useState(''); const [batch, setBatch] = useState('');
  const [rep, setRep] = useState<VoucherLoadReport | null>(null); const [err, setErr] = useState('');
  const run = useMutation({
    mutationFn: (dry: boolean) => api.loadVoucherCodes(plan.sku, { text, batch: batch || undefined, dry_run: dry }),
    onSuccess: (r, dry) => { setRep({ ...r, ...(dry ? {} : {}) }); setErr(''); if (!dry && r.ok && r.added > 0) setText(''); },
    onError: (e: any) => setErr(e instanceof ApiError ? e.message : String(e)),
  });
  return (
    <Modal open onClose={onClose} title={`${s.load} — ${plan.sku}`}>
      <div className="space-y-3">
        <p className="text-xs" style={muted}>{s.paste}</p>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 160, fontFamily: 'ui-monospace, monospace' }} value={text} onChange={(e) => { setText(e.target.value); setRep(null); }} data-testid="v-text" />
        <input className={inputCls} style={inputStyle} placeholder={s.batch} value={batch} onChange={(e) => setBatch(e.target.value)} />
        {err && <p className="text-sm" style={{ color: '#dc2626' }}>{err}</p>}
        {rep && rep.ok && rep.added === 0 && <p className="text-sm" style={{ color: '#16a34a' }} data-testid="v-ok">{s.okCheck(rep.to_add)}</p>}
        {rep && rep.ok && rep.added > 0 && <p className="text-sm" style={{ color: '#16a34a' }} data-testid="v-added">{s.added(rep.added)}</p>}
        {rep && !rep.ok && (
          <div className="text-sm" style={{ color: '#dc2626' }} data-testid="v-problems">
            <p>{s.refused}</p>
            <ul className="list-disc pl-5 mt-1">{rep.problems.slice(0, 30).map((p, i) => <li key={i}>{s.line} {p.line}: {p.text} — {p.reason}</li>)}</ul>
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button className={btn} style={ghost} onClick={onClose}>{s.cancel}</button>
          <button className={btn} style={ghost} disabled={!text.trim() || run.isPending} onClick={() => run.mutate(true)} data-testid="v-check">{s.check}</button>
          <button className={btn} style={solid} disabled={!text.trim() || run.isPending} onClick={() => run.mutate(false)} data-testid="v-load">{s.loadNow}</button>
        </div>
      </div>
    </Modal>
  );
}

function InstrModal({ plan, s, onClose }: { plan: VoucherPlan; s: typeof S.en; onClose: () => void }) {
  const [fr, setFr] = useState(plan.instructions_fr ?? ''); const [en, setEn] = useState(plan.instructions_en ?? '');
  const save = useMutation({ mutationFn: () => api.saveVoucherPlan(plan.sku, { instructions_fr: fr, instructions_en: en }), onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title={`${s.instr} — ${plan.sku}`}>
      <div className="space-y-3">
        <p className="text-xs" style={muted}>{s.instrHelp}</p>
        <div><label className={labelCls} style={muted}>{s.fr}</label><textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }} value={fr} onChange={(e) => setFr(e.target.value)} /></div>
        <div><label className={labelCls} style={muted}>{s.en}</label><textarea className={inputCls} style={{ ...inputStyle, minHeight: 80 }} value={en} onChange={(e) => setEn(e.target.value)} /></div>
        <div className="flex gap-2 justify-end">
          <button className={btn} style={ghost} onClick={onClose}>{s.cancel}</button>
          <button className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate()}>{s.save}</button>
        </div>
      </div>
    </Modal>
  );
}

function CounterSale({ plans, s, onDone }: { plans: VoucherPlan[]; s: typeof S.en; onDone: (d: VoucherDelivery) => void }) {
  const [sku, setSku] = useState(plans[0]?.sku ?? ''); const [qty, setQty] = useState('1'); const [method, setMethod] = useState('cash');
  const [email, setEmail] = useState(''); const [err, setErr] = useState('');
  const plan = plans.find((p) => p.sku === sku) ?? plans[0];
  const n = Math.max(1, Math.min(50, parseInt(qty, 10) || 1));
  const sell = useMutation({
    mutationFn: async () => {
      if (!plan || plan.price_cents == null) throw new Error('No price');
      const o = await api.createManualOrder({ customer_email: email || undefined, currency: plan.currency ?? undefined, items: [{ sku: plan.sku, qty: n }], payment: { amount_cents: plan.price_cents * n, method } });
      return api.getVoucherOrder(o.order_id);
    },
    onSuccess: (d) => { setErr(''); onDone(d); }, onError: (e: any) => setErr(e.message),
  });
  return (
    <div className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} data-testid="v-sale">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.sale}</h2>
      <p className="text-xs" style={muted}>{s.saleHelp}</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <select className={inputCls} style={inputStyle} value={plan?.sku ?? ''} onChange={(e) => setSku(e.target.value)} data-testid="v-sale-sku">
          {plans.map((p) => <option key={p.sku} value={p.sku}>{p.product_title}{p.variant_title && p.variant_title !== 'Default' ? ` — ${p.variant_title}` : ''}</option>)}
        </select>
        <input className={inputCls} style={inputStyle} inputMode="numeric" aria-label={s.qty} placeholder={s.qty} value={qty} onChange={(e) => setQty(e.target.value)} data-testid="v-sale-qty" />
        <select className={inputCls} style={inputStyle} value={method} onChange={(e) => setMethod(e.target.value)} aria-label={s.method}>
          <option value="cash">{s.cash}</option><option value="mobile_money">{s.mm}</option>
        </select>
        <input className={inputCls} style={inputStyle} type="email" placeholder={s.email} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {err && <p className="text-sm" style={{ color: '#dc2626' }}>{err}</p>}
      <button className={btn} style={solid} disabled={sell.isPending || !plan} onClick={() => sell.mutate()} data-testid="v-sell">{s.sell}{plan?.price_cents != null && plan.currency ? ` · ${formatPrice(plan.price_cents * n, plan.currency)}` : ''}</button>
    </div>
  );
}

function ReceiptModal({ d, s, lang, plans, onClose }: { d: VoucherDelivery; s: typeof S.en; lang: 'fr' | 'en'; plans: VoucherPlan[]; onClose: () => void }) {
  const instr = [...new Set(d.items.map((i) => { const p = plans.find((x) => x.sku === i.sku); return (lang === 'en' ? p?.instructions_en || p?.instructions_fr : p?.instructions_fr || p?.instructions_en) ?? ''; }).filter(Boolean))];
  const text = codesText(d) + (instr.length ? '\n\n' + instr.join('\n') : '');
  const missing = d.items.reduce((n, i) => n + i.waiting, 0);
  return (
    <Modal open onClose={onClose} title={`${s.receipt} ${d.number}`}>
      <div className="space-y-3" data-testid="v-receipt">
        {d.items.map((i) => i.codes.map((c) => (
          <div key={c.seq} className="p-3 rounded-lg" style={{ background: 'var(--bg-subtle, #f4f1e8)', fontFamily: 'ui-monospace, monospace' }} data-testid="v-code">
            <div className="text-[11px]" style={muted}>{i.title}</div>
            <div className="text-lg break-all">{c.username}</div>
            {c.password && <div className="text-base break-all">{c.password}</div>}
          </div>
        )))}
        {missing > 0 && <p className="text-sm" style={{ color: '#d97706' }}>{s.pending} ({missing})</p>}
        {instr.map((t, i) => <p key={i} className="text-sm whitespace-pre-wrap" style={muted}>{t}</p>)}
        <div className="flex flex-wrap gap-2 justify-end">
          <button className={btn} style={ghost} onClick={onClose}>{s.close}</button>
          {missing === 0 && <>
            <button className={btn} style={ghost} onClick={() => window.open(`https://wa.me/${(d.customer_phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(s.wamsg(text))}`, '_blank', 'noopener')}>{s.share}</button>
            <button className={btn} style={solid} onClick={() => printReceipt(d, s, instr)}>{s.print}</button>
          </>}
        </div>
      </div>
    </Modal>
  );
}
