import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type LowStockItem } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { useLocale } from '../../lib/locale-context';

const S = {
  en: {
    title: 'Low-stock alerts', help: 'You are told once when a product drops under its threshold, and once more if it runs out — not every few minutes. Stock counts what is on the shelf minus what customers have reserved.',
    settings: 'Alerts', threshold: 'Default threshold (units)', emails: 'Send e-mails to (comma separated)', push: 'Also notify the installed admin app', save: 'Save', saved: 'Saved.',
    show: 'Show all products', hide: 'Only products to reorder', level: { ok: 'OK', low: 'Low', out: 'Out' }, avail: 'Available', thr: 'Threshold', supplier: 'Supplier', none: '—', edit: 'Edit', msg: 'Reorder message',
    empty: 'Nothing to reorder right now.', suppliers: 'Suppliers', sName: 'Name', sPhone: 'WhatsApp / phone', sEmail: 'E-mail', add: 'Add', remove: 'Remove', mute: 'Do not alert for this product', reorder: 'Usual reorder quantity',
    useDefault: 'Default', mutedTag: 'muted', cancel: 'Cancel', copy: 'Copy', copied: 'Copied.', whatsapp: 'Open in WhatsApp', close: 'Close', stockFor: 'Product',
  },
  fr: {
    title: 'Alertes de stock bas', help: 'Vous êtes prévenu une fois quand un produit passe sous son seuil, et une fois de plus s’il est épuisé — pas toutes les quelques minutes. Le stock = ce qu’il y a en rayon moins ce que les clients ont réservé.',
    settings: 'Alertes', threshold: 'Seuil par défaut (unités)', emails: 'Envoyer les e-mails à (séparés par des virgules)', push: 'Notifier aussi l’application admin installée', save: 'Enregistrer', saved: 'Enregistré.',
    show: 'Voir tous les produits', hide: 'Seulement les produits à recommander', level: { ok: 'OK', low: 'Bas', out: 'Épuisé' }, avail: 'Disponible', thr: 'Seuil', supplier: 'Fournisseur', none: '—', edit: 'Modifier', msg: 'Message de réassort',
    empty: 'Rien à recommander pour le moment.', suppliers: 'Fournisseurs', sName: 'Nom', sPhone: 'WhatsApp / téléphone', sEmail: 'E-mail', add: 'Ajouter', remove: 'Retirer', mute: 'Ne pas alerter pour ce produit', reorder: 'Quantité habituelle de réassort',
    useDefault: 'Par défaut', mutedTag: 'en sourdine', cancel: 'Annuler', copy: 'Copier', copied: 'Copié.', whatsapp: 'Ouvrir dans WhatsApp', close: 'Fermer', stockFor: 'Produit',
  },
};
const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const box = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const COLOR = { ok: '#16a34a', low: '#d97706', out: '#dc2626' };
const name = (i: LowStockItem) => `${i.product_title}${i.variant_title && i.variant_title !== 'Default' ? ' — ' + i.variant_title : ''}`;

