import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Circle, AlertTriangle } from 'lucide-react';
import { api, type LaunchCheck, type LaunchManual } from '../lib/api';
import { useLocale } from '../lib/locale-context';

// Self-contained strings (this card does not touch the core translation file).
type Txt = { label: string; hint?: string };
const AUTO: Record<string, { fr: Txt; en: Txt }> = {
  products: { fr: { label: 'Au moins un produit actif', hint: 'Publiez vos produits (statut « actif »).' }, en: { label: 'At least one active product', hint: 'Publish your products (status “active”).' } },
  images_missing: { fr: { label: 'Chaque produit a une photo', hint: 'Sans photo, la boutique paraît vide et inspire moins confiance.' }, en: { label: 'Every product has a photo', hint: 'Without a photo the shop looks empty and earns less trust.' } },
  images_placeholder: { fr: { label: 'Plus d’images provisoires (Unsplash, placeholders)', hint: 'Remplacez-les par les vraies photos du client.' }, en: { label: 'No placeholder images left (Unsplash, placeholders)', hint: 'Replace them with the client’s real photos.' } },
  price_zero: { fr: { label: 'Aucun produit à prix 0', hint: 'Un prix oublié = un produit offert.' }, en: { label: 'No product priced at 0', hint: 'A forgotten price means a free product.' } },
  description_missing: { fr: { label: 'Chaque produit a une description', hint: 'Recommandé : une description rassure et aide le référencement.' }, en: { label: 'Every product has a description', hint: 'Recommended: it reassures buyers and helps search.' } },
  weight_missing: { fr: { label: 'Les produits physiques ont un poids', hint: 'Sans poids, le poids par défaut est utilisé pour les frais de livraison.' }, en: { label: 'Physical products have a weight', hint: 'Without one, the default weight is used for shipping costs.' } },
  stock_zero: { fr: { label: 'Les produits physiques sont en stock', hint: 'Un produit à 0 s’affiche « rupture de stock ».' }, en: { label: 'Physical products are in stock', hint: 'A product at 0 shows as out of stock.' } },
  shipping: { fr: { label: 'Livraison activée avec au moins une zone et un tarif', hint: 'Admin → Livraison.' }, en: { label: 'Shipping on, with at least one zone and one rate', hint: 'Admin → Shipping.' } },
  payments: { fr: { label: 'Chaque devise en vente a un moyen de paiement connecté', hint: 'XOF/GNF → FedaPay ; EUR/USD/GBP/CAD → Stripe.' }, en: { label: 'Every currency on sale has a connected payment provider', hint: 'XOF/GNF → FedaPay; EUR/USD/GBP/CAD → Stripe.' } },
  store_name: { fr: { label: 'Nom de la boutique défini (STORE_NAME)', hint: 'Il apparaît dans les e-mails.' }, en: { label: 'Shop name set (STORE_NAME)', hint: 'It appears in e-mails.' } },
  store_url: { fr: { label: 'Adresse de la boutique en HTTPS (STORE_URL)', hint: 'Utilisée dans les liens des e-mails.' }, en: { label: 'Shop address on HTTPS (STORE_URL)', hint: 'Used in e-mail links.' } },
  email: { fr: { label: 'E-mail configuré', hint: 'Confirmations de commande, liens de connexion.' }, en: { label: 'E-mail set up', hint: 'Order confirmations, sign-in links.' } },
  backup_recent: { fr: { label: 'Sauvegarde de moins de 36 h', hint: 'Bucket BACKUPS relié ; la sauvegarde part la nuit (02:00 UTC), ou lancez-la dans « Sauvegardes ».' }, en: { label: 'Backup less than 36 h old', hint: 'BACKUPS bucket bound; it runs nightly (02:00 UTC), or run it from “Backups”.' } },
  push_device: { fr: { label: 'Un téléphone reçoit les notifications de commande', hint: 'Recommandé : Cet appareil → activer les notifications.' }, en: { label: 'A phone receives order notifications', hint: 'Recommended: This device → turn on notifications.' } },
};
const MANUAL: Record<string, { fr: Txt; en: Txt }> = {
  pay_live_fedapay: { fr: { label: 'Un vrai paiement FedaPay réussi (petit montant, clés live)', hint: 'Payez vous-même une commande de quelques centaines de F, vérifiez qu’elle passe « payée » et que l’e-mail arrive.' }, en: { label: 'One real FedaPay payment succeeded (small amount, live keys)', hint: 'Pay a few-hundred-franc order yourself; check it turns “paid” and the e-mail arrives.' } },
  pay_test_stripe: { fr: { label: 'Stripe testé en mode test (seulement si vous vendez en EUR/USD)', hint: 'Carte 4242 4242 4242 4242. Stripe ne gère pas le XOF.' }, en: { label: 'Stripe tested in test mode (only if you sell in EUR/USD)', hint: 'Card 4242 4242 4242 4242. Stripe does not handle XOF.' } },
  pay_cod: { fr: { label: 'Une commande à la livraison créée puis marquée payée', hint: '' }, en: { label: 'A cash-on-delivery order created, then marked paid', hint: '' } },
  mail_dns: { fr: { label: 'SPF, DKIM (et DMARC) configurés pour le domaine d’envoi', hint: 'Sans eux, les e-mails de commande finissent en spam. Votre fournisseur d’e-mail indique les enregistrements DNS à ajouter.' }, en: { label: 'SPF, DKIM (and DMARC) set up for the sending domain', hint: 'Without them order e-mails land in spam. Your e-mail provider lists the DNS records to add.' } },
  mail_receive: { fr: { label: 'E-mail de commande reçu en boîte de réception (Gmail et Outlook/Yahoo)', hint: 'Pas dans les spams.' }, en: { label: 'Order e-mail received in the inbox (Gmail and Outlook/Yahoo)', hint: 'Not in spam.' } },
  phone_test: { fr: { label: 'Parcours complet testé sur un vrai téléphone en données mobiles', hint: 'Boutique, panier, paiement, confirmation. Vérifiez aussi un téléphone modeste.' }, en: { label: 'Full journey tested on a real phone on mobile data', hint: 'Shop, cart, payment, confirmation. Try a modest phone too.' } },
  backup_private: { fr: { label: 'Le bucket BACKUPS n’a aucun accès public ni domaine personnalisé', hint: 'Cloudflare → R2 → BACKUPS → Settings : « Public access » désactivé.' }, en: { label: 'The BACKUPS bucket has no public access and no custom domain', hint: 'Cloudflare → R2 → BACKUPS → Settings: “Public access” off.' } },
  backup_restore: { fr: { label: 'Une sauvegarde restaurée une fois sur un déploiement de test', hint: 'Une sauvegarde jamais restaurée est une hypothèse.' }, en: { label: 'A backup restored once on a scratch deployment', hint: 'A backup never restored is an assumption.' } },
  legal_review: { fr: { label: 'CGV, confidentialité, remboursement, FAQ et À propos relues par le client', hint: 'Les textes rédigés sont des brouillons : le client en est responsable.' }, en: { label: 'Terms, privacy, refund policy, FAQ and About read by the client', hint: 'The drafted texts are drafts: the client is responsible for them.' } },
  real_rates: { fr: { label: 'Vrais tarifs de livraison saisis (pas des estimations)', hint: 'À obtenir du client / du coursier.' }, en: { label: 'Real shipping rates entered (not estimates)', hint: 'To get from the client / the courier.' } },
  domain_https: { fr: { label: 'Domaine définitif en HTTPS ; PASSKEY_RP_ID, STORE_ORIGINS, ADMIN_ORIGINS à jour', hint: 'Les passkeys sont liées au domaine : changez-le avant, pas après.' }, en: { label: 'Final domain on HTTPS; PASSKEY_RP_ID, STORE_ORIGINS, ADMIN_ORIGINS updated', hint: 'Passkeys are tied to the domain: change it before launch, not after.' } },
  push_phone: { fr: { label: 'Admin installé sur le téléphone du propriétaire, notification de test reçue', hint: '' }, en: { label: 'Admin installed on the owner’s phone, test notification received', hint: '' } },
  demo_removed: { fr: { label: 'Anciennes pages démo supprimées ; sitemap et robots vérifiés', hint: '' }, en: { label: 'Old demo pages removed; sitemap and robots checked', hint: '' } },
  team_roles: { fr: { label: 'Comptes du personnel créés avec les bons rôles', hint: '' }, en: { label: 'Staff accounts created with the right roles', hint: '' } },
};
const UI = {
  fr: { title: 'Prêt pour le lancement ?', help: 'Vérifications automatiques sur vos vrais produits et réglages, puis ce que seule une personne peut contrôler.', auto: 'Vérifié automatiquement', manual: 'À vérifier par vous', must: 'indispensable', ready: 'Tout l’indispensable est au vert.', notReady: (n: number) => `Encore ${n} point(s) indispensable(s).`, by: 'par', on: 'le', e: 'ex.', refresh: 'Revérifier', backupNone: 'Aucune sauvegarde pour le moment.', backupOld: 'La dernière sauvegarde date de plus de 36 h.', backupNoBucket: 'Aucun bucket BACKUPS relié.' },
  en: { title: 'Ready to launch?', help: 'Automatic checks on your real products and settings, then what only a person can verify.', auto: 'Checked automatically', manual: 'For you to verify', must: 'required', ready: 'Everything required is green.', notReady: (n: number) => `${n} required item(s) to go.`, by: 'by', on: 'on', e: 'e.g.', refresh: 'Check again', backupNone: 'No backup yet.', backupOld: 'The latest backup is over 36 h old.', backupNoBucket: 'No BACKUPS bucket bound.' },
};
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)' };

