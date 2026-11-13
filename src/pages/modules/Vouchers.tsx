import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type VoucherDelivery, type VoucherLoadReport, type VoucherLocation, type VoucherPlan } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { Modal } from '../../components/Modal';
import { useLocale } from '../../lib/locale-context';

// Self-contained strings: a module does not touch the core translation file.
const S = {
  en: {
    title: 'WiFi vouchers', help: 'Organise your hotspots by location. Each location has plans (for example 24 hours or 30 days). Load the codes your router already knows into a plan, and every paid order gets its code automatically (page, e-mail, counter receipt). If a plan runs out, paid orders wait and are served in order as soon as you load more.',
    empty: 'No location yet. Add your first one below.', stock: 'In stock', sold: 'Sold', waiting: 'Waiting for a code', low: 'Running low', none: 'Out of stock',
    load: 'Load codes', instr: 'Instructions', remove: 'Remove', confirmRemove: 'Stop selling this plan as a code? (Only possible when it holds no codes.)', newTitle: 'Create a new voucher product', newName: 'Name (e.g. WiFi 1 day)', newPrice: 'Price (smallest unit, e.g. 300 for 300 F)', create: 'Create and sell as a code', createHelp: 'Creates the product (type Digital, no file, no stock, no delivery address) and links it, in one step.', addPlan: 'Or use an existing product variant as a plan', pick: 'Choose a product…', add: 'Add',
    paste: 'Paste the codes, one per line: username or username,password. A header line is fine.', batch: 'Batch name (optional)', check: 'Check', loadNow: 'Load', cancel: 'Cancel', save: 'Save',
    okCheck: (n: number) => `${n} code(s) ready to load.`, added: (n: number) => `${n} code(s) loaded.`, refused: 'Nothing was loaded. Fix these lines and try again:', line: 'Line', manage: 'Manage codes', batches: 'Batches', codesTab: 'Codes', noBatch: '(no batch)', avail: 'on sale', soldN: 'sold', voidN: 'withdrawn', voidAct: 'Withdraw unsold', restoreAct: 'Put back on sale', deleteAct: 'Delete unsold', moveAct: 'Move unsold to…', renameAct: 'Rename', moveTo: 'Move to', go: 'Go',
    confirmVoid: (n: number) => `Withdraw ${n} unsold code(s) from sale? Sold codes are not touched. You can put them back later.`, confirmDelete: (n: number) => `Delete ${n} unsold code(s) for good? Sold codes are kept as records.`, confirmMove: (n: number, to: string) => `Move ${n} unsold code(s) to ${to}?`, renamePrompt: 'New batch name (empty = no name)',
    done: (n: number, k: number) => `${n} code(s) changed${k ? `, ${k} sold code(s) left untouched` : ''}.`, search: 'Search a code', allStatus: 'All', stAvailable: 'On sale', stSold: 'Sold', stVoid: 'Withdrawn', withdraw: 'Withdraw', back: 'Put back', del: 'Delete', usedBy: 'Order', confirmDelOne: 'Delete this code for good?', confirmVoidSold: 'This code was already given to a customer. Mark it as withdrawn (for example after a refund)? It stays in your records.', noCodes: 'No code.',
    alertTitle: 'Low-code alerts', alertHelp: 'You are told once when a product has this many codes left or fewer, and once more if it runs out (notification, and e-mail if you add addresses).', alertDefault: 'Default threshold', alertEmails: 'E-mail addresses (optional, separated by commas)', alertPush: 'Notify the app', alertSave: 'Save alerts', alertSaved: 'Saved.', alertThis: 'Alert at', alertMute: 'Mute alerts', alertAuto: 'default', file: 'Choose a CSV file (Mikhmon: Users → Export)', fileHelp: 'The Username and Password columns are read; Profile and Comment are used to pick the right codes and name the batch.', profileLabel: 'Profile to load', profilePick: 'Choose…', profileMix: 'This file has several profiles: choose the one this product sells.', profileOne: (p: string) => `Profile in the file: ${p}. Make sure it is the one this product sells.`,
    fr: 'Instructions (French)', en: 'Instructions (English)', instrHelp: 'Shown with the code (e.g. “Connect to WiFi Santé, open any page, enter the code”).',
    sale: 'Counter sale', saleHelp: 'Sell a code in person: it is handed out at once and can be printed or sent by WhatsApp.', qty: 'Quantity', method: 'Paid by', cash: 'Cash', mm: 'Mobile money', sell: 'Sell and show the code',
    phone: 'Customer WhatsApp (optional)', email: 'Customer e-mail (optional)', receipt: 'Receipt', print: 'Print', share: 'Send by WhatsApp', close: 'Close', user: 'Username', pass: 'Password',
    orders: 'Recent deliveries', order: 'Order', codes: 'Codes', mail: 'E-mail', resend: 'Send again', view: 'Show', sent: 'Sent', noMail: '—', pending: 'Waiting for codes', refunded: 'Refunded: disable these codes on the router',
    noOrders: 'No voucher orders yet.', wasent: 'Resent.', notSent: 'Could not send (no e-mail set up or no address).',
    locTitle: 'Add a location', locName: 'Location name (e.g. Central Café)', planName: 'Plan name (e.g. 24 hours)', locCreate: 'Create location and first plan', locLabel: 'Location', planLabel: 'Plan', priceLabel: 'Price',
    locHelp: 'A location is a place where you sell WiFi (a café, a hotel, a campus). Customers see it as a product in your shop and choose a plan on its page. Photos and description are edited in Products.',
    planHelp: 'A plan is one thing you sell at a location: a duration or a speed, with its own price and its own codes (for example “24 hours” or “30 days”). One plan matches one profile in Mikhmon.',
    codesHelp: 'Codes are the usernames and passwords your router already knows. Load them into a plan; every paid order receives one per unit bought.',
    manageHelp: 'Withdraw, put back on sale, delete, move or rename a batch (one loaded file), or work on a single code. Sold codes are never deleted.',
    instrLocHelp: 'Default instructions for every plan of this location (network name, how to connect). A plan can have its own text; if it has none, this one is used.', instrEmptyPlan: 'Leave empty to use the location’s instructions.',
    plansN: (n: number) => `${n} plan${n === 1 ? '' : 's'}`, addPlanTo: 'Add a plan', noPlan: 'No plan yet. Add one to start selling.', editPlan: 'Edit plan', renameLoc: 'Rename', removeLoc: 'Remove location', attention: 'Needs attention', helpLabel: 'Help', priceNote: 'Changing the price only affects new orders.',
    confirmRemoveLoc: 'Remove this location and its product from your shop? Only possible when it has no plans.', locInstr: 'Location instructions', renamePromptLoc: 'New location name', savePlan: 'Save', needPlan: 'Enter a plan name and a price.', needLoc: 'Enter a location name, a plan name and a price.',
    wamsg: (codes: string) => `Your WiFi access:\n${codes}`,
  },
  fr: {
    title: 'Tickets WiFi', help: 'Organisez vos hotspots par site. Chaque site a des forfaits (par exemple 24 heures ou 30 jours). Chargez dans un forfait les codes que votre routeur connaît déjà, et chaque commande payée reçoit son ticket automatiquement (page, e-mail, ticket au comptoir). Si un forfait est épuisé, les commandes payées attendent et sont servies dans l’ordre dès que vous rechargez.',
    empty: 'Aucun site pour le moment. Ajoutez le premier ci-dessous.', stock: 'En stock', sold: 'Vendus', waiting: 'En attente de code', low: 'Stock bas', none: 'Rupture',
    load: 'Charger des codes', instr: 'Instructions', remove: 'Retirer', confirmRemove: 'Ne plus vendre ce forfait comme ticket ? (Possible seulement s’il ne contient aucun code.)', newTitle: 'Créer un nouveau produit voucher', newName: 'Nom (ex. WiFi 1 jour)', newPrice: 'Prix (plus petite unité, ex. 300 pour 300 F)', create: 'Créer et vendre comme code', createHelp: 'Crée le produit (type Digital, sans fichier, sans stock, sans adresse de livraison) et le relie, en une seule étape.', addPlan: 'Ou utiliser une variante de produit existante comme forfait', pick: 'Choisir un produit…', add: 'Ajouter',
    paste: 'Collez les codes, un par ligne : identifiant ou identifiant,mot de passe. Une ligne d’en-tête est acceptée.', batch: 'Nom du lot (facultatif)', check: 'Vérifier', loadNow: 'Charger', cancel: 'Annuler', save: 'Enregistrer',
    okCheck: (n: number) => `${n} code(s) prêts à charger.`, added: (n: number) => `${n} code(s) chargés.`, refused: 'Rien n’a été chargé. Corrigez ces lignes puis réessayez :', line: 'Ligne', manage: 'Gérer les codes', batches: 'Lots', codesTab: 'Codes', noBatch: '(sans lot)', avail: 'en vente', soldN: 'vendus', voidN: 'retirés', voidAct: 'Retirer les invendus', restoreAct: 'Remettre en vente', deleteAct: 'Supprimer les invendus', moveAct: 'Déplacer les invendus vers…', renameAct: 'Renommer', moveTo: 'Déplacer vers', go: 'Valider',
    confirmVoid: (n: number) => `Retirer ${n} code(s) invendu(s) de la vente ? Les codes vendus ne sont pas touchés. Vous pourrez les remettre en vente.`, confirmDelete: (n: number) => `Supprimer définitivement ${n} code(s) invendu(s) ? Les codes vendus sont conservés comme historique.`, confirmMove: (n: number, to: string) => `Déplacer ${n} code(s) invendu(s) vers ${to} ?`, renamePrompt: 'Nouveau nom du lot (vide = sans nom)',
    done: (n: number, k: number) => `${n} code(s) modifié(s)${k ? `, ${k} code(s) vendu(s) non touché(s)` : ''}.`, search: 'Rechercher un code', allStatus: 'Tous', stAvailable: 'En vente', stSold: 'Vendu', stVoid: 'Retiré', withdraw: 'Retirer', back: 'Remettre', del: 'Supprimer', usedBy: 'Commande', confirmDelOne: 'Supprimer définitivement ce code ?', confirmVoidSold: 'Ce code a déjà été remis à un client. Le marquer comme retiré (par exemple après un remboursement) ? Il reste dans votre historique.', noCodes: 'Aucun code.',
    alertTitle: 'Alertes de codes bas', alertHelp: 'Vous êtes prévenu une fois quand un produit a ce nombre de codes ou moins, et une fois de plus s’il est épuisé (notification, et e-mail si vous ajoutez des adresses).', alertDefault: 'Seuil par défaut', alertEmails: 'Adresses e-mail (facultatif, séparées par des virgules)', alertPush: 'Notifier l’application', alertSave: 'Enregistrer les alertes', alertSaved: 'Enregistré.', alertThis: 'Alerte à', alertMute: 'Couper les alertes', alertAuto: 'défaut', file: 'Choisir un fichier CSV (Mikhmon : Users → Export)', fileHelp: 'Les colonnes Username et Password sont lues ; Profile et Comment servent à choisir les bons codes et à nommer le lot.', profileLabel: 'Profil à charger', profilePick: 'Choisir…', profileMix: 'Ce fichier contient plusieurs profils : choisissez celui que vend ce produit.', profileOne: (p: string) => `Profil dans le fichier : ${p}. Vérifiez que c’est bien celui que vend ce produit.`,
    fr: 'Instructions (français)', en: 'Instructions (anglais)', instrHelp: 'Affichées avec le code (ex. « Connectez-vous au WiFi Santé, ouvrez une page, saisissez le code »).',
    sale: 'Vente au comptoir', saleHelp: 'Vendez un code en personne : il est remis tout de suite, à imprimer ou envoyer par WhatsApp.', qty: 'Quantité', method: 'Payé par', cash: 'Espèces', mm: 'Mobile money', sell: 'Vendre et afficher le code',
    phone: 'WhatsApp du client (facultatif)', email: 'E-mail du client (facultatif)', receipt: 'Ticket', print: 'Imprimer', share: 'Envoyer par WhatsApp', close: 'Fermer', user: 'Identifiant', pass: 'Mot de passe',
    orders: 'Dernières remises', order: 'Commande', codes: 'Codes', mail: 'E-mail', resend: 'Renvoyer', view: 'Voir', sent: 'Envoyé', noMail: '—', pending: 'En attente de codes', refunded: 'Remboursée : désactivez ces codes sur le routeur',
    noOrders: 'Aucune commande de tickets pour le moment.', wasent: 'Renvoyé.', notSent: 'Envoi impossible (e-mail non configuré ou pas d’adresse).',
    locTitle: 'Ajouter un site', locName: 'Nom du site (ex. Café Central)', planName: 'Nom du forfait (ex. 24 heures)', locCreate: 'Créer le site et son premier forfait', locLabel: 'Site', planLabel: 'Forfait', priceLabel: 'Prix',
    locHelp: 'Un site est un lieu où vous vendez du WiFi (café, hôtel, campus). Vos clients le voient comme un produit de la boutique et choisissent un forfait sur sa page. Photos et description se modifient dans Produits.',
    planHelp: 'Un forfait est ce que vous vendez sur un site : une durée ou un débit, avec son prix et ses propres codes (par exemple « 24 heures » ou « 30 jours »). Un forfait correspond à un profil Mikhmon.',
    codesHelp: 'Les codes sont les identifiants et mots de passe que votre routeur connaît déjà. Chargez-les dans un forfait ; chaque commande payée en reçoit un par unité achetée.',
    manageHelp: 'Retirer, remettre en vente, supprimer, déplacer ou renommer un lot (un fichier chargé), ou agir sur un seul code. Les codes vendus ne sont jamais supprimés.',
    instrLocHelp: 'Instructions par défaut de tous les forfaits de ce site (nom du réseau, comment se connecter). Un forfait peut avoir son propre texte ; s’il n’en a pas, celui-ci est utilisé.', instrEmptyPlan: 'Laissez vide pour utiliser les instructions du site.',
    plansN: (n: number) => `${n} forfait${n > 1 ? 's' : ''}`, addPlanTo: 'Ajouter un forfait', noPlan: 'Aucun forfait pour le moment. Ajoutez-en un pour commencer à vendre.', editPlan: 'Modifier le forfait', renameLoc: 'Renommer', removeLoc: 'Supprimer le site', attention: 'À surveiller', helpLabel: 'Aide', priceNote: 'Changer le prix n’affecte que les nouvelles commandes.',
    confirmRemoveLoc: 'Supprimer ce site et son produit de la boutique ? Possible seulement s’il n’a aucun forfait.', locInstr: 'Instructions du site', renamePromptLoc: 'Nouveau nom du site', savePlan: 'Enregistrer', needPlan: 'Saisissez le nom du forfait et son prix.', needLoc: 'Saisissez le nom du site, le nom du forfait et son prix.',
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

const codesText = (d: VoucherDelivery) => d.items.flatMap((i) => i.codes.map((c) => c.password ? `${c.username} / ${c.password}` : c.username)).join('\n');

function printReceipt(d: VoucherDelivery, s: typeof S.en, instr: string[]) {
  const w = window.open('', '_blank', 'width=360,height=600'); if (!w) return;
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = d.items.flatMap((i) => i.codes.map((c) => `<div class="c"><small>${esc(i.title)}</small><b>${esc(s.user)}: ${esc(c.username)}</b>${c.password ? `<br><b>${esc(s.pass)}: ${esc(c.password)}</b>` : ''}</div>`)).join('');
  w.document.write(`<!doctype html><title>${esc(d.number)}</title><style>body{font:14px system-ui,sans-serif;margin:12px;max-width:300px}h1{font-size:15px;margin:0 0 8px}.c{border:1px dashed #000;padding:8px;margin:8px 0;font-family:monospace;font-size:16px}small{display:block;font:11px system-ui}p{white-space:pre-wrap;font-size:12px}</style><h1>${esc(s.receipt)} ${esc(d.number)}</h1>${rows}${instr.map((t) => `<p>${esc(t)}</p>`).join('')}<script>setTimeout(function(){window.print()},200)</script>`);
  w.document.close();
}

const slug = (x: string, n: number) => x.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]+/g, '').slice(0, n);
const mkSku = (loc: string, plan: string) => `WIFI-${slug(loc, 6) || 'LOC'}${slug(plan, 4)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** A small "?" that opens a short explanation under it (works by tap, not only by hover). */
function Help({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-block align-middle">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)} data-testid="v-help"
        className="ml-1.5 inline-flex items-center justify-center rounded-full text-xs font-bold" style={{ width: 22, height: 22, border: '1px solid var(--border)', color: 'var(--text-secondary)', background: open ? 'var(--bg-card)' : 'transparent' }}>?</button>
      {open && <span role="note" className="block text-xs font-normal normal-case tracking-normal mt-1 max-w-prose" style={muted}>{text}</span>}
    </span>
  );
}

export function Vouchers({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale();
  const lang = locale === 'en' ? 'en' : 'fr'; const s = S[lang];
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['vouchers'] }); qc.invalidateQueries({ queryKey: ['products'] }); };
  const { data } = useQuery({ queryKey: ['vouchers', 'plans'], queryFn: () => api.getVoucherPlans() });
  const orders = useQuery({ queryKey: ['vouchers', 'orders'], queryFn: () => api.getVoucherOrders() });
  const products = useQuery({ queryKey: ['products', 'for-vouchers'], queryFn: () => api.getProducts({ limit: 100 }), enabled: canWrite });
  const [loading, setLoading] = useState<VoucherPlan | null>(null);
  const [editing, setEditing] = useState<{ plan?: VoucherPlan; loc?: VoucherLocation } | null>(null);
  const [editPlan, setEditPlan] = useState<VoucherPlan | null>(null);
  const [managing, setManaging] = useState<VoucherPlan | null>(null);
  const [receipt, setReceipt] = useState<VoucherDelivery | null>(null);
  const [pick, setPick] = useState('');
  const [note, setNote] = useState('');
  const plans = data?.items ?? [];
  const locations: VoucherLocation[] = data?.locations ?? [];
  const taken = new Set(plans.map((p) => p.sku));
  const variants = (products.data?.items ?? []).flatMap((p) => (p.variants ?? []).filter((v) => v.sku && !taken.has(v.sku)).map((v) => ({ sku: v.sku, label: `${p.title}${v.title && v.title !== 'Default' ? ' — ' + v.title : ''} (${v.sku})` })));
  const [newLoc, setNewLoc] = useState(''); const [newPlan, setNewPlan] = useState(''); const [newPrice, setNewPrice] = useState('');
  const create = useMutation({
    mutationFn: async () => {
      const price = parseInt(newPrice, 10);
      if (!newLoc.trim() || !newPlan.trim() || !Number.isFinite(price) || price < 0) throw new Error(s.needLoc);
      const product = await api.createProduct({ title: newLoc.trim() });
      const sku = mkSku(newLoc, newPlan);
      try {
        await api.createVariant(product.id, { sku, title: newPlan.trim(), price_cents: price, product_type: 'digital' });
        await api.saveVoucherPlan(sku, {});
      } catch (e) { try { await api.deleteProduct(product.id); } catch { /* leave the product; it can be removed in Products */ } throw e; }
    },
    onSuccess: () => { setNewLoc(''); setNewPlan(''); setNewPrice(''); setNote(''); refresh(); },
    onError: (e: any) => setNote(e.message),
  });
  const addPlan = useMutation({ mutationFn: (sku: string) => api.saveVoucherPlan(sku, {}), onSuccess: () => { setPick(''); refresh(); } });
  const delPlan = useMutation({ mutationFn: (sku: string) => api.deleteVoucherPlan(sku), onSuccess: refresh, onError: (e: any) => setNote(e.message) });
  const resend = useMutation({ mutationFn: (id: string) => api.resendVoucher(id), onSuccess: (r) => { setNote(r.emailed ? s.wasent : s.notSent); refresh(); }, onError: (e: any) => setNote(e.message) });
  const delLoc = useMutation({
    mutationFn: async (l: VoucherLocation) => { await api.deleteVoucherLocation(l.product_id); try { await api.deleteProduct(l.product_id); } catch { /* the product stays in Products */ } },
    onSuccess: refresh, onError: (e: any) => setNote(e.message),
  });
  const renameLoc = useMutation({ mutationFn: (v: { id: string; title: string }) => api.updateProduct(v.id, { title: v.title }), onSuccess: refresh, onError: (e: any) => setNote(e.message) });
  // A plan without its own instructions uses its location's: the receipt shows the same text the customer gets.
  const plansForReceipt = plans.map((p) => { const l = locations.find((x) => x.product_id === p.product_id); return { ...p, instructions_fr: p.instructions_fr || l?.instructions_fr || null, instructions_en: p.instructions_en || l?.instructions_en || null }; });

  return (
    <div className="space-y-5" data-testid="vouchers-page">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
        <p className="text-xs" style={muted}>{s.help}</p>
        {note && <p className="text-xs mt-1" style={{ color: 'var(--text)' }} role="status">{note}</p>}
      </div>

      {canWrite && <AlertSettings s={s} onSaved={refresh} />}

      {locations.length === 0 && <p className="text-sm" style={muted}>{s.empty}</p>}
      <div className="space-y-4">
        {locations.map((l) => {
          const lp = plans.filter((p) => p.product_id === l.product_id);
          const stockTotal = lp.reduce((n, p) => n + p.available, 0);
          const attention = lp.some((p) => p.waiting > 0 || (p.level ?? 'ok') !== 'ok');
          return (
            <section key={l.product_id} className="space-y-2" data-testid={`vloc-${l.product_id}`}>
              <div className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{l.title}<Help text={s.locHelp} label={s.helpLabel} /></h2>
                  <span className="text-xs" style={muted}>{s.plansN(lp.length)} · {s.stock}: {stockTotal}</span>
                  {attention && <span className="text-xs font-medium" style={{ color: '#d97706' }}>{s.attention}</span>}
                </div>
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <button className={btn} style={ghost} onClick={() => setEditing({ loc: l })} data-testid={`vlocinstr-${l.product_id}`}>{s.locInstr}</button>
                    <button className={btn} style={ghost} onClick={() => { const n = window.prompt(s.renamePromptLoc, l.title ?? ''); if (n && n.trim()) renameLoc.mutate({ id: l.product_id, title: n.trim() }); }}>{s.renameLoc}</button>
                    {lp.length === 0 && <button className={btn} style={ghost} onClick={() => { if (confirm(s.confirmRemoveLoc)) delLoc.mutate(l); }}>{s.removeLoc}</button>}
                  </div>
                )}
              </div>
              <div className="space-y-2 pl-3" style={{ borderLeft: '2px solid var(--border)' }}>
                {lp.length === 0 && <p className="text-sm" style={muted}>{s.noPlan}</p>}
                {lp.map((p) => {
                  const lvl = p.level ?? 'ok'; const warn = p.waiting > 0 || lvl !== 'ok';
                  return (
                    <div key={p.sku} className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} data-testid={`vplan-${p.sku}`}>
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <b className="text-sm" style={{ color: 'var(--text)' }}>{p.variant_title && p.variant_title !== 'Default' ? p.variant_title : p.product_title}</b>
                        <Help text={s.planHelp} label={s.helpLabel} />
                        <span className="text-xs" style={muted}>{p.sku}{p.price_cents != null && p.currency ? ` · ${formatPrice(p.price_cents, p.currency)}` : ''}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span><span style={muted}>{s.stock}: </span><b data-testid="v-avail" style={{ color: p.available === 0 ? '#dc2626' : warn ? '#d97706' : 'var(--text)' }}>{p.available}</b><Help text={s.codesHelp} label={s.helpLabel} /></span>
                        <span><span style={muted}>{s.sold}: </span><b>{p.sold}</b></span>
                        {p.waiting > 0 && <span style={{ color: '#dc2626' }}><b data-testid="v-waiting">{p.waiting}</b> {s.waiting}</span>}
                        {lvl === 'out' ? <span className="text-xs font-medium" style={{ color: '#dc2626' }}>{s.none}</span> : lvl === 'low' && <span className="text-xs font-medium" style={{ color: '#d97706' }}>{s.low}</span>}
                      </div>
                      {canWrite && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button className={btn} style={solid} onClick={() => setLoading(p)} data-testid={`vload-${p.sku}`}>{s.load}</button>
                          <button className={btn} style={ghost} onClick={() => setManaging(p)} data-testid={`vmanage-${p.sku}`}>{s.manage}</button>
                          <Help text={s.manageHelp} label={s.helpLabel} />
                          <button className={btn} style={ghost} onClick={() => setEditPlan(p)} data-testid={`vedit-${p.sku}`}>{s.editPlan}</button>
                          <button className={btn} style={ghost} onClick={() => setEditing({ plan: p })}>{s.instr}</button>
                          <button className={btn} style={ghost} onClick={() => { if (confirm(s.confirmRemove)) delPlan.mutate(p.sku); }}>{s.remove}</button>
                        </div>
                      )}
                      {canWrite && <PlanAlert plan={p} s={s} onSaved={refresh} />}
                    </div>
                  );
                })}
                {canWrite && <AddPlan loc={l} s={s} onDone={refresh} onError={setNote} />}
              </div>
            </section>
          );
        })}
      </div>

      {canWrite && (
        <div className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} data-testid="v-create">
          <label className={labelCls} style={muted}>{s.locTitle}<Help text={s.locHelp} label={s.helpLabel} /></label>
          <div className="flex flex-wrap gap-2">
            <input className={inputCls} style={{ ...inputStyle, flex: '2 1 200px' }} value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder={s.locName} data-testid="v-new-loc" />
            <input className={inputCls} style={{ ...inputStyle, flex: '2 1 180px' }} value={newPlan} onChange={(e) => setNewPlan(e.target.value)} placeholder={s.planName} data-testid="v-new-name" />
            <input className={inputCls} style={{ ...inputStyle, flex: '1 1 140px' }} inputMode="numeric" value={newPrice} onChange={(e) => setNewPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder={s.newPrice} data-testid="v-new-price" />
            <button className={btn} style={solid} disabled={create.isPending || !newLoc.trim() || !newPlan.trim() || !newPrice} onClick={() => create.mutate()} data-testid="v-new-go">{s.locCreate}</button>
          </div>
        </div>
      )}

      {canWrite && (
        <details className="p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <summary className="text-sm cursor-pointer" style={muted}>{s.addPlan}</summary>
          <div className="flex flex-wrap gap-2 mt-2">
            <select className={inputCls} style={{ ...inputStyle, flex: '1 1 220px' }} value={pick} onChange={(e) => setPick(e.target.value)} data-testid="v-pick">
              <option value="">{s.pick}</option>
              {variants.map((v) => <option key={v.sku} value={v.sku}>{v.label}</option>)}
            </select>
            <button className={btn} style={solid} disabled={!pick || addPlan.isPending} onClick={() => addPlan.mutate(pick)} data-testid="v-add">{s.add}</button>
          </div>
        </details>
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
      {managing && <ManageModal plan={managing} plans={plans} s={s} canWrite={canWrite} onClose={() => { setManaging(null); refresh(); }} />}
      {editing && <InstrModal target={editing} s={s} onClose={() => { setEditing(null); refresh(); }} />}
      {editPlan && <EditPlanModal plan={editPlan} s={s} onClose={() => { setEditPlan(null); refresh(); }} />}
      {receipt && <ReceiptModal d={receipt} s={s} lang={lang} plans={plansForReceipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function AddPlan({ loc, s, onDone, onError }: { loc: VoucherLocation; s: typeof S.en; onDone: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [price, setPrice] = useState('');
  const add = useMutation({
    mutationFn: async () => {
      const cents = parseInt(price, 10);
      if (!name.trim() || !Number.isFinite(cents) || cents < 0) throw new Error(s.needPlan);
      const sku = mkSku(loc.title ?? '', name);
      await api.createVariant(loc.product_id, { sku, title: name.trim(), price_cents: cents, product_type: 'digital' });
      await api.saveVoucherPlan(sku, {});
    },
    onSuccess: () => { setName(''); setPrice(''); setOpen(false); onError(''); onDone(); },
    onError: (e: any) => onError(e.message),
  });
  if (!open) return <button className={btn} style={ghost} onClick={() => setOpen(true)} data-testid={`vaddplan-${loc.product_id}`}>+ {s.addPlanTo}</button>;
  return (
    <div className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}>
      <div className="flex flex-wrap gap-2">
        <input className={inputCls} style={{ ...inputStyle, flex: '2 1 180px' }} value={name} onChange={(e) => setName(e.target.value)} placeholder={s.planName} data-testid="v-plan-name" />
        <input className={inputCls} style={{ ...inputStyle, flex: '1 1 140px' }} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder={s.newPrice} data-testid="v-plan-price" />
      </div>
      <div className="flex gap-2">
        <button className={btn} style={solid} disabled={add.isPending || !name.trim() || !price} onClick={() => add.mutate()} data-testid="v-plan-go">{s.addPlanTo}</button>
        <button className={btn} style={ghost} onClick={() => setOpen(false)}>{s.cancel}</button>
      </div>
    </div>
  );
}

function EditPlanModal({ plan, s, onClose }: { plan: VoucherPlan; s: typeof S.en; onClose: () => void }) {
  const prod = useQuery({ queryKey: ['products', 'one', plan.product_id], queryFn: () => api.getProduct(plan.product_id) });
  const variant = prod.data?.variants?.find((v) => v.sku === plan.sku);
  const [name, setName] = useState<string | null>(null); const [price, setPrice] = useState<string | null>(null); const [err, setErr] = useState('');
  const nm = name ?? variant?.title ?? plan.variant_title ?? ''; const pr = price ?? String(variant?.price_cents ?? plan.price_cents ?? '');
  const save = useMutation({
    mutationFn: () => { const cents = parseInt(pr, 10); if (!variant || !nm.trim() || !Number.isFinite(cents) || cents < 0) throw new Error(s.needPlan); return api.updateVariant(plan.product_id, variant.id, { title: nm.trim(), price_cents: cents }); },
    onSuccess: onClose, onError: (e: any) => setErr(e.message),
  });
  return (
    <Modal open onClose={onClose} title={`${s.editPlan} — ${plan.sku}`}>
      <div className="space-y-3">
        <div><label className={labelCls} style={muted}>{s.planLabel}</label><input className={inputCls} style={inputStyle} value={nm} onChange={(e) => setName(e.target.value)} data-testid="v-edit-name" /></div>
        <div><label className={labelCls} style={muted}>{s.priceLabel}</label><input className={inputCls} style={inputStyle} inputMode="numeric" value={pr} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} data-testid="v-edit-price" /><p className="text-xs mt-1" style={muted}>{s.newPrice}. {s.priceNote}</p></div>
        {err && <p className="text-xs" role="alert" style={{ color: '#dc2626' }}>{err}</p>}
        <div className="flex gap-2 justify-end">
          <button className={btn} style={ghost} onClick={onClose}>{s.cancel}</button>
          <button className={btn} style={solid} disabled={save.isPending || !variant} onClick={() => save.mutate()} data-testid="v-edit-save">{s.savePlan}</button>
        </div>
      </div>
    </Modal>
  );
}

function LoadModal({ plan, s, onClose }: { plan: VoucherPlan; s: typeof S.en; onClose: () => void }) {
  const [text, setText] = useState(''); const [batch, setBatch] = useState(''); const [profile, setProfile] = useState('');
  const [rep, setRep] = useState<VoucherLoadReport | null>(null); const [err, setErr] = useState('');
  const run = useMutation({
    mutationFn: (v: { dry: boolean; text?: string; profile?: string }) => api.loadVoucherCodes(plan.sku, { text: v.text ?? text, batch: batch || undefined, dry_run: v.dry, profile: (v.profile ?? profile) || undefined }),
    onSuccess: (r, v) => { setRep(r); setErr(''); if (!v.dry && r.ok && r.added > 0) setText(''); },
    onError: (e: any) => setErr(e instanceof ApiError ? e.message : String(e)),
  });
  return (
    <Modal open onClose={onClose} title={`${s.load} — ${plan.sku}`}>
      <div className="space-y-3">
        <p className="text-xs" style={muted}>{s.paste}</p>
        <div className="space-y-1">
          <label className={`${btn} cursor-pointer`} style={ghost}>{s.file}<input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" data-testid="v-file" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const t = await f.text(); setText(t); setProfile(''); setRep(null); run.mutate({ dry: true, text: t, profile: '' }); }} /></label>
          <p className="text-xs" style={muted}>{s.fileHelp}</p>
        </div>
        <textarea className={inputCls} style={{ ...inputStyle, minHeight: 160, fontFamily: 'ui-monospace, monospace' }} value={text} onChange={(e) => { setText(e.target.value); setRep(null); setProfile(''); }} data-testid="v-text" />
        {rep?.profiles && Object.keys(rep.profiles).length > 0 && (
          <div className="space-y-1" data-testid="v-profiles">
            <p className="text-xs" style={muted}>{Object.keys(rep.profiles).length > 1 ? s.profileMix : s.profileOne(Object.keys(rep.profiles)[0])}</p>
            {Object.keys(rep.profiles).length > 1 && (
              <select className={inputCls} style={inputStyle} value={profile} aria-label={s.profileLabel} onChange={(e) => { setProfile(e.target.value); run.mutate({ dry: true, profile: e.target.value }); }} data-testid="v-profile">
                <option value="">{s.profilePick}</option>{Object.entries(rep.profiles).map(([n, c]) => <option key={n} value={n}>{n} ({c})</option>)}
              </select>)}
          </div>)}
        <input className={inputCls} style={inputStyle} placeholder={rep?.batch && !batch ? rep.batch : s.batch} value={batch} onChange={(e) => setBatch(e.target.value)} />
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
          <button className={btn} style={ghost} disabled={!text.trim() || run.isPending} onClick={() => run.mutate({ dry: true })} data-testid="v-check">{s.check}</button>
          <button className={btn} style={solid} disabled={!text.trim() || run.isPending} onClick={() => run.mutate({ dry: false })} data-testid="v-load">{s.loadNow}</button>
        </div>
      </div>
    </Modal>
  );
}

function InstrModal({ target, s, onClose }: { target: { plan?: VoucherPlan; loc?: VoucherLocation }; s: typeof S.en; onClose: () => void }) {
  const cur = target.plan ?? target.loc!;
  const [fr, setFr] = useState(cur.instructions_fr ?? ''); const [en, setEn] = useState(cur.instructions_en ?? '');
  const save = useMutation({
    mutationFn: (): Promise<unknown> => (target.plan ? api.saveVoucherPlan(target.plan.sku, { instructions_fr: fr, instructions_en: en }) : api.saveVoucherLocation(target.loc!.product_id, { instructions_fr: fr, instructions_en: en })),
    onSuccess: onClose,
  });
  const title = target.plan ? `${s.instr} — ${target.plan.sku}` : `${s.locInstr} — ${target.loc!.title}`;
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-3">
        <p className="text-xs" style={muted}>{s.instrHelp} {target.plan ? s.instrEmptyPlan : s.instrLocHelp}</p>
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

function AlertSettings({ s, onSaved }: { s: typeof S.en; onSaved: () => void }) {
  const { data } = useQuery({ queryKey: ['vouchers', 'alert-settings'], queryFn: () => api.getVoucherAlertSettings() });
  const [open, setOpen] = useState(false); const [v, setV] = useState<{ t: string; e: string; p: boolean } | null>(null); const [msg, setMsg] = useState('');
  const cur = v ?? (data ? { t: String(data.default_threshold), e: data.emails, p: !!data.push } : null);
  const save = useMutation({ mutationFn: () => api.saveVoucherAlertSettings({ default_threshold: Math.max(0, parseInt(cur!.t, 10) || 0), emails: cur!.e, push: cur!.p }), onSuccess: () => { setMsg(s.alertSaved); setV(null); onSaved(); }, onError: (e: any) => setMsg(e.message) });
  if (!cur) return null;
  return (
    <div className="p-3 space-y-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} data-testid="v-alert-settings">
      <button type="button" className="text-sm font-medium underline" style={{ color: 'var(--text)' }} onClick={() => setOpen(!open)}>{s.alertTitle} — {s.alertDefault}: {data?.default_threshold}</button>
      {open && <div className="space-y-2">
        <p className="text-xs" style={muted}>{s.alertHelp}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-sm"><span className={labelCls} style={muted}>{s.alertDefault}</span><input className={inputCls} style={inputStyle} inputMode="numeric" value={cur.t} onChange={(e) => setV({ ...cur, t: e.target.value.replace(/[^\d]/g, '') })} /></label>
          <label className="text-sm sm:col-span-2"><span className={labelCls} style={muted}>{s.alertEmails}</span><input className={inputCls} style={inputStyle} value={cur.e} onChange={(e) => setV({ ...cur, e: e.target.value })} /></label>
        </div>
        <label className="text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}><input type="checkbox" checked={cur.p} onChange={(e) => setV({ ...cur, p: e.target.checked })} />{s.alertPush}</label>
        <div className="flex items-center gap-3"><button className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate()}>{s.alertSave}</button>{msg && <span className="text-xs" role="status" style={muted}>{msg}</span>}</div>
      </div>}
    </div>
  );
}

function PlanAlert({ plan, s, onSaved }: { plan: VoucherPlan; s: typeof S.en; onSaved: () => void }) {
  const [t, setT] = useState(plan.threshold != null && plan.threshold !== undefined ? String(plan.threshold) : ''); const [muted, setMuted] = useState(!!plan.muted);
  const save = useMutation({ mutationFn: (m: boolean) => api.saveVoucherPlanAlert(plan.sku, { threshold: t.trim() === '' ? null : Math.max(0, parseInt(t, 10) || 0), muted: m }), onSuccess: onSaved });
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" style={muted ? undefined : undefined}>
      <span style={{ color: 'var(--text-secondary)' }}>{s.alertThis}</span>
      <input className="w-20 px-2 py-1 rounded-lg" style={inputStyle} inputMode="numeric" value={t} placeholder={s.alertAuto} onChange={(e) => setT(e.target.value.replace(/[^\d]/g, ''))} onBlur={() => save.mutate(muted)} aria-label={s.alertThis} />
      <label className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><input type="checkbox" checked={muted} onChange={(e) => { setMuted(e.target.checked); save.mutate(e.target.checked); }} />{s.alertMute}</label>
    </div>
  );
}

function ManageModal({ plan, plans, s, canWrite, onClose }: { plan: VoucherPlan; plans: VoucherPlan[]; s: typeof S.en; canWrite: boolean; onClose: () => void }) {
  const qc = useQueryClient(); const [tab, setTab] = useState<'batches' | 'codes'>('batches'); const [msg, setMsg] = useState('');
  const others = plans.filter((p) => p.sku !== plan.sku); const [dest, setDest] = useState(others[0]?.sku ?? '');
  const batches = useQuery({ queryKey: ['vouchers', 'batches', plan.sku], queryFn: () => api.getVoucherBatches(plan.sku) });
  const [q, setQ] = useState(''); const [status, setStatus] = useState('');
  const codes = useQuery({ queryKey: ['vouchers', 'codes', plan.sku, q, status], queryFn: () => api.getVoucherCodes({ sku: plan.sku, q: q.trim() || undefined, status: status || undefined }), enabled: tab === 'codes' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['vouchers'] }); };
  const batchOp = useMutation({ mutationFn: (v: Parameters<typeof api.voucherBatch>[0]) => api.voucherBatch(v), onSuccess: (r) => { setMsg(s.done(r.affected, r.kept_sold)); refresh(); }, onError: (e: any) => setMsg(e.message) });
  const codeOp = useMutation({ mutationFn: (v: { seq: number; a: 'void' | 'restore' | 'delete' }): Promise<unknown> => (v.a === 'void' ? api.voidVoucherCode(v.seq) : v.a === 'restore' ? api.restoreVoucherCode(v.seq) : api.deleteVoucherCode(v.seq)), onSuccess: () => { setMsg(''); refresh(); }, onError: (e: any) => setMsg(e.message) });
  const name = (b: string | null) => b ?? s.noBatch;
  const st = (x: string) => (x === 'available' ? s.stAvailable : x === 'sold' ? s.stSold : s.stVoid);
  return (
    <Modal open onClose={onClose} title={`${s.manage} — ${plan.sku}`} size="lg">
      <div className="space-y-3" data-testid="v-manage">
        <div className="flex gap-2">{(['batches', 'codes'] as const).map((k) => <button key={k} type="button" className={btn} style={tab === k ? solid : ghost} onClick={() => setTab(k)}>{k === 'batches' ? s.batches : s.codesTab}</button>)}</div>
        {msg && <p className="text-xs" role="status" style={muted}>{msg}</p>}
        {tab === 'batches' && (
          <ul className="space-y-2">
            {batches.data?.items.length === 0 && <li className="text-sm" style={muted}>{s.noCodes}</li>}
            {batches.data?.items.map((b) => {
              const unsold = b.available + b.void;
              return (
                <li key={String(b.batch)} className="p-2 space-y-2" style={{ border: '1px solid var(--border)' }} data-testid="v-batch">
                  <div className="text-sm" style={{ color: 'var(--text)' }}><b>{name(b.batch)}</b> <span style={muted}>· {b.available} {s.avail} · {b.sold} {s.soldN} · {b.void} {s.voidN}</span></div>
                  {canWrite && <div className="flex flex-wrap gap-2 items-center">
                    <button className={btn} style={ghost} disabled={b.available === 0} onClick={() => { if (confirm(s.confirmVoid(b.available))) batchOp.mutate({ sku: plan.sku, batch: b.batch, action: 'void' }); }}>{s.voidAct}</button>
                    <button className={btn} style={ghost} disabled={b.void === 0} onClick={() => batchOp.mutate({ sku: plan.sku, batch: b.batch, action: 'restore' })}>{s.restoreAct}</button>
                    <button className={btn} style={ghost} disabled={unsold === 0} onClick={() => { if (confirm(s.confirmDelete(unsold))) batchOp.mutate({ sku: plan.sku, batch: b.batch, action: 'delete' }); }}>{s.deleteAct}</button>
                    <button className={btn} style={ghost} onClick={() => { const n = window.prompt(s.renamePrompt, b.batch ?? ''); if (n !== null) batchOp.mutate({ sku: plan.sku, batch: b.batch, action: 'rename', new_name: n }); }}>{s.renameAct}</button>
                    {others.length > 0 && <span className="flex items-center gap-1"><select className="px-2 py-2 text-sm rounded-lg" style={inputStyle} value={dest} onChange={(e) => setDest(e.target.value)} aria-label={s.moveTo}>{others.map((p) => <option key={p.sku} value={p.sku}>{p.product_title}{p.variant_title && p.variant_title !== 'Default' ? ` — ${p.variant_title}` : ''}</option>)}</select>
                      <button className={btn} style={ghost} disabled={unsold === 0 || !dest} onClick={() => { if (confirm(s.confirmMove(unsold, dest))) batchOp.mutate({ sku: plan.sku, batch: b.batch, action: 'move', to_sku: dest }); }}>{s.moveAct}</button></span>}
                  </div>}
                </li>);
            })}
          </ul>)}
        {tab === 'codes' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2"><input className={inputCls} style={{ ...inputStyle, flex: '2 1 160px' }} placeholder={s.search} value={q} onChange={(e) => setQ(e.target.value)} />
              <select className={inputCls} style={{ ...inputStyle, flex: '1 1 120px' }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{s.allStatus}</option><option value="available">{s.stAvailable}</option><option value="sold">{s.stSold}</option><option value="void">{s.stVoid}</option></select></div>
            {codes.data?.items.length === 0 && <p className="text-sm" style={muted}>{s.noCodes}</p>}
            <ul className="space-y-1">
              {codes.data?.items.map((c) => (
                <li key={c.seq} className="flex flex-wrap items-center justify-between gap-2 text-sm py-1" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }} data-testid="v-code">
                  <span><code>{c.username}{c.password && c.password !== c.username ? ` / ${c.password}` : ''}</code> <span style={muted}>· {st(c.status)}{c.batch ? ` · ${c.batch}` : ''}{c.order_number ? ` · ${s.usedBy} ${c.order_number}` : ''}</span></span>
                  {canWrite && <span className="flex gap-1">
                    {c.status !== 'void' && <button className={btn} style={ghost} onClick={() => { if (c.status !== 'sold' || confirm(s.confirmVoidSold)) codeOp.mutate({ seq: c.seq, a: 'void' }); }}>{s.withdraw}</button>}
                    {c.status === 'void' && !c.order_number && <button className={btn} style={ghost} onClick={() => codeOp.mutate({ seq: c.seq, a: 'restore' })}>{s.back}</button>}
                    {!c.order_number && c.status !== 'sold' && <button className={btn} style={ghost} onClick={() => { if (confirm(s.confirmDelOne)) codeOp.mutate({ seq: c.seq, a: 'delete' }); }}>{s.del}</button>}
                  </span>}
                </li>))}
            </ul>
          </div>)}
      </div>
    </Modal>
  );
}