export function LowStock({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale(); const lang = locale === 'en' ? 'en' : 'fr'; const s = S[lang];
  const qc = useQueryClient(); const refresh = () => qc.invalidateQueries({ queryKey: ['lowstock'] });
  const { data } = useQuery({ queryKey: ['lowstock'], queryFn: () => api.getLowStock() });
  const [all, setAll] = useState(false); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const [edit, setEdit] = useState<LowStockItem | null>(null); const [msg, setMsg] = useState<{ text: string; phone: string | null } | null>(null);
  const [f, setF] = useState<{ t: string; e: string; p: boolean } | null>(null); const [sup, setSup] = useState({ name: '', phone: '', email: '' });
  const save = useMutation({ mutationFn: (v: { t: string; e: string; p: boolean }) => api.saveLowStockSettings({ default_threshold: parseInt(v.t, 10), emails: v.e, push: v.p }), onSuccess: () => { setErr(''); setNote(s.saved); setF(null); refresh(); }, onError: (e: any) => { setNote(''); setErr(e.message); } });
  const addSup = useMutation({ mutationFn: () => api.addLowStockSupplier({ name: sup.name, phone: sup.phone || null, email: sup.email || null }), onSuccess: () => { setSup({ name: '', phone: '', email: '' }); setErr(''); refresh(); }, onError: (e: any) => setErr(e.message) });
  const delSup = useMutation({ mutationFn: (id: string) => api.deleteLowStockSupplier(id), onSuccess: refresh });
  if (!data) return null;
  const st = data.settings; const v = f ?? { t: String(st.default_threshold), e: st.emails, p: !!st.push };
  const shown = data.items.filter((i) => all || (i.level !== 'ok' && !i.muted));
  const supName = (id: string | null) => data.suppliers.find((x) => x.id === id)?.name ?? s.none;
  const open = async (i: LowStockItem) => { const r = await api.lowStockMessage(i.sku, lang); setMsg({ text: r.message, phone: r.supplier?.phone ?? null }); };
  return (
    <div className="space-y-5" data-testid="lowstock-page">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
        <p className="text-xs" style={muted}>{s.help}</p>
        {note && <p className="text-xs mt-1" role="status" style={{ color: 'var(--text)' }}>{note}</p>}
        {err && <p className="text-sm mt-1" style={{ color: '#dc2626' }}>{err}</p>}
      </div>

      {canWrite && (
        <div className="p-3 space-y-3" style={box}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.settings}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls} style={muted}>{s.threshold}</label><input inputMode="numeric" className={inputCls} style={inputStyle} value={v.t} onChange={(e) => setF({ ...v, t: e.target.value })} data-testid="ls-threshold" /></div>
            <div><label className={labelCls} style={muted}>{s.emails}</label><input className={inputCls} style={inputStyle} value={v.e} onChange={(e) => setF({ ...v, e: e.target.value })} data-testid="ls-emails" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}><input type="checkbox" checked={v.p} onChange={(e) => setF({ ...v, p: e.target.checked })} />{s.push}</label>
          <button className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate(v)} data-testid="ls-save">{s.save}</button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button className="text-xs underline" style={muted} onClick={() => setAll(!all)}>{all ? s.hide : s.show}</button>
        </div>
        {shown.length === 0 && <p className="text-sm" style={muted}>{s.empty}</p>}
        {shown.map((i) => (
          <div key={i.sku} className="p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1" style={box} data-testid={`ls-${i.sku}`}>
            <b style={{ color: 'var(--text)' }}>{name(i)}</b>
            <span style={{ color: COLOR[i.level] }} className="font-medium">{s.level[i.level]}{i.muted ? ` · ${s.mutedTag}` : ''}</span>
            <span style={muted}>{s.avail}: <b style={{ color: 'var(--text)' }}>{Math.max(i.available, 0)}</b> · {s.thr}: {i.threshold}</span>
            <span style={muted}>{s.supplier}: {supName(i.supplier_id)}</span>
            <span className="flex gap-2 ml-auto">
              {i.level !== 'ok' && <button className={btn} style={ghost} onClick={() => open(i)}>{s.msg}</button>}
              {canWrite && <button className={btn} style={ghost} onClick={() => setEdit(i)}>{s.edit}</button>}
            </span>
          </div>
        ))}
      </div>

      <div className="p-3 space-y-2" style={box}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.suppliers}</h2>
        {data.suppliers.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center gap-x-4 text-sm"><b style={{ color: 'var(--text)' }}>{x.name}</b><span style={muted}>{[x.phone, x.email].filter(Boolean).join(' · ')}</span>
            {canWrite && <button className="text-xs underline ml-auto" style={muted} onClick={() => delSup.mutate(x.id)}>{s.remove}</button>}</div>
        ))}
        {canWrite && (
          <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <input className={inputCls} style={{ ...inputStyle, flex: '1 1 140px', width: 'auto' }} placeholder={s.sName} value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} data-testid="ls-sname" />
            <input className={inputCls} style={{ ...inputStyle, flex: '1 1 140px', width: 'auto' }} placeholder={s.sPhone} value={sup.phone} onChange={(e) => setSup({ ...sup, phone: e.target.value })} />
            <input className={inputCls} style={{ ...inputStyle, flex: '1 1 140px', width: 'auto' }} placeholder={s.sEmail} value={sup.email} onChange={(e) => setSup({ ...sup, email: e.target.value })} />
            <button className={btn} style={solid} disabled={!sup.name.trim() || addSup.isPending} onClick={() => addSup.mutate()} data-testid="ls-sadd">{s.add}</button>
          </div>
        )}
      </div>

      {edit && <ItemModal item={edit} suppliers={data.suppliers} s={s} onClose={() => { setEdit(null); refresh(); }} />}
      {msg && (
        <Modal open onClose={() => setMsg(null)} title={s.msg}>
          <div className="space-y-3">
            <textarea readOnly className={inputCls} style={{ ...inputStyle, minHeight: 100 }} value={msg.text} data-testid="ls-msg" />
            <div className="flex flex-wrap gap-2 justify-end">
              <button className={btn} style={ghost} onClick={() => setMsg(null)}>{s.close}</button>
              <button className={btn} style={ghost} onClick={async () => { try { await navigator.clipboard.writeText(msg.text); setNote(s.copied); } catch { /* clipboard unavailable */ } }}>{s.copy}</button>
              <button className={btn} style={solid} onClick={() => window.open(`https://wa.me/${(msg.phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(msg.text)}`, '_blank', 'noopener')}>{s.whatsapp}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ItemModal({ item, suppliers, s, onClose }: { item: LowStockItem; suppliers: { id: string; name: string }[]; s: typeof S.en; onClose: () => void }) {
  const [thr, setThr] = useState(item.threshold === 0 || item.threshold ? String(item.threshold) : '');
  const [sup, setSup] = useState(item.supplier_id ?? ''); const [qty, setQty] = useState(item.reorder_qty ? String(item.reorder_qty) : ''); const [mute, setMute] = useState(!!item.muted); const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: () => api.saveLowStockItem(item.sku, { threshold: thr.trim() === '' ? null : parseInt(thr, 10), supplier_id: sup || null, reorder_qty: qty.trim() === '' ? null : parseInt(qty, 10), muted: mute }),
    onSuccess: onClose, onError: (e: any) => setErr(e.message),
  });
  return (
    <Modal open onClose={onClose} title={name(item)}>
      <div className="space-y-3">
        <div><label className={labelCls} style={muted}>{s.thr} ({s.useDefault}: —)</label><input inputMode="numeric" className={inputCls} style={inputStyle} value={thr} onChange={(e) => setThr(e.target.value)} /></div>
        <div><label className={labelCls} style={muted}>{s.supplier}</label>
          <select className={inputCls} style={inputStyle} value={sup} onChange={(e) => setSup(e.target.value)}><option value="">{s.none}</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div><label className={labelCls} style={muted}>{s.reorder}</label><input inputMode="numeric" className={inputCls} style={inputStyle} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}><input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} />{s.mute}</label>
        {err && <p className="text-sm" style={{ color: '#dc2626' }}>{err}</p>}
        <div className="flex gap-2 justify-end"><button className={btn} style={ghost} onClick={onClose}>{s.cancel}</button><button className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate()}>{s.save}</button></div>
      </div>
    </Modal>
  );
}