export function LaunchCard() {
  const { locale } = useLocale(); const lang = locale === 'en' ? 'en' : 'fr'; const u = UI[lang];
  const qc = useQueryClient(); const [open, setOpen] = useState(false);
  const { data, refetch, isFetching } = useQuery({ queryKey: ['launch'], queryFn: () => api.getLaunch() });
  const tick = useMutation({ mutationFn: (a: { id: string; done: boolean }) => api.tickLaunch(a.id, a.done), onSuccess: () => qc.invalidateQueries({ queryKey: ['launch'] }) });
  if (!data) return null;
  const todo = data.checks.filter((c) => c.must && !c.ok).length + data.manual.filter((m) => m.must && !m.done).length;
  const detail = (c: LaunchCheck) => {
    if (c.id === 'backup_recent') return c.sample?.[0] === 'no-bucket' ? u.backupNoBucket : c.sample?.[0] === 'old' ? u.backupOld : u.backupNone;
    return c.count && c.sample?.length ? `${c.count} — ${u.e} ${c.sample.join(', ')}` : c.count && c.count > 1 ? String(c.count) : '';
  };
  const Icon = ({ ok }: { ok: boolean }) => ok ? <CircleCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} /> : <Circle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />;
  const row = (c: LaunchCheck) => { const t = AUTO[c.id]?.[lang]; if (!t) return null; return (
    <li key={c.id} className="flex items-start gap-2 text-sm" data-testid={`launch-${c.id}`}>
      <Icon ok={c.ok} />
      <span style={{ color: c.ok ? 'var(--text-secondary)' : 'var(--text)' }}>
        {t.label}{c.must && !c.ok && <em className="ml-2 text-xs not-italic" style={{ color: '#b42318' }}>{u.must}</em>}
        {!c.ok && <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{[detail(c), t.hint].filter(Boolean).join(' · ')}</span>}
      </span>
    </li>); };
  const mrow = (m: LaunchManual) => { const t = MANUAL[m.id]?.[lang]; if (!t) return null; return (
    <li key={m.id} className="text-sm" data-testid={`launch-m-${m.id}`}>
      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" className="mt-1" checked={m.done} disabled={tick.isPending} onChange={(e) => tick.mutate({ id: m.id, done: e.target.checked })} />
        <span style={{ color: m.done ? 'var(--text-secondary)' : 'var(--text)' }}>
          {t.label}{m.must && !m.done && <em className="ml-2 text-xs not-italic" style={{ color: '#b42318' }}>{u.must}</em>}
          {t.hint && !m.done && <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{t.hint}</span>}
          {m.done && m.at && <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{u.by} {m.by} {u.on} {new Date(m.at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR')}</span>}
        </span>
      </label>
    </li>); };
  return (
    <section className="p-5" style={card} data-testid="launch-card">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold flex-1" style={{ color: 'var(--text)' }}>{u.title}</h2>
        <button className="text-xs underline" style={{ color: 'var(--text-secondary)' }} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? '−' : '+'}</button>
      </div>
      <p className="text-xs mt-1 mb-2" style={{ color: 'var(--text-muted)' }}>{u.help}</p>
      <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: data.ready ? 'var(--accent)' : '#b42318' }} data-testid="launch-summary">
        {!data.ready && <AlertTriangle className="w-4 h-4" />}{data.ready ? u.ready : u.notReady(todo)}
      </p>
      {(open || !data.ready) && (
        <div className="mt-3 space-y-4">
          <div><h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>{u.auto}</h3><ul className="space-y-1.5">{data.checks.map(row)}</ul></div>
          <div><h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>{u.manual}</h3><ul className="space-y-2">{data.manual.map(mrow)}</ul></div>
          <button className="text-xs px-2 py-1 rounded-sm" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }} disabled={isFetching} onClick={() => refetch()}>{u.refresh}</button>
        </div>
      )}
    </section>
  );
}
