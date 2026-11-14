import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type OfferInput, type OfferRow } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { useLocale } from '../../lib/locale-context';
import { Modal } from '../../components/Modal';

const S = {
  en: {
    title: 'Offers (upsell)',
    help: 'Suggest a complementary item in the cart: "when the cart has X, offer Y", with an optional discount. The visitor adds it with one tap, and the shop sets the price itself when the order is placed. The numbers below show how many people saw, took and paid for each offer.',
    none: 'No offer yet. Create the first one.', add: 'New offer', edit: 'Edit', del: 'Delete', delConfirm: 'Delete this offer? Carts that already confirmed it keep their price.',
    on: 'On', off: 'Off', when: 'When the cart has', offer: 'Offer', anyCart: 'any item', seen: 'Seen', taken: 'Taken', paid: 'Paid', revenue: 'Revenue', off_pct: (n: number) => `${n}% off`, noDisc: 'no discount',
    name: 'Name (for you)', trigger: 'Trigger', tAny: 'Any item in the cart', tProduct: 'A given product', tSku: 'A given variant', pickProduct: 'Choose a product…', pickVariant: 'Choose a variant…', offered: 'Item to offer', pct: 'Discount %', maxQty: 'Max quantity at this price',
    headFr: 'Message in French (optional)', headEn: 'Message in English (optional)', prio: 'Priority (higher shows first)', active: 'Offer is on', save: 'Save', cancel: 'Cancel', saved: 'Saved.', needName: 'Enter a name and choose the item to offer.', needTrigger: 'Choose what triggers the offer.',
    h: { trigger: 'The offer appears in the cart when the cart holds this. "Any item" suits a small accessory you want to offer to everyone.', pct: 'Applied to the offered item only, and only when it is bought together with the trigger. 0 = suggest without a discount.', max: 'The discount is valid up to this quantity of the offered item. Above it, the normal price applies.', prio: 'When several offers fit a cart, the highest priority is shown first (up to 3).', numbers: '"Seen" counts once per visit. "Paid" counts paid orders that contain the offered item at its offer price.' },
    helpLabel: 'Help', afterHint: 'The offer is also hidden when the item is already in the cart or out of stock.',
  },
  fr: {
    title: 'Offres complémentaires',
    help: 'Proposez un article complémentaire dans le panier : « quand le panier contient X, proposer Y », avec une réduction facultative. Le visiteur l’ajoute d’un geste, et la boutique fixe elle-même le prix au moment de la commande. Les chiffres montrent combien de personnes ont vu, pris et payé chaque offre.',
    none: 'Aucune offre pour le moment. Créez la première.', add: 'Nouvelle offre', edit: 'Modifier', del: 'Supprimer', delConfirm: 'Supprimer cette offre ? Les paniers qui l’ont déjà confirmée gardent leur prix.',
    on: 'Active', off: 'Inactive', when: 'Quand le panier contient', offer: 'Offre', anyCart: 'n’importe quel article', seen: 'Vue', taken: 'Prise', paid: 'Payée', revenue: 'Chiffre d’affaires', off_pct: (n: number) => `-${n} %`, noDisc: 'sans réduction',
    name: 'Nom (pour vous)', trigger: 'Déclencheur', tAny: 'N’importe quel article du panier', tProduct: 'Un produit précis', tSku: 'Une variante précise', pickProduct: 'Choisir un produit…', pickVariant: 'Choisir une variante…', offered: 'Article à proposer', pct: 'Réduction %', maxQty: 'Quantité maximale à ce prix',
    headFr: 'Message en français (facultatif)', headEn: 'Message en anglais (facultatif)', prio: 'Priorité (la plus haute s’affiche en premier)', active: 'L’offre est active', save: 'Enregistrer', cancel: 'Annuler', saved: 'Enregistré.', needName: 'Saisissez un nom et choisissez l’article à proposer.', needTrigger: 'Choisissez ce qui déclenche l’offre.',
    h: { trigger: 'L’offre apparaît dans le panier quand il contient ceci. « N’importe quel article » convient à un petit accessoire que vous voulez proposer à tous.', pct: 'Appliquée à l’article proposé seulement, et seulement s’il est acheté avec le déclencheur. 0 = proposer sans réduction.', max: 'La réduction vaut jusqu’à cette quantité de l’article proposé. Au-delà, le prix normal s’applique.', prio: 'Quand plusieurs offres conviennent à un panier, la plus haute priorité s’affiche en premier (3 au maximum).', numbers: '« Vue » compte une fois par visite. « Payée » compte les commandes payées qui contiennent l’article au prix de l’offre.' },
    helpLabel: 'Aide', afterHint: 'L’offre est aussi masquée si l’article est déjà dans le panier ou en rupture de stock.',
  },
};
type L = (typeof S)['en'];

const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const box = { background: 'var(--bg-card)', border: '1px solid var(--border)' };

function Help({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-block align-middle normal-case">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)} className="ml-1.5 inline-flex items-center justify-center rounded-full text-xs font-bold"
        style={{ width: 22, height: 22, border: '1px solid var(--border)', color: 'var(--text-secondary)', background: open ? 'var(--bg-card)' : 'transparent' }}>?</button>
      {open && <span role="note" className="block text-xs font-normal tracking-normal mt-1 max-w-prose" style={muted}>{text}</span>}
    </span>
  );
}

export function Offers({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale(); const s: L = S[locale === 'en' ? 'en' : 'fr'];
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['offers'], queryFn: () => api.getOffers() });
  const [editing, setEditing] = useState<OfferRow | 'new' | null>(null);
  const del = useMutation({ mutationFn: (id: string) => api.deleteOffer(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['offers'] }) });
  const toggle = useMutation({ mutationFn: (o: OfferRow) => api.updateOffer(o.id, toInput(o, { active: !o.active })), onSuccess: () => qc.invalidateQueries({ queryKey: ['offers'] }) });
  const items = data?.items ?? [];
  return (
    <div className="space-y-4" data-testid="offers-page">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
        <p className="text-xs" style={muted}>{s.help}</p>
      </div>
      {canWrite && <div><button className={btn} style={solid} onClick={() => setEditing('new')} data-testid="offer-new">{s.add}</button></div>}
      {items.length === 0 && <p className="text-sm" style={muted}>{s.none}</p>}
      <div className="space-y-3">
        {items.map((o) => (
          <div key={o.id} className="p-3 space-y-2" style={box} data-testid="offer-row">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <b className="text-sm" style={{ color: 'var(--text)' }}>{o.name}</b>
              <span className="text-xs font-medium" style={{ color: o.active ? '#0F6B4B' : 'var(--text-secondary)' }}>{o.active ? s.on : s.off}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              <span style={muted}>{s.when}: </span>{o.trigger_kind === 'any' ? s.anyCart : (o.trigger_title ?? o.trigger_ref)}
              <br /><span style={muted}>{s.offer}: </span>{o.offer_title ?? o.offer_sku} · {o.discount_pct > 0 ? s.off_pct(o.discount_pct) : s.noDisc}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: 'var(--text)' }}>
              <span><span style={muted}>{s.seen}: </span><b>{o.seen}</b></span>
              <span><span style={muted}>{s.taken}: </span><b>{o.taken}</b></span>
              <span><span style={muted}>{s.paid}: </span><b>{o.sold}</b></span>
              <span><span style={muted}>{s.revenue}: </span><b>{formatPrice(o.revenue_cents, o.currency ?? 'XOF')}</b></span>
              <Help text={s.h.numbers} label={s.helpLabel} />
            </div>
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <button className={btn} style={ghost} onClick={() => setEditing(o)}>{s.edit}</button>
                <button className={btn} style={ghost} onClick={() => toggle.mutate(o)}>{o.active ? s.off : s.on}</button>
                <button className={btn} style={ghost} onClick={() => { if (confirm(s.delConfirm)) del.mutate(o.id); }}>{s.del}</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && <OfferForm s={s} offer={editing === 'new' ? null : editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['offers'] }); }} />}
    </div>
  );
}

const toInput = (o: OfferRow, over: Partial<OfferInput> = {}): OfferInput => ({
  name: o.name, active: !!o.active, trigger_kind: o.trigger_kind, trigger_ref: o.trigger_ref, offer_sku: o.offer_sku, discount_pct: o.discount_pct, max_qty: o.max_qty,
  headline_fr: o.headline_fr, headline_en: o.headline_en, priority: o.priority, ...over,
});

function OfferForm({ s, offer, onClose }: { s: L; offer: OfferRow | null; onClose: () => void }) {
  const products = useQuery({ queryKey: ['products', 'for-offers'], queryFn: () => api.getProducts({ limit: 100 }) });
  const list = products.data?.items ?? [];
  const variants = list.flatMap((p) => (p.variants ?? []).map((v) => ({ sku: v.sku, product_id: p.id, label: `${p.title}${v.title && v.title !== 'Default' ? ' — ' + v.title : ''} (${v.sku})` })));
  const [f, setF] = useState<OfferInput>(offer ? toInput(offer) : { name: '', active: true, trigger_kind: 'any', trigger_ref: null, offer_sku: '', discount_pct: 10, max_qty: 1, headline_fr: '', headline_en: '', priority: 0 });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => {
      if (!f.name.trim() || !f.offer_sku) throw new Error(s.needName);
      if (f.trigger_kind !== 'any' && !f.trigger_ref) throw new Error(s.needTrigger);
      return offer ? api.updateOffer(offer.id, f) : api.createOffer(f);
    },
    onSuccess: onClose, onError: (e: any) => setErr(e.message),
  });
  const set = (p: Partial<OfferInput>) => setF({ ...f, ...p });
  const num = (v: string, d = 0) => (v === '' ? d : Math.max(0, parseInt(v, 10) || 0));
  return (
    <Modal open onClose={onClose} title={offer ? s.edit : s.add} size="lg">
      <div className="space-y-3" data-testid="offer-form">
        <div><label className={labelCls} style={muted}>{s.name}</label><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => set({ name: e.target.value })} data-testid="of-name" /></div>
        <div>
          <label className={labelCls} style={muted}>{s.trigger}<Help text={s.h.trigger} label={s.helpLabel} /></label>
          <select className={inputCls} style={inputStyle} value={f.trigger_kind} onChange={(e) => set({ trigger_kind: e.target.value as OfferInput['trigger_kind'], trigger_ref: null })} data-testid="of-kind">
            <option value="any">{s.tAny}</option><option value="product">{s.tProduct}</option><option value="sku">{s.tSku}</option>
          </select>
          {f.trigger_kind === 'product' && <select className={`${inputCls} mt-2`} style={inputStyle} value={f.trigger_ref ?? ''} onChange={(e) => set({ trigger_ref: e.target.value || null })} data-testid="of-ref"><option value="">{s.pickProduct}</option>{list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>}
          {f.trigger_kind === 'sku' && <select className={`${inputCls} mt-2`} style={inputStyle} value={f.trigger_ref ?? ''} onChange={(e) => set({ trigger_ref: e.target.value || null })} data-testid="of-ref"><option value="">{s.pickVariant}</option>{variants.map((v) => <option key={v.sku} value={v.sku}>{v.label}</option>)}</select>}
        </div>
        <div>
          <label className={labelCls} style={muted}>{s.offered}</label>
          <select className={inputCls} style={inputStyle} value={f.offer_sku} onChange={(e) => set({ offer_sku: e.target.value })} data-testid="of-sku"><option value="">{s.pickVariant}</option>{variants.map((v) => <option key={v.sku} value={v.sku}>{v.label}</option>)}</select>
          <p className="text-xs mt-1" style={muted}>{s.afterHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls} style={muted}>{s.pct}<Help text={s.h.pct} label={s.helpLabel} /></label><input className={inputCls} style={inputStyle} inputMode="numeric" value={String(f.discount_pct)} onChange={(e) => set({ discount_pct: Math.min(90, num(e.target.value)) })} data-testid="of-pct" /></div>
          <div><label className={labelCls} style={muted}>{s.maxQty}<Help text={s.h.max} label={s.helpLabel} /></label><input className={inputCls} style={inputStyle} inputMode="numeric" value={String(f.max_qty)} onChange={(e) => set({ max_qty: Math.min(20, Math.max(1, num(e.target.value, 1))) })} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className={labelCls} style={muted}>{s.headFr}</label><input className={inputCls} style={inputStyle} value={f.headline_fr ?? ''} onChange={(e) => set({ headline_fr: e.target.value })} /></div>
          <div><label className={labelCls} style={muted}>{s.headEn}</label><input className={inputCls} style={inputStyle} value={f.headline_en ?? ''} onChange={(e) => set({ headline_en: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div><label className={labelCls} style={muted}>{s.prio}<Help text={s.h.prio} label={s.helpLabel} /></label><input className={inputCls} style={inputStyle} inputMode="numeric" value={String(f.priority)} onChange={(e) => set({ priority: Math.min(100, num(e.target.value)) })} /></div>
          <label className="text-sm flex items-center gap-2 pb-2" style={{ color: 'var(--text)' }}><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />{s.active}</label>
        </div>
        {err && <p className="text-xs" role="alert" style={{ color: '#dc2626' }}>{err}</p>}
        <div className="flex gap-2 justify-end">
          <button className={btn} style={ghost} onClick={onClose}>{s.cancel}</button>
          <button className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate()} data-testid="of-save">{s.save}</button>
        </div>
      </div>
    </Modal>
  );
}
